import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AuctionScreen,
  BidRecord,
  Player,
  PlayerCategory,
  SquadRules,
  Team,
  AppMode,
  MultiplayerRoomState
} from './types';
import { INITIAL_TEAMS } from './data/teamsData';
import { INITIAL_PLAYERS } from './data/playersData';
import { DEFAULT_RULES, formatCurrency, getNextBidAmount } from './utils/currencyUtils';
import {
  playBidChime,
  playCountdownTick,
  playSoldFanfare,
  playUnsoldThud,
  setMuted
} from './utils/soundUtils';
import { updateTeamPurchasedPlayer, validateBid } from './engine/squadRules';
import { subscribeToRoomEvents, reconnectMultiplayerPlayer } from './services/socketService';

import { Navbar } from './components/Navbar';
import { ModeSelectionScreen } from './components/ModeSelectionScreen';
import { TeamSelectionScreen } from './components/TeamSelectionScreen';
import { TeamsLeftPanel } from './components/TeamsLeftPanel';
import { PlayerMainStage } from './components/PlayerMainStage';
import { LiveBidRightPanel } from './components/LiveBidRightPanel';
import { QueueBottomPanel } from './components/QueueBottomPanel';
import { SoldOverlay } from './components/SoldOverlay';
import { UnsoldOverlay } from './components/UnsoldOverlay';
import { SquadModal } from './components/SquadModal';
import { RulesModal } from './components/RulesModal';
import { AuctionResultsScreen } from './components/AuctionResultsScreen';

// Multiplayer Components
import { MultiplayerEntryScreen } from './components/multiplayer/MultiplayerEntryScreen';
import { MultiplayerLobbyScreen } from './components/multiplayer/MultiplayerLobbyScreen';
import { MultiplayerAuctionScreen } from './components/multiplayer/MultiplayerAuctionScreen';
import { MultiplayerResultsScreen } from './components/multiplayer/MultiplayerResultsScreen';

const AUCTION_TIMER_SECONDS = 15; // Exactly 15 seconds bidding timer

export function App() {
  // Top-Level Game Mode ('singleplayer' | 'multiplayer' | null)
  const [appMode, setAppMode] = useState<AppMode>(null);

  // ==========================================
  // SINGLE PLAYER STATE (Stage 1 Preserved)
  // ==========================================
  const [screen, setScreen] = useState<AuctionScreen>('selection');
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [userTeamId, setUserTeamId] = useState<string>('MI');
  const [rules, setRules] = useState<SquadRules>(DEFAULT_RULES);

  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [currentBid, setCurrentBid] = useState<number>(0);
  const [highestBidderTeamId, setHighestBidderTeamId] = useState<string | null>(null);
  const [bidHistory, setBidHistory] = useState<BidRecord[]>([]);
  const [countdown, setCountdown] = useState<number>(AUCTION_TIMER_SECONDS);
  const [auctioneerCall, setAuctioneerCall] = useState<string>('Waiting for opening bid...');

  const [soldModalData, setSoldModalData] = useState<{ player: Player; winningTeam: Team; price: number } | null>(null);
  const [unsoldModalData, setUnsoldModalData] = useState<Player | null>(null);
  const [inspectSquadModalOpen, setInspectSquadModalOpen] = useState<boolean>(false);
  const [rulesModalOpen, setRulesModalOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<PlayerCategory | 'All'>('All');

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [isMutedState, setIsMutedState] = useState<boolean>(false);

  const isResolvingRef = useRef<boolean>(false);
  const currentBidRef = useRef<number>(currentBid);
  const highestBidderTeamIdRef = useRef<string | null>(highestBidderTeamId);
  const currentPlayerRef = useRef<Player | null>(null);
  const userTeamRef = useRef<Team>(INITIAL_TEAMS[0]);

  const currentPlayer = players[currentPlayerIndex] || null;
  const userTeam = teams.find(t => t.id === userTeamId) || teams[0];
  const highestBidderTeam = teams.find(t => t.id === highestBidderTeamId) || null;

  useEffect(() => { currentBidRef.current = currentBid; }, [currentBid]);
  useEffect(() => { highestBidderTeamIdRef.current = highestBidderTeamId; }, [highestBidderTeamId]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { userTeamRef.current = userTeam; }, [userTeam]);

  // ==========================================
  // MULTIPLAYER STATE (Stage 2)
  // ==========================================
  const [multiplayerRoom, setMultiplayerRoom] = useState<MultiplayerRoomState | null>(null);
  const [multiplayerPlayerId, setMultiplayerPlayerId] = useState<string | null>(null);

  // Sound toggle
  const handleToggleSound = () => {
    const nextMute = !isMutedState;
    setMuted(nextMute);
    setIsMutedState(nextMute);
  };

  // Start singleplayer auction after franchise confirmation
  const handleConfirmTeam = (chosenTeamId: string) => {
    setUserTeamId(chosenTeamId);
    setScreen('auction');
    setCurrentPlayerIndex(0);
    resetLot(0);
  };

  // Reset lot for singleplayer
  const resetLot = useCallback((index: number) => {
    const p = players[index];
    if (!p) return;

    isResolvingRef.current = false;
    setCurrentBid(0);
    currentBidRef.current = 0;
    setHighestBidderTeamId(null);
    highestBidderTeamIdRef.current = null;
    setBidHistory([]);
    setCountdown(AUCTION_TIMER_SECONDS);
    setSoldModalData(null);
    setUnsoldModalData(null);
    setAuctioneerCall(`Lot #${p.id} • ${p.name} on the podium! 15s timer started. Base price: ${formatCurrency(p.basePrice)}.`);
  }, [players]);

  const handleAdvanceToNextPlayer = useCallback(() => {
    setSoldModalData(null);
    setUnsoldModalData(null);
    isResolvingRef.current = false;

    let nextIdx = currentPlayerIndex + 1;
    while (nextIdx < players.length && players[nextIdx].status !== 'upcoming') {
      nextIdx++;
    }

    if (nextIdx < players.length) {
      setCurrentPlayerIndex(nextIdx);
      resetLot(nextIdx);
    } else {
      setScreen('results');
    }
  }, [currentPlayerIndex, players, resetLot]);

  const handleJumpToPlayer = (targetPlayer: Player) => {
    const idx = players.findIndex(p => p.id === targetPlayer.id);
    if (idx !== -1) {
      setCurrentPlayerIndex(idx);
      resetLot(idx);
    }
  };

  const handlePlaceUserBid = () => {
    if (!currentPlayer || isPaused || isResolvingRef.current) return;

    const nextAmount = currentBid === 0
      ? currentPlayer.basePrice
      : getNextBidAmount(currentBid, currentPlayer.basePrice, rules);

    const validation = validateBid(userTeam, currentPlayer, nextAmount, rules);
    if (!validation.isValid) return;

    const newBid: BidRecord = {
      id: `bid-${Date.now()}-${Math.random()}`,
      playerId: currentPlayer.id,
      teamId: userTeam.id,
      teamName: userTeam.name,
      teamShortName: userTeam.shortName,
      amount: nextAmount,
      timestamp: Date.now(),
      bidderType: 'user'
    };

    playBidChime();
    setCurrentBid(nextAmount);
    currentBidRef.current = nextAmount;
    setHighestBidderTeamId(userTeam.id);
    highestBidderTeamIdRef.current = userTeam.id;
    setBidHistory(prev => [newBid, ...prev]);

    setCountdown(AUCTION_TIMER_SECONDS);
    setAuctioneerCall(`${userTeam.shortName} bids ${formatCurrency(nextAmount)}! Timer reset to 15s.`);
  };

  const handlePassPlayer = () => {
    if (!currentPlayer || isResolvingRef.current) return;

    isResolvingRef.current = true;
    setPlayers(prev => prev.map((p, i) => i === currentPlayerIndex ? { ...p, status: 'unsold' } : p));
    playUnsoldThud();
    setUnsoldModalData(currentPlayer);
    setAuctioneerCall(`${currentPlayer.name} passed with no bids — marked UNSOLD!`);
  };

  const handleSkipPlayer = () => {
    if (!currentPlayer || isResolvingRef.current) return;
    setPlayers(prev => prev.map((p, i) => i === currentPlayerIndex ? { ...p, status: 'unsold' } : p));
    setAuctioneerCall(`${currentPlayer.name} skipped — marked UNSOLD.`);
    handleAdvanceToNextPlayer();
  };

  const handleSkipEntireSet = () => {
    if (!currentPlayer || isResolvingRef.current) return;
    const currentCategory = currentPlayer.category;

    // Mark current player and all upcoming players in this set as unsold (never sold)
    setPlayers(prev => prev.map((p, i) => {
      if (i === currentPlayerIndex || (p.category === currentCategory && p.status === 'upcoming')) {
        return { ...p, status: 'unsold' };
      }
      return p;
    }));

    setSoldModalData(null);
    setUnsoldModalData(null);
    isResolvingRef.current = false;

    // Find the first upcoming player in the next auction set
    let nextIdx = currentPlayerIndex + 1;
    while (nextIdx < players.length && (players[nextIdx].category === currentCategory || players[nextIdx].status !== 'upcoming')) {
      nextIdx++;
    }

    if (nextIdx < players.length) {
      setCurrentPlayerIndex(nextIdx);
      resetLot(nextIdx);
      setAuctioneerCall(`Skipped remainder of ${currentCategory} set. Commencing Set: ${players[nextIdx].category}!`);
    } else {
      setScreen('results');
    }
  };

  const nextUserBid = currentPlayer
    ? (currentBid === 0 ? currentPlayer.basePrice : getNextBidAmount(currentBid, currentPlayer.basePrice, rules))
    : 0;

  const userBidValidation = currentPlayer
    ? validateBid(userTeam, currentPlayer, nextUserBid, rules)
    : { isValid: false, reason: 'No active player' };

  const canUserBid =
    userBidValidation.isValid &&
    screen === 'auction' &&
    !soldModalData &&
    !unsoldModalData &&
    !isResolvingRef.current;

  // Single Player Auction Timer Loop
  useEffect(() => {
    if (appMode !== 'singleplayer' || screen !== 'auction' || isPaused || soldModalData || unsoldModalData || !currentPlayer) {
      return;
    }

    const tickInterval = Math.max(250, Math.round(1000 / gameSpeed));
    const timerId = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 0 || isResolvingRef.current) return 0;
        const nextTime = prev - 1;

        if (nextTime === 10) {
          if (highestBidderTeamIdRef.current === userTeamRef.current.id) {
            setAuctioneerCall(`10s left! Current winning bid: ${formatCurrency(currentBidRef.current)} by ${userTeamRef.current.shortName}.`);
          } else {
            setAuctioneerCall(`10s left! Base price ${formatCurrency(currentPlayerRef.current?.basePrice || 0)}... No bids yet!`);
          }
        } else if (nextTime === 5) {
          if (highestBidderTeamIdRef.current === userTeamRef.current.id) {
            setAuctioneerCall(`5s remaining! Going once at ${formatCurrency(currentBidRef.current)}!`);
          } else {
            setAuctioneerCall(`5s remaining! Going once... Place your bid to secure this lot!`);
          }
          playCountdownTick('normal');
        } else if (nextTime === 3) {
          setAuctioneerCall(`3 seconds! Going twice...`);
          playCountdownTick('urgent');
        } else if (nextTime === 1) {
          setAuctioneerCall(`1 second! Fair warning! Final call!`);
          playCountdownTick('urgent');
        }

        if (nextTime <= 0) {
          isResolvingRef.current = true;
          clearInterval(timerId);

          const activeBid = currentBidRef.current;
          const activeBidderId = highestBidderTeamIdRef.current;
          const activePlayer = currentPlayerRef.current;
          const activeUserTeam = userTeamRef.current;

          if (activeBidderId === activeUserTeam.id && activeBid > 0 && activePlayer) {
            const updatedUserTeam = updateTeamPurchasedPlayer(activeUserTeam, activePlayer, activeBid);
            setTeams(prevTeams => prevTeams.map(t => t.id === activeUserTeam.id ? updatedUserTeam : t));
            setPlayers(prevPlayers => prevPlayers.map((p, i) => i === currentPlayerIndex ? {
              ...p,
              status: 'sold',
              soldPrice: activeBid,
              soldTo: activeUserTeam.id
            } : p));

            playSoldFanfare();
            setSoldModalData({ player: activePlayer, winningTeam: activeUserTeam, price: activeBid });
            setAuctioneerCall(`SOLD! ${activePlayer.name} sold to ${activeUserTeam.name} for ${formatCurrency(activeBid)}!`);
          } else if (activePlayer) {
            setPlayers(prevPlayers => prevPlayers.map((p, i) => i === currentPlayerIndex ? { ...p, status: 'unsold' } : p));
            playUnsoldThud();
            setUnsoldModalData(activePlayer);
            setAuctioneerCall(`${activePlayer.name} received no bids in 15 seconds — marked UNSOLD!`);
          }

          return 0;
        }

        return nextTime;
      });
    }, tickInterval);

    return () => clearInterval(timerId);
  }, [
    appMode,
    screen,
    isPaused,
    gameSpeed,
    soldModalData,
    unsoldModalData,
    currentPlayerIndex,
    currentPlayer
  ]);

  const handleResetAuction = () => {
    if (window.confirm('Restart the auction simulator from team selection?')) {
      isResolvingRef.current = false;
      setTeams(INITIAL_TEAMS);
      setPlayers(INITIAL_PLAYERS);
      setCurrentPlayerIndex(0);
      setScreen('selection');
      setSoldModalData(null);
      setUnsoldModalData(null);
    }
  };

  // ==========================================
  // MULTIPLAYER SOCKET SUBSCRIPTION
  // ==========================================
  useEffect(() => {
    // Attempt session storage reconnection
    const savedRoomCode = sessionStorage.getItem('ipl_room_code');
    const savedPlayerId = sessionStorage.getItem('ipl_player_id');
    if (savedRoomCode && savedPlayerId && appMode === 'multiplayer' && !multiplayerRoom) {
      reconnectMultiplayerPlayer(savedRoomCode, savedPlayerId).then(res => {
        if (res.success && res.room) {
          setMultiplayerRoom(res.room);
          setMultiplayerPlayerId(savedPlayerId);
        }
      });
    }

    const unsubscribe = subscribeToRoomEvents({
      onRoomUpdated: (updatedRoom) => {
        setMultiplayerRoom(updatedRoom);
      },
      onBidPlaced: (data) => {
        playBidChime();
        setMultiplayerRoom(data.room);
      },
      onTimerTick: (data) => {
        if (data.countdown <= 3 && data.countdown > 0) {
          playCountdownTick('urgent');
        } else if (data.countdown === 5) {
          playCountdownTick('normal');
        }
        setMultiplayerRoom(prev => prev ? { ...prev, countdown: data.countdown, auctioneerCall: data.auctioneerCall } : null);
      },
      onLotResolved: (data) => {
        if (data.resolvedLot.type === 'sold') {
          playSoldFanfare();
        } else {
          playUnsoldThud();
        }
        setMultiplayerRoom(data.room);
      },
      onAuctionCompleted: (completedRoom) => {
        setMultiplayerRoom(completedRoom);
      }
    });

    return () => unsubscribe();
  }, [appMode]);

  // Save multiplayer credentials for automatic recovery
  const handleMultiplayerJoined = (room: MultiplayerRoomState, playerId: string) => {
    setMultiplayerRoom(room);
    setMultiplayerPlayerId(playerId);
    sessionStorage.setItem('ipl_room_code', room.roomCode);
    sessionStorage.setItem('ipl_player_id', playerId);
  };

  const handleLeaveMultiplayerRoom = () => {
    sessionStorage.removeItem('ipl_room_code');
    sessionStorage.removeItem('ipl_player_id');
    setMultiplayerRoom(null);
    setMultiplayerPlayerId(null);
  };

  const upcomingPlayers = players.filter((p, idx) => idx > currentPlayerIndex && p.status === 'upcoming');
  const myMultiplayerTeam = multiplayerRoom?.teams.find(t => {
    const me = multiplayerRoom.players.find(p => p.id === multiplayerPlayerId);
    return t.id === me?.teamId;
  }) || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Broadcast Header Navigation */}
      <Navbar
        appMode={appMode}
        selectedTeam={appMode === 'singleplayer' ? (screen !== 'selection' ? userTeam : null) : myMultiplayerTeam}
        roomCode={multiplayerRoom?.roomCode}
        isMuted={isMutedState}
        onToggleSound={handleToggleSound}
        onOpenRules={() => setRulesModalOpen(true)}
        onOpenSquads={() => setInspectSquadModalOpen(true)}
        onOpenResults={() => {
          if (appMode === 'singleplayer') setScreen('results');
        }}
        onResetAuction={handleResetAuction}
        onSwitchMode={() => setAppMode(null)}
      />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        {/* LANDING: Mode Selection Screen */}
        {appMode === null && (
          <ModeSelectionScreen
            onSelectMode={(mode) => setAppMode(mode)}
          />
        )}

        {/* MODE 1: SINGLE PLAYER AUCTION (STAGE 1 PRESERVED) */}
        {appMode === 'singleplayer' && (
          <>
            {screen === 'selection' && (
              <TeamSelectionScreen
                teams={teams}
                onConfirmTeam={handleConfirmTeam}
              />
            )}

            {screen === 'auction' && (
              <div className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
                  <div className="lg:col-span-3 order-2 lg:order-1">
                    <TeamsLeftPanel
                      teams={teams}
                      userTeamId={userTeamId}
                      highestBidderTeamId={highestBidderTeamId}
                      onSelectTeamToInspect={() => setInspectSquadModalOpen(true)}
                    />
                  </div>

                  <div className="lg:col-span-6 order-1 lg:order-2">
                    <PlayerMainStage
                      player={currentPlayer}
                      currentBid={currentBid}
                      highestBidder={highestBidderTeam}
                      userTeam={userTeam}
                      countdown={countdown}
                      maxCountdown={AUCTION_TIMER_SECONDS}
                      isPaused={isPaused}
                      gameSpeed={gameSpeed}
                      canUserBid={canUserBid}
                      userBidDisabledReason={userBidValidation.reason}
                      onPlaceUserBid={handlePlaceUserBid}
                      onPassPlayer={handlePassPlayer}
                      onSkipPlayer={handleSkipPlayer}
                      onSkipSet={handleSkipEntireSet}
                      onTogglePause={() => setIsPaused(prev => !prev)}
                      onChangeSpeed={s => setGameSpeed(s)}
                    />
                  </div>

                  <div className="lg:col-span-3 order-3">
                    <LiveBidRightPanel
                      bids={bidHistory}
                      teams={teams}
                      userTeamId={userTeamId}
                      auctioneerCall={auctioneerCall}
                    />
                  </div>
                </div>

                <div className="w-full">
                  <QueueBottomPanel
                    upcomingPlayers={upcomingPlayers}
                    selectedCategory={selectedCategory}
                    onSelectCategory={cat => setSelectedCategory(cat)}
                    onJumpToPlayer={handleJumpToPlayer}
                    currentIndex={currentPlayerIndex}
                    totalPlayers={players.length}
                  />
                </div>
              </div>
            )}

            {screen === 'results' && (
              <AuctionResultsScreen
                teams={teams}
                players={players}
                userTeamId={userTeamId}
                onBackToAuction={() => setScreen('auction')}
                onRestartAuction={handleResetAuction}
              />
            )}
          </>
        )}

        {/* MODE 2: REAL-TIME MULTIPLAYER AUCTION (STAGE 2) */}
        {appMode === 'multiplayer' && (
          <>
            {!multiplayerRoom ? (
              <MultiplayerEntryScreen
                onRoomJoined={handleMultiplayerJoined}
                onBackToHome={() => setAppMode(null)}
              />
            ) : multiplayerRoom.status === 'waiting' || multiplayerRoom.status === 'ready' ? (
              <MultiplayerLobbyScreen
                room={multiplayerRoom}
                currentUserId={multiplayerPlayerId || ''}
                onLeaveRoom={handleLeaveMultiplayerRoom}
              />
            ) : multiplayerRoom.status === 'auction' ? (
              <MultiplayerAuctionScreen
                room={multiplayerRoom}
                currentUserId={multiplayerPlayerId || ''}
                onLeaveRoom={handleLeaveMultiplayerRoom}
                onOpenSquads={() => setInspectSquadModalOpen(true)}
              />
            ) : (
              <MultiplayerResultsScreen
                room={multiplayerRoom}
                currentUserId={multiplayerPlayerId || ''}
                onLeaveRoom={handleLeaveMultiplayerRoom}
              />
            )}
          </>
        )}
      </main>

      {/* Singleplayer Modals & Overlays */}
      {soldModalData && (
        <SoldOverlay
          player={soldModalData.player}
          winningTeam={soldModalData.winningTeam}
          finalPrice={soldModalData.price}
          userTeamId={userTeamId}
          onNext={handleAdvanceToNextPlayer}
        />
      )}

      {unsoldModalData && (
        <UnsoldOverlay
          player={unsoldModalData}
          onNext={handleAdvanceToNextPlayer}
        />
      )}

      {inspectSquadModalOpen && (
        <SquadModal
          teams={appMode === 'multiplayer' && multiplayerRoom ? multiplayerRoom.teams : teams}
          initialSelectedTeamId={userTeamId}
          onClose={() => setInspectSquadModalOpen(false)}
        />
      )}

      {rulesModalOpen && (
        <RulesModal
          rules={rules}
          onUpdateRules={newRules => setRules(newRules)}
          onClose={() => setRulesModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
