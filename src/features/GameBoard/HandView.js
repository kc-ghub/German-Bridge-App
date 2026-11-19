import React from 'react';
import { StyleSheet, Text, View, Animated, Easing, TouchableOpacity, Platform } from 'react-native';
import { isValidPlay, sortHand } from '../../core/gameEngine';
import { soundManager } from '../../services/soundManager';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const CARD_WIDTH = 54;
const CARD_HEIGHT = 84;
const MAX_EXPOSED_WIDTH = 30;

export default function HandView({ 
  hand, 
  selectedIndex, 
  onSelect, 
  onPlay, 
  isMyTurn, 
  leadCard, 
  animatingCardIdx,
  setAnimatingCardIdx,
  flyAnimY,
  flyAnimScale,
  loading,
  handAreaWidth = 0,
  width = 400
}) {
  const myHand = sortHand(hand || []);

  const measuredWidth = handAreaWidth > 0 ? handAreaWidth : Math.min(width - 48, 366);
  const safeWidth = Math.max(250, measuredWidth - 8);
  const fitExposedWidth = myHand.length > 1
    ? (safeWidth - CARD_WIDTH) / (myHand.length - 1)
    : CARD_WIDTH;
  const exposedWidth = Math.min(MAX_EXPOSED_WIDTH, fitExposedWidth);
  const overlapMargin = myHand.length > 1 ? -(CARD_WIDTH - exposedWidth) : 0;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingTop: 22, paddingBottom: 6, overflow: 'visible' }}>
      {myHand.map((card, idx) => {
        const isSelected = selectedIndex === idx;
        const isLegal = isMyTurn ? isValidPlay(myHand, card, leadCard) : false;
        const isMyTurnToPlay = isMyTurn && !loading;

        const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';
        const cardColor = isRed ? '#dc2626' : '#0f172a';
        const symbol = card.suit === 'Spades' ? '♠' : card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : '♣';

        const isCardAnimating = animatingCardIdx === idx;
        const translateYValue = isCardAnimating ? flyAnimY : (isSelected ? -18 : 0);
        const scaleValue = isCardAnimating ? flyAnimScale : 1;

        const onCardPress = () => {
          if (!isMyTurnToPlay || animatingCardIdx !== null) return;
          if (!isLegal) {
            soundManager.playError?.();
            return;
          }
          if (isSelected) {
            soundManager.playCardThrow?.();
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
              onPlay(idx, card);
            });
          } else {
            soundManager.playCardSelect?.();
            onSelect(idx);
          }
        };

        return (
          <AnimatedTouchable
            key={`${card.suit}-${card.rank}-${idx}`}
            activeOpacity={0.9}
            disabled={!isMyTurnToPlay || animatingCardIdx !== null}
            onPress={onCardPress}
            style={[
              styles.playingCard,
              idx > 0 && { marginLeft: overlapMargin },
              {
                opacity: 1,
                zIndex: isCardAnimating ? 999 : (isSelected ? 99 : idx + 1),
                backgroundColor: '#ffffff',
                borderColor: isSelected ? '#38bdf8' : (isLegal && isMyTurn ? '#3b82f6' : '#cbd5e1'),
                borderWidth: isSelected ? 2 : 1,
                transform: [
                  { translateY: translateYValue },
                  { scale: scaleValue }
                ]
              }
            ]}
          >
            <View style={styles.cardTopCorner}>
              <Text style={[styles.cardCornerRank, { color: cardColor }]}>
                {card.rank}
              </Text>
              <Text style={[styles.cardCornerSuit, { color: cardColor }]}>
                {symbol}
              </Text>
            </View>
            <Text style={[styles.cardCenterSymbol, { color: cardColor }]}>{symbol}</Text>
          </AnimatedTouchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  playingCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
  cardTopCorner: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 16,
  },
  cardCornerRank: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  cardCornerSuit: {
    fontSize: 13,
    lineHeight: 14,
  },
  cardCenterSymbol: {
    fontSize: 30,
    textAlign: 'center',
    marginBottom: 8,
  }
});