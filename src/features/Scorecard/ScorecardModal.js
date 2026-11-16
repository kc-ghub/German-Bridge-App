import React from 'react';
import { StyleSheet, Text, View, Modal, ScrollView, TouchableOpacity } from 'react-native';

export default function ScorecardModal({ visible, onClose, gameState, players }) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.scoreModalContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff' }}>📜 Match Scorecard</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Text style={{ color: '#9ca3af', fontSize: 20, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }}>
            {(!gameState?.scoreHistory || gameState.scoreHistory.length === 0) ? (
              <Text style={[styles.textCenter, { color: '#9ca3af', fontStyle: 'italic', paddingVertical: 24 }]}>
                No completed rounds yet. Scores will be logged here after Round 1 concludes.
              </Text>
            ) : (
              <View>
                {/* Table Column Headers */}
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#334155', paddingBottom: 6, marginBottom: 6 }}>
                  <Text style={{ flex: 1.1, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>Round</Text>
                  {[...(gameState?.players || [])]
                    .sort((a, b) => a.seat_number - b.seat_number)
                    .map(p => (
                      <Text key={p.user_id} style={[styles.textCenter, { flex: 1.4, color: '#9ca3af', fontSize: 11, fontWeight: '700' }]} numberOfLines={1}>
                        {p.nickname || 'Player'}
                      </Text>
                    ))}
                </View>

                {/* Cumulative Scores Row */}
                <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderColor: '#334155', marginBottom: 6 }}>
                  <Text style={{ flex: 1.1, color: '#f3f4f6', fontSize: 11, fontWeight: '800' }}>TOTAL</Text>
                  {[...(gameState?.players || [])]
                    .sort((a, b) => a.seat_number - b.seat_number)
                    .map(p => (
                    <Text key={p.user_id} style={[styles.textCenter, { flex: 1.4, color: '#60a5fa', fontSize: 12, fontWeight: '800' }]}>
                        {gameState.cumulativeScores?.[p.user_id] || 0}
                    </Text>
                  ))}
                </View>

                {/* Round Rows */}
                {gameState.scoreHistory.map(record => (
                  <View key={record.roundNumber} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderColor: '#1e293b', alignItems: 'center' }}>
                    <Text style={{ flex: 1.1, color: '#f3f4f6', fontSize: 11, fontWeight: '600' }}>
                      {record.roundNumber}
                    </Text>
                    {[...(gameState?.players || [])]
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
            onPress={onClose}
          >
            <Text style={styles.btnText}>Close Scorecard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.75)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16 
  },
  scoreModalContent: { 
    backgroundColor: '#0f172a', 
    borderRadius: 12, 
    padding: 16, 
    width: '100%', 
    maxWidth: 580, 
    borderWidth: 1, 
    borderColor: '#334155' 
  },
  textCenter: { 
    textAlign: 'center' 
  },
  button: {
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14
  }
});