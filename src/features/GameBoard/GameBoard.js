import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BidWheel, HandView } from './index';
import { sortHand, calculateForbiddenBid, isFinalBidder, getPlayerSeat } from '../../core/gameEngine';

const GameBoard = ({
  currentRoom,
  userId,
  players,
  nickname,
  loading,
  errorLog,
  roundCountdown,
  trickHold,
  selectedCardIdx,
  setSelectedCardIdx,
  animatingCardIdx,
  setAnimatingCardIdx,
  flyAnimY,
  flyAnimScale,
  isSoundMuted,
  setIsSoundMuted,
  showScoreModal,
  setShowScoreModal,
  onPlaceBid,
  onPlayCard,
  onNextRound,
  onEndGame,
  onResetToLobby,
  onLeaveTable,
  soundManager
}) => {
  const getPlayerName = (identifier) => {
    const playersList = currentRoom?.game_state?.players || [];
    const player = typeof identifier === 'number' 
      ? playersList.find(p => p.seat_number === identifier)
      : playersList.find(p => p.user_id === identifier);
    return player?.nickname || (typeof identifier === 'number' ? `Seat ${identifier}` : 'Player');
  };
  return (
    <View style={styles.cardWide}>
      <View style={styles.boardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.boardTitle}>Desk #{currentRoom.id}</Text>
          <Text style={styles.boardSubTitle}>
            Round {currentRoom.game_state?.roundNumber || 1} of {currentRoom.game_state?.totalRounds || 25}
          </Text>
          <Text style={{ fontSize: 12, color: '#cbd5e1', fontWeight: '600', marginTop: 2 }}>
            {currentRoom.game_state?.cardsDealt || 0} Cards
          </Text>
          <Text style={{ fontSize: 11, color: '#38bdf8', fontWeight: '800', letterSpacing: 0.6, marginTop: 2 }}>
            {(currentRoom.game_state?.mode || currentRoom.round_mode || 'mountain').toUpperCase()}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 10 }}>
          <TouchableOpacity
            onPress={() => setShowScoreModal(true)}
            style={{ backgroundColor: '#0f172a', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{ fontSize: 12 }}>📊</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }}>Scorecard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (typeof soundManager !== 'undefined' && soundManager.toggleMute) {
                const muted = soundManager.toggleMute();
                setIsSoundMuted(muted);
              }
            }}
            style={{ backgroundColor: '#0f172a', width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 14 }}>{isSoundMuted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'center', marginRight: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#10b981', letterSpacing: 0.5, marginBottom: 3 }}>
            TRUMP
          </Text>
          {currentRoom.game_state?.isNoTrump ? (
            <View style={{ width: 44, height: 62, borderRadius: 6, backgroundColor: '#78350f', borderWidth: 1, borderColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 11 }}>NT</Text>
            </View>
          ) : currentRoom.game_state?.trumpCard ? (
            <View style={{ width: 44, height: 62, borderRadius: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', padding: 4, justifyContent: 'space-between' }}>
              <Text style={{ color: (currentRoom.game_state.trumpCard.suit === 'Hearts' || currentRoom.game_state.trumpCard.suit === 'Diamonds') ? '#dc2626' : '#0f172a', fontWeight: '800', fontSize: 12, lineHeight: 13 }}>
                {currentRoom.game_state.trumpCard.rank}
              </Text>
              <Text style={[styles.textCenter, { color: (currentRoom.game_state.trumpCard.suit === 'Hearts' || currentRoom.game_state.trumpCard.suit === 'Diamonds') ? '#dc2626' : '#0f172a', fontSize: 20, lineHeight: 22 }]}>
                {currentRoom.game_state.trumpCard.suit === 'Spades' ? '♠' : currentRoom.game_state.trumpCard.suit === 'Hearts' ? '♥' : currentRoom.game_state.trumpCard.suit === 'Diamonds' ? '♦' : '♣'}
              </Text>
            </View>
          ) : (
            <View style={{ width: 44, height: 62, borderRadius: 6, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#64748b', fontSize: 11 }}>—</Text>
            </View>
          )}
        </View>
      </View>

      {(() => {
        const allPlayers = [...(currentRoom.game_state?.players || [])].sort(
          (a, b) => a.seat_number - b.seat_number
        );
        const myIdx = allPlayers.findIndex(p => p.user_id === userId);
        const orderedOpponents =
          myIdx !== -1
            ? [...allPlayers.slice(myIdx + 1), ...allPlayers.slice(0, myIdx)]
            : allPlayers.filter(p => p.user_id !== userId);

        return (
          <View style={styles.opponentsGrid}>
            {orderedOpponents.map((opp) => {
              const oppBid = currentRoom.game_state?.bids?.[opp.user_id];
              const oppWon = currentRoom.game_state?.tricksWon?.[opp.user_id] ?? 0;
              const isOppTurn = String(currentRoom.game_state?.activeSeat) === String(opp.seat_number);
              const isOppLead = String(currentRoom.game_state?.initiativeSeat) === String(opp.seat_number);

              return (
                <View
                  key={opp.user_id}
                  style={[
                    styles.opponentCard,
                    isOppTurn && { borderColor: '#38bdf8', backgroundColor: '#132238' },
                  ]}
                >
                  <Text numberOfLines={1} style={styles.oppNameText}>
                    {opp.seat_number}. {opp.nickname || 'Player'}{isOppLead ? ' ⭐' : ''}
                  </Text>
                  <Text style={styles.oppContractText}>
                    Bid: {oppBid !== undefined ? oppBid : '—'} | Won: {oppWon}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}

      <View style={styles.centerArena}>
        {currentRoom.game_state?.phase === 'bidding' ? (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <Text style={styles.centerArenaTitle}>
              {currentRoom.game_state.activeSeat === getPlayerSeat(currentRoom.game_state, userId)
                ? "👉 It's Your Turn to Bid!"
                : `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Bid...`}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginVertical: 8 }}>
              {currentRoom.game_state.players?.map((p) => {
                const playerBid = currentRoom.game_state.bids?.[p.user_id];
                const hasBid = playerBid !== undefined;
                return (
                  <View key={p.user_id} style={{ alignItems: 'center', minWidth: 52, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#1e293b', borderRadius: 6, borderWidth: 1, borderColor: '#334155' }}>
                    <Text style={{ color: '#9ca3af', fontSize: 11 }} numberOfLines={1}>{getPlayerName(p.user_id)}</Text>
                    <Text style={{ color: hasBid ? '#10b981' : '#64748b', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                      {hasBid ? playerBid : '?'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {currentRoom.game_state.activeSeat === getPlayerSeat(currentRoom.game_state, userId) && (() => {
              const cardsDealt = currentRoom.game_state.cardsDealt || 1;
              const committedBids = Object.values(currentRoom.game_state.bids || {});
              const isFinal = isFinalBidder(currentRoom.game_state.players.length, committedBids.length);
              const forbiddenBid = isFinal ? calculateForbiddenBid(cardsDealt, committedBids) : -1;
              const initialBid = forbiddenBid === 0 ? 1 : 0;

              return (
                <BidWheel
                  cardsDealt={cardsDealt}
                  isFinal={isFinal}
                  forbiddenBid={forbiddenBid}
                  initialBid={initialBid}
                  onSubmitBid={onPlaceBid}
                  loading={loading}
                />
              );
            })()}
          </View>
        ) : (currentRoom.game_state?.phase === 'trick' || trickHold) ? (
          (() => {
            const mySeat = getPlayerSeat(currentRoom.game_state, userId);
            const isMyTurn = String(currentRoom.game_state.activeSeat) === String(mySeat);
            const activeTrick = currentRoom.game_state.trick || [];
            const lastTrick = currentRoom.game_state.lastTrickResult;
            const isShowingLastTrick = activeTrick.length === 0 && lastTrick?.cards?.length > 0 && trickHold;
            const displayCards = isShowingLastTrick ? lastTrick.cards : activeTrick;

            const isFinalTrick = currentRoom.game_state?.phase === 'scoring' || currentRoom.game_state?.phase === 'game_over';
            let statusTitle = `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Play...`;
            if (trickHold) {
              statusTitle = isFinalTrick 
                ? `Final Trick Won by ${getPlayerName(lastTrick?.winnerId)}!` 
                : `Trick Won by ${getPlayerName(lastTrick?.winnerId)}`;
            } else if (isMyTurn) {
              statusTitle = activeTrick.length === 0 
                ? "👉 It's Your Turn to Lead the Trick!" 
                : "👉 It's Your Turn to Play!";
            } else {
              statusTitle = activeTrick.length === 0
                ? `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Lead...`
                : `Waiting for ${getPlayerName(currentRoom.game_state.activeSeat)} to Play...`;
            }

            const totalBids = Object.values(currentRoom.game_state.bids || {}).reduce(
              (sum, val) => sum + Number(val || 0),
              0
            );
            const cardsDealt = currentRoom.game_state.cardsDealt || 1;
            const bidDiff = totalBids - cardsDealt;
            const isFight = bidDiff > 0;
            const diffCount = Math.abs(bidDiff);
            const tensionLabel = bidDiff === 0
              ? '⚖️ 平注 (Even)'
              : isFight
                ? `⚔️ 搶 ${diffCount} 注 (Fight +${diffCount})`
                : `🛡️ 讓 ${diffCount} 注 (Yield -${diffCount})`;

            return (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: isFight ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    borderColor: isFight ? '#ef4444' : '#10b981',
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 16,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '600' }}>
                    Total Bids: {totalBids}/{cardsDealt}
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 12 }}>|</Text>
                  <Text
                    style={{
                      color: isFight ? '#fca5a5' : '#6ee7b7',
                      fontSize: 12,
                      fontWeight: '800',
                    }}
                  >
                    {tensionLabel}
                  </Text>
                </View>
                <Text style={styles.centerArenaTitle}>{statusTitle}</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10, minHeight: 74, alignItems: 'center' }}>
                  {displayCards.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                      <Text style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                        Table cleared. Waiting for {getPlayerName(currentRoom.game_state.activeSeat)} to lead...
                      </Text>
                    </View>
                  ) : (
                    displayCards.map((play, idx) => {
                      const isRed = play.card.suit === 'Hearts' || play.card.suit === 'Diamonds';
                      const suitColor = isRed ? '#dc2626' : '#0f172a';
                      const suitSymbol =
                        play.card.suit === 'Spades'
                          ? '♠'
                          : play.card.suit === 'Hearts'
                          ? '♥'
                          : play.card.suit === 'Diamonds'
                          ? '♦'
                          : '♣';
                      const seatPlayer = currentRoom.game_state.players?.find(p => p.user_id === play.user_id);
                      const isCompactTrick = (currentRoom.game_state.players?.length || 4) >= 5;

                      return (
                        <View key={`${play.user_id}-${idx}`} style={{ alignItems: 'center' }}>
                          <View
                            style={{
                              width: isCompactTrick ? 44 : 52,
                              height: isCompactTrick ? 62 : 74,
                              backgroundColor: '#ffffff',
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#cbd5e1',
                              padding: 4,
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: suitColor, fontWeight: '800', fontSize: isCompactTrick ? 13 : 15, lineHeight: 15 }}>
                              {play.card.rank}
                            </Text>
                            <Text style={[styles.textCenter, { color: suitColor, fontSize: isCompactTrick ? 20 : 24, lineHeight: isCompactTrick ? 22 : 26 }]}>
                              {suitSymbol}
                            </Text>
                          </View>
                          <Text style={{ color: '#9ca3af', fontSize: isCompactTrick ? 10 : 11, marginTop: isCompactTrick ? 3 : 5, fontWeight: '600' }} numberOfLines={1}>
                            {seatPlayer?.nickname || `Seat ${seatPlayer?.seat_number || '?'}`}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })()
        ) : currentRoom.game_state?.phase === 'scoring' ? (
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 6 }}>
            <Text style={styles.centerArenaTitle}>🏆 Round {currentRoom.game_state.roundNumber} Complete</Text>
            {currentRoom.game_state?.lastTrickResult && (
              <Text style={{ color: '#60a5fa', fontWeight: '700', fontSize: 13, marginBottom: 8 }}>
                Final Trick Won by {getPlayerName(currentRoom.game_state.lastTrickResult.winnerId)} (Takes Round {currentRoom.game_state.roundNumber + 1} Lead)
              </Text>
            )}

            <View style={{ width: '95%', backgroundColor: '#0f172a', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#334155', marginVertical: 6 }}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1e293b', paddingBottom: 4, marginBottom: 4 }}>
                <Text style={{ flex: 1.2, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>PLAYER</Text>
                <Text style={[styles.textCenter, { flex: 1, color: '#9ca3af', fontSize: 11, fontWeight: '700' }]}>BID</Text>
                <Text style={[styles.textCenter, { flex: 1, color: '#9ca3af', fontSize: 11, fontWeight: '700' }]}>WON</Text>
                <Text style={{ flex: 1.2, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>ROUND</Text>
                <Text style={{ flex: 1.2, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>TOTAL</Text>
              </View>
              {currentRoom.game_state.players?.map(p => {
                const bid = currentRoom.game_state.bids?.[p.user_id] ?? 0;
                const won = currentRoom.game_state.tricksWon?.[p.user_id] ?? 0;
                const pts = currentRoom.game_state.roundScores?.[p.user_id] ?? 0;
                const total = currentRoom.game_state.cumulativeScores?.[p.user_id] ?? 0;
                const isSuccess = bid === won;

                return (
                  <View key={p.user_id} style={{ flexDirection: 'row', paddingVertical: 3 }}>
                    <Text style={{ flex: 1.2, color: '#f3f4f6', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{p.nickname || 'Player'}</Text>
                    <Text style={[styles.textCenter, { flex: 1, color: '#9ca3af', fontSize: 12 }]}>{bid}</Text>
                    <Text style={[styles.textCenter, { flex: 1, color: '#9ca3af', fontSize: 12 }]}>{won}</Text>
                    <Text style={{ flex: 1.2, color: isSuccess ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: '700', textAlign: 'right' }}>
                      {pts >= 0 ? `+${pts}` : pts}
                    </Text>
                    <Text style={{ flex: 1.2, color: '#60a5fa', fontSize: 12, fontWeight: '800', textAlign: 'right' }}>
                      {total}
                    </Text>
                  </View>
                );
              })}
            </View>

            {currentRoom.game_state.roundNumber >= currentRoom.game_state.totalRounds ? (
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: '#eab308', fontSize: 16, fontWeight: '800' }}>
                  🏆 All {currentRoom.game_state.totalRounds} Rounds Completed!
                </Text>
                <Text style={{ color: '#38bdf8', fontSize: 13, marginTop: 4 }}>
                  Showing Final Standings in {roundCountdown !== null ? roundCountdown : 5}s...
                </Text>
                {currentRoom.host_id === userId && (
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#eab308', marginTop: 10, paddingVertical: 8, paddingHorizontal: 20 }]}
                    onPress={onEndGame}
                  >
                    <Text style={[styles.btnText, { color: '#0f172a', fontWeight: '800' }]}>
                      🏆 View Final Podium Now
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              currentRoom.game_state?.config?.requireManualNextRound ? (
                currentRoom.host_id === userId ? (
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#10b981', marginTop: 10, paddingVertical: 10, paddingHorizontal: 22 }]}
                    onPress={onNextRound}
                  >
                    <Text style={styles.btnText}>
                      ▶ Start Round {currentRoom.game_state.roundNumber + 1}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic', marginTop: 10 }}>
                    Waiting for Host to start Round {currentRoom.game_state.roundNumber + 1}...
                  </Text>
                )
              ) : (
                <View style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: '#38bdf8', fontSize: 14, fontWeight: '700' }}>
                    ⏱ Round {currentRoom.game_state.roundNumber + 1} starting in {roundCountdown !== null ? roundCountdown : 5}s...
                  </Text>
                  {currentRoom.host_id === userId && (
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: '#2563eb', marginTop: 8, paddingVertical: 6, paddingHorizontal: 16 }]}
                      onPress={onNextRound}
                    >
                      <Text style={[styles.btnText, { fontSize: 13 }]}>Deal Now ⏭</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            )}
          </View>
        ) : currentRoom.game_state?.phase === 'game_over' ? (
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#eab308', marginBottom: 4 }}>
              👑 Match Finished!
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
              Final Leaderboard after {currentRoom.game_state.totalRounds} Rounds
            </Text>

            <View style={{ width: '95%', backgroundColor: '#0f172a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155' }}>
              {(() => {
                const gs = currentRoom.game_state;
                if (!gs) return null;

                const sortedPlayers = [...(gs.players || [])]
                  .sort((a, b) => (gs.cumulativeScores?.[b.user_id] || 0) - (gs.cumulativeScores?.[a.user_id] || 0));

                if (sortedPlayers.length === 0) return null;

                const rankedPlayers = [];
                let rank = 1;
                for (let i = 0; i < sortedPlayers.length; i++) {
                  if (i > 0 && (gs.cumulativeScores?.[sortedPlayers[i].user_id] || 0) < (gs.cumulativeScores?.[sortedPlayers[i-1].user_id] || 0)) {
                    rank = i + 1;
                  }
                  rankedPlayers.push({
                    player: sortedPlayers[i],
                    score: gs.cumulativeScores?.[sortedPlayers[i].user_id] || 0,
                    rank: rank
                  });
                }

                const highestScore = rankedPlayers.length > 0 ? rankedPlayers[0].score : 0;

                return rankedPlayers.map(({ player, score, rank }, idx) => {
                  const isWinner = score === highestScore && highestScore > 0;
                  
                  let medal;
                  if (rank === 1) medal = '🥇';
                  else if (rank === 2) medal = '🥈';
                  else if (rank === 3) medal = '🥉';
                  else medal = `#${rank}`;

                  return (
                    <View 
                      key={player.user_id} 
                      style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        paddingVertical: 10, 
                        borderBottomWidth: idx === rankedPlayers.length - 1 ? 0 : 1, 
                        borderColor: '#1e293b' 
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={[styles.textCenter, { fontSize: 18, fontWeight: '800', color: isWinner ? '#eab308' : '#9ca3af', width: 32 }]}>
                          {medal}
                        </Text>
                        <Text style={{ color: isWinner ? '#ffffff' : '#e2e8f0', fontSize: 15, fontWeight: isWinner ? '800' : '600' }}>
                          {player.nickname || player.profiles?.nickname || 'Player'}
                          {isWinner ? ' (Winner 👑)' : ''}
                        </Text>
                      </View>
                      <Text style={{ color: isWinner ? '#10b981' : '#60a5fa', fontSize: 18, fontWeight: '800' }}>
                        {score} pts
                      </Text>
                    </View>
                  );
                });
              })()}
            </View>

            <View style={[styles.rowGap10, { marginTop: 18 }]}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#475569', paddingVertical: 10, paddingHorizontal: 16 }]}
                onPress={() => setShowScoreModal(true)}
              >
                <Text style={{ color: '#38bdf8', fontWeight: '700' }}>📊 View Scorecard</Text>
              </TouchableOpacity>

              {currentRoom.host_id === userId && (
                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 18 }]}
                  onPress={onResetToLobby}
                >
                  <Text style={styles.btnText}>🔄 Return to Lobby</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 16 }}>
        {(() => {
          const mySeat = getPlayerSeat(currentRoom.game_state, userId);
          const isLead = mySeat === currentRoom.game_state?.initiativeSeat;
          const myBid = currentRoom.game_state?.bids?.[userId];
          const myWon = currentRoom.game_state?.tricksWon?.[userId] ?? 0;
          return (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>
                Your Hand{isLead ? ' ⭐ Lead' : ''}
              </Text>
              <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#38bdf8' }}>
                <Text style={{ color: '#38bdf8', fontSize: 14, fontWeight: '800' }}>
                  Bid: {myBid !== undefined ? myBid : '—'} | Won: {myWon}
                </Text>
              </View>
            </View>
          );
        })()}
        
        <View style={{ overflow: 'visible', marginTop: 8 }}>
          {(() => {
            const rawHand = currentRoom.game_state?.hands?.[userId] || [];
            const myHand = sortHand(rawHand);
            const mySeat = getPlayerSeat(currentRoom.game_state, userId);
            const isTrickPhase = currentRoom.game_state?.phase === 'trick';
            const isMyTurn = isTrickPhase &&
                             String(currentRoom.game_state?.activeSeat) === String(mySeat) &&
                             !trickHold;
            const activeTrick = currentRoom.game_state?.trick || [];
            const leadCard = activeTrick.length > 0 ? activeTrick[0].card : null;

            return (
              <HandView
                hand={myHand}
                selectedIndex={selectedCardIdx}
                onSelect={(idx) => setSelectedCardIdx(idx)}
                onPlay={(idx, card) => {
                  const rawIndex = (currentRoom.game_state?.hands?.[userId] || []).findIndex(
                    c => c.suit === card.suit && c.rank === card.rank
                  );
                  onPlayCard(rawIndex !== -1 ? rawIndex : idx, card);
                  setSelectedCardIdx(null);
                  setAnimatingCardIdx(null);
                }}
                isMyTurn={isMyTurn}
                leadCard={leadCard}
                animatingCardIdx={animatingCardIdx}
                setAnimatingCardIdx={setAnimatingCardIdx}
                flyAnimY={flyAnimY}
                flyAnimScale={flyAnimScale}
              />
            );
          })()}
        </View>

        <View style={currentRoom.status === 'playing' ? { alignItems: 'center' } : {}}>
          <TouchableOpacity style={[styles.cancelButton, { marginTop: 16 }]} onPress={onLeaveTable}>
            <Text style={styles.btnText}>Exit Game Table</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWide: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 24,
    width: '100%',
    maxWidth: 414,
    minHeight: 780,
    alignSelf: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#334155',
    paddingBottom: 8,
  },
  boardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  boardSubTitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  opponentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  opponentCard: {
    width: '31%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderWidth: 1, borderColor: '#334155',
    alignItems: 'center',
  },
  oppNameText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11.5,
    marginBottom: 3,
  },
  oppContractText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 10.5,
  },
  centerArena: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginVertical: 10,
  },
  centerArenaTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  textCenter: {
    textAlign: 'center',
  },
  rowGap10: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default GameBoard;