import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  useWindowDimensions
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
import { soundManager } from './src/utils/soundManager';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Session persistence helpers
const saveSession = (key, val) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (val) window.localStorage.setItem(key, JSON.stringify(val));
    else window.localStorage.removeItem(key);
  }
};

const getSession = (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    }
    return null;
  };

const getSuitColor = (suit) => {
  return (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
};

export default function App() {
  // Screen dimensions
  const { width: windowWidth } = useWindowDimensions();
  const [selectedBid, setSelectedBid] = useState(0);
  const bidWheelRef = useRef(null);

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

  // Scorecard Modal State
  const [showScoreModal, setShowScoreModal] = useState(false);
  
  // Sound state
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  // Card animation state
  const [animatingCardIdx, setAnimatingCardIdx] = useState(null);
  const flyAnimY = useRef(new Animated.Value(0)).current;
  const flyAnimScale = useRef(new Animated.Value(1)).current;
  
  // Card selection and trick hold state
  const [selectedCardIdx, setSelectedCardIdx] = useState(null);
  const [trickHold, setTrickHold] = useState(false);

  // Reset card animation state on round/hand change
  useEffect(() => {
    setSelectedCardIdx(null);
    // Fix for animation state not resetting when hand updates after playing a card
    if (animatingCardIdx !== null) {
      flyAnimY.setValue(0);
      flyAnimScale.setValue(1);
      setAnimatingCardIdx(null);
    }
  }, [currentRoom?.game_state?.roundNumber, currentRoom?.game_state?.hands?.[userId]?.length]);

  // Initialize bid wheel to legal starting bid when bidding phase begins
  useEffect(() => {
    if (currentRoom?.game_state?.phase === 'bidding') {
      const committedBids = Object.values(currentRoom.game_state.bids || {});
      const totalPlayers = currentRoom.game_state.players?.length || 4;
      const cardsDealt = currentRoom.game_state.cardsDealt || 1;
      const isFinal = isFinalBidder(totalPlayers, committedBids.length);
      const forbiddenBid = isFinal ? calculateForbiddenBid(cardsDealt, committedBids) : -1;
      const initialBid = forbiddenBid === 0 ? 1 : 0;
      setSelectedBid(initialBid);
      setTimeout(() => {
        bidWheelRef.current?.scrollTo({ y: initialBid * 36, animated: false });
      }, 50);
    }
  }, [currentRoom?.game_state?.roundNumber, currentRoom?.game_state?.phase, currentRoom?.game_state?.activeSeat]);

  // Helper to get player name by seat or ID
  const getPlayerName = (identifier) => {
    const playersList = currentRoom?.game_state?.players || [];
    const player = typeof identifier === 'number' 
      ? playersList.find(p => p.seat_number === identifier)
      : playersList.find(p => p.user_id === identifier);
    return player?.nickname || (typeof identifier === 'number' ? `Seat ${identifier}` : 'Player');
  };

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
    if (currentRoom?.game_state?.phase !== 'scoring' || trickHold) {
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
          if (currentRoom.game_state.roundNumber >= currentRoom.game_state.totalRounds) {
            handleEndGame();
          } else {
            handleNextRound();
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentRoom?.game_state?.phase, currentRoom?.game_state?.roundNumber]);

  // Trick hold timer for completed tricks
  useEffect(() => {
    if (currentRoom?.game_state?.lastTrickResult?.cards?.length) {
      setTrickHold(true);
      setSelectedCardIdx(null);
      const timer = setTimeout(() => {
        setTrickHold(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentRoom?.game_state?.lastTrickResult?.cards]);

  // Reset selection whenever active turn or phase changes
  useEffect(() => {
    setSelectedCardIdx(null);
  }, [currentRoom?.game_state?.activeSeat, currentRoom?.game_state?.phase]);

  // Sync mute state with soundManager
  useEffect(() => {
    soundManager.setMuted(isSoundMuted);
  }, [isSoundMuted]);

  // Play "your turn" sound when it becomes the player's turn
  const prevActiveSeat = useRef(null);
  useEffect(() => {
    if (!currentRoom?.game_state || !userId) return;
    const gs = currentRoom.game_state;
    const mySeat = (gs.players || players).find(p => p.user_id === userId)?.seat_number;
    if (gs.activeSeat === mySeat && prevActiveSeat.current !== mySeat && (gs.phase === 'bidding' || gs.phase === 'trick')) {
      soundManager.playYourTurn();
    }
    prevActiveSeat.current = gs.activeSeat;
  }, [currentRoom?.game_state?.activeSeat, currentRoom?.game_state?.phase, userId, players]);

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

    if (currentRoom.status === 'lobby') {
      if (isHost) {
        const confirmed = window.confirm(
          'Warning: Leaving will close this table and remove all waiting players from the lobby. Are you sure you want to close the game?'
        );
        if (!confirmed) return;
      }
    } else if (currentRoom.status === 'playing') {
      const confirmed = window.confirm('Are you sure you want to exit the game?');
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
      // const totalRounds = 2; // TEST OVERRIDE: Cap match at 2 rounds
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
        scoreHistory: [],
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

    soundManager.playBidPlace();

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
    if (!currentRoom?.game_state || loading) return;
    const gs = currentRoom.game_state;
    const mySeat = (gs.players || players).find(p => p.user_id === userId)?.seat_number;
    if (gs.phase !== 'trick' || String(gs.activeSeat) !== String(mySeat)) return;

    setLoading(true);
    setErrorLog('');
    try {
      const myHand = gs.hands?.[userId] || [];
      const actualIndex = myHand.findIndex(
        c => c.suit === playedCard.suit && c.rank === playedCard.rank
      );
      if (actualIndex === -1) {
        throw new Error('Card not found in hand. State may be out of sync.');
      }

      const currentTrick = gs.trick || [];
      const leadCard = currentTrick.length > 0 ? currentTrick[0].card : null;

      if (!isValidPlay(myHand, playedCard, leadCard)) {
        throw new Error(`Invalid Play: You must follow the lead suit (${leadCard.suit})!`);
      }

      const updatedHand = myHand.filter((_, idx) => idx !== actualIndex);
      const updatedHands = { ...gs.hands, [userId]: updatedHand };
      const updatedTrick = [...currentTrick, { user_id: userId, card: playedCard }];
      
      let nextPhase = 'trick';
      let nextActiveSeat = getNextSeat(gs.activeSeat, gs.players.length);
      let updatedTricksWon = { ...(gs.tricksWon || {}) };
      let lastTrickResult = gs.lastTrickResult || null;
      let roundScores = gs.roundScores || {};
      let cumulativeScores = { ...(gs.cumulativeScores || {}) };
      let updatedScoreHistory = gs.scoreHistory || [];

      // If a new trick is starting, clear the lastTrickResult from the state
      if (currentTrick.length === 0) {
        lastTrickResult = null;
      }

      if (updatedTrick.length === gs.players.length) {
        const winnerId = resolveTrickWinner(updatedTrick, gs.isNoTrump ? null : gs.trumpCard);
        const winnerSeat = gs.players.find(p => p.user_id === winnerId)?.seat_number;
        
        updatedTricksWon[winnerId] = (updatedTricksWon[winnerId] || 0) + 1;
        nextActiveSeat = winnerSeat;
        lastTrickResult = { winnerId, winnerSeat, cards: updatedTrick };

        soundManager.playTrickWin();

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

          soundManager.playRoundComplete();

          const roundRecord = {
            roundNumber: gs.roundNumber,
            cardsDealt: gs.cardsDealt,
            bids: gs.bids,
            tricksWon: updatedTricksWon,
            roundScores: roundScores,
            cumulativeScores: cumulativeScores,
          };
          updatedScoreHistory = [...(gs.scoreHistory || []), roundRecord];
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
        scoreHistory: updatedScoreHistory,
        phase: nextPhase,
      };

      const { error: updateErr } = await supabase
        .from('rooms')
        .update({ game_state: updatedGameState })
        .eq('id', currentRoom.id);

      if (updateErr) throw updateErr;
    } catch (err) {
      setErrorLog(err.message);
      // Failsafe to reset animation on error
      flyAnimY.setValue(0);
      flyAnimScale.setValue(1);
      setAnimatingCardIdx(null);
    } finally {
      setLoading(false);
    }
  };

  // Transition match to Final Standings
  const handleEndGame = async () => {
    if (!currentRoom?.game_state || currentRoom.host_id !== userId) return;
    setLoading(true);
    try {
      const updatedGameState = {
        ...currentRoom.game_state,
        phase: 'game_over'
      };
      setCurrentRoom(prev => ({ ...prev, game_state: updatedGameState }));
      await supabase
        .from('rooms')
        .update({ game_state: updatedGameState })
        .eq('id', currentRoom.id);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Host resets table back to lobby for another game
  const handleResetToLobby = async () => {
    if (!currentRoom || currentRoom.host_id !== userId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'lobby', game_state: null })
        .eq('id', currentRoom.id);
      if (error) throw error;
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

    if (gs.roundNumber >= gs.totalRounds) {
      handleEndGame();
      return;
    }
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

          <TouchableOpacity style={[styles.cancelButton, currentRoom.status === 'playing' && styles.buttonSmall]} onPress={handleLeaveTable}>
            <Text style={styles.btnText}>Leave Table</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FULL MATCH SCORECARD MODAL */}
      <Modal
        visible={showScoreModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowScoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scoreModalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff' }}>📜 Match Scorecard</Text>
              <TouchableOpacity onPress={() => setShowScoreModal(false)} style={{ padding: 6 }}>
                <Text style={{ color: '#9ca3af', fontSize: 20, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {(!currentRoom?.game_state?.scoreHistory || currentRoom.game_state.scoreHistory.length === 0) ? (
                <Text style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 }}>
                  No completed rounds yet. Scores will be logged here after Round 1 concludes.
                </Text>
              ) : (
                <View>
                  {/* Table Column Headers */}
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#334155', paddingBottom: 6, marginBottom: 6 }}>
                    <Text style={{ flex: 1.1, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>Round</Text>
                    {[...(currentRoom.game_state?.players || [])]
                      .sort((a, b) => a.seat_number - b.seat_number)
                      .map(p => (
                        <Text key={p.user_id} style={{ flex: 1.4, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                          {p.nickname || 'Player'}
                        </Text>
                      ))}
                  </View>

                  {/* Cumulative Scores Row */}
                  <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderColor: '#334155', marginBottom: 6 }}>
                    <Text style={{ flex: 1.1, color: '#f3f4f6', fontSize: 11, fontWeight: '800' }}>TOTAL</Text>
                    {[...(currentRoom.game_state?.players || [])]
                      .sort((a, b) => a.seat_number - b.seat_number)
                      .map(p => (
                      <Text key={p.user_id} style={{ flex: 1.4, color: '#60a5fa', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>
                          {currentRoom.game_state.cumulativeScores?.[p.user_id] || 0}
                      </Text>
                    ))}
                  </View>

                  {/* Round Rows */}
                  {currentRoom.game_state.scoreHistory.map(record => (
                    <View key={record.roundNumber} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderColor: '#1e293b', alignItems: 'center' }}>
                      <Text style={{ flex: 1.1, color: '#f3f4f6', fontSize: 11, fontWeight: '600' }}>
                        {record.roundNumber}
                      </Text>
                      {[...(currentRoom.game_state?.players || [])]
                        .sort((a, b) => a.seat_number - b.seat_number)
                        .map(p => {
                          const bid = record.bids?.[p.user_id] ?? 0;
                          const won = record.tricksWon?.[p.user_id] ?? 0;
                          const pts = record.roundScores?.[p.user_id] ?? 0;
                          const total = record.cumulativeScores?.[p.user_id] ?? 0;
                          const isSuccess = bid === won;

                          return (
                            <View key={p.user_id} style={{ flex: 1.4, alignItems: 'center' }}>
                              <Text style={{ fontSize: 10, color: '#9ca3af' }}>
                                {bid}/{won} <Text style={{ color: isSuccess ? '#10b981' : '#ef4444', fontWeight: '700' }}>{pts >= 0 ? `+${pts}` : pts}</Text>
                              </Text>
                              <Text style={{ fontSize: 11, color: '#60a5fa', fontWeight: '800' }}>
                                {total}
                              </Text>
                            </View>
                          );
                        })}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.button, { marginTop: 14, backgroundColor: '#334155', paddingVertical: 10 }]} 
              onPress={() => setShowScoreModal(false)}
            >
              <Text style={styles.btnText}>Close Scorecard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ACTIVE GAME TABLE */}
      {currentRoom && currentRoom.status === 'playing' && (
        <View style={styles.cardWide}>
          
          {/* 1. Header: Multi-line Desk Info, Controls & Inset Trump Card */}
          <View style={styles.boardHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.boardTitle}>Desk #{currentRoom.id}</Text>
              <Text style={styles.boardSubTitle}>
                Round {currentRoom.game_state?.roundNumber || 1} of {currentRoom.game_state?.totalRounds || 25}
              </Text>
              <Text style={{ fontSize: 12, color: '#cbd5e1', fontWeight: '600', marginTop: 2 }}>
                {currentRoom.game_state?.cardsDealt || 0} Cards
              </Text>
              <Text style={{ fontSize: 11, color: '#38bdf8', fontWeight: '800', letterSpacing: 0.6, marginTop: 2 }}>
                {(currentRoom.game_state?.mode || currentRoom.round_mode || 'mountain').toUpperCase()}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 10 }}>
              <TouchableOpacity
                onPress={() => setShowScoreModal(true)}
                style={{ backgroundColor: '#0f172a', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={{ fontSize: 12 }}>📊</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }}>Scorecard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (typeof soundManager !== 'undefined' && soundManager.toggleMute) {
                    const muted = soundManager.toggleMute();
                    setIsSoundMuted(muted);
                  }
                }}
                style={{ backgroundColor: '#0f172a', width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14 }}>{isSoundMuted ? '🔇' : '🔊'}</Text>
              </TouchableOpacity>
            </View>

            {/* Trump Card Display with clean right & top margin inside frame */}
            <View style={{ alignItems: 'center', marginRight: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#10b981', letterSpacing: 0.5, marginBottom: 3 }}>
                TRUMP
              </Text>
              {currentRoom.game_state?.isNoTrump ? (
                <View style={{ width: 44, height: 62, borderRadius: 6, backgroundColor: '#78350f', borderWidth: 1, borderColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 11 }}>NT</Text>
                </View>
              ) : currentRoom.game_state?.trumpCard ? (
                <View style={{ width: 44, height: 62, borderRadius: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', padding: 4, justifyContent: 'space-between' }}>
                  <Text style={{ color: (currentRoom.game_state.trumpCard.suit === 'Hearts' || currentRoom.game_state.trumpCard.suit === 'Diamonds') ? '#dc2626' : '#0f172a', fontWeight: '800', fontSize: 12, lineHeight: 13 }}>
                    {currentRoom.game_state.trumpCard.rank}
                  </Text>
                  <Text style={{ color: (currentRoom.game_state.trumpCard.suit === 'Hearts' || currentRoom.game_state.trumpCard.suit === 'Diamonds') ? '#dc2626' : '#0f172a', fontSize: 20, textAlign: 'center', lineHeight: 22 }}>
                    {currentRoom.game_state.trumpCard.suit === 'Spades' ? '♠' : currentRoom.game_state.trumpCard.suit === 'Hearts' ? '♥' : currentRoom.game_state.trumpCard.suit === 'Diamonds' ? '♦' : '♣'}
                  </Text>
                </View>
              ) : (
                <View style={{ width: 44, height: 62, borderRadius: 6, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#64748b', fontSize: 11 }}>—</Text>
                </View>
              )}
            </View>
          </View>

          {/* 2. Opponents HUD Grid (Wraps cleanly for 3–8 players) */}
          {(() => {
            const allPlayers = [...(currentRoom.game_state?.players || [])].sort(
              (a, b) => a.seat_number - b.seat_number
            );
            const myIdx = allPlayers.findIndex(p => p.user_id === userId);
            const orderedOpponents =
              myIdx !== -1
                ? [...allPlayers.slice(myIdx + 1), ...allPlayers.slice(0, myIdx)]
                : allPlayers.filter(p => p.user_id !== userId);

            return (
              <View style={styles.opponentsGrid}>
                {orderedOpponents.map((opp) => {
                  const oppBid = currentRoom.game_state?.bids?.[opp.user_id];
                  const oppWon = currentRoom.game_state?.tricksWon?.[opp.user_id] ?? 0;
                  const isOppTurn = String(currentRoom.game_state?.activeSeat) === String(opp.seat_number);
                  const isOppLead = String(currentRoom.game_state?.initiativeSeat) === String(opp.seat_number);

                  return (
                    <View
                      key={opp.user_id}
                      style={[
                        styles.opponentCard,
                        isOppTurn && { borderColor: '#38bdf8', backgroundColor: '#132238' },
                      ]}
                    >
                      <Text numberOfLines={1} style={styles.oppNameText}>
                        {opp.seat_number}. {opp.nickname || 'Player'}{isOppLead ? ' ⭐' : ''}
                      </Text>
                      <Text style={styles.oppContractText}>
                        Bid: {oppBid !== undefined ? oppBid : '—'} | Won: {oppWon}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Center Arena */}
          <View style={styles.centerArena}>
            {currentRoom.game_state?.phase === 'bidding' ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={styles.centerArenaTitle}>
                  {currentRoom.game_state.activeSeat === (currentRoom.game_state.players?.find(p => p.user_id === userId)?.seat_number)
                    ? "👉 It's Your Turn to Bid!"
                    : `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Bid...`}
                </Text>

                {/* Display Current Bids */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginVertical: 8 }}>
                  {currentRoom.game_state.players?.map((p) => {
                    const playerBid = currentRoom.game_state.bids?.[p.user_id];
                    const hasBid = playerBid !== undefined;
                    return (
                      <View key={p.user_id} style={{ alignItems: 'center', minWidth: 52, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#1e293b', borderRadius: 6, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#9ca3af', fontSize: 11 }} numberOfLines={1}>{getPlayerName(p.user_id)}</Text>
                        <Text style={{ color: hasBid ? '#10b981' : '#64748b', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                          {hasBid ? playerBid : '?'}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Bid Selection - iOS-style Bid Wheel Drum */}
                {currentRoom.game_state.activeSeat === (currentRoom.game_state.players?.find(p => p.user_id === userId)?.seat_number) && (() => {
                  const cardsDealt = currentRoom.game_state.cardsDealt || 1;
                  const committedBids = Object.values(currentRoom.game_state.bids || {});
                  const isFinal = isFinalBidder(currentRoom.game_state.players.length, committedBids.length);
                  const forbiddenBid = isFinal ? calculateForbiddenBid(cardsDealt, committedBids) : -1;
                  const isSelectedForbidden = isFinal && selectedBid === forbiddenBid;
                  const ITEM_H = 36;

                  return (
                    <View style={{ width: '100%', alignItems: 'center', marginTop: 6 }}>
                      <Text style={styles.centerArenaSubText}>Roll or tap to select your bid:</Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 }}>
                        {/* iOS Cylindrical Bid Wheel Drum */}
                        <View style={{ width: 116, height: ITEM_H * 3, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', position: 'relative' }}>
                          {/* Center Selection Lens */}
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              top: ITEM_H,
                              left: 6,
                              right: 6,
                              height: ITEM_H,
                              borderRadius: 8,
                              backgroundColor: isSelectedForbidden ? 'rgba(239, 68, 68, 0.16)' : 'rgba(56, 189, 248, 0.16)',
                              borderWidth: 1,
                              borderColor: isSelectedForbidden ? '#ef4444' : '#38bdf8',
                              zIndex: 2,
                            }}
                          />
                          <ScrollView
                            ref={bidWheelRef}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={false}
                            snapToInterval={ITEM_H}
                            decelerationRate="fast"
                            contentContainerStyle={{ paddingVertical: ITEM_H }}
                            onScroll={(e) => {
                              const offsetY = e.nativeEvent.contentOffset.y;
                              const idx = Math.max(0, Math.min(cardsDealt, Math.round(offsetY / ITEM_H)));
                              if (idx !== selectedBid) setSelectedBid(idx);
                            }}
                            scrollEventThrottle={16}
                          >
                            {Array.from({ length: cardsDealt + 1 }).map((_, bidValue) => {
                              const isForbidden = isFinal && bidValue === forbiddenBid;
                              const isCenter = bidValue === selectedBid;
                              return (
                                <TouchableOpacity
                                  key={bidValue}
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    setSelectedBid(bidValue);
                                    bidWheelRef.current?.scrollTo({ y: bidValue * ITEM_H, animated: true });
                                  }}
                                  style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}
                                >
                                  <Text
                                    style={{
                                      fontSize: isCenter ? 18 : 14,
                                      fontWeight: isCenter ? '800' : '600',
                                      color: isForbidden
                                        ? '#f87171'
                                        : (isCenter ? '#ffffff' : '#64748b'),
                                    }}
                                  >
                                    {bidValue}{isForbidden ? ' 🚫' : ''}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>

                        {/* Confirm Bid Action Button */}
                        <TouchableOpacity
                          disabled={isSelectedForbidden}
                          onPress={() => {
                            if (typeof soundManager !== 'undefined') soundManager.playBidPlace?.();
                            handlePlaceBid(selectedBid);
                          }}
                          style={{
                            backgroundColor: isSelectedForbidden ? '#475569' : '#2563eb',
                            paddingVertical: 14,
                            paddingHorizontal: 18,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: isSelectedForbidden ? '#64748b' : '#60a5fa',
                            opacity: isSelectedForbidden ? 0.75 : 1,
                            minWidth: 145,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
                            {isSelectedForbidden ? `🚫 Hook (${selectedBid})` : `Confirm Bid: ${selectedBid}`}
                          </Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 2 }}>
                            {isSelectedForbidden ? 'Forbidden by Hook' : `of ${cardsDealt} Tricks`}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}
              </View>
            ) : (currentRoom.game_state?.phase === 'trick' || trickHold) ? (
              (() => {
                const mySeat = currentRoom.game_state.players?.find(p => p.user_id === userId)?.seat_number;
                const isMyTurn = String(currentRoom.game_state.activeSeat) === String(mySeat);
                const activeTrick = currentRoom.game_state.trick || [];
                const lastTrick = currentRoom.game_state.lastTrickResult;
                const isShowingLastTrick = activeTrick.length === 0 && lastTrick?.cards?.length > 0 && trickHold;
                const displayCards = isShowingLastTrick ? lastTrick.cards : activeTrick;

                const isFinalTrick = currentRoom.game_state?.phase === 'scoring' || currentRoom.game_state?.phase === 'game_over';
                let statusTitle = `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Play...`;
                if (trickHold) {
                  statusTitle = isFinalTrick 
                    ? `Final Trick Won by ${getPlayerName(lastTrick?.winnerId)}!` 
                    : `Trick Won by ${getPlayerName(lastTrick?.winnerId)}`;
                } else if (isMyTurn) {
                  statusTitle = activeTrick.length === 0 
                    ? "👉 It's Your Turn to Lead the Trick!" 
                    : "👉 It's Your Turn to Play!";
                } else {
                  statusTitle = activeTrick.length === 0
                    ? `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Lead...`
                    : `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Play...`;
                }

                const totalBids = Object.values(currentRoom.game_state.bids || {}).reduce(
                  (sum, val) => sum + Number(val || 0),
                  0
                );
                const cardsDealt = currentRoom.game_state.cardsDealt || 1;
                const bidDiff = totalBids - cardsDealt;
                const isFight = bidDiff > 0;
                const diffCount = Math.abs(bidDiff);
                const tensionLabel = bidDiff === 0
                  ? '⚖️ 平注 (Even)'
                  : isFight
                    ? `⚔️ 搶 ${diffCount} 注 (Fight +${diffCount})`
                    : `🛡️ 讓 ${diffCount} 注 (Yield -${diffCount})`;

                return (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: isFight ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        borderColor: isFight ? '#ef4444' : '#10b981',
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 16,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '600' }}>
                        Total Bids: {totalBids}/{cardsDealt}
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>|</Text>
                      <Text
                        style={{
                          color: isFight ? '#fca5a5' : '#6ee7b7',
                          fontSize: 12,
                          fontWeight: '800',
                        }}
                      >
                        {tensionLabel}
                      </Text>
                    </View>
                    <Text style={styles.centerArenaTitle}>{statusTitle}</Text>

                    {/* Trick Cards on Table */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10, minHeight: 74, alignItems: 'center' }}>
                      {displayCards.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                          <Text style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                            Table cleared. Waiting for {getPlayerName(currentRoom.game_state.activeSeat)} to lead...
                          </Text>
                        </View>
                      ) : (
                        displayCards.map((play, idx) => {
                          const isRed = play.card.suit === 'Hearts' || play.card.suit === 'Diamonds';
                          const suitColor = isRed ? '#dc2626' : '#0f172a';
                          const suitSymbol =
                            play.card.suit === 'Spades'
                              ? '♠'
                              : play.card.suit === 'Hearts'
                              ? '♥'
                              : play.card.suit === 'Diamonds'
                              ? '♦'
                              : '♣';
                          const seatPlayer = currentRoom.game_state.players?.find(p => p.user_id === play.user_id);
                          const isCompactTrick = (currentRoom.game_state.players?.length || 4) >= 5;

                          return (
                            <View key={`${play.user_id}-${idx}`} style={{ alignItems: 'center' }}>
                              <View
                                style={{
                                  width: isCompactTrick ? 44 : 52,
                                  height: isCompactTrick ? 62 : 74,
                                  backgroundColor: '#ffffff',
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: '#cbd5e1',
                                  padding: 4,
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Text style={{ color: suitColor, fontWeight: '800', fontSize: isCompactTrick ? 13 : 15, lineHeight: 15 }}>
                                  {play.card.rank}
                                </Text>
                                <Text style={{ color: suitColor, fontSize: isCompactTrick ? 20 : 24, textAlign: 'center', lineHeight: isCompactTrick ? 22 : 26 }}>
                                  {suitSymbol}
                                </Text>
                              </View>
                              <Text style={{ color: '#9ca3af', fontSize: isCompactTrick ? 10 : 11, marginTop: isCompactTrick ? 3 : 5, fontWeight: '600' }} numberOfLines={1}>
                                {seatPlayer?.nickname || `Seat ${seatPlayer?.seat_number || '?'}`}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                );
              })()
            ) : currentRoom.game_state?.phase === 'scoring' ? (
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 6 }}>
                <Text style={styles.centerArenaTitle}>🏆 Round {currentRoom.game_state.roundNumber} Complete</Text>
                {currentRoom.game_state?.lastTrickResult && (
                  <Text style={{ color: '#60a5fa', fontWeight: '700', fontSize: 13, marginBottom: 8 }}>
                    Final Trick Won by {getPlayerName(currentRoom.game_state.lastTrickResult.winnerId)} (Takes Round {currentRoom.game_state.roundNumber + 1} Lead)
                  </Text>
                )}

                {/* Scoreboard Table */}
                <View style={{ width: '95%', backgroundColor: '#0f172a', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#334155', marginVertical: 6 }}>
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1e293b', paddingBottom: 4, marginBottom: 4 }}>
                    <Text style={{ flex: 1.2, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>PLAYER</Text>
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
                        <Text style={{ flex: 1.2, color: '#f3f4f6', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{p.nickname || 'Player'}</Text>
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

                {/* Round Progression or Final Standings Trigger */}
                {currentRoom.game_state.roundNumber >= currentRoom.game_state.totalRounds ? (
                  <View style={{ alignItems: 'center', marginTop: 12 }}>
                    <Text style={{ color: '#eab308', fontSize: 16, fontWeight: '800' }}>
                      🏆 All {currentRoom.game_state.totalRounds} Rounds Completed!
                    </Text>
                    <Text style={{ color: '#38bdf8', fontSize: 13, marginTop: 4 }}>
                      Showing Final Standings in {roundCountdown !== null ? roundCountdown : 5}s...
                    </Text>
                    {currentRoom.host_id === userId && (
                      <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#eab308', marginTop: 10, paddingVertical: 8, paddingHorizontal: 20 }]}
                        onPress={handleEndGame}
                      >
                        <Text style={[styles.btnText, { color: '#0f172a', fontWeight: '800' }]}>
                          🏆 View Final Podium Now
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  currentRoom.game_state?.config?.requireManualNextRound ? (
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
                  )
                )}
              </View>
            ) : currentRoom.game_state?.phase === 'game_over' ? (
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#eab308', marginBottom: 4 }}>
                  👑 Match Finished!
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
                  Final Leaderboard after {currentRoom.game_state.totalRounds} Rounds
                </Text>

                {/* Final Ranked Podium */}
                <View style={{ width: '95%', backgroundColor: '#0f172a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155' }}>
                  {(() => {
                    const gs = currentRoom.game_state;
                    if (!gs) return null;

                    const sortedPlayers = [...(gs.players || [])]
                      .sort((a, b) => (gs.cumulativeScores?.[b.user_id] || 0) - (gs.cumulativeScores?.[a.user_id] || 0));

                    if (sortedPlayers.length === 0) return null;

                    const rankedPlayers = [];
                    let rank = 1;
                    for (let i = 0; i < sortedPlayers.length; i++) {
                      if (i > 0 && (gs.cumulativeScores?.[sortedPlayers[i].user_id] || 0) < (gs.cumulativeScores?.[sortedPlayers[i-1].user_id] || 0)) {
                        rank = i + 1;
                      }
                      rankedPlayers.push({
                        player: sortedPlayers[i],
                        score: gs.cumulativeScores?.[sortedPlayers[i].user_id] || 0,
                        rank: rank
                      });
                    }

                    const highestScore = rankedPlayers.length > 0 ? rankedPlayers[0].score : 0;

                    return rankedPlayers.map(({ player, score, rank }, idx) => {
                      const isWinner = score === highestScore && highestScore > 0;
                      
                      let medal;
                      if (rank === 1) medal = '🥇';
                      else if (rank === 2) medal = '🥈';
                      else if (rank === 3) medal = '🥉';
                      else medal = `#${rank}`;

                      return (
                        <View 
                          key={player.user_id} 
                          style={{ 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            paddingVertical: 10, 
                            borderBottomWidth: idx === rankedPlayers.length - 1 ? 0 : 1, 
                            borderColor: '#1e293b' 
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: isWinner ? '#eab308' : '#9ca3af', width: 32, textAlign: 'center' }}>
                              {medal}
                            </Text>
                            <Text style={{ color: isWinner ? '#ffffff' : '#e2e8f0', fontSize: 15, fontWeight: isWinner ? '800' : '600' }}>
                              {player.nickname || player.profiles?.nickname || 'Player'}
                              {isWinner ? ' (Winner 👑)' : ''}
                            </Text>
                          </View>
                          <Text style={{ color: isWinner ? '#10b981' : '#60a5fa', fontSize: 18, fontWeight: '800' }}>
                            {score} pts
                          </Text>
                        </View>
                      );
                    });
                  })()}
                </View>

                {/* Host Controls & Scorecard Button */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#475569', paddingVertical: 10, paddingHorizontal: 16 }]}
                    onPress={() => setShowScoreModal(true)}
                  >
                    <Text style={{ color: '#38bdf8', fontWeight: '700' }}>📊 View Scorecard</Text>
                  </TouchableOpacity>

                  {currentRoom.host_id === userId && (
                    <TouchableOpacity 
                      style={[styles.button, { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 18 }]}
                      onPress={handleResetToLobby}
                    >
                      <Text style={styles.btnText}>🔄 Return to Lobby</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : null}

          </View>

          {/* Bottom HUD: Hand */}
          <View style={{ marginTop: 16 }}>
            {(() => {
              const mySeat = currentRoom.game_state?.players?.find(p => p.user_id === userId)?.seat_number;
              const isLead = mySeat === currentRoom.game_state?.initiativeSeat;
              const myBid = currentRoom.game_state?.bids?.[userId];
              const myWon = currentRoom.game_state?.tricksWon?.[userId] ?? 0;
              return (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>
                    Your Hand{isLead ? ' ⭐ Lead' : ''}
                  </Text>
                  <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#38bdf8' }}>
                    <Text style={{ color: '#38bdf8', fontSize: 14, fontWeight: '800' }}>
                      Bid: {myBid !== undefined ? myBid : '—'} | Won: {myWon}
                    </Text>
                  </View>
                </View>
              );
            })()}
            
            <View style={{ overflow: 'visible', marginTop: 8 }}>
            {(() => {
              const rawHand = currentRoom.game_state?.hands?.[userId] || [];
              const myHand = sortHand(rawHand);
              const mySeat = currentRoom.game_state?.players?.find(p => p.user_id === userId)?.seat_number;
              const isTrickPhase = currentRoom.game_state?.phase === 'trick';
              const isMyTurn = isTrickPhase &&
                               String(currentRoom.game_state?.activeSeat) === String(mySeat) &&
                               !trickHold;
              const activeTrick = currentRoom.game_state?.trick || [];
              const leadCard = activeTrick.length > 0 ? activeTrick[0].card : null;

              // Keep existing -24px overlap for <= 13 cards; compress dynamically only for >= 14 cards
              const isCompactHand = myHand.length >= 14;
              const maxHandWidth = Math.min(windowWidth - 36, 386);
              const cardWidth = 52;
              const overlapMargin = isCompactHand
                ? Math.min(-24, -Math.ceil(cardWidth - (maxHandWidth - cardWidth) / (myHand.length - 1)))
                : -24;

              return (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 100 }}>
                  {myHand.map((card, idx) => {
                const isSelected = selectedCardIdx === idx;
                const isLegal = isMyTurn ? isValidPlay(myHand, card, leadCard) : false;
                const canInteract = isMyTurn && isLegal;
                const isDisabledOffSuit = isMyTurn && !isLegal;

                const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';
                const cardColor = isDisabledOffSuit ? '#334155' : (isRed ? '#dc2626' : '#0f172a');
                const symbol = card.suit === 'Spades' ? '♠' : card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : '♣';

                const isCardAnimating = animatingCardIdx === idx;
                const translateYValue = isCardAnimating ? flyAnimY : (isSelected ? -18 : 0);
                const scaleValue = isCardAnimating ? flyAnimScale : 1;

                const onCardPress = () => {
                  if (!canInteract || animatingCardIdx !== null) return;
                  if (isSelected) {
                    if (typeof soundManager !== 'undefined') soundManager.playCardThrow?.();
                    setAnimatingCardIdx(idx);
                    flyAnimY.setValue(-18);
                    flyAnimScale.setValue(1);

                    Animated.parallel([
                      Animated.timing(flyAnimY, {
                        toValue: -85,
                        duration: 150,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                      }),
                      Animated.timing(flyAnimScale, {
                        toValue: 0.75,
                        duration: 150,
                        useNativeDriver: true,
                      }),
                    ]).start(() => {
                      const rawIndex = (currentRoom.game_state?.hands?.[userId] || []).findIndex(
                        c => c.suit === card.suit && c.rank === card.rank
                      );
                      handlePlayCard(rawIndex !== -1 ? rawIndex : idx, card);
                      setSelectedCardIdx(null);
                      setAnimatingCardIdx(null);
                    });
                  } else {
                    if (typeof soundManager !== 'undefined') soundManager.playCardSelect?.();
                    setSelectedCardIdx(idx);
                  }
                };

                return (
                  <AnimatedTouchable
                    key={`${card.suit}-${card.rank}-${idx}`}
                    activeOpacity={0.9}
                    disabled={!canInteract || animatingCardIdx !== null}
                    onPress={onCardPress}
                    style={[
                      styles.playingCard,
                      idx > 0 && { marginLeft: overlapMargin },
                      {
                        opacity: 1,
                        zIndex: isCardAnimating ? 999 : (isSelected ? 99 : idx + 1),
                        backgroundColor: isDisabledOffSuit ? '#64748b' : '#ffffff',
                        borderColor: isSelected ? '#38bdf8' : (isLegal && isMyTurn ? '#3b82f6' : '#cbd5e1'),
                        borderWidth: isSelected ? 2 : 1,
                        transform: [
                          { translateY: translateYValue },
                          { scale: scaleValue }
                        ]
                      }
                    ]}
                  >
                    <View style={[styles.cardTopCorner, isCompactHand && styles.cardTopCornerCompact]}>
                      <Text style={[styles.cardCornerRank, isCompactHand && styles.cardCornerTextCompact, { color: cardColor }]}>
                        {card.rank}
                      </Text>
                      <Text style={[styles.cardCornerSuit, isCompactHand && styles.cardCornerTextCompact, { color: cardColor }]}>
                        {symbol}
                      </Text>
                    </View>
                    <Text style={[styles.cardCenterSymbol, { color: cardColor }]}>{symbol}</Text>
                  </AnimatedTouchable>
                );
              })}
                </View>
              );
            })()}
            </View>
          </View>

          <View style={currentRoom.status === 'playing' ? { alignItems: 'center' } : {}}>
            <TouchableOpacity style={[styles.cancelButton, { marginTop: 16 }]} onPress={handleLeaveTable}>
              <Text style={styles.btnText}>Exit Game Table</Text>
            </TouchableOpacity>
          </View>
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
  cardWide: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 24,
    width: '100%',
    maxWidth: 414,
    minHeight: 780,
    alignSelf: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#334155',
    paddingBottom: 8,
  },
  boardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  boardSubTitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  opponentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  opponentCard: {
    width: '31%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  oppNameText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11.5,
    marginBottom: 3,
  },
  oppContractText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 10.5,
  },
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
  cardPlaceholder: { width: 60, height: 85, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3 },
  playingCard: {
    width: 52,
    height: 80,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTopCorner: {
    flexDirection: 'row',
    gap: 2,
  },
  cardTopCornerCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: 15,
    gap: 0,
  },
  cardCornerRank: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardCornerSuit: {
    fontSize: 14,
  },
  cardCornerTextCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  cardCenterSymbol: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  scoreModalContent: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, width: '100%', maxWidth: 580, borderWidth: 1, borderColor: '#334155' }
});