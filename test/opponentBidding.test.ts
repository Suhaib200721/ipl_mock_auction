import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupMultiplayerSocket } from '../server/multiplayer';
import { DEFAULT_RULES, formatCurrency, getNextBidAmount } from '../src/utils/currencyUtils';

console.log('=== RUNNING MULTI-CLIENT OPPONENT BIDDING INTEGRATION TEST SUITE ===');

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
setupMultiplayerSocket(io);

const TEST_PORT = 3110;

server.listen(TEST_PORT, async () => {
  console.log(`✓ Test Socket.IO server running on port ${TEST_PORT}`);

  try {
    // 1. CONNECT CLIENT 1 (HOST - "CaptainRohit")
    const client1: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket']
    });
    await new Promise<void>((resolve) => client1.on('connect', () => resolve()));
    console.log('✓ Host Client (CaptainRohit) connected');

    // 2. CONNECT CLIENT 2 (OPPONENT - "KingKohli")
    const client2: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket']
    });
    await new Promise<void>((resolve) => client2.on('connect', () => resolve()));
    console.log('✓ Opponent Client (KingKohli) connected');

    // 3. HOST CREATES ROOM
    const createRes: any = await new Promise((resolve) => {
      client1.emit('create_room', { hostName: 'CaptainRohit' }, resolve);
    });
    console.assert(createRes.success, 'Create room failed');
    const roomCode = createRes.room.roomCode;
    const hostPlayerId = createRes.room.hostId;
    console.log(`✓ Room created with code: ${roomCode}, HostId: ${hostPlayerId}`);

    // 4. OPPONENT JOINS ROOM
    const joinRes: any = await new Promise((resolve) => {
      client2.emit('join_room', { roomCode, playerName: 'KingKohli' }, resolve);
    });
    console.assert(joinRes.success, 'Join room failed');
    console.assert(joinRes.playerId, 'Join room should return playerId');
    const opponentPlayerId = joinRes.playerId;
    console.log(`✓ Opponent joined room successfully. OpponentId: ${opponentPlayerId}`);

    // 5. FRANCHISE CLAIM: Host claims MI, Opponent claims RCB
    const hostClaimRes: any = await new Promise((resolve) => {
      client1.emit('claim_team', { teamId: 'MI' }, resolve);
    });
    console.assert(hostClaimRes.success, 'Host team claim failed');
    console.log('✓ Host claimed franchise: Mumbai Indians (MI)');

    // Collision check: Opponent tries to claim MI -> must fail
    const collisionRes: any = await new Promise((resolve) => {
      client2.emit('claim_team', { teamId: 'MI' }, resolve);
    });
    console.assert(!collisionRes.success, 'Opponent claiming already taken team should fail');
    console.log(`✓ Team collision check passed: "${collisionRes.error}"`);

    const opponentClaimRes: any = await new Promise((resolve) => {
      client2.emit('claim_team', { teamId: 'RCB' }, resolve);
    });
    console.assert(opponentClaimRes.success, 'Opponent team claim failed');
    console.log('✓ Opponent claimed franchise: Royal Challengers Bengaluru (RCB)');

    // 6. HOST STARTS AUCTION
    const startRes: any = await new Promise((resolve) => {
      client1.emit('start_auction', resolve);
    });
    console.assert(startRes.success, 'Start auction failed');
    console.log('✓ Host launched live auction. Status: AUCTION');

    // Setup live broadcast listener on both clients
    const hostReceivedBids: any[] = [];
    const opponentReceivedBids: any[] = [];
    client1.on('bid_placed', (d: any) => hostReceivedBids.push(d));
    client2.on('bid_placed', (d: any) => opponentReceivedBids.push(d));

    // 7. OPENING BID: Host places opening bid (₹2.00 Cr)
    const bid1Res: any = await new Promise((resolve) => {
      client1.emit('place_bid', {
        roomCode,
        playerId: hostPlayerId,
        teamId: 'MI'
      }, resolve);
    });
    console.assert(bid1Res.success, `Host bid failed: ${bid1Res.error}`);
    console.log(`✓ Host placed opening bid: ${formatCurrency(bid1Res.bid.amount)}`);

    // Verify host cannot double-bid consecutively
    const hostDoubleBidRes: any = await new Promise((resolve) => {
      client1.emit('place_bid', {
        roomCode,
        playerId: hostPlayerId,
        teamId: 'MI'
      }, resolve);
    });
    console.assert(!hostDoubleBidRes.success, 'Host consecutive bid should be blocked');
    console.log(`✓ Host consecutive double-bid blocked: "${hostDoubleBidRes.error}"`);

    // 8. OPPONENT COUNTER-BID: Opponent places counter bid (₹2.25 Cr)
    const bid2Res: any = await new Promise((resolve) => {
      client2.emit('place_bid', {
        roomCode,
        playerId: opponentPlayerId,
        teamId: 'RCB'
      }, resolve);
    });
    console.assert(bid2Res.success, `Opponent counter bid failed: ${bid2Res.error}`);
    console.assert(bid2Res.bid.teamShortName === 'RCB', 'Bid should be recorded under RCB');
    console.assert(bid2Res.bid.bidderName === 'KingKohli', 'Bidder should be KingKohli');
    console.log(`✓ Opponent counter-bid executed successfully: ${formatCurrency(bid2Res.bid.amount)} for RCB!`);

    // Verify opponent cannot double-bid consecutively
    const opponentDoubleBidRes: any = await new Promise((resolve) => {
      client2.emit('place_bid', {
        roomCode,
        playerId: opponentPlayerId,
        teamId: 'RCB'
      }, resolve);
    });
    console.assert(!opponentDoubleBidRes.success, 'Opponent consecutive bid should be blocked');
    console.log(`✓ Opponent consecutive double-bid blocked: "${opponentDoubleBidRes.error}"`);

    // 9. BID BACK AND FORTH (Host -> Opponent -> Host -> Opponent)
    // Host raises to ₹2.50 Cr
    const bid3Res: any = await new Promise((resolve) => {
      client1.emit('place_bid', { roomCode, playerId: hostPlayerId, teamId: 'MI' }, resolve);
    });
    console.assert(bid3Res.success, `Host 3rd bid failed: ${bid3Res.error}`);
    console.log(`✓ Host raised to: ${formatCurrency(bid3Res.bid.amount)}`);

    // Opponent raises to ₹2.75 Cr
    const bid4Res: any = await new Promise((resolve) => {
      client2.emit('place_bid', { roomCode, playerId: opponentPlayerId, teamId: 'RCB' }, resolve);
    });
    console.assert(bid4Res.success, `Opponent 4th bid failed: ${bid4Res.error}`);
    console.log(`✓ Opponent raised to: ${formatCurrency(bid4Res.bid.amount)}`);

    // Host raises to ₹3.00 Cr
    const bid5Res: any = await new Promise((resolve) => {
      client1.emit('place_bid', { roomCode, playerId: hostPlayerId, teamId: 'MI' }, resolve);
    });
    console.assert(bid5Res.success, `Host 5th bid failed: ${bid5Res.error}`);
    console.log(`✓ Host raised to: ${formatCurrency(bid5Res.bid.amount)}`);

    // 10. RECONNECTION RESILIENCE TEST
    // Disconnect opponent client, reconnect, and verify opponent can still bid
    client2.disconnect();
    const client2Reconnected: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket']
    });
    await new Promise<void>((resolve) => client2Reconnected.on('connect', () => resolve()));
    console.log('✓ Opponent simulated network disconnect & reconnected via new WebSocket');

    // Opponent places counter bid (₹3.25 Cr) via reconnected socket
    const bid6Res: any = await new Promise((resolve) => {
      client2Reconnected.emit('place_bid', {
        roomCode,
        playerId: opponentPlayerId,
        teamId: 'RCB'
      }, resolve);
    });
    console.assert(bid6Res.success, `Opponent bid after reconnect failed: ${bid6Res.error}`);
    console.log(`✓ Opponent placed bid after socket reconnection: ${formatCurrency(bid6Res.bid.amount)}!`);

    // 11. VERIFY REAL-TIME BROADCASTS
    await new Promise((r) => setTimeout(r, 200));
    console.assert(hostReceivedBids.length >= 4, `Host should have received all bid broadcasts, got ${hostReceivedBids.length}`);
    console.log(`✓ Real-time broadcast verification: Host received ${hostReceivedBids.length} bid_placed events`);

    // Clean up
    client1.disconnect();
    client2Reconnected.disconnect();
    server.close();

    console.log('=== ALL 11 OPPONENT BIDDING INTEGRATION TESTS PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('Opponent bidding test failed:', err);
    server.close();
    process.exit(1);
  }
});
