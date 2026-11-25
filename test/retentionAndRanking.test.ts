import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { setupMultiplayerSocket } from '../server/multiplayer';
import { INITIAL_TEAMS } from '../src/data/teamsData';
import { INITIAL_PLAYERS } from '../src/data/playersData';
import {
  DEFAULT_RETENTION_RULES,
  getEligibleRetentionPlayers,
  validateRetentionSelection,
  applyTeamRetention
} from '../src/engine/retentionEngine';
import { analyzeTeam, analyzeTournament } from '../src/engine/teamAnalysisEngine';
import type { MultiplayerRoomState } from '../src/types';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runTests() {
  console.log('=== RUNNING RETENTION & AI RANKING INTEGRATION TESTS ===');

  // ----------------------------------------------------------------
  // PART 1: UNIT TESTS FOR RETENTION ENGINE
  // ----------------------------------------------------------------
  const miTeam = { ...INITIAL_TEAMS.find(t => t.id === 'MI')!, purchasedPlayers: [] };
  const miEligible = getEligibleRetentionPlayers('MI', INITIAL_PLAYERS);
  assert(miEligible.length >= 5, `MI should have >= 5 eligible players (got ${miEligible.length})`);
  assert(miEligible.every(p => p.previousTeam === 'MI'), 'All eligible MI players must belong to MI');

  // Invalid: selecting another team's player (Virat Kohli - RCB)
  const kohli = INITIAL_PLAYERS.find(p => p.name === 'Virat Kohli')!;
  const invalidTeamRes = validateRetentionSelection(miTeam, [kohli.id], INITIAL_PLAYERS, DEFAULT_RETENTION_RULES);
  assert(!invalidTeamRes.isValid, 'Must reject retaining a player from another franchise');

  // Invalid: exceeding max retentions (6 > 5)
  const sixIds = miEligible.slice(0, 6).map(p => p.id);
  const tooManyRes = validateRetentionSelection(miTeam, sixIds, INITIAL_PLAYERS, DEFAULT_RETENTION_RULES);
  assert(!tooManyRes.isValid, 'Must reject exceeding max retentions');

  // Valid: retaining 2 MI players (e.g. Bumrah & Rohit/Suryakumar)
  const twoMiIds = miEligible.slice(0, 2).map(p => p.id);
  const validMiRes = validateRetentionSelection(miTeam, twoMiIds, INITIAL_PLAYERS, DEFAULT_RETENTION_RULES);
  assert(validMiRes.isValid, `Valid 2-player retention failed: ${validMiRes.reason}`);
  // Slot 1 = 18 Cr, Slot 2 = 14 Cr => 32 Cr
  assert(validMiRes.totalCost === 320000000, `Expected 32 Cr retention cost, got ${validMiRes.totalCost}`);

  const { updatedTeam: miAfterRetention, updatedPlayerPool: poolAfterMi } = applyTeamRetention(
    miTeam,
    validMiRes.items,
    INITIAL_PLAYERS
  );
  assert(miAfterRetention.currentPurse === 1200000000 - 320000000, 'Purse must be deducted by 32 Cr (88 Cr remaining)');
  assert(miAfterRetention.squadCount === 2, 'Retained players must be included in squadCount');
  assert(miAfterRetention.retentionConfirmed === true, 'retentionConfirmed flag must be set');
  assert(
    twoMiIds.every(id => poolAfterMi.find(p => p.id === id)?.status === 'retained'),
    'Retained players must be marked status=retained in playerPool'
  );

  // Duplicate retention guard
  const dupRes = validateRetentionSelection(miAfterRetention, twoMiIds, poolAfterMi, DEFAULT_RETENTION_RULES);
  assert(!dupRes.isValid, 'Duplicate retention submission must be rejected');

  console.log('✓ Part 1 Passed: Retention engine unit tests & duplicate deduction prevention');

  // ----------------------------------------------------------------
  // PART 2: MULTIPLAYER SOCKET.IO END-TO-END FLOW
  // ----------------------------------------------------------------
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  setupMultiplayerSocket(io);

  await new Promise<void>(resolve => server.listen(3121, resolve));
  const url = 'http://localhost:3121';

  const hostSocket: ClientSocket = ioClient(url, { transports: ['websocket'] });
  const guestSocket: ClientSocket = ioClient(url, { transports: ['websocket'] });

  await Promise.all([
    new Promise<void>(res => hostSocket.on('connect', res)),
    new Promise<void>(res => guestSocket.on('connect', res))
  ]);

  const emitAsync = <T = any>(sock: ClientSocket, event: string, payload?: any): Promise<T> =>
    new Promise(resolve => {
      if (payload !== undefined) sock.emit(event, payload, resolve);
      else sock.emit(event, resolve);
    });

  // 1. Create & Join Room
  const createRes = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(hostSocket, 'create_room', {
    hostName: 'HostMI'
  });
  assert(createRes.success && !!createRes.room.roomCode, 'Room creation must succeed');
  const roomCode = createRes.room.roomCode;
  const hostId = createRes.room.hostId;

  const joinRes = await emitAsync<{ success: boolean; room: MultiplayerRoomState; playerId: string }>(
    guestSocket,
    'join_room',
    { roomCode, playerName: 'GuestRCB' }
  );
  assert(joinRes.success, 'Guest must join room');
  const guestId = joinRes.playerId;

  // 2. Claim Teams (Host = MI, Guest = RCB)
  const claimHost = await emitAsync(hostSocket, 'claim_team', { teamId: 'MI' });
  const claimGuest = await emitAsync(guestSocket, 'claim_team', { teamId: 'RCB' });
  assert(claimHost.success && claimGuest.success, 'Both managers must claim teams');

  // 3. Non-host cannot start retention
  const nonHostStartRet = await emitAsync(guestSocket, 'start_retention');
  assert(!nonHostStartRet.success, 'Non-host must not be allowed to start retention stage');

  // 4. Host starts retention stage
  const startRet = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(hostSocket, 'start_retention');
  assert(startRet.success && startRet.room.status === 'retention', 'Room must transition to retention stage');

  // 5. Host retains Bumrah (p-m02) for MI -> 18 Cr
  const bumrah = INITIAL_PLAYERS.find(p => p.name === 'Jasprit Bumrah')!;
  const hostRetRes = await emitAsync<{ success: boolean; totalCost: number; remainingPurse: number; room: MultiplayerRoomState }>(
    hostSocket,
    'submit_retention',
    { roomCode, playerId: hostId, teamId: 'MI', playerIds: [bumrah.id] }
  );
  assert(hostRetRes.success, 'Host MI retention submission must succeed');
  assert(hostRetRes.totalCost === 180000000, `Expected 18 Cr, got ${hostRetRes.totalCost}`);
  assert(hostRetRes.remainingPurse === 1020000000, `Expected 102 Cr remaining, got ${hostRetRes.remainingPurse}`);

  // Duplicate retention attempt by Host must fail
  const hostDupRet = await emitAsync(hostSocket, 'submit_retention', {
    roomCode,
    playerId: hostId,
    teamId: 'MI',
    playerIds: [bumrah.id]
  });
  assert(!hostDupRet.success, 'Duplicate retention submission on server must be rejected');

  // 6. Guest retains Virat Kohli (p-m01) for RCB -> 18 Cr
  const guestRetRes = await emitAsync<{ success: boolean; totalCost: number; remainingPurse: number; room: MultiplayerRoomState }>(
    guestSocket,
    'submit_retention',
    { roomCode, playerId: guestId, teamId: 'RCB', playerIds: [kohli.id] }
  );
  assert(guestRetRes.success, 'Guest RCB retention submission must succeed');
  assert(guestRetRes.remainingPurse === 1020000000, 'RCB must have 102 Cr remaining');

  // 7. Host starts auction -> retained players (Kohli p-m01, Bumrah p-m02) MUST be skipped!
  const startAucRes = await emitAsync(hostSocket, 'start_auction');
  assert(startAucRes.success, 'Start auction from retention must succeed');

  // Wait briefly for room_updated or reconnect to inspect current lot
  const checkState = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(hostSocket, 'reconnect_player', {
    roomCode,
    playerId: hostId
  });
  const firstLot = checkState.room.playerPool[checkState.room.currentPlayerIndex];
  assert(
    firstLot.id !== kohli.id && firstLot.id !== bumrah.id,
    `Retained players must NOT enter auction! First lot was ${firstLot.name}`
  );
  assert(firstLot.status === 'upcoming', 'First auction lot must have status=upcoming');

  // 8. Place a bid on the first non-retained lot (Rohit Sharma p-m03)
  const bidRes = await emitAsync<{ success: boolean; bid?: any; error?: string }>(guestSocket, 'place_bid', {
    roomCode,
    playerId: guestId,
    teamId: 'RCB',
    amount: firstLot.basePrice,
    requestId: 'req-ret-1'
  });
  assert(bidRes.success, `Guest bid after retention must succeed (got ${bidRes.error})`);

  // 9. Non-host cannot close/finalize auction
  const guestCloseRes = await emitAsync(guestSocket, 'close_auction', { roomCode, playerId: guestId });
  assert(!guestCloseRes.success, 'Non-host must NOT be able to close/finalize auction');

  // 10. Host closes & finalizes auction
  const hostCloseRes = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(hostSocket, 'close_auction', {
    roomCode,
    playerId: hostId
  });
  assert(hostCloseRes.success, 'Host close_auction must succeed');
  assert(hostCloseRes.room.status === 'completed', 'Room status must be completed');
  assert(!!hostCloseRes.room.finalResults, 'Server must store finalResults in room state');
  assert(hostCloseRes.room.finalResults!.rankings.length === 2, 'Rankings must evaluate participating teams');
  assert(!!hostCloseRes.room.finalResults!.championTeamId, 'Champion team must be identified');

  // 11. Duplicate finalization must be rejected
  const dupCloseRes = await emitAsync(hostSocket, 'close_auction', { roomCode, playerId: hostId });
  assert(!dupCloseRes.success, 'Duplicate close_auction must be rejected');

  // 12. Bidding after finalization must be rejected
  const postCloseBid = await emitAsync(hostSocket, 'place_bid', {
    roomCode,
    playerId: hostId,
    teamId: 'MI',
    amount: 20000000
  });
  assert(!postCloseBid.success, 'Bidding after finalization must be rejected');

  // 13. Reconnection retrieves identical finalized results
  const reconRes = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(guestSocket, 'reconnect_player', {
    roomCode,
    playerId: guestId
  });
  assert(reconRes.success && reconRes.room.status === 'completed', 'Reconnecting user must see completed room');
  assert(
    reconRes.room.finalResults?.championTeamId === hostCloseRes.room.finalResults?.championTeamId,
    'Reconnecting user must receive identical champion & rankings'
  );

  // 14. Sequence Progression: Non-host cannot resume, Host resumes from next eligible player (NOT Virat Kohli!)
  const guestResumeRes = await emitAsync(guestSocket, 'resume_auction', { roomCode, playerId: guestId });
  assert(!guestResumeRes.success, 'Non-host must not be allowed to resume auction');

  // Re-open from completed state -> since Rohit Sharma (p-m03) was still 'upcoming' when closed,
  // let's resume, advance via next_lot to Klaasen (p-m04), close again, and resume again -> MUST land on Klaasen!
  const resume1 = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(hostSocket, 'resume_auction', {
    roomCode,
    playerId: hostId
  });
  assert(resume1.success && resume1.room.status === 'auction', 'Host must be able to resume closed auction');
  const resumedLot1 = resume1.room.playerPool[resume1.room.currentPlayerIndex];
  assert(resumedLot1.id !== kohli.id && resumedLot1.id !== bumrah.id, 'Resumed lot must NOT restart at Virat Kohli');

  const nextLotRes = await emitAsync(hostSocket, 'next_lot', { roomCode, playerId: hostId });
  assert(nextLotRes.success, 'Host next_lot must succeed');

  const close2 = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(hostSocket, 'close_auction', {
    roomCode,
    playerId: hostId
  });
  assert(close2.success, 'Second close_auction must succeed');

  const resume2 = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(hostSocket, 'resume_auction', {
    roomCode,
    playerId: hostId
  });
  assert(resume2.success, 'Second resume_auction must succeed');
  const resumedLot2 = resume2.room.playerPool[resume2.room.currentPlayerIndex];
  assert(
    resumedLot2.name === 'Heinrich Klaasen',
    `Expected resumed lot to continue at Heinrich Klaasen, got ${resumedLot2.name}`
  );
  assert(
    resume2.room.playerPool.find(p => p.name === 'Rohit Sharma')?.status === 'unsold',
    'Previously skipped Rohit Sharma must remain unsold and not repeat'
  );

  const guestReconAfterResume = await emitAsync<{ success: boolean; room: MultiplayerRoomState }>(
    guestSocket,
    'reconnect_player',
    { roomCode, playerId: guestId }
  );
  assert(
    guestReconAfterResume.room.currentPlayerIndex === resume2.room.currentPlayerIndex,
    'Reconnecting guest must receive exact resumed currentPlayerIndex'
  );

  // ----------------------------------------------------------------
  // PART 3: AI RANKING & NARRATIVE UNIQUENESS TESTS
  // ----------------------------------------------------------------
  const teamA = { ...miAfterRetention, ownerName: 'ManagerA' };
  const teamB = {
    ...INITIAL_TEAMS.find(t => t.id === 'CSK')!,
    purchasedPlayers: INITIAL_PLAYERS.filter(p => p.previousTeam === 'CSK').slice(0, 11).map(p => ({
      ...p,
      status: 'sold' as const,
      soldPrice: 80000000,
      soldTo: 'CSK'
    })),
    squadCount: 11,
    currentPurse: 1200000000 - 880000000
  };
  const reportA = analyzeTeam(teamA);
  const reportB = analyzeTeam(teamB);
  assert(reportA.aiNarrative !== reportB.aiNarrative, 'Each team must receive a unique AI narrative');
  assert(reportA.retainedCount === 2 && reportA.retentionSpent === 320000000, 'Retention metrics must be reflected in report');
  assert(reportB.overallScore > reportA.overallScore, 'Full 11-player CSK squad should outrank 1-player MI squad');

  const tourney = analyzeTournament([teamA, teamB]);
  assert(tourney.championTeamId === 'CSK', 'CSK must be ranked #1 champion');
  assert(tourney.rankings[0].rank === 1 && tourney.rankings[1].rank === 2, 'Ranks must be sequential');

  console.log('✓ Part 2 & 3 Passed: Full multiplayer retention -> auction -> finalization -> AI ranking & reconnect verified!');

  hostSocket.disconnect();
  guestSocket.disconnect();
  io.close();
  server.close();
  console.log('=== ALL RETENTION & AI RANKING TESTS PASSED 100% ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
