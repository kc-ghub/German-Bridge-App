import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions, Modal, TextInput } from 'react-native';
import { supabase } from '../../../supabaseClient';
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
  onExit,
  soundManager,
  onOpenRules
}) => {
  const { width } = useWindowDimensions();
  const [handAreaWidth, setHandAreaWidth] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugNote, setBugNote] = useState('');
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugStatus, setBugStatus] = useState('');
  const isHost = currentRoom?.host_id === userId;
  const handleSubmitBugReport = async () => {
    if (!bugNote.trim()) return;
    setBugSubmitting(true);
    setBugStatus('');
    const gs = currentRoom?.game_state || {};
    const playersList = gs.players || [];
    const myPlayer = playersList.find(p => p.user_id === userId);
    const myNickname = myPlayer?.nickname || nickname || 'Unknown';
    const snapshot = {
      mode: gs.mode,
      cardsDealt: gs.cardsDealt,
      activeSeat: gs.activeSeat,
      initiativeSeat: gs.initiativeSeat,
      bids: gs.bids,
      tricksWon: gs.tricksWon,
      trick: gs.trick,
      myHandCount: gs.hands?.[userId]?.length ?? 0,
    };
    const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : Platform.OS;
    try {
      const { error } = await supabase.from('beta_feedback').insert({
        room_id: currentRoom?.id || null,
        user_id: userId || null,
        nickname: myNickname,
        round_number: gs.roundNumber || null,
        phase: gs.phase || null,
        note: bugNote.trim(),
        device_info: deviceInfo,
        game_snapshot: snapshot
      });
      if (error) throw error;
      setBugNote('');
      setBugStatus('✅ Report sent! Thank you.');
      setTimeout(() => {
        setShowBugModal(false);
        setBugStatus('');
      }, 1000);
    } catch (err) {
      setBugStatus('Failed to send report. Please try again.');
    } finally {
      setBugSubmitting(false);
    }
  };
  const getPlayerName = (identifier) => {
    const playersList = currentRoom?.game_state?.players || [];
    const player = typeof identifier === 'number' 
      ? playersList.find(p => p.seat_number === identifier)
      : playersList.find(p => p.user_id === identifier);
    return player?.nickname || (typeof identifier === 'number' ? `Seat ${identifier}` : 'Player');
  };

  const getSuitSymbol = (suit) => {
    if (suit === 'Spades') return '♠';
    if (suit === 'Hearts') return '♥';
    if (suit === 'Diamonds') return '♦';
    return '♣';
  };

  const getSuitColor = (suit) => {
    return suit === 'Hearts' || suit === 'Diamonds' ? '#dc2626' : '#0f172a';
  };

  return (
    <View style={styles.cardWide}>
      <View style={styles.topHUD}>
        <View style={styles.hudLeft}>
          <Text style={styles.hudText}>
            Desk #{currentRoom?.id || '?'}
          </Text>
          <Text style={styles.hudSubText}>
            Round {currentRoom?.game_state?.roundNumber || 1} of {currentRoom?.game_state?.totalRounds || 25} • {currentRoom?.game_state?.cardsDealt || 0} Cards • {(currentRoom?.game_state?.mode || currentRoom?.round_mode || 'mountain').toUpperCase()}
          </Text>
        </View>
        <View style={styles.hudRight}>
          <TouchableOpacity
            onPress={() => setShowScoreModal(true)}
            style={styles.hudButton}
          >
            <Text style={styles.hudButtonText}>📊 Scorecard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onOpenRules}
            style={styles.hudButton}
          >
            <Text style={styles.hudButtonText}>❓ Rules</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setBugStatus('');
              setShowBugModal(true);
            }}
            style={styles.bugButton}
          >
            <Text style={styles.bugButtonText}>🐛</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(() => {
        const allPlayers = [...(currentRoom?.game_state?.players || [])].sort(
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
              const oppBid = currentRoom?.game_state?.bids?.[opp.user_id];
              const oppWon = currentRoom?.game_state?.tricksWon?.[opp.user_id] ?? 0;
              const isOppTurn = String(currentRoom?.game_state?.activeSeat) === String(opp.seat_number);
              const oppCardCount = currentRoom?.game_state?.hands?.[opp.user_id]?.length || 0;

              return (
                <View
                  key={opp.user_id}
                  style={[
                    styles.opponentPod,
                    isOppTurn && styles.opponentPodActive,
                  ]}
                >
                  <Text numberOfLines={1} style={styles.opponentPodName}>
                    {opp.seat_number}. {opp.nickname || 'Player'}
                  </Text>
                  <Text style={styles.opponentPodCards}>
                    🂠 {oppCardCount}
                  </Text>
                  <Text style={styles.opponentPodStats}>
                    Bid: {oppBid !== undefined ? oppBid : '—'} | Won: {oppWon}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}

      <View style={styles.tableRail}>
        <View style={styles.feltSurfaceContainer}>
          {Platform.OS === 'web' && (
            <View style={styles.feltPerspectiveOverlay} />
          )}
          <View style={styles.feltSurface}>
            <View style={styles.trumpCardContainer}>
              <Text style={styles.trumpLabel}>TRUMP</Text>
              {currentRoom?.game_state?.isNoTrump ? (
                <View style={styles.noTrumpBadge}>
                  <Text style={styles.noTrumpText}>🚫 NO TRUMP</Text>
                </View>
              ) : currentRoom?.game_state?.trumpCard ? (
                <View style={styles.trumpCard}>
                  <Text style={[styles.trumpCardRank, { color: getSuitColor(currentRoom?.game_state?.trumpCard?.suit) }]}>
                    {currentRoom?.game_state?.trumpCard?.rank}
                  </Text>
                  <Text style={[styles.trumpCardSuit, { color: getSuitColor(currentRoom?.game_state?.trumpCard?.suit) }]}>
                    {getSuitSymbol(currentRoom?.game_state?.trumpCard?.suit)}
                  </Text>
                </View>
              ) : (
                <View style={styles.trumpCardPlaceholder}>
                  <Text style={styles.trumpCardPlaceholderText}>—</Text>
                </View>
              )}
            </View>

            {currentRoom?.game_state?.phase === 'bidding' ? (
              <View style={styles.feltCenterConsole}>
                <Text style={styles.centerConsoleTitle}>
                  {currentRoom?.game_state?.activeSeat === getPlayerSeat(currentRoom?.game_state, userId)
                    ? "👉 It's Your Turn to Bid!"
                    : `Waiting for ${getPlayerName(currentRoom?.game_state?.activeSeat)} to Bid...`}
                </Text>

                <View style={styles.bidderGrid}>
                  {currentRoom?.game_state?.players?.map((p) => {
                    const playerBid = currentRoom?.game_state?.bids?.[p.user_id];
                    const hasBid = playerBid !== undefined;
                    return (
                      <View key={p.user_id} style={styles.bidderPod}>
                        <Text style={styles.bidderName} numberOfLines={1}>{getPlayerName(p.user_id)}</Text>
                        <Text style={[styles.bidderBid, hasBid && styles.bidderBidPlaced]}>
                          {hasBid ? playerBid : '?'}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {currentRoom?.game_state?.activeSeat === getPlayerSeat(currentRoom?.game_state, userId) && (() => {
                  const cardsDealt = currentRoom?.game_state?.cardsDealt || 1;
                  const committedBids = Object.values(currentRoom?.game_state?.bids || {});
                  const isFinal = isFinalBidder(currentRoom?.game_state?.players?.length || 0, committedBids.length);
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
            ) : (currentRoom?.game_state?.phase === 'trick' || trickHold) ? (
              (() => {
                const mySeat = getPlayerSeat(currentRoom?.game_state, userId);
                const isMyTurn = String(currentRoom?.game_state?.activeSeat) === String(mySeat);
                const activeTrick = currentRoom?.game_state?.trick || [];
                const lastTrick = currentRoom?.game_state?.lastTrickResult;
                const isShowingLastTrick = activeTrick.length === 0 && lastTrick?.cards?.length > 0 && trickHold;
                const displayCards = isShowingLastTrick ? lastTrick.cards : activeTrick;

                const isFinalTrick = currentRoom?.game_state?.phase === 'scoring' || currentRoom?.game_state?.phase === 'game_over';
                let statusTitle = `Waiting for ${getPlayerName(currentRoom?.game_state?.activeSeat)} to Play...`;
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
                    ? `Waiting for ${getPlayerName(currentRoom?.game_state?.activeSeat)} to Lead...`
                    : `Waiting for ${getPlayerName(currentRoom?.game_state?.activeSeat)} to Play...`;
                }

                const totalBids = Object.values(currentRoom?.game_state?.bids || {}).reduce(
                  (sum, val) => sum + Number(val || 0),
                  0
                );
                const cardsDealt = currentRoom?.game_state?.cardsDealt || 1;
                const bidDiff = totalBids - cardsDealt;
                const isFight = bidDiff > 0;
                const diffCount = Math.abs(bidDiff);
                const tensionLabel = bidDiff === 0
                  ? '⚖️ Even'
                  : isFight
                    ? `⚔️ Fight +${diffCount}`
                    : `🛡️ Yield -${diffCount}`;

                return (
                  <View style={styles.feltCenterConsole}>
                    <View style={[styles.bidTensionBar, isFight ? styles.bidTensionFight : styles.bidTensionYield]}>
                      <Text style={styles.bidTensionText}>
                        Total Bids: {totalBids}/{cardsDealt} | {tensionLabel}
                      </Text>
                    </View>
                    <Text style={styles.centerConsoleTitle}>{statusTitle}</Text>

                    <View style={styles.trickCardsRow}>
                      {displayCards.length === 0 ? (
                        <View style={styles.emptyTrickState}>
                          <Text style={styles.emptyTrickText}>
                            Table cleared. Waiting for {getPlayerName(currentRoom?.game_state?.activeSeat)} to lead...
                          </Text>
                        </View>
                      ) : (
                        displayCards.map((play, idx) => {
                          const suitColor = getSuitColor(play.card.suit);
                          const suitSymbol = getSuitSymbol(play.card.suit);
                          const seatPlayer = currentRoom?.game_state?.players?.find(p => p.user_id === play.user_id);

                          return (
                            <View key={`${play.user_id}-${idx}`} style={styles.trickCardWrapper}>
                              <View style={styles.trickCard}>
                                <Text style={[styles.trickCardRank, { color: suitColor }]}>
                                  {play.card.rank}
                                </Text>
                                <Text style={[styles.trickCardSuit, { color: suitColor }]}>
                                  {suitSymbol}
                                </Text>
                              </View>
                              <Text style={styles.trickCardPlayer} numberOfLines={1}>
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
            ) : currentRoom?.game_state?.phase === 'scoring' ? (
              <View style={styles.feltCenterConsole}>
                <Text style={styles.centerConsoleTitle}>🏆 Round {currentRoom?.game_state?.roundNumber || 1} Complete</Text>
                {currentRoom?.game_state?.lastTrickResult && (
                  <Text style={styles.scoringSubtitle}>
                    Final Trick Won by {getPlayerName(currentRoom?.game_state?.lastTrickResult?.winnerId)}
                  </Text>
                )}

                <View style={styles.scoreTable}>
                  <View style={styles.scoreTableHeader}>
                    <Text style={[styles.scoreTableHeaderText, { flex: 1.2 }]}>PLAYER</Text>
                    <Text style={[styles.scoreTableHeaderText, { flex: 1, textAlign: 'center' }]}>BID</Text>
                    <Text style={[styles.scoreTableHeaderText, { flex: 1, textAlign: 'center' }]}>WON</Text>
                    <Text style={[styles.scoreTableHeaderText, { flex: 1.2, textAlign: 'right' }]}>ROUND</Text>
                    <Text style={[styles.scoreTableHeaderText, { flex: 1.2, textAlign: 'right' }]}>TOTAL</Text>
                  </View>
                  {currentRoom?.game_state?.players?.map(p => {
                    const bid = currentRoom?.game_state?.bids?.[p.user_id] ?? 0;
                    const won = currentRoom?.game_state?.tricksWon?.[p.user_id] ?? 0;
                    const pts = currentRoom?.game_state?.roundScores?.[p.user_id] ?? 0;
                    const total = currentRoom?.game_state?.cumulativeScores?.[p.user_id] ?? 0;
                    const isSuccess = bid === won;

                    return (
                      <View key={p.user_id} style={styles.scoreTableRow}>
                        <Text style={[styles.scoreTableCell, { flex: 1.2 }]} numberOfLines={1}>{p.nickname || 'Player'}</Text>
                        <Text style={[styles.scoreTableCell, { flex: 1, textAlign: 'center' }]}>{bid}</Text>
                        <Text style={[styles.scoreTableCell, { flex: 1, textAlign: 'center' }]}>{won}</Text>
                        <Text style={[styles.scoreTableCell, { flex: 1.2, textAlign: 'right', color: isSuccess ? '#10b981' : '#ef4444' }]}>
                          {pts >= 0 ? `+${pts}` : pts}
                        </Text>
                        <Text style={[styles.scoreTableCell, { flex: 1.2, textAlign: 'right', color: '#60a5fa', fontWeight: '800' }]}>
                          {total}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {currentRoom?.game_state?.roundNumber >= currentRoom?.game_state?.totalRounds ? (
                  <View style={styles.scoringActionRow}>
                    <Text style={styles.finalScoreTitle}>🏆 All {currentRoom?.game_state?.totalRounds} Rounds Completed!</Text>
                    {currentRoom?.host_id === userId && (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={onEndGame}
                      >
                        <Text style={styles.primaryButtonText}>🏆 View Final Podium Now</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  currentRoom?.game_state?.config?.requireManualNextRound ? (
                    currentRoom?.host_id === userId ? (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={onNextRound}
                      >
                        <Text style={styles.primaryButtonText}>▶ Start Round {currentRoom?.game_state?.roundNumber + 1}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.waitingText}>
                        Waiting for Host to start Round {currentRoom?.game_state?.roundNumber + 1}...
                      </Text>
                    )
                  ) : (
                    <View style={styles.scoringActionRow}>
                      <Text style={styles.countdownText}>
                        ⏱ Round {currentRoom?.game_state?.roundNumber + 1} starting in {roundCountdown !== null ? roundCountdown : 5}s...
                      </Text>
                      {currentRoom?.host_id === userId && (
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={onNextRound}
                        >
                          <Text style={styles.secondaryButtonText}>Deal Now ⏭</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                )}
              </View>
            ) : currentRoom?.game_state?.phase === 'game_over' ? (
              <View style={styles.feltCenterConsole}>
                <Text style={styles.finalGameTitle}>👑 Match Finished!</Text>
                <Text style={styles.finalGameSubtitle}>
                  Final Leaderboard after {currentRoom?.game_state?.totalRounds} Rounds
                </Text>

                <View style={styles.leaderboardTable}>
                  {(() => {
                    const gs = currentRoom?.game_state;
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
                          style={[styles.leaderboardRow, idx === rankedPlayers.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={styles.leaderboardLeft}>
                            <Text style={[styles.leaderboardMedal, isWinner && { color: '#eab308' }]}>
                              {medal}
                            </Text>
                            <Text style={[styles.leaderboardName, isWinner && { color: '#ffffff', fontWeight: '800' }]}>
                              {player.nickname || player.profiles?.nickname || 'Player'}
                              {isWinner ? ' (Winner 👑)' : ''}
                            </Text>
                          </View>
                          <Text style={[styles.leaderboardScore, isWinner && { color: '#10b981' }]}>
                            {score} pts
                          </Text>
                        </View>
                      );
                    });
                  })()}
                </View>

                <View style={styles.finalGameActions}>
                  <TouchableOpacity 
                    style={styles.secondaryButton}
                    onPress={() => setShowScoreModal(true)}
                  >
                    <Text style={styles.secondaryButtonText}>📊 View Scorecard</Text>
                  </TouchableOpacity>

                  {currentRoom.host_id === userId && (
                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={onResetToLobby}
                    >
                      <Text style={styles.primaryButtonText}>🔄 Return to Lobby</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.handSection}>
        {(() => {
          const mySeat = getPlayerSeat(currentRoom?.game_state, userId);
          const isLead = mySeat === currentRoom?.game_state?.initiativeSeat;
          const myBid = currentRoom?.game_state?.bids?.[userId];
          const myWon = currentRoom?.game_state?.tricksWon?.[userId] ?? 0;
          return (
            <View style={styles.handHeader}>
              <Text style={styles.handHeaderTitle}>
                Your Hand{isLead ? ' ⭐ Lead' : ''}
              </Text>
              <View style={styles.handStatsBadge}>
                <Text style={styles.handStatsText}>
                  Bid: {myBid !== undefined ? myBid : '—'} | Won: {myWon}
                </Text>
              </View>
            </View>
          );
        })()}
        
        <View 
          style={styles.handContainer}
          onLayout={(e) => setHandAreaWidth(e.nativeEvent.layout.width)}
        >
          {(() => {
            const rawHand = currentRoom?.game_state?.hands?.[userId] || [];
            const myHand = sortHand(rawHand);
            const mySeat = getPlayerSeat(currentRoom?.game_state, userId);
            const isTrickPhase = currentRoom?.game_state?.phase === 'trick';
            const isMyTurn = isTrickPhase &&
                             String(currentRoom?.game_state?.activeSeat) === String(mySeat) &&
                             !trickHold;
            const activeTrick = currentRoom?.game_state?.trick || [];
            const leadCard = activeTrick.length > 0 ? activeTrick[0].card : null;

            return (
              <HandView
                hand={myHand}
                selectedIndex={selectedCardIdx}
                onSelect={(idx) => setSelectedCardIdx(idx)}
                onPlay={(idx, card) => {
                  const rawIndex = (currentRoom?.game_state?.hands?.[userId] || []).findIndex(
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
                loading={loading}
                handAreaWidth={handAreaWidth}
                width={width}
              />
            );
          })()}
        </View>

        <TouchableOpacity 
          style={[styles.exitButton, { zIndex: 30 }]} 
          onPress={() => setShowExitConfirm(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.exitButtonText}>Exit Game Table</Text>
        </TouchableOpacity>

        <Modal
          visible={showExitConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowExitConfirm(false)}
        >
          <View style={styles.exitModalOverlay}>
            <View style={styles.exitModalContent}>
              <Text style={styles.exitModalTitle}>
                {isHost ? 'Close Game Table?' : 'Leave Game Table?'}
              </Text>
              <Text style={styles.exitModalBody}>
                {isHost 
                  ? 'Warning: Leaving will close this table and end the game for all players. Are you sure you want to exit?'
                  : 'Are you sure you want to leave this game table?'
                }
              </Text>
              <View style={styles.exitModalButtons}>
                <TouchableOpacity
                  style={styles.exitModalCancelBtn}
                  onPress={() => setShowExitConfirm(false)}
                >
                  <Text style={styles.exitModalCancelText}>Stay in Game</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exitModalConfirmBtn}
                  onPress={() => {
                    setShowExitConfirm(false);
                    (onLeaveTable || onExit)?.();
                  }}
                >
                  <Text style={styles.exitModalConfirmText}>
                    {isHost ? 'Close & Exit' : 'Leave Table'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showBugModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBugModal(false)}
        >
          <View style={styles.exitModalOverlay}>
            <View style={styles.bugModalContent}>
              <Text style={styles.exitModalTitle}>🐛 Report a Bug</Text>
              <Text style={styles.bugModalCaption}>
                Auto-attaching Desk #{currentRoom?.id} • Round {currentRoom?.game_state?.roundNumber || 1} • Phase: {currentRoom?.game_state?.phase || 'unknown'}
              </Text>
              <TextInput
                style={styles.bugTextInput}
                placeholder="What happened? (e.g., turn stuck, wrong card rule)"
                placeholderTextColor="#64748b"
                maxLength={500}
                multiline
                numberOfLines={4}
                value={bugNote}
                onChangeText={setBugNote}
              />
              {bugStatus ? (
                <Text style={styles.bugStatusText}>{bugStatus}</Text>
              ) : null}
              <View style={styles.exitModalButtons}>
                <TouchableOpacity
                  style={styles.exitModalCancelBtn}
                  onPress={() => setShowBugModal(false)}
                >
                  <Text style={styles.exitModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.exitModalConfirmBtn,
                    (bugSubmitting || !bugNote.trim()) && { opacity: 0.5 }
                  ]}
                  disabled={bugSubmitting || !bugNote.trim()}
                  onPress={handleSubmitBugReport}
                >
                  <Text style={styles.exitModalConfirmText}>Send Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  topHUD: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  hudLeft: {
    flex: 1,
  },
  hudText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  hudSubText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  hudRight: {
    flexDirection: 'row',
    gap: 6,
  },
  hudButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hudButtonText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },
  bugButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  bugButtonText: {
    fontSize: 14,
  },
  opponentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  opponentPod: {
    width: '30%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
  },
  opponentPodActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#132238',
  },
  opponentPodName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 2,
  },
  opponentPodCards: {
    color: '#9ca3af',
    fontSize: 10,
    marginBottom: 2,
  },
  opponentPodStats: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 9.5,
  },
  tableRail: {
    backgroundColor: '#451a03',
    borderColor: '#78350f',
    borderWidth: 6,
    borderRadius: 28,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  feltSurfaceContainer: {
    position: 'relative',
    minHeight: 240,
  },
  feltPerspectiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ perspective: 900 }, { rotateX: '10deg' }],
    backgroundColor: 'transparent',
  },
  feltSurface: {
    backgroundColor: '#0b4d34',
    borderColor: '#10b981',
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 14,
    minHeight: 240,
    position: 'relative',
  },
  trumpCardContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  trumpLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  noTrumpBadge: {
    backgroundColor: '#78350f',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  noTrumpText: {
    color: '#fbbf24',
    fontWeight: '800',
    fontSize: 10,
  },
  trumpCard: {
    width: 42,
    height: 58,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trumpCardRank: {
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 13,
  },
  trumpCardSuit: {
    fontSize: 22,
    lineHeight: 24,
  },
  trumpCardPlaceholder: {
    width: 42,
    height: 58,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trumpCardPlaceholderText: {
    color: '#64748b',
    fontSize: 11,
  },
  feltCenterConsole: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
  },
  centerConsoleTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  bidderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 8,
  },
  bidderPod: {
    alignItems: 'center',
    minWidth: 52,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bidderName: {
    color: '#9ca3af',
    fontSize: 10,
  },
  bidderBid: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  bidderBidPlaced: {
    color: '#10b981',
  },
  bidTensionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  bidTensionFight: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  bidTensionYield: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  bidTensionText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  trickCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    minHeight: 74,
    alignItems: 'center',
  },
  emptyTrickState: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyTrickText: {
    color: '#94a3b8',
    fontStyle: 'italic',
    fontSize: 12,
  },
  trickCardWrapper: {
    alignItems: 'center',
  },
  trickCard: {
    width: 48,
    height: 68,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trickCardRank: {
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 15,
  },
  trickCardSuit: {
    fontSize: 22,
    lineHeight: 24,
  },
  trickCardPlayer: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
  scoreTable: {
    width: '95%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 6,
  },
  scoreTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    paddingBottom: 4,
    marginBottom: 4,
  },
  scoreTableHeaderText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
  },
  scoreTableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  scoreTableCell: {
    color: '#f3f4f6',
    fontSize: 11,
  },
  scoringSubtitle: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  scoringActionRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  finalScoreTitle: {
    color: '#eab308',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingText: {
    color: '#9ca3af',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 10,
  },
  countdownText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  finalGameTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#eab308',
    marginBottom: 4,
    textAlign: 'center',
  },
  finalGameSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  leaderboardTable: {
    width: '95%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaderboardMedal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9ca3af',
    width: 28,
    textAlign: 'center',
  },
  leaderboardName: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardScore: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '800',
  },
  finalGameActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  handSection: {
    marginTop: 12,
  },
  handHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  handHeaderTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  handStatsBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  handStatsText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
  },
  handContainer: {
    overflow: 'visible',
    marginTop: 8,
  },
  exitButton: {
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  exitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  exitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exitModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#374151',
  },
  exitModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  exitModalBody: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
  },
  exitModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exitModalCancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exitModalCancelText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 14,
  },
  exitModalConfirmBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exitModalConfirmText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  bugModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#374151',
  },
  bugModalCaption: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  bugTextInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  bugStatusText: {
    fontSize: 14,
    color: '#10b981',
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default GameBoard;