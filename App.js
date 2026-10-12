import React, { useEffect, useState } from 'react';
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

export default function App() {
  // Session State
  const [userId, setUserId] = useState(null);
  const [nickname, setNickname] = useState('');
  const [userRole, setUserRole] = useState(null); // 'host' | 'guest'
  
  // Host Password Verification
  const [hostAuthPassword, setHostAuthPassword] = useState('');
  const [isHostAuthenticated, setIsHostAuthenticated] = useState(false);

  // Quick Room Setup Controls (Host)
  const [roomNum, setRoomNum] = useState('');          // 3 digits
  const [roomPasscode, setRoomPasscode] = useState(''); // 4 digits
  const [maxPlayers, setMaxPlayers] = useState(4);       // 3 to 8
  const [roundMode, setRoundMode] = useState('mountain'); // valley | mountain | flatline

  // Invitee Join Form State (Guest)
  const [joinRoomNum, setJoinRoomNum] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');

  // Active Game & Lobby State
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState('');

  // 1. Initialize Anonymous Session & Parse Deep-Link Query Params
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
        }
      } catch (err) {
        setErrorLog(`Session initialization failed: ${err.message}`);
      }
    }
    initSession();

    // Deep-Link URL Receiver (e.g. http://localhost:8081/?room=123)
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setJoinRoomNum(roomParam);
        setUserRole('guest');
      }
    }
  }, []);

  // 2. Realtime Subscription for Active Room Players
  useEffect(() => {
    if (!currentRoom?.id) return;

    const channel = supabase
      .channel(`public:room_players:${currentRoom.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'room_players', 
        filter: `room_id=eq.${currentRoom.id}` 
      }, () => {
        fetchRoomMembers(currentRoom.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom?.id]);

  // Fetch Seated Members
  const fetchRoomMembers = async (targetRoomId) => {
    const { data: members, error } = await supabase
      .from('room_players')
      .select('user_id, seat_number, status, profiles(nickname)')
      .eq('room_id', targetRoomId);

    if (!error && members) {
      setPlayers(members);
    }
  };

  // 3. Host Authentication Handler ("funfam123999")
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

  // 4. Host Creates Game Table
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

      setCurrentRoom(room);
      await fetchRoomMembers(roomNum);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Invitee Joins Game Table
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
      const { data: joinData, error } = await supabase.rpc('join_quick_room', {
        p_user_id: userId,
        p_nickname: nickname.trim(),
        p_room_num: joinRoomNum.trim(),
        p_passcode: joinPasscode.trim()
      });

      if (error) throw error;

      const { data: room } = await supabase.from('rooms').select('*').eq('id', joinRoomNum).single();
      setCurrentRoom(room);
      await fetchRoomMembers(joinRoomNum);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 6. Share Link Generator
  const copyInviteLink = () => {
    const inviteUrl = `${window.location?.origin || 'http://localhost:8081'}/?room=${currentRoom.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
      alert(`Invite link copied to clipboard:\n${inviteUrl}`);
    } else {
      Alert.alert('Invite Link', inviteUrl);
    }
  };

  // 7. Host Starts Game Session
  const handleStartGame = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', currentRoom.id);

      if (error) throw error;
      alert('Game session starting!');
    } catch (err) {
      setErrorLog(err.message);
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

      {/* MODE SELECTOR */}
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

      {/* HOST SETUP FORM */}
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

      {/* INVITEE FORM */}
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

{/* LOBBY TABLE */}
      {currentRoom && (
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
                      ? `🟢 Seat ${seatNum}: ${occupied.profiles?.nickname || 'Player'}${isHostSeat ? ' (Host)' : ''}` 
                      : `🪑 Seat ${seatNum}: Vacant Position`}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Host Start Game Action / Invitee Status Banner */}
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

          <TouchableOpacity style={styles.cancelButton} onPress={() => { setCurrentRoom(null); setUserRole(null); }}>
            <Text style={styles.btnText}>Leave Table</Text>
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
  cardWide: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12, width: '100%', maxWidth: 600, borderWidth: 1, borderColor: '#374151' },
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
  guestStatusText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 }
});
