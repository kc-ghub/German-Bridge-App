import React from 'react';
import { StyleSheet, Text, View, Modal, ScrollView, TouchableOpacity } from 'react-native';

export default function HowToPlayModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.rulesModalContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff' }}>📖 How to Play</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Text style={{ color: '#9ca3af', fontSize: 20, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: '70%' }}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎯 Objective</Text>
              <Text style={styles.sectionText}>Predict the exact number of tricks you will win each round.</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏔️ Round Modes & Trump</Text>
              <Text style={styles.sectionText}>
                Max hand size is floor(52 / Players).{'\n'}
                <Text style={{ fontWeight: '700' }}>Mountain</Text>: 1 → Max → 1 cards{'\n'}
                <Text style={{ fontWeight: '700' }}>Valley</Text>: Max → 1 → Max{'\n'}
                <Text style={{ fontWeight: '700' }}>Flatline</Text>: Constant Max{'\n\n'}
                The top remaining deck card sets the <Text style={{ fontWeight: '700' }}>Trump</Text> suit (or <Text style={{ fontWeight: '700' }}>No Trump</Text> when all 52 cards are dealt).
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🚫 Bidding & "The Hook"</Text>
              <Text style={styles.sectionText}>
                Bidding goes clockwise starting from the Lead (⭐) player.{'\n\n'}
                <Text style={{ fontWeight: '700' }}>The Hook</Text>: The final bidder cannot pick a number that makes total bids equal the cards dealt—someone is guaranteed to miss.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🃏 Trick Play</Text>
              <Text style={styles.sectionText}>
                You must follow the lead suit if you have one; otherwise you may play any card (including Trump).{'\n\n'}
                Highest Trump wins, or highest card of the lead suit. The trick winner leads next.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Scoring</Text>
              <Text style={styles.sectionText}>
                <Text style={{ fontWeight: '700' }}>Exact Contract</Text>: +10 + (Bid)² (e.g., Bid 0 = +10, Bid 3 = +19){'\n'}
                <Text style={{ fontWeight: '700' }}>Missed Contract</Text>: -(Tricks Won - Bid)² (e.g., off by 2 = -4 pts)
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity 
            style={[styles.button, { marginTop: 14, backgroundColor: '#334155', paddingVertical: 10 }]} 
            onPress={onClose}
          >
            <Text style={styles.btnText}>Close Rules</Text>
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
  rulesModalContent: { 
    backgroundColor: '#1e293b', 
    borderRadius: 12, 
    padding: 16, 
    width: '100%', 
    maxWidth: 440, 
    maxHeight: '82%', 
    borderWidth: 1, 
    borderColor: '#334155' 
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6
  },
  sectionText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20
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