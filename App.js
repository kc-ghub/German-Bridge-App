import React, { useEffect, useState, useRef, Component } from 'react';
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
  useWindowDimensions,
  Platform
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
  resolveTrickWinner,
  getSuitColor,
  getPlayerSeat
} from './src/core/gameEngine';
import { soundManager } from './src/services/soundManager';
import ScorecardModal from './src/features/Scorecard/ScorecardModal';
import HowToPlayModal from './src/features/Rules/HowToPlayModal';
import { GameBoard } from './src/features/GameBoard';
import LobbyScreen from './src/features/Lobby/LobbyScreen';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBoundaryContainer}>
          <Text style={styles.errorBoundaryTitle}>⚠️ Runtime Error</Text>
          <Text style={styles.errorBoundaryMessage}>{this.state.error?.message || 'An unexpected error occurred'}</Text>
          <TouchableOpacity style={styles.errorBoundaryButton} onPress={this.handleReset}>
            <Text style={styles.errorBoundaryButtonText}>Reset Session & Reload</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

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

export default function App() {
  // Web PWA viewport & overscroll protection
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    
    // Set viewport meta tag to prevent zoom
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    
    // Add Apple PWA meta tags
    let appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCapable) {
      appleCapable = document.createElement('meta');
      appleCapable.name = 'apple-mobile-web-app-capable';
      appleCapable.content = 'yes';
      document.head.appendChild(appleCapable);
    }
    
    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStatusBar) {
      appleStatusBar = document.createElement('meta');
      appleStatusBar.name = 'apple-mobile-web-app-status-bar-style';
      appleStatusBar.content = 'black-translucent';
      document.head.appendChild(appleStatusBar);
    }
    
    // Prevent pull-to-refresh and double-tap zoom
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.touchAction = 'manipulation';
  }, []);

  // Screen dimensions
  const { width: windowWidth } = useWindowDimensions();

  // Session & User State
  const [userId, setUserId] = useState(null);
  const [nickname, setNickname] = useState('');
  const [userRole, setUserRole] = useState(null); // 'host' | 'guest'
  
  // Host Password Verification
  const [isHostAuthenticated, setIsHostAuthenticated] = useState(false);

  // Quick Room Setup Controls (Host)
  const [roomPasscode, setRoomPasscode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roundMode, setRoundMode] = useState('mountain');

  // Invitee Join Form State (Guest)
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');

  // Active Game & Lobby State
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const setErrorLog = (msg) => setStatusBanner(msg ? { type: 'error', message: msg } : null);
  const [roundCountdown, setRoundCountdown] = useState(null);

  // Host Auth Flow State
  const [authView, setAuthView] = useState('login');
  const [hostEmail, setHostEmail] = useState('');
  const [hostAuthPassword, setHostAuthPassword] = useState('');
  const [hostInviteCode, setHostInviteCode] = useState('');
  const [hostSignupNickname, setHostSignupNickname] = useState('');
  const [authenticatedHostEmail, setAuthenticatedHostEmail] = useState('');

  // Channel reference
  const channelRef = useRef(null);
  const isLeavingRef = useRef(false);
  const currentRoomRef = useRef(currentRoom);
  currentRoomRef.current = currentRoom;

  // Scorecard Modal State
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  
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

  const runWithLoading = async (task) => {
    setLoading(true);
    setErrorLog('');
    try {
      await task();
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncLatestRoom = async (roomId) => {
    if (!roomId) return;
    try {
      const { data: latestRoom, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !latestRoom) return;

      const hasStatusChanged = latestRoom.status !== currentRoomRef.current?.status;
      const hasGameStateChanged = JSON.stringify(latestRoom.game_state) !== JSON.stringify(currentRoomRef.current?.game_state);

      if (hasStatusChanged || hasGameStateChanged) {
        setCurrentRoom(latestRoom);
      }
    } catch {
      // Ignore transient network errors
    }
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

          if (!user.is_anonymous) {
            await activateAndVerifyHost(user);
          }

          const params = typeof window !== 'undefined' && window.location?.search 
            ? new URLSearchParams(window.location.search) 
            : null;
          const urlRoomId = params ? params.get('room') : null;
          const savedSession = getSession('active_game_session');

          if (urlRoomId && savedSession && savedSession.roomId !== urlRoomId) {
            saveSession('active_game_session', null);
            setJoinRoomCode(urlRoomId.trim().toUpperCase());
            setUserRole('guest');
            setCurrentRoom(null);
            return;
          }

          if (urlRoomId && !savedSession) {
            setJoinRoomCode(urlRoomId.trim().toUpperCase());
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

  // Auth State Change Listener for automatic email-link login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user && !session.user.is_anonymous) {
        await activateAndVerifyHost(session.user);
      }
    });
    return () => subscription.unsubscribe();
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
      if (isLeavingRef.current) return;
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
      if (isLeavingRef.current) return;
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
        syncLatestRoom(currentRoom.id);
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentRoom?.id, userId]);

  // 2a. Foreground Recovery: Sync room state when tab becomes visible or window gains focus
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleForeground = () => {
      if (currentRoomRef.current?.id) {
        syncLatestRoom(currentRoomRef.current.id);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleForeground();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleForeground);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleForeground);
    };
  }, []);

  // 2b. Active-Match Safety Watchdog: Poll every 4s during active gameplay as fallback
  useEffect(() => {
    if (!currentRoom?.id || currentRoom.status !== 'playing') return;

    const watchdogInterval = setInterval(() => {
      syncLatestRoom(currentRoom.id);
    }, 4000);

    return () => clearInterval(watchdogInterval);
  }, [currentRoom?.id, currentRoom?.status]);

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
    const mySeat = getPlayerSeat(gs, userId);
    if (gs.activeSeat === mySeat && prevActiveSeat.current !== mySeat && (gs.phase === 'bidding' || gs.phase === 'trick')) {
      soundManager.playYourTurn();
    }
    prevActiveSeat.current = gs.activeSeat;
  }, [currentRoom?.game_state?.activeSeat, currentRoom?.game_state?.phase, userId, players]);

  // Host Activation & Verification Helper
  const activateAndVerifyHost = async (authUser) => {
    const { data: canHost, error: claimErr } = await supabase.rpc('claim_host_access', { 
      p_invite_code: hostInviteCode.trim() || null, 
      p_nickname: hostSignupNickname.trim() || null 
    });
    
    if (claimErr || !canHost) {
      await supabase.auth.signOut();
      const { data: anon } = await supabase.auth.signInAnonymously();
      if (anon?.user) setUserId(anon.user.id);
      setIsHostAuthenticated(false);
      setAuthenticatedHostEmail('');
      setAuthView('login');
      setStatusBanner({ type: 'error', message: 'Email verified, but a valid Beta Invite Code is required to host tables.' });
      return false;
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', authUser.id)
      .single();
    
    if (profile?.nickname && !nickname.trim()) {
      setNickname(profile.nickname);
    }
    
    setUserId(authUser.id);
    setAuthenticatedHostEmail(authUser.email || '');
    setIsHostAuthenticated(true);
    setStatusBanner(null);
    return true;
  };

  // 4. Host Email/Password Login Handler
  const handleHostEmailLogin = async () => {
    if (!hostEmail.trim() || !hostAuthPassword.trim()) {
      setStatusBanner({ type: 'error', message: 'Please enter both email and password.' });
      return;
    }
    setLoading(true);
    setStatusBanner(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: hostEmail.trim(),
        password: hostAuthPassword.trim()
      });
      if (error) throw error;
      if (!data?.user) return;
      
      await activateAndVerifyHost(data.user);
    } catch (err) {
      setStatusBanner({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 4b. Host Email/Password Sign-Up Handler
  const handleHostEmailSignUp = async () => {
    if (!hostSignupNickname.trim() || !hostEmail.trim() || !hostAuthPassword.trim() || hostAuthPassword.length < 6 || !hostInviteCode.trim()) {
      setStatusBanner({ type: 'error', message: 'Please fill in all fields (nickname, email, password ≥6 chars, invite code).' });
      return;
    }
    setLoading(true);
    setStatusBanner(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: hostEmail.trim(),
        password: hostAuthPassword,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          data: {
            nickname: hostSignupNickname.trim(),
            invite_code: hostInviteCode.trim(),
          },
        },
      });
      if (error) throw error;
      
      if (data?.session) {
        await activateAndVerifyHost(data.user);
      } else {
        setAuthView('verify_pending');
        setStatusBanner({ type: 'success', message: 'Confirmation link sent! Please check your inbox and verify your email.' });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 4c. Resend Verification Email Handler
  const handleResendVerification = async () => {
    if (!hostEmail.trim()) {
      setStatusBanner({ type: 'error', message: 'Please enter your email address.' });
      return;
    }
    setLoading(true);
    setStatusBanner(null);
    try {
      const { error } = await supabase.auth.resend({ 
        type: 'signup', 
        email: hostEmail.trim(), 
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } 
      });
      if (error) throw error;
      setStatusBanner({ type: 'success', message: 'Verification email resent. Check your inbox or spam folder.' });
    } catch (err) {
      setStatusBanner({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 4d. Forgot Password Handler
  const handleForgotPassword = async () => {
    if (!hostEmail.trim()) {
      setStatusBanner({ type: 'error', message: 'Please enter your email address.' });
      return;
    }
    setLoading(true);
    setStatusBanner(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(hostEmail.trim(), { 
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined 
      });
      if (error) throw error;
      setStatusBanner({ type: 'success', message: 'Password reset link sent if an account exists for this email.' });
    } catch (err) {
      setStatusBanner({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 4e. Host Sign Out Handler
  const handleHostSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setIsHostAuthenticated(false);
      setAuthenticatedHostEmail('');
      setAuthView('login');
      const { data: anon } = await supabase.auth.signInAnonymously();
      if (anon?.user) setUserId(anon.user.id);
      setStatusBanner({ type: 'info', message: 'Signed out of host account.' });
    } catch (err) {
      setStatusBanner({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 5. Host Creates Game Table
  const handleCreateRoom = async () => {
    isLeavingRef.current = false;
    if (!nickname.trim()) {
      setErrorLog('Please enter your host nickname.');
      return;
    }
    if (roomPasscode.length !== 4 || isNaN(roomPasscode)) {
      setErrorLog('Passcode must be exactly 4 numeric digits (e.g. 4321).');
      return;
    }

    await runWithLoading(async () => {
      const { data: room, error } = await supabase.rpc('create_quick_room', {
        p_host_id: userId,
        p_nickname: nickname.trim() || 'Host',
        p_passcode: roomPasscode.trim(),
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
    });
  };

  // 6. Invitee Joins Game Table
  const handleJoinRoom = async () => {
    isLeavingRef.current = false;
    if (!nickname.trim()) {
      setErrorLog('Please enter your nickname.');
      return;
    }
    const cleanCode = joinRoomCode.trim().toUpperCase();
    if (!cleanCode || !joinPasscode.trim()) {
      setErrorLog('Please enter both Table Code and Passcode.');
      return;
    }
    if (!/^[A-Z0-9]{3,4}$/.test(cleanCode)) {
      setErrorLog('Table Code must be 3-4 alphanumeric characters (e.g. K7M2).');
      return;
    }

    await runWithLoading(async () => {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', cleanCode)
        .single();

      if (roomError || !room) {
        throw new Error(`Room ${cleanCode} does not exist.`);
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
    });
  };

  // 7. Leave Table Handler
  const handleLeaveTable = async () => {
    isLeavingRef.current = true;
    const isHost = currentRoom && currentRoom.host_id === userId;
    const roomId = currentRoom?.id;
    
    saveSession('active_game_session', null);
    
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('active_game_session');
    }
    
    if (typeof window !== 'undefined' && window.history && window.location) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (channelRef.current) {
      await channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    setCurrentRoom(null);
    setPlayers([]);
    setUserRole(null);
    setLoading(false);

    try {
      if (isHost && roomId) {
        await supabase.from('rooms').delete().eq('id', roomId);
      } else if (!isHost && roomId && userId) {
        await supabase.from('room_players').delete().eq('room_id', roomId).eq('user_id', userId);
      }
    } catch (err) {
      console.error('Cleanup error during leave:', err);
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
    const mySeat = getPlayerSeat(gs, userId);
    if (gs.phase !== 'bidding' || gs.activeSeat !== mySeat) return;

    soundManager.playBidPlace();

    await runWithLoading(async () => {
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
        nextActiveSeat = gs.initiativeSeat;
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
    });
  };

  // 11. Play Card & Resolve Trick / Scoring
  const handlePlayCard = async (cardIndex, playedCard) => {
    if (!currentRoom?.game_state || loading) return;
    const gs = currentRoom.game_state;
    const mySeat = getPlayerSeat(gs, userId);
    if (gs.phase !== 'trick' || String(gs.activeSeat) !== String(mySeat)) return;

    try {
      await runWithLoading(async () => {
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

        if (currentTrick.length === 0) {
          lastTrickResult = null;
        }

        if (updatedTrick.length === gs.players.length) {
          const winnerId = resolveTrickWinner(updatedTrick, gs.isNoTrump ? null : gs.trumpCard);
          const winnerSeat = getPlayerSeat(gs, winnerId);
          
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
      });
    } catch (err) {
      flyAnimY.setValue(0);
      flyAnimScale.setValue(1);
      setAnimatingCardIdx(null);
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
    <ErrorBoundary>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>German Bridge 🃏</Text>
      <Text style={styles.subtitle}>Private Invitation Game Desk</Text>

      {statusBanner ? (
        <Text style={[
          styles.errorText, 
          statusBanner.type === 'success' && { color: '#10b981' },
          statusBanner.type === 'info' && { color: '#60a5fa' }
        ]}>
          {statusBanner.type === 'error' ? '⚠️ ' : statusBanner.type === 'success' ? '✅ ' : 'ℹ️ '}
          {statusBanner.message}
        </Text>
      ) : null}
      {loading && <ActivityIndicator size="small" color="#60a5fa" style={{ marginBottom: 10 }} />}

      <LobbyScreen
        userRole={userRole}
        setUserRole={setUserRole}
        statusBanner={statusBanner}
        setStatusBanner={setStatusBanner}
        errorLog={statusBanner?.message || ''}
        authView={authView}
        setAuthView={setAuthView}
        hostEmail={hostEmail}
        setHostEmail={setHostEmail}
        hostAuthPassword={hostAuthPassword}
        setHostAuthPassword={setHostAuthPassword}
        hostInviteCode={hostInviteCode}
        setHostInviteCode={setHostInviteCode}
        hostSignupNickname={hostSignupNickname}
        setHostSignupNickname={setHostSignupNickname}
        authenticatedHostEmail={authenticatedHostEmail}
        isHostAuthenticated={isHostAuthenticated}
        nickname={nickname}
        setNickname={setNickname}
        roomPasscode={roomPasscode}
        setRoomPasscode={setRoomPasscode}
        maxPlayers={maxPlayers}
        setMaxPlayers={setMaxPlayers}
        roundMode={roundMode}
        setRoundMode={setRoundMode}
        joinRoomCode={joinRoomCode}
        setJoinRoomCode={setJoinRoomCode}
        joinPasscode={joinPasscode}
        setJoinPasscode={setJoinPasscode}
        currentRoom={currentRoom}
        players={players}
        userId={userId}
        loading={loading}
        onHostEmailLogin={handleHostEmailLogin}
        onHostEmailSignUp={handleHostEmailSignUp}
        onResendVerification={handleResendVerification}
        onForgotPassword={handleForgotPassword}
        onHostSignOut={handleHostSignOut}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onStartGame={handleStartGame}
        onLeaveTable={handleLeaveTable}
        onExit={handleLeaveTable}
        copyInviteLink={copyInviteLink}
        onOpenRules={() => setShowRulesModal(true)}
      />

      <ScorecardModal
        visible={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        gameState={currentRoom?.game_state}
        players={players}
      />

      <HowToPlayModal
        visible={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {currentRoom && currentRoom.status === 'playing' && (
        <GameBoard
          currentRoom={currentRoom}
          userId={userId}
          players={players}
          nickname={nickname}
          loading={loading}
          errorLog={statusBanner?.message || ''}
          roundCountdown={roundCountdown}
          trickHold={trickHold}
          selectedCardIdx={selectedCardIdx}
          setSelectedCardIdx={setSelectedCardIdx}
          animatingCardIdx={animatingCardIdx}
          setAnimatingCardIdx={setAnimatingCardIdx}
          flyAnimY={flyAnimY}
          flyAnimScale={flyAnimScale}
          isSoundMuted={isSoundMuted}
          setIsSoundMuted={setIsSoundMuted}
          showScoreModal={showScoreModal}
          setShowScoreModal={setShowScoreModal}
          onPlaceBid={handlePlaceBid}
          onPlayCard={handlePlayCard}
          onNextRound={handleNextRound}
          onEndGame={handleEndGame}
          onResetToLobby={handleResetToLobby}
          onLeaveTable={handleLeaveTable}
          onExit={handleLeaveTable}
          soundManager={soundManager}
          onOpenRules={() => setShowRulesModal(true)}
        />
      )}
    </ScrollView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 20 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowGap10: { flexDirection: 'row', gap: 10 },
  textCenter: { textAlign: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#374151' },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 16, textAlign: 'center' },
  label: { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#4b5563', fontSize: 15 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  
  cancelButton: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  errorText: { color: '#f87171', marginBottom: 15, fontWeight: '600', textAlign: 'center' },
  errorBoundaryContainer: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorBoundaryTitle: { fontSize: 24, fontWeight: 'bold', color: '#f87171', marginBottom: 16, textAlign: 'center' },
  errorBoundaryMessage: { fontSize: 16, color: '#ffffff', marginBottom: 24, textAlign: 'center' },
  errorBoundaryButton: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', width: '100%', maxWidth: 300 },
  errorBoundaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});