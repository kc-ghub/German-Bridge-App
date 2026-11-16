import React from 'react';
import { StyleSheet, Text, View, Animated, Easing, TouchableOpacity, useWindowDimensions } from 'react-native';
import { isValidPlay, sortHand } from '../../core/gameEngine';
import { soundManager } from '../../services/soundManager';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

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
  flyAnimScale
}) {
  const { width: windowWidth } = useWindowDimensions();

  const myHand = sortHand(hand || []);

  const isCompactHand = myHand.length >= 14;
  const maxHandWidth = Math.min(windowWidth - 36, 386);
  const cardWidth = 52;
  const overlapMargin = isCompactHand
    ? Math.min(-24, -Math.ceil(cardWidth - (maxHandWidth - cardWidth) / (myHand.length - 1)))
    : -24;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 100 }}>
      {myHand.map((card, idx) => {
        const isSelected = selectedIndex === idx;
        const isLegal = isMyTurn ? isValidPlay(myHand, card, leadCard) : false;
        const canInteract = isMyTurn && isLegal;
        const isDisabledOffSuit = isMyTurn && !isLegal;

        const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';
        const cardColor = isDisabledOffSuit ? '#334155' : (isRed ? '#dc2626' : '#0f172a');
        const symbol = card.suit === 'Spades' ? '♠' : card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : '♣';

        const isCardAnimating = animatingCardIdx === idx;
        const translateYValue = isCardAnimating ? flyAnimY : (isSelected ? -18 : 0);
        const scaleValue = isCardAnimating ? flyAnimScale : 1;

        const onCardPress = () => {
          if (!canInteract || animatingCardIdx !== null) return;
          if (isSelected) {
            if (typeof soundManager !== 'undefined') soundManager.playCardThrow?.();
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
            if (typeof soundManager !== 'undefined') soundManager.playCardSelect?.();
            onSelect(idx);
          }
        };

        return (
          <AnimatedTouchable
            key={`${card.suit}-${card.rank}-${idx}`}
            activeOpacity={0.9}
            disabled={!canInteract || animatingCardIdx !== null}
            onPress={onCardPress}
            style={[
              styles.playingCard,
              idx > 0 && { marginLeft: overlapMargin },
              {
                opacity: 1,
                zIndex: isCardAnimating ? 999 : (isSelected ? 99 : idx + 1),
                backgroundColor: isDisabledOffSuit ? '#64748b' : '#ffffff',
                borderColor: isSelected ? '#38bdf8' : (isLegal && isMyTurn ? '#3b82f6' : '#cbd5e1'),
                borderWidth: isSelected ? 2 : 1,
                transform: [
                  { translateY: translateYValue },
                  { scale: scaleValue }
                ]
              }
            ]}
          >
            <View style={[styles.cardTopCorner, isCompactHand && styles.cardTopCornerCompact]}>
              <Text style={[styles.cardCornerRank, isCompactHand && styles.cardCornerTextCompact, { color: cardColor }]}>
                {card.rank}
              </Text>
              <Text style={[styles.cardCornerSuit, isCompactHand && styles.cardCornerTextCompact, { color: cardColor }]}>
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
    width: 52,
    height: 80,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 3,
  },
  cardTopCorner: {
    flexDirection: 'row',
    gap: 2,
  },
  cardTopCornerCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: 15,
    gap: 0,
  },
  cardCornerRank: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardCornerSuit: {
    fontSize: 14,
  },
  cardCornerTextCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  cardCenterSymbol: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
  }
});