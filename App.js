import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { supabase } from './supabaseClient';
import { 
  getMaxCardsPerPlayer, 
  getRoundCardsCount, 
  getTotalRounds,
  dealRound, 
  sortHand,
  calculateForbiddenBid,
  calculateRoundScore,
  getNextSeat,
  isFinalBidder,
  isValidPlay,
  resolveTrickWinner
} from './src/core/gameEngine';

// Session persistence helpers
const saveSession = (key, val) => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    if (val) window.sessionStorage.setItem(key, JSON.stringify(val));
    else window.sessionStorage.removeItem(key);
  }
};

const getSession = (key) => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }
  return null;
};

export default function App() {
  // Session & User State
  const [userId, setUserId] = useState(null);
  const [nickname, setNickname] = useState('');
  const [userRole, setUserRole] = useState(null); // 'host' | 'guest'
  
  // Host Password Verification
  const [hostAuthPassword, setHostAuthPassword] = useState('');
  const [isHostAuthenticated, setIsHostAuthenticated] = useState(false);

  // Quick Room Setup Controls (Host)
  const [roomNum, setRoomNum] = useState('');
  const [roomPasscode, setRoomPasscode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roundMode, setRoundMode] = useState('mountain');

  // Invitee Join Form State (Guest)
  const [joinRoomNum, setJoinRoomNum] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');

  // Active Game & Lobby State
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState('');
  const [roundCountdown, setRoundCountdown] = useState(null);

  // Channel reference
  const channelRef = useRef(null);

  // 1. Initialize Anonymous Session & Prioritize Deep-Link URL Over Stale Sessions
  useEffect(() => {
    async function initSession() {
      try {
        let { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          user = data?.user;
        }
        if (user) {
          setUserId(user.id);

          const params = typeof window !== 'undefined' && window.location?.search 
            ? new URLSearchParams(window.location.search) 
            : null;
          const urlRoomId = params ? params.get('room') : null;
          const savedSession = getSession('active_game_session');

          if (urlRoomId && savedSession && savedSession.roomId !== urlRoomId) {
            saveSession('active_game_session', null);
            setJoinRoomNum(urlRoomId);
            setUserRole('guest');
            setCurrentRoom(null);
            return;
          }

          if (urlRoomId && !savedSession) {
            setJoinRoomNum(urlRoomId);
            setUserRole('guest');
            return;
          }

          if (savedSession && savedSession.roomId) {
            const { data: room, error: roomErr } = await supabase
              .from('rooms')
              .select('*')
              .eq('id', savedSession.roomId)
              .single();

            if (!roomErr && room && (room.status === 'lobby' || room.status === 'playing')) {
              setNickname(savedSession.nickname || '');
              setUserRole(savedSession.role || 'guest');
              setCurrentRoom(room);
            } else {
              saveSession('active_game_session', null);
            }
          }
        }
      } catch (err) {
        setErrorLog(`Session initialization failed: ${err.message}`);
      }
    }
    initSession();
  }, []);

  // Warn host before closing the browser tab/window in lobby
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (currentRoom && currentRoom.host_id === userId && currentRoom.status === 'lobby') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [currentRoom?.id, currentRoom?.status, userId]);

  // 2. Realtime Presence Channel for Lobby Seating & Table Sync
  useEffect(() => {
    if (!currentRoom?.id || !userId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`presence_room_${currentRoom.id}`, {
      config: {
        presence: { key: userId },
      },
    });

    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      // Freeze seating roster once match is active to prevent mid-game seat shifting
      if (currentRoom?.status && currentRoom.status !== 'lobby') return;

      const state = channel.presenceState();
      const activeList = [];
      Object.entries(state).forEach(([_, presences]) => {
        if (presences && presences.length > 0) {
          activeList.push(presences[0]);
        }
      });

      activeList.sort((a, b) => {
        if (a.is_host && !b.is_host) return -1;
        if (!a.is_host && b.is_host) return 1;
        return (a.joined_at || 0) - (b.joined_at || 0);
      });

      const mappedSeats = activeList.map((p, idx) => ({
        user_id: p.user_id,
        nickname: p.nickname,
        seat_number: idx + 1,
        is_host: p.is_host
      }));

      setPlayers(mappedSeats);
    });

    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${currentRoom.id}`
    }, (payload) => {
      if (payload.new) {
        setCurrentRoom(payload.new);
      }
    });

    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${currentRoom.id}`
    }, () => {
      alert('The table was closed by the host.');
      saveSession('active_game_session', null);
      setCurrentRoom(null);
      setUserRole(null);
      setPlayers([]);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          nickname: nickname || 'Player',
          is_host: currentRoom.host_id === userId,
          joined_at: Date.now()
        });
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentRoom?.id, userId]);

  // 3. Automated Round Transition Countdown (Configurable: 5-15s or Manual)
  useEffect(() => {
    if (currentRoom?.game_state?.phase !== 'scoring') {
      setRoundCountdown(null);
      return;
    }

    const config = currentRoom.game_state.config || { requireManualNextRound: false, nextRoundDelaySeconds: 5 };
    if (config.requireManualNextRound) {
      setRoundCountdown(null);
      return;
    }

    let seconds = Math.min(Math.max(config.nextRoundDelaySeconds || 5, 1), 15);
    setRoundCountdown(seconds);

    const timer = setInterval(() => {
      seconds -= 1;
      setRoundCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(timer);
        if (currentRoom.host_id === userId) {
          handleNextRound();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentRoom?.game_state?.phase, currentRoom?.game_state?.roundNumber]);

  // 4. Host Authentication Handler ("funfam123999")
  const handleHostAuth = async () => {
    if (!hostAuthPassword.trim()) return;
    setLoading(true);
    setErrorLog('');
    try {
      const { data: isValid, error } = await supabase.rpc('verify_host_password', { 
        p_password: hostAuthPassword.trim() 
      });
      if (error) throw error;

      if (isValid) {
        setIsHostAuthenticated(true);
        setUserRole('host');
      } else {
        setErrorLog('Incorrect Host Password.');
      }
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Host Creates Game Table
  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setErrorLog('Please enter your host nickname.');
      return;
    }
    if (roomNum.length !== 3 || isNaN(roomNum)) {
      setErrorLog('Room ID must be exactly 3 numeric digits (e.g. 123).');
      return;
    }
    if (roomPasscode.length !== 4 || isNaN(roomPasscode)) {
      setErrorLog('Passcode must be exactly 4 numeric digits (e.g. 4321).');
      return;
    }

    setLoading(true);
    setErrorLog('');
    try {
      const { data: room, error } = await supabase.rpc('create_quick_room', {
        p_host_id: userId,
        p_nickname: nickname.trim(),
        p_room_num: roomNum,
        p_passcode: roomPasscode,
        p_max_players: parseInt(maxPlayers, 10),
        p_round_mode: roundMode
      });

      if (error) throw error;

      saveSession('active_game_session', {
        roomId: room.id,
        nickname: nickname.trim(),
        role: 'host'
      });

      setCurrentRoom(room);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. Invitee Joins Game Table
  const handleJoinRoom = async () => {
    if (!nickname.trim()) {
      setErrorLog('Please enter your nickname.');
      return;
    }
    if (!joinRoomNum.trim() || !joinPasscode.trim()) {
      setErrorLog('Please enter both Room Number and Passcode.');
      return;
    }

    setLoading(true);
    setErrorLog('');
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', joinRoomNum.trim())
        .single();

      if (roomError || !room) {
        throw new Error(`Room ${joinRoomNum.trim()} does not exist.`);
      }

      if (room.status !== 'lobby') {
        throw new Error('This game table has already started or is closed.');
      }

      if (room.passcode !== joinPasscode.trim()) {
        throw new Error('Incorrect table passcode.');
      }

      await supabase.from('profiles').upsert({ id: userId, nickname: nickname.trim() });

      saveSession('active_game_session', {
        roomId: room.id,
        nickname: nickname.trim(),
        role: 'guest'
      });

      setUserRole('guest');
      setCurrentRoom(room);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 7. Leave Table Handler
  const handleLeaveTable = async () => {
    const isHost = currentRoom && currentRoom.host_id === userId;

    if (isHost && currentRoom.status === 'lobby') {
      const confirmed = window.confirm(
        'Warning: Leaving will close this table and remove all waiting players from the lobby. Are you sure you want to close the game?'
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      saveSession('active_game_session', null);

      if (isHost && currentRoom.status === 'lobby') {
        await supabase.from('rooms').delete().eq('id', currentRoom.id);
      }

      if (channelRef.current) {
        await channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setCurrentRoom(null);
      setUserRole(null);
      setPlayers([]);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 8. Share Link Generator
  const copyInviteLink = () => {
    const inviteUrl = `${window.location?.origin || 'http://localhost:8081'}/?room=${currentRoom.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
      alert(`Invite link copied to clipboard:\n${inviteUrl}`);
    } else {
      Alert.alert('Invite Link', inviteUrl);
    }
  };

// 9. Host Action: Start Game Session (Randomize Round 1 Lead)
  const handleStartGame = async () => {
    if (players.length < currentRoom.max_players) return;
    setLoading(true);
    setErrorLog('');
    try {
      const effectiveMode = (currentRoom.round_mode || 'mountain').toLowerCase();
      const maxCards = getMaxCardsPerPlayer(players);
      const totalRounds = getTotalRounds(effectiveMode, maxCards);
      const cardsDealt = getRoundCardsCount(effectiveMode, 1, maxCards);
      const dealResult = dealRound(players, cardsDealt);

      const handsByUserId = {};
      players.forEach((p, idx) => {
        handsByUserId[p.user_id] = dealResult.hands[idx];
      });

      // Randomized die roll for Round 1 opening lead
      const randomInitiativeSeat = Math.floor(Math.random() * players.length) + 1;

      const initialGameState = {
        roundNumber: 1,
        totalRounds,
        mode: effectiveMode,
        cardsDealt,
        maxCards,
        players: players,
        initiativeSeat: randomInitiativeSeat,
        activeSeat: randomInitiativeSeat,
        trumpCard: dealResult.trumpCard,
        isNoTrump: dealResult.isNoTrump,
        hands: handsByUserId,
        bids: {},
        trick: [],
        tricksWon: {},
        lastTrickResult: null,
        roundScores: {},
        cumulativeScores: {},
        phase: 'bidding',
        config: {
          requireManualNextRound: false,
          nextRoundDelaySeconds: 5
        }
      };

      const playerRows = players.map(p => ({
        room_id: currentRoom.id,
        user_id: p.user_id,
        seat_number: p.seat_number,
        status: 'active'
      }));

      await supabase.from('room_players').delete().eq('room_id', currentRoom.id);
      const { error: insertErr } = await supabase.from('room_players').insert(playerRows);
      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from('rooms')
        .update({ status: 'playing', game_state: initialGameState })
        .eq('id', currentRoom.id);

      if (updateErr) throw updateErr;
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 10. Bidding Submission
  const handlePlaceBid = async (bidValue) => {
    if (!currentRoom?.game_state) return;
    const gs = currentRoom.game_state;
    const mySeat = (gs.players || players).find(p => p.user_id === userId)?.seat_number;
    if (gs.phase !== 'bidding' || gs.activeSeat !== mySeat) return;

    setLoading(true);
    setErrorLog('');
    try {
      const committedBids = Object.values(gs.bids || {});
      const isFinal = isFinalBidder(gs.players.length, committedBids.length);
      const forbidden = isFinal ? calculateForbiddenBid(gs.cardsDealt, committedBids) : -1;

      if (isFinal && bidValue === forbidden) {
        throw new Error(`Forbidden Bid! Total bids cannot equal ${gs.cardsDealt} cards.`);
      }

      const updatedBids = { ...(gs.bids || {}), [userId]: bidValue };
      const allBidsSubmitted = Object.keys(updatedBids).length === gs.players.length;

      let nextPhase = 'bidding';
      let nextActiveSeat = getNextSeat(gs.activeSeat, gs.players.length);

      if (allBidsSubmitted) {
        nextPhase = 'trick';
        nextActiveSeat = gs.initiativeSeat; // First bidder leads the opening trick
      }

      const updatedGameState = {
        ...gs,
        bids: updatedBids,
        activeSeat: nextActiveSeat,
        phase: nextPhase
      };

      const { error: updateErr } = await supabase
        .from('rooms')
        .update({ game_state: updatedGameState })
        .eq('id', currentRoom.id);

      if (updateErr) throw updateErr;
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 11. Play Card & Resolve Trick / Scoring
  const handlePlayCard = async (cardIndex, playedCard) => {
    if (!currentRoom?.game_state) return;
    const gs = currentRoom.game_state;
    const mySeat = (gs.players || players).find(p => p.user_id === userId)?.seat_number;
    if (gs.phase !== 'trick' || gs.activeSeat !== mySeat) return;

    setLoading(true);
    setErrorLog('');
    try {
      const myHand = gs.hands[userId];
      const currentTrick = gs.trick || [];
      const leadCard = currentTrick.length > 0 ? currentTrick[0].card : null;

      if (!isValidPlay(myHand, playedCard, leadCard)) {
        throw new Error(`Invalid Play: You must follow the lead suit (${leadCard.suit})!`);
      }

      const updatedHand = myHand.filter((_, idx) => idx !== cardIndex);
      const updatedHands = { ...gs.hands, [userId]: updatedHand };
      const updatedTrick = [...currentTrick, { user_id: userId, card: playedCard }];
      
      let nextPhase = 'trick';
      let nextActiveSeat = getNextSeat(gs.activeSeat, gs.players.length);
      let updatedTricksWon = { ...(gs.tricksWon || {}) };
      let lastTrickResult = gs.lastTrickResult || null;
      let roundScores = gs.roundScores || {};
      let cumulativeScores = { ...(gs.cumulativeScores || {}) };

      if (updatedTrick.length === gs.players.length) {
        const winnerId = resolveTrickWinner(updatedTrick, gs.isNoTrump ? null : gs.trumpCard);
        const winnerSeat = gs.players.find(p => p.user_id === winnerId)?.seat_number;
        
        updatedTricksWon[winnerId] = (updatedTricksWon[winnerId] || 0) + 1;
        nextActiveSeat = winnerSeat;
        lastTrickResult = { winnerId, winnerSeat, cards: updatedTrick };

        const isRoundOver = gs.players.every(p => !updatedHands[p.user_id] || updatedHands[p.user_id].length === 0);
        if (isRoundOver) {
          nextPhase = 'scoring';
          roundScores = {};
          gs.players.forEach(p => {
            const bid = gs.bids?.[p.user_id] ?? 0;
            const won = updatedTricksWon[p.user_id] ?? 0;
            const pts = calculateRoundScore(bid, won);
            roundScores[p.user_id] = pts;
            cumulativeScores[p.user_id] = (cumulativeScores[p.user_id] || 0) + pts;
          });
        }
      }

      const updatedGameState = {
        ...gs,
        hands: updatedHands,
        trick: updatedTrick.length === gs.players.length ? [] : updatedTrick,
        lastTrickResult,
        activeSeat: nextActiveSeat,
        tricksWon: updatedTricksWon,
        roundScores,
        cumulativeScores,
        phase: nextPhase,
      };

      const { error: updateErr } = await supabase
        .from('rooms')
        .update({ game_state: updatedGameState })
        .eq('id', currentRoom.id);

      if (updateErr) throw updateErr;
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 12. Next Round Progression (Auto/Manual Handler)
  const handleNextRound = async () => {
    if (!currentRoom?.game_state || currentRoom.host_id !== userId) return;
    const gs = currentRoom.game_state;
    if (gs.phase !== 'scoring') return;

    setLoading(true);
    setErrorLog('');
    try {
      const nextRoundNum = gs.roundNumber + 1;
      const effectiveMode = (gs.mode || currentRoom.round_mode || 'mountain').toLowerCase();
      const effectiveMaxCards = gs.maxCards || getMaxCardsPerPlayer(gs.players.length);
      const nextCardsCount = getRoundCardsCount(effectiveMode, nextRoundNum, effectiveMaxCards);
      const nextInitiativeSeat = gs.lastTrickResult?.winnerSeat || gs.initiativeSeat || 1;

      const dealResult = dealRound(gs.players.length, nextCardsCount);

      const nextHands = {};
      gs.players.forEach((p, idx) => {
        nextHands[p.user_id] = dealResult.hands[idx];
      });

      const nextGameState = {
        ...gs,
        roundNumber: nextRoundNum,
        cardsDealt: nextCardsCount,
        maxCards: effectiveMaxCards,
        mode: effectiveMode,
        initiativeSeat: nextInitiativeSeat,
        activeSeat: nextInitiativeSeat,
        trumpCard: dealResult.trumpCard,
        isNoTrump: dealResult.isNoTrump,
        hands: nextHands,
        bids: {},
        trick: [],
        tricksWon: {},
        lastTrickResult: null,
        roundScores: {},
        phase: 'bidding',
        config: gs.config || { requireManualNextRound: false, nextRoundDelaySeconds: 5 }
      };

      setCurrentRoom(prev => ({ ...prev, game_state: nextGameState }));

      const { error: updateErr } = await supabase
        .from('rooms')
        .update({ game_state: nextGameState })
        .eq('id', currentRoom.id);

      if (updateErr) throw updateErr;
    } catch (err) {
      console.error('handleNextRound error:', err);
      setErrorLog(err.message);
      if (typeof window !== 'undefined') {
        window.alert('Error starting next round: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>German Bridge 🃏</Text>
      <Text style={styles.subtitle}>Private Invitation Game Desk</Text>

      {errorLog ? <Text style={styles.errorText}>⚠️ {errorLog}</Text> : null}
      {loading && <ActivityIndicator size="small" color="#60a5fa" style={{ marginBottom: 10 }} />}

      {/* ACCESS SCREEN */}
      {!userRole && !currentRoom && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Game Access</Text>
          <TouchableOpacity style={styles.button} onPress={() => setUserRole('guest')}>
            <Text style={styles.btnText}>Join Game as Invitee</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#10b981', marginTop: 12 }]} 
            onPress={() => setUserRole('host')}
          >
            <Text style={styles.btnText}>Host New Game Table</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* HOST CONFIGURATION */}
      {userRole === 'host' && !currentRoom && (
        <View style={styles.card}>
          {!isHostAuthenticated ? (
            <View>
              <Text style={styles.cardTitle}>Host Verification</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Host Master Password..."
                placeholderTextColor="#6b7280"
                secureTextEntry
                value={hostAuthPassword}
                onChangeText={setHostAuthPassword}
              />
              <TouchableOpacity style={styles.button} onPress={handleHostAuth}>
                <Text style={styles.btnText}>Authenticate Host</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setUserRole(null)}>
                <Text style={{ color: '#60a5fa' }}>← Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.cardTitle}>Table Settings</Text>
              
              <Text style={styles.label}>Host Nickname</Text>
              <TextInput
                style={styles.input}
                placeholder="Your Display Name"
                placeholderTextColor="#6b7280"
                value={nickname}
                onChangeText={setNickname}
              />

              <Text style={styles.label}>3-Digit Room ID (e.g. 123)</Text>
              <TextInput
                style={styles.input}
                placeholder="123"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
                maxLength={3}
                value={roomNum}
                onChangeText={setRoomNum}
              />

              <Text style={styles.label}>4-Digit Room Passcode (e.g. 4321)</Text>
              <TextInput
                style={styles.input}
                placeholder="4321"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
                maxLength={4}
                value={roomPasscode}
                onChangeText={setRoomPasscode}
              />

              <Text style={styles.label}>Total Players (3–8)</Text>
              <View style={styles.rowSelector}>
                {[3, 4, 5, 6, 7, 8].map(num => (
                  <TouchableOpacity 
                    key={num} 
                    style={[styles.chip, maxPlayers === num && styles.chipActive]}
                    onPress={() => setMaxPlayers(num)}
                  >
                    <Text style={styles.chipText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Game Sequence Mode</Text>
              <View style={styles.rowSelector}>
                {['valley', 'mountain', 'flatline'].map(mode => (
                  <TouchableOpacity 
                    key={mode} 
                    style={[styles.chip, roundMode === mode && styles.chipActive, { flex: 1 }]}
                    onPress={() => setRoundMode(mode)}
                  >
                    <Text style={styles.chipText}>{mode.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981', marginTop: 15 }]} onPress={handleCreateRoom}>
                <Text style={styles.btnText}>Create & Launch Table</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* GUEST JOIN */}
      {userRole === 'guest' && !currentRoom && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join Game Desk</Text>

          <Text style={styles.label}>Your Nickname</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name..."
            placeholderTextColor="#6b7280"
            value={nickname}
            onChangeText={setNickname}
          />

          <Text style={styles.label}>3-Digit Room ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 123"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            maxLength={3}
            value={joinRoomNum}
            onChangeText={setJoinRoomNum}
          />

          <Text style={styles.label}>4-Digit Table Passcode</Text>
          <TextInput
            style={styles.input}
            placeholder="Passcode from Host"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            value={joinPasscode}
            onChangeText={setJoinPasscode}
          />

          <TouchableOpacity style={styles.button} onPress={handleJoinRoom}>
            <Text style={styles.btnText}>Verify & Take Seat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setUserRole(null)}>
            <Text style={{ color: '#60a5fa' }}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LOBBY ROOM */}
      {currentRoom && currentRoom.status === 'lobby' && (
        <View style={styles.cardWide}>
          <Text style={styles.lobbyTitle}>Game Desk Number: <Text style={{ color: '#60a5fa' }}>{currentRoom.id}</Text></Text>
          <Text style={styles.subTitleText}>Mode: {currentRoom.round_mode?.toUpperCase()} • Seats Occupied: {players.length}/{currentRoom.max_players}</Text>

          <TouchableOpacity style={[styles.button, { backgroundColor: '#8b5cf6', marginBottom: 20 }]} onPress={copyInviteLink}>
            <Text style={styles.btnText}>🔗 Copy Invite Link for Friends</Text>
          </TouchableOpacity>

          <View style={styles.seatContainer}>
            {Array.from({ length: currentRoom.max_players }).map((_, idx) => {
              const seatNum = idx + 1;
              const occupied = players.find(p => p.seat_number === seatNum);
              const isHostSeat = occupied?.user_id === currentRoom.host_id;

              return (
                <View key={seatNum} style={[styles.seatBadge, occupied && { borderColor: '#10b981' }]}>
                  <Text style={styles.seatText}>
                    {occupied 
                      ? `🟢 Seat ${seatNum}: ${occupied.nickname || 'Player'}${isHostSeat ? ' (Host)' : ''}` 
                      : `🪑 Seat ${seatNum}: Vacant Position`}
                  </Text>
                </View>
              );
            })}
          </View>

          {currentRoom.host_id === userId ? (
            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  marginTop: 20, 
                  backgroundColor: players.length >= currentRoom.max_players ? '#10b981' : '#374151',
                  borderColor: players.length >= currentRoom.max_players ? '#34d399' : '#4b5563',
                  borderWidth: 1
                }
              ]} 
              disabled={players.length < currentRoom.max_players}
              onPress={handleStartGame}
            >
              <Text style={styles.btnText}>
                {players.length >= currentRoom.max_players 
                  ? '▶ Start Game Session' 
                  : `Waiting for Players (${players.length}/${currentRoom.max_players})...`}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.guestStatusBanner}>
              <Text style={styles.guestStatusText}>
                {players.length >= currentRoom.max_players 
                  ? '⌛ All players seated. Waiting for Host to start...' 
                  : `⌛ Waiting for remaining players (${players.length}/${currentRoom.max_players})...`}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={handleLeaveTable}>
            <Text style={styles.btnText}>Leave Table</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ACTIVE GAME TABLE */}
      {currentRoom && currentRoom.status === 'playing' && (
        <View style={styles.cardWide}>
          
          {/* Header & Trump Card */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>Desk #{currentRoom.id}</Text>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                Round {currentRoom.game_state?.roundNumber || 1} of {currentRoom.game_state?.totalRounds || 1} • {currentRoom.game_state?.cardsDealt || 1} Cards • {currentRoom.game_state?.mode?.toUpperCase()}
              </Text>
            </View>
            <View style={{ backgroundColor: '#0f172a', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#10b981' }}>
              <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 13 }}>
                {currentRoom.game_state?.isNoTrump 
                  ? 'TRUMP: NO TRUMP' 
                  : `TRUMP: ${currentRoom.game_state?.trumpCard?.suit === 'Spades' ? '♠' : currentRoom.game_state?.trumpCard?.suit === 'Hearts' ? '♥' : currentRoom.game_state?.trumpCard?.suit === 'Diamonds' ? '♦' : '♣'} ${currentRoom.game_state?.trumpCard?.rank} of ${currentRoom.game_state?.trumpCard?.suit}`}
              </Text>
            </View>
          </View>

          {/* Opponents HUD (Shows ⭐ Lead on Initiative Seat, Not Host) */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            {currentRoom.game_state?.players?.filter(p => p.user_id !== userId).map(p => {
              const isInitiative = p.seat_number === currentRoom.game_state?.initiativeSeat;
              return (
                <View key={p.user_id} style={{ backgroundColor: '#0f172a', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: isInitiative ? '#eab308' : '#334155', alignItems: 'center', minWidth: 95 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 12 }}>
                    {p.seat_number}. {p.nickname || 'Player'}{isInitiative ? ' ⭐' : ''}
                  </Text>
                  <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 3 }}>
                    🂠 {currentRoom.game_state?.hands?.[p.user_id]?.length || 0} Cards
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Center Arena */}
          <View style={styles.centerArena}>
            {currentRoom.game_state?.phase === 'bidding' ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={styles.centerArenaTitle}>
                  {currentRoom.game_state.activeSeat === (currentRoom.game_state.players?.find(p => p.user_id === userId)?.seat_number)
                    ? "👉 It's Your Turn to Bid!"
                    : `Waiting for Seat ${currentRoom.game_state.activeSeat} to Bid...`}
                </Text>

                {/* Display Current Bids */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 12, flexWrap: 'wrap' }}>
                  {currentRoom.game_state.players?.map((p) => {
                    const playerBid = currentRoom.game_state.bids?.[p.user_id];
                    const hasBid = playerBid !== undefined;
                    return (
                      <View key={p.user_id} style={{ alignItems: 'center', minWidth: 50, padding: 6, backgroundColor: '#1e293b', borderRadius: 6, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Seat {p.seat_number}</Text>
                        <Text style={{ color: hasBid ? '#10b981' : '#64748b', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                          {hasBid ? playerBid : '?'}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Bid Selection Chips */}
                {currentRoom.game_state.activeSeat === (currentRoom.game_state.players?.find(p => p.user_id === userId)?.seat_number) && (
                  <View style={{ width: '100%', alignItems: 'center', marginTop: 6 }}>
                    <Text style={styles.centerArenaSubText}>Select your bid for this round:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 10, justifyContent: 'center' }}>
                      {Array.from({ length: (currentRoom.game_state.cardsDealt || 1) + 1 }).map((_, bidValue) => {
                        const committedBids = Object.values(currentRoom.game_state.bids || {});
                        const isFinal = isFinalBidder(currentRoom.game_state.players.length, committedBids.length);
                        const forbiddenBid = isFinal ? calculateForbiddenBid(currentRoom.game_state.cardsDealt, committedBids) : -1;
                        const isForbidden = isFinal && bidValue === forbiddenBid;

                        return (
                          <TouchableOpacity
                            key={bidValue}
                            disabled={isForbidden}
                            style={[
                              styles.chip,
                              { backgroundColor: isForbidden ? '#4b5563' : '#2563eb', paddingHorizontal: 14, paddingVertical: 8, opacity: isForbidden ? 0.6 : 1 }
                            ]}
                            onPress={() => handlePlaceBid(bidValue)}
                          >
                            <Text style={styles.chipText}>
                              {bidValue}{isForbidden ? ' 🚫 (Hook)' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : currentRoom.game_state?.phase === 'trick' ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={styles.centerArenaTitle}>
                  {currentRoom.game_state.activeSeat === (currentRoom.game_state.players?.find(p => p.user_id === userId)?.seat_number)
                    ? "👉 It's Your Turn to Play!"
                    : `Waiting for Seat ${currentRoom.game_state.activeSeat} to Play...`}
                </Text>

                {/* Center Trick Arena Pool */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 15, minHeight: 80, alignItems: 'center' }}>
                  {(!currentRoom.game_state.trick || currentRoom.game_state.trick.length === 0) ? (
                    <Text style={{ color: '#64748b', fontStyle: 'italic' }}>
                      {currentRoom.game_state.lastTrickResult 
                        ? `Last trick won by Seat ${currentRoom.game_state.lastTrickResult.winnerSeat}. Lead the next trick!` 
                        : 'No cards played in this trick yet...'}
                    </Text>
                  ) : (
                    currentRoom.game_state.trick.map((play, idx) => {
                      const isRed = play.card.suit === 'Hearts' || play.card.suit === 'Diamonds';
                      const seatNum = currentRoom.game_state.players?.find(p => p.user_id === play.user_id)?.seat_number;
                      return (
                        <View key={idx} style={{ alignItems: 'center' }}>
                          <View style={[styles.cardPlaceholder, { width: 52, height: 74, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', borderRadius: 6 }]}>
                            <Text style={{ color: isRed ? '#ef4444' : '#111827', fontWeight: 'bold', fontSize: 16, position: 'absolute', top: 4, left: 6 }}>
                              {play.card.rank}
                            </Text>
                            <Text style={{ fontSize: 20 }}>
                              {play.card.suit === 'Spades' ? '♠️' : play.card.suit === 'Hearts' ? '♥️' : play.card.suit === 'Diamonds' ? '♦️' : '♣️'}
                            </Text>
                          </View>
                          <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                            Seat {seatNum}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            ) : (
              /* Phase 5 Scoring Screen with Countdown */
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 6 }}>
                <Text style={styles.centerArenaTitle}>🏆 Round {currentRoom.game_state.roundNumber} Complete</Text>
                {currentRoom.game_state?.lastTrickResult && (
                  <Text style={{ color: '#60a5fa', fontWeight: '700', fontSize: 13, marginBottom: 8 }}>
                    Final Trick Won by Seat {currentRoom.game_state.lastTrickResult.winnerSeat} (Takes Round {currentRoom.game_state.roundNumber + 1} Lead)
                  </Text>
                )}

                {/* Scoreboard Table */}
                <View style={{ width: '95%', backgroundColor: '#0f172a', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#334155', marginVertical: 6 }}>
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1e293b', paddingBottom: 4, marginBottom: 4 }}>
                    <Text style={{ flex: 1.2, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>SEAT</Text>
                    <Text style={{ flex: 1, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>BID</Text>
                    <Text style={{ flex: 1, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>WON</Text>
                    <Text style={{ flex: 1.2, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>ROUND</Text>
                    <Text style={{ flex: 1.2, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>TOTAL</Text>
                  </View>
                  {currentRoom.game_state.players?.map(p => {
                    const bid = currentRoom.game_state.bids?.[p.user_id] ?? 0;
                    const won = currentRoom.game_state.tricksWon?.[p.user_id] ?? 0;
                    const pts = currentRoom.game_state.roundScores?.[p.user_id] ?? 0;
                    const total = currentRoom.game_state.cumulativeScores?.[p.user_id] ?? 0;
                    const isSuccess = bid === won;

                    return (
                      <View key={p.user_id} style={{ flexDirection: 'row', paddingVertical: 3 }}>
                        <Text style={{ flex: 1.2, color: '#f3f4f6', fontSize: 12, fontWeight: '600' }}>Seat {p.seat_number}</Text>
                        <Text style={{ flex: 1, color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>{bid}</Text>
                        <Text style={{ flex: 1, color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>{won}</Text>
                        <Text style={{ flex: 1.2, color: isSuccess ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: '700', textAlign: 'right' }}>
                          {pts >= 0 ? `+${pts}` : pts}
                        </Text>
                        <Text style={{ flex: 1.2, color: '#60a5fa', fontSize: 12, fontWeight: '800', textAlign: 'right' }}>
                          {total}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Round Progression: Configurable Countdown or Manual Button */}
                {currentRoom.game_state?.config?.requireManualNextRound ? (
                  currentRoom.host_id === userId ? (
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: '#10b981', marginTop: 10, paddingVertical: 10, paddingHorizontal: 22 }]}
                      onPress={handleNextRound}
                    >
                      <Text style={styles.btnText}>
                        ▶ Start Round {currentRoom.game_state.roundNumber + 1}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic', marginTop: 10 }}>
                      Waiting for Host to start Round {currentRoom.game_state.roundNumber + 1}...
                    </Text>
                  )
                ) : (
                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                    <Text style={{ color: '#38bdf8', fontSize: 14, fontWeight: '700' }}>
                      ⏱ Round {currentRoom.game_state.roundNumber + 1} starting in {roundCountdown !== null ? roundCountdown : 5}s...
                    </Text>
                    {currentRoom.host_id === userId && (
                      <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#2563eb', marginTop: 8, paddingVertical: 6, paddingHorizontal: 16 }]}
                        onPress={handleNextRound}
                      >
                        <Text style={[styles.btnText, { fontSize: 13 }]}>Deal Now ⏭</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Bottom HUD: Hand */}
          <View style={{ marginTop: 16 }}>
            {(() => {
              const mySeat = currentRoom.game_state?.players?.find(p => p.user_id === userId)?.seat_number;
              const isLead = mySeat === currentRoom.game_state?.initiativeSeat;
              return (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                    Your Hand (Seat {mySeat}{isLead ? ' ⭐ Lead' : ''})
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                    {currentRoom.game_state?.hands?.[userId]?.length || 0} Cards
                  </Text>
                </View>
              );
            })()}
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 5 }}>
              {currentRoom.game_state?.hands?.[userId]?.map((card, idx) => {
                const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';
                const isMyTurn = currentRoom.game_state.phase === 'trick' && 
                  currentRoom.game_state.activeSeat === (currentRoom.game_state.players?.find(p => p.user_id === userId)?.seat_number);

                return (
                  <TouchableOpacity
                    key={idx}
                    disabled={!isMyTurn}
                    onPress={() => handlePlayCard(idx, card)}
                    style={[
                      styles.cardPlaceholder,
                      { 
                        backgroundColor: '#ffffff', 
                        marginLeft: idx === 0 ? 0 : -30,
                        transform: [{ translateY: isMyTurn ? -6 : 0 }],
                        borderColor: isMyTurn ? '#3b82f6' : '#d1d5db',
                        borderWidth: isMyTurn ? 2 : 1,
                        opacity: isMyTurn ? 1 : 0.85
                      }
                    ]}
                  >
                    <Text style={{ color: isRed ? '#ef4444' : '#111827', fontWeight: 'bold', fontSize: 18, position: 'absolute', top: 6, left: 6 }}>
                      {card.rank}
                    </Text>
                    <Text style={{ fontSize: 24 }}>
                      {card.suit === 'Spades' ? '♠️' : card.suit === 'Hearts' ? '♥️' : card.suit === 'Diamonds' ? '♦️' : '♣️'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity style={[styles.cancelButton, { marginTop: 16 }]} onPress={handleLeaveTable}>
            <Text style={styles.btnText}>Exit Game Table</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#374151' },
  cardWide: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12, width: '100%', maxWidth: 640, borderWidth: 1, borderColor: '#374151' },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 16, textAlign: 'center' },
  lobbyTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  subTitleText: { color: '#9ca3af', textAlign: 'center', marginBottom: 16, fontSize: 14 },
  label: { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#4b5563', fontSize: 15 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  seatContainer: { gap: 10, marginVertical: 10 },
  seatBadge: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#374151' },
  seatText: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  errorText: { color: '#f87171', marginBottom: 15, fontWeight: '600', textAlign: 'center' },
  rowSelector: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chip: { backgroundColor: '#0f172a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#4b5563', alignItems: 'center' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#60a5fa' },
  chipText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  guestStatusBanner: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, marginTop: 20, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  guestStatusText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
  centerArena: { backgroundColor: '#0f172a', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginVertical: 10 },
  centerArenaTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  centerArenaSubText: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },
  cardPlaceholder: { width: 60, height: 85, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3 }
});