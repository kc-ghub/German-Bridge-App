import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';

export default function LobbyScreen({
  userRole,
  setUserRole,
  statusBanner,
  setStatusBanner,
  authView,
  setAuthView,
  hostEmail,
  setHostEmail,
  hostAuthPassword,
  setHostAuthPassword,
  hostInviteCode,
  setHostInviteCode,
  hostSignupNickname,
  setHostSignupNickname,
  authenticatedHostEmail,
  isHostAuthenticated,
  nickname,
  setNickname,
  roomPasscode,
  setRoomPasscode,
  maxPlayers,
  setMaxPlayers,
  roundMode,
  setRoundMode,
  joinRoomCode,
  setJoinRoomCode,
  joinPasscode,
  setJoinPasscode,
  currentRoom,
  players,
  userId,
  loading,
  onHostEmailLogin,
  onHostEmailSignUp,
  onResendVerification,
  onForgotPassword,
  onHostSignOut,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onLeaveTable,
  copyInviteLink,
  onOpenRules
}) {
  const handleAuthViewChange = (newView) => {
    setStatusBanner?.(null);
    setAuthView(newView);
  };

  const renderStatusBanner = () => {
    if (!statusBanner?.message) return null;
    const bannerStyles = {
      error: { backgroundColor: '#7f1d1d', borderColor: '#f87171', textColor: '#f87171', icon: '⚠️ ' },
      success: { backgroundColor: '#064e3b', borderColor: '#34d399', textColor: '#34d399', icon: '✅ ' },
      info: { backgroundColor: '#1e3a8a', borderColor: '#60a5fa', textColor: '#60a5fa', icon: 'ℹ️ ' }
    };
    const style = bannerStyles[statusBanner.type] || bannerStyles.info;
    return (
      <View style={[styles.statusBanner, { backgroundColor: style.backgroundColor, borderColor: style.borderColor }]}>
        <Text style={[styles.statusBannerText, { color: style.textColor }]}>
          {style.icon}{statusBanner.message}
        </Text>
      </View>
    );
  };

  const renderHostAuthCard = () => {
    if (authView === 'login') {
      return (
        <View>
          <Text style={styles.cardTitle}>Host Beta Sign In</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={hostEmail}
            onChangeText={setHostEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password..."
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={hostAuthPassword}
            onChangeText={setHostAuthPassword}
          />
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={onHostEmailLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>Sign In</Text>
          </TouchableOpacity>
          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => handleAuthViewChange('forgot_password')}>
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleAuthViewChange('signup')}>
              <Text style={styles.linkText}>New beta host? Create an account</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => { setStatusBanner?.(null); setUserRole(null); }}>
            <Text style={{ color: '#60a5fa' }}>← Back to Selection</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authView === 'signup') {
      return (
        <View>
          <Text style={styles.cardTitle}>Create Beta Host Account</Text>
          <Text style={styles.label}>Display Nickname</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Display Name"
            placeholderTextColor="#6b7280"
            value={hostSignupNickname}
            onChangeText={setHostSignupNickname}
          />
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={hostEmail}
            onChangeText={setHostEmail}
          />
          <Text style={styles.label}>Password (min 6 chars)</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 6 characters"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={hostAuthPassword}
            onChangeText={setHostAuthPassword}
          />
          <Text style={styles.label}>Beta Invite Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. BRIDGE2026"
            placeholderTextColor="#6b7280"
            autoCapitalize="characters"
            value={hostInviteCode}
            onChangeText={setHostInviteCode}
          />
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={onHostEmailSignUp}
            disabled={loading}
          >
            <Text style={styles.btnText}>Create Host Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => handleAuthViewChange('login')}>
            <Text style={{ color: '#60a5fa' }}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authView === 'verify_pending') {
      return (
        <View>
          <Text style={styles.cardTitle}>Verify Your Email</Text>
          <Text style={styles.bodyText}>
            We sent a confirmation link to {hostEmail}. Click the link in your inbox to activate your host table access.
          </Text>
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={onResendVerification}
            disabled={loading}
          >
            <Text style={styles.btnText}>Resend Confirmation Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => handleAuthViewChange('login')}>
            <Text style={{ color: '#60a5fa' }}>← Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (authView === 'forgot_password') {
      return (
        <View>
          <Text style={styles.cardTitle}>Reset Host Password</Text>
          <Text style={styles.label}>Registered Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={hostEmail}
            onChangeText={setHostEmail}
          />
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={onForgotPassword}
            disabled={loading}
          >
            <Text style={styles.btnText}>Send Reset Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => handleAuthViewChange('login')}>
            <Text style={{ color: '#60a5fa' }}>← Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <>
      {!userRole && !currentRoom && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.cardTitle}>Game Access</Text>
            <TouchableOpacity
              onPress={onOpenRules}
              style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ fontSize: 12 }}>📖</Text>
              <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }}>Rules</Text>
            </TouchableOpacity>
          </View>
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
          {renderStatusBanner()}
          {!isHostAuthenticated ? (
            renderHostAuthCard()
          ) : (
            <View>
              <View style={styles.hostStatusBar}>
                <Text style={styles.hostStatusText}>🟢 {authenticatedHostEmail || 'Verified Host'}</Text>
                <TouchableOpacity style={styles.signOutButton} onPress={onHostSignOut}>
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.cardTitle, { marginTop: 16 }]}>Table Settings</Text>
              
              <Text style={styles.label}>Host Nickname</Text>
              <TextInput
                style={styles.input}
                placeholder="Your Display Name"
                placeholderTextColor="#6b7280"
                value={nickname}
                onChangeText={setNickname}
              />

              <Text style={styles.infoText}>🎲 A unique 4-character Table Code will be generated automatically.</Text>

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
          {renderStatusBanner()}
          <Text style={styles.cardTitle}>Join Game Desk</Text>

          <Text style={styles.label}>Your Nickname</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name..."
            placeholderTextColor="#6b7280"
            value={nickname}
            onChangeText={setNickname}
          />

          <Text style={styles.label}>4-Character Table Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. K7M2"
            placeholderTextColor="#6b7280"
            autoCapitalize="characters"
            maxLength={4}
            value={joinRoomCode}
            onChangeText={(text) => setJoinRoomCode(text.toUpperCase())}
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
          {renderStatusBanner()}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lobbyTitle}>Game Desk Number: <Text style={{ color: '#60a5fa' }}>{currentRoom.id}</Text></Text>
              <Text style={styles.subTitleText}>Mode: {currentRoom.round_mode?.toUpperCase()} • Seats Occupied: {players.length}/{currentRoom.max_players}</Text>
            </View>
            <TouchableOpacity
              onPress={onOpenRules}
              style={{ backgroundColor: '#0f172a', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10 }}
            >
              <Text style={{ fontSize: 12 }}>📖</Text>
              <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }}>Rules</Text>
            </TouchableOpacity>
          </View>

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
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1
  },
  statusBannerText: {
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center'
  },
  hostStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16
  },
  hostStatusText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14
  },
  signOutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  signOutButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10
  },
  linkText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '500'
  },
  bodyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20
  },
  buttonDisabled: {
    opacity: 0.5
  },
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
  infoText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 4,
    fontStyle: 'italic'
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