import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';

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

  // 1. Initial Session Handshake
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

  // 2. Automated Public Desk Syncer & Spawner (Option B Nullable Host Setup)
  const syncLobbySystem = async () => {
    setErrorLog('');
    try {
      const { data: activeRooms, error: fetchError } = await supabase
        .from('rooms')
        .select(`*, room_players(count)`)
        .eq('status', 'lobby');

      if (fetchError) throw fetchError;

      const modes = ['mountain', 'valley', 'flatline'];
      
      // Filter list to find public desks based on your MOU, VAL, FLA 6-character system prefixes
      let verifiedRooms = (activeRooms || []).filter(r => 
        ['MOU', 'VAL', 'FLA'].includes((r.id || '').substring(0, 3))
      );

      // Check if a desk exists for each mode. If not, auto-spawn it!
      for (const mode of modes) {
        const modeExists = verifiedRooms.some(r => r.round_mode === mode);
        if (!modeExists) {
          const prefix = mode.substring(0, 3).toUpperCase();
          const randomDigits = Math.floor(100 + Math.random() * 900);
          const freshCode = `${prefix}${randomDigits}`;
          
          const { data: newRoom, error: insertError } = await supabase.from('rooms').insert({
            id: freshCode,
            host_id: null, // Option B: Public rooms have no human host row requirement
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
      // Deep inspection log to expose the exact raw database response
      console.log("=== DETAILED DATABASE ERROR REJECTION ===");
      console.log("Message:", err.message);
      console.log("Status Code:", err.status);
      console.log("Raw Error Object:", JSON.stringify(err, null, 2));
      
      setErrorLog(`Lobby syncing failed: ${err.message}`);
      console.error('Lobby sync error:', err);
    }
  };

  // 3. Save Profile Nickname
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

  // 4. Create Private Custom Room
  const createPrivateRoom = async () => {
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

  // 5. Join Any Desk (Public or Private)
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

      // If this player fills the 4th seat, launch game state & spawn backup desk
      if (nextSeat === 4) {
        await supabase.from('rooms').update({ status: 'playing' }).eq('id', targetRoomCode);
        const isPublicPrefix = ['MOU', 'VAL', 'FLA'].includes(targetRoomCode.substring(0, 3));
        if (isPublicPrefix) {
          const prefix = mode.substring(0, 3).toUpperCase();
          const randomDigits = Math.floor(100 + Math.random() * 900);
          const freshCode = `${prefix}${randomDigits}`;
          
          await supabase.from('rooms').insert({
            id: freshCode,
            host_id: null, // Public replenishment desks get no host signature
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

      {!isProfileSaved ? (
        <View style={styles.card}>
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
            <Text style={styles.btnText}>Enter Arena</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ width: '100%', alignItems: 'center', gap: 20 }}>
          <Text style={styles.welcomeText}>Welcome, <Text style={{color: '#34d399'}}>{nickname}</Text>!</Text>
          
          {!currentRoom ? (
            <View style={{ width: '100%', maxWidth: 800, gap: 20 }}>
              {/* PUBLIC DESKS SECTION */}
              <View style={styles.cardWide}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15}}>
                  <Text style={styles.cardTitle}>🔥 Public Game Desks</Text>
                  <TouchableOpacity onPress={syncLobbySystem}><Text style={{color: '#60a5fa'}}>🔄 Refresh List</Text></TouchableOpacity>
                </View>
                
                <View style={styles.publicGrid}>
                  {publicDesks.map((desk) => {
                    const count = desk.room_players