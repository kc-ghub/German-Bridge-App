import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { soundManager } from '../../services/soundManager';

const ITEM_H = 36;

export default function BidWheel({
  cardsDealt,
  isFinal,
  forbiddenBid,
  initialBid,
  onSubmitBid,
  loading
}) {
  const bidWheelRef = useRef(null);
  const [selectedBid, setSelectedBid] = useState(initialBid);

  useEffect(() => {
    setSelectedBid(initialBid);
    setTimeout(() => {
      bidWheelRef.current?.scrollTo({ y: initialBid * ITEM_H, animated: false });
    }, 50);
  }, [initialBid]);

  const isSelectedForbidden = isFinal && selectedBid === forbiddenBid;

  return (
    <View style={{ width: '100%', alignItems: 'center', marginTop: 6 }}>
      <Text style={styles.centerArenaSubText}>Roll or tap to select your bid:</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 }}>
        <View style={{ width: 116, height: ITEM_H * 3, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', position: 'relative' }}>
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

        <TouchableOpacity
          disabled={isSelectedForbidden || loading}
          onPress={() => {
            if (typeof soundManager !== 'undefined') soundManager.playBidPlace?.();
            onSubmitBid(selectedBid);
          }}
          style={{
            backgroundColor: isSelectedForbidden ? '#475569' : '#2563eb',
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isSelectedForbidden ? '#64748b' : '#60a5fa',
            opacity: isSelectedForbidden || loading ? 0.75 : 1,
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
}

const styles = StyleSheet.create({
  centerArenaSubText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
  },
});