import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';

const SYSTEM_LOBBY_UUID = '00000000-0000-0000-0000-000000000000';

export default function App() {
  const [userId, setUserId] = useState(null);
  const [nickname, setNickname] = useState('');
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [publicDesks, setPublicDesks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [lobbyLoginMode, setLobbyLoginMode] = useState(false);

  useEffect(() => {
    async function initSession() {
      try {
        let { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          const { data, error: authError } = await supabase.auth.signInAnonymously();
          if (authError) throw authError;
          user = data?.user;
        }
        if (user) {
          setUserId(user.id);
          setIsAnonymous(user.is_anonymous || false);
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profile) {
            setNickname(profile.nickname);
            setIsProfileSaved(true);
            syncLobbySystem();
          }
        }
      } catch (err) {
        setErrorLog(`Session initialization failed: ${err.message}`);
      }
    }
    initSession();
  }, []);

  const syncLobbySystem = async () => {
    setErrorLog('');
    try {
      const { data: activeRooms, error: fetchError } = await supabase
        .from('rooms')
        .select(`*, room_players(count)`)
        .eq('status', 'lobby')
        .eq('host_id', SYSTEM_LOBBY_UUID);
      if (fetchError) throw fetchError;
      const modes = ['mountain', 'valley', 'flatline'];
      let verifiedRooms = activeRooms || [];
      for (const mode of modes) {
        const modeExists = verifiedRooms.some(r => r.round_mode === mode);
        if (!modeExists) {
          const prefix = mode.substring(0, 3).toUpperCase();
          const randomDigits = Math.floor(100 + Math.random() * 900);
          const freshCode = `${prefix}${randomDigits}`;
          const { data: newRoom, error: insertError } = await supabase.from('rooms').insert({
            id: freshCode,
            host_id: SYSTEM_LOBBY_UUID,
            status: 'lobby',
            max_players: 4,
            round_mode: mode
          }).select().single();
          if (insertError) throw insertError;
          if (newRoom) {
            newRoom.room_players = [{ count: 0 }];
            verifiedRooms.push(newRoom);
          }
        }
      }
      setPublicDesks(verifiedRooms);
    } catch (err) {
      setErrorLog(`Lobby syncing failed: ${err.message}`);
    }
  };

  const handleLogin = async () => {
    if (!authEmail.trim() || !authPassword.trim()) return;
    setLoading(true);
    setErrorLog('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword.trim()
      });
      if (error) throw error;
      if (data?.user) {
        setUserId(data.user.id);
        setIsAnonymous(data.user.is_anonymous || false);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (profile) {
          setNickname(profile.nickname);
          setIsProfileSaved(true);
        } else {
          setIsProfileSaved(false);
          setNickname('');
        }
        setAuthEmail('');
        setAuthPassword('');
        setShowUpgradeForm(false);
        syncLobbySystem();
      }
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpUpgrade = async () => {
    if (!authEmail.trim() || !authPassword.trim()) return;
    setLoading(true);
    setErrorLog('');
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: authEmail.trim(),
        password: authPassword.trim()
      });
      if (error) throw error;
      if (data?.user) {
        setIsAnonymous(false);
        setShowUpgradeForm(false);
        setAuthEmail('');
        setAuthPassword('');
        alert("Account verified! Your profile and gaming achievements are now permanent.");
      }
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setErrorLog('');
    try {
      await supabase.auth.signOut();
      setUserId(null);
      setNickname('');
      setIsProfileSaved(false);
      setIsAnonymous(true);
      const { data, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
      if (data?.user) {
        setUserId(data.user.id);
        setIsAnonymous(true);
      }
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    setErrorLog('');
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        nickname: nickname.trim(),
        avatar_index: 1,
        title: 'Freshman'
      });
      if (error) throw error;
      setIsProfileSaved(true);
      syncLobbySystem();
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createPrivateRoom = async () => {
    if (isAnonymous) return;
    setLoading(true);
    setErrorLog('');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const { error: roomError } = await supabase.from('rooms').insert({
        id: code,
        host_id: userId,
        status: 'lobby',
        max_players: 4,
        round_mode: 'mountain'
      });
      if (roomError) throw roomError;
      const { error: seatError } = await supabase.from('room_players').insert({ room_id: code, user_id: userId, seat_number: 1 });
      if (seatError) throw seatError;
      fetchRoomState(code);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinDesk = async (targetRoomCode, currentOccupancy = 0, mode = 'mountain') => {
    setLoading(true);
    setErrorLog('');
    try {
      const nextSeat = currentOccupancy + 1;
      const { error: joinError } = await supabase.from('room_players').insert({
        room_id: targetRoomCode,
        user_id: userId,
        seat_number: nextSeat
      });
      if (joinError) throw new Error("Seat already occupied! Try refreshing.");
      if (nextSeat === 4) {
        await supabase.from('rooms').update({ status: 'playing' }).eq('id', targetRoomCode);
        const isPublicPrefix = ['MOU', 'VAL', 'FLA'].includes(targetRoomCode.substring(0, 3));
        if (isPublicPrefix) {
          const prefix = mode.substring(0, 3).toUpperCase();
          const randomDigits = Math.floor(100 + Math.random() * 900);
          const freshCode = `${prefix}${randomDigits}`;
          await supabase.from('rooms').insert({
            id: freshCode,
            host_id: SYSTEM_LOBBY_UUID,
            status: 'lobby',
            max_players: 4,
            round_mode: mode
          });
        }
      }
      fetchRoomState(targetRoomCode);
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomState = async (code) => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', code).single();
    if (room) {
      setCurrentRoom(room);
      const { data: members } = await supabase.from('room_players')
        .select(`user_id, seat_number, profiles(nickname)`)
        .eq('room_id', code);
      setPlayers(members || []);
    }
    syncLobbySystem();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>German Bridge 🃏</Text>
      {errorLog ? <Text style={styles.errorText}>⚠️ {errorLog}</Text> : null}
      {loading && <ActivityIndicator size="small" color="#60a5fa" style={{ marginBottom: 10 }} />}

      {!isProfileSaved ? (
        <View style={styles.card}>
          {!isLoginMode ? (
            <View>
              <Text style={styles.cardTitle}>Choose Player Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter nickname..."
                placeholderTextColor="#6b7280"
                maxLength={12}
                value={nickname}
                onChangeText={setNickname}
              />
              <TouchableOpacity style={styles.button} onPress={saveProfile}>
                <Text style={styles.btnText}>Enter Arena as Guest</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setIsLoginMode(true)}>
                <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '500' }}>Already have an account? Log In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.cardTitle}>Player Account Login</Text>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                value={authEmail}
                onChangeText={setAuthEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#6b7280"
                secureTextEntry
                autoCapitalize="none"
                value={authPassword}
                onChangeText={setAuthPassword}
              />
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.btnText}>Sign In & Enter Arena</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setIsLoginMode(false)}>
                <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '500' }}>Need a guest profile? Set Guest Name</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={{ width: '100%', alignItems: 'center', gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={styles.welcomeText}>Welcome, <Text style={{color: '#34d399'}}>{nickname}</Text>!</Text>
            {!isAnonymous ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '800', backgroundColor: '#78350f', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12 }}>🏆 MEMBER</Text>
                <TouchableOpacity onPress={handleLogout}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>[Log Out]</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setShowUpgradeForm(!showUpgradeForm); setLobbyLoginMode(false); }}>
                <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>⚙️ Account Options (Sign Up / Log In)</Text>
              </TouchableOpacity>
            )}
          </View>

          {isAnonymous && showUpgradeForm && (
            <View style={[styles.card, { maxWidth: 800, borderColor: '#f59e0b', borderWidth: 1 }]}>
              {!lobbyLoginMode ? (
                <View>
                  <Text style={[styles.cardTitle, { fontSize: 16, marginBottom: 4, color: '#f59e0b' }]}>🔒 Convert Guest to Permanent Account</Text>
                  <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>Enter an email and password to preserve your nickname and stats across logins.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#6b7280"
                    autoCapitalize="none"
                    value={authEmail}
                    onChangeText={setAuthEmail}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Choose Password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry
                    autoCapitalize="none"
                    value={authPassword}
                    onChangeText={setAuthPassword}
                  />
                  <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={handleSignUpUpgrade}>
                    <Text style={styles.btnText}>Register Account</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setLobbyLoginMode(true)}>
                    <Text style={{ color: '#60a5fa', fontSize: 13 }}>Already have a member account? Log In here</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={[styles.cardTitle, { fontSize: 16, marginBottom: 4, color: '#3b82f6' }]}>🔑 Switch to Registered Account</Text>
                  <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>Log into your existing player account to sync your profile details.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Registered Email"
                    placeholderTextColor="#6b7280"
                    autoCapitalize="none"
                    value={authEmail}
                    onChangeText={setAuthEmail}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry
                    autoCapitalize="none"
                    value={authPassword}
                    onChangeText={setAuthPassword}
                  />
                  <TouchableOpacity style={[styles.button, { backgroundColor: '#2563eb' }]} onPress={handleLogin}>
                    <Text style={styles.btnText}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setLobbyLoginMode(false)}>
                    <Text style={{ color: '#f59e0b', fontSize: 13 }}>Need to upgrade this guest session instead? Register here</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          
          {!currentRoom ? (
            <View style={{ width: '100%', maxWidth: 800, gap: 20 }}>
              <View style={styles.cardWide}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15}}>
                  <Text style={styles.cardTitle}>🔥 Public Game Desks</Text>
                  <TouchableOpacity onPress={syncLobbySystem}><Text style={{color: '#60a5fa'}}>🔄 Refresh List</Text></TouchableOpacity>
                </View>
                <View style={styles.publicGrid}>
                  {publicDesks.map((desk) => {
                    const count = desk.room_players?.[0]?.count || 0;
                    return (
                      <View key={desk.id} style={styles.deskItem}>
                        <View>
                          <Text style={styles.deskModeName}>{desk.round_mode.toUpperCase()} DESK</Text>
                          <Text style={styles.deskCodeLabel}>{desk.id} • {count}/4 Seated</Text>
                        </View>
                        <TouchableOpacity 
                          style={[styles.joinMiniBtn, count >= 4 && {backgroundColor: '#4b5563'}]}
                          disabled={count >= 4}
                          onPress={() => joinDesk(desk.id, count, desk.round_mode)}
                        >
                          <Text style={styles.btnText}>{count >= 4 ? 'Full' : 'Sit Down'}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.rowLayout}>
                <View style={styles.cardHalf}>
                  <Text style={styles.cardTitle}>Custom Match</Text>
                  <TouchableOpacity 
                    style={[styles.button, isAnonymous ? {backgroundColor: '#4b5563'} : {backgroundColor: '#10b981'}]} 
                    disabled={isAnonymous}
                    onPress={createPrivateRoom}
                  >
                    <Text style={styles.btnText}>{isAnonymous ? '🔒 Members Only' : 'Host Private Room'}</Text>
                  </TouchableOpacity>
                  {isAnonymous && <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 6, textAlign: 'center' }}>Sign up above to unlock custom rooms</Text>}
                </View>
                <View style={styles.cardHalf}>
                  <Text style={styles.cardTitle}>Direct Invite Code</Text>
                  <View style={{flexDirection: 'row', gap: 10}}>
                    <TextInput
                      style={[styles.input, {flex: 1, marginBottom: 0}]}
                      placeholder="6-Char Code"
                      placeholderTextColor="#6b7280"
                      autoCapitalize="characters"
                      maxLength={8}
                      value={roomCode}
                      onChangeText={setRoomCode}
                    />
                    <TouchableOpacity style={styles.button} onPress={() => joinDesk(roomCode.toUpperCase(), 0)}>
                      <Text style={styles.btnText}>Join</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.cardWide}>
              <Text style={styles.lobbyCodeTitle}>Desk Code: <Text style={styles.highlightText}>{currentRoom.id}</Text></Text>
              <Text style={styles.subTitleText}>Mode: {currentRoom.round_mode.toUpperCase()} • Waiting for seats to fill...</Text>
              <View style={styles.seatContainer}>
                {[1, 2, 3, 4].map((seatNum) => {
                  const occupied = players.find(p => p.seat_number === seatNum);
                  return (
                    <View key={seatNum} style={[styles.seatBadge, occupied && {borderColor: '#10b981'}]}>
                      <Text style={styles.seatText}>
                        {occupied ? `🟢 Seat ${seatNum}: ${occupied.profiles?.nickname}` : `🪑 Seat ${seatNum}: Vacant Position`}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setCurrentRoom(null)}>
                <Text style={styles.btnText}>Stand Up / Leave Desk</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 34, fontWeight: 'bold', color: '#ffffff', marginBottom: 20 },
  welcomeText: { fontSize: 20, color: '#ffffff', fontWeight: '600' },
  card: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#374151' },
  cardWide: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12, width: '100%', borderWidth: 1, borderColor: '#374151' },
  rowLayout: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 16 },
  cardHalf: { flex: 1, backgroundColor: '#1e293b', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 12 },
  lobbyCodeTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  highlightText: { color: '#60a5fa' },
  subTitleText: { color: '#9ca3af', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  input: { backgroundColor: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#4b5563', fontSize: 15 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  seatContainer: { gap: 10, marginVertical: 10 },
  seatBadge: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3b82f6' },
  seatText: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  errorText: { color: '#f87171', marginBottom: 15, fontWeight: '600' },
  publicGrid: { gap: 12 },
  deskItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  deskModeName: { color: '#ffffff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  deskCodeLabel: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  joinMiniBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 }
});