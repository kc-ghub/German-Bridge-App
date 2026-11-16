import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';

export default function LobbyScreen({
  userRole,
  setUserRole,
  hostAuthPassword,
  setHostAuthPassword,
  isHostAuthenticated,
  nickname,
  setNickname,
  roomNum,
  setRoomNum,
  roomPasscode,
  setRoomPasscode,
  maxPlayers,
  setMaxPlayers,
  roundMode,
  setRoundMode,
  joinRoomNum,
  setJoinRoomNum,
  joinPasscode,
  setJoinPasscode,
  currentRoom,
  players,
  userId,
  loading,
  errorLog,
  onHostAuth,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onLeaveTable,
  copyInviteLink
}) {
  return (
    <>
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
              <TouchableOpacity style={styles.button} onPress={onHostAuth}>
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

              <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981', marginTop: 15 }]} onPress={onCreateRoom}>
                <Text style={styles.btnText}>Create & Launch Table</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

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

          <TouchableOpacity style={styles.button} onPress={onJoinRoom}>
            <Text style={styles.btnText}>Verify & Take Seat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setUserRole(null)}>
            <Text style={{ color: '#60a5fa' }}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

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
              onPress={onStartGame}
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

          <TouchableOpacity style={[styles.cancelButton, currentRoom.status === 'playing' && styles.buttonSmall]} onPress={onLeaveTable}>
            <Text style={styles.btnText}>Leave Table</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151'
  },
  cardWide: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    borderWidth: 1,
    borderColor: '#374151'
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center'
  },
  label: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 16,
    marginBottom: 12
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60a5fa'
  },
  cancelButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16
  },
  rowSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12
  },
  chip: {
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center'
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#60a5fa'
  },
  chipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  lobbyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center'
  },
  subTitleText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14
  },
  seatContainer: {
    gap: 10,
    marginVertical: 10
  },
  seatBadge: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1, borderColor: '#374151'
  },
  seatText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500'
  },
  guestStatusBanner: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  guestStatusText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 14
  }
});