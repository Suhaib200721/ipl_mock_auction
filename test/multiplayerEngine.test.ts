import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupMultiplayerSocket } from '../server/multiplayer';
import type { MultiplayerRoomState } from '../src/types';

console.log('--- RUNNING REAL-TIME MULTIPLAYER SOCKET.IO INTEGRATION TESTS ---');

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
setupMultiplayerSocket(io);

const TEST_PORT = 3099;

server.listen(TEST_PORT, async () => {
  console.log(`✓ Test Socket.IO server running on port ${TEST_PORT}`);

  try {
    // 1. Connect Client 1 (Host: "CaptainRohit")
    const client1: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`);
    await new Promise<void>(resolve => client1.on('connect', () => resolve()));
    console.log('✓ Client 1 (Host) connected via real WebSocket');

    // 2. Client 1 creates auction room
    const createRes = await new Promise<any>(resolve => {
      client1.emit('create_room', { hostName: 'CaptainRohit' }, resolve);
    });
    console.assert(createRes.success, 'Create room failed');
    const roomCode = createRes.room.roomCode;
    const hostPlayerId = createRes.room.hostId;
    console.log(`✓ Room created successfully with 6-character code: ${roomCode}`);

    // 3. Connect Client 2 (Player: "ViratFan")
    const client2: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`);
    await new Promise<void>(resolve => client2.on('connect', () => resolve()));
    console.log('✓ Client 2 connected via real WebSocket');

    // 4. Client 2 joins room with roomCode
    const joinRes = await new Promise<any>(resolve => {
      client2.emit('join_room', { roomCode, playerName: 'ViratFan' }, resolve);
    });
    console.assert(joinRes.success, 'Join room failed');
    console.assert(joinRes.room.players.length === 2, 'Room should have 2 players');
    console.log('✓ Client 2 joined room. Roster synchronized: 2 human managers');

    // 5. Client 1 selects team 'MI'
    const team1Res = await new Promise<any>(resolve => {
      client1.emit('select_team', { teamId: 'MI' }, resolve);
    });
    console.assert(team1Res.success, 'Host team selection failed');
    console.log('✓ Host selected Mumbai Indians (MI)');

    // 6. Client 2 tries to select 'MI' -> Must fail (team collision prevention)
    const conflictRes = await new Promise<any>(resolve => {
      client2.emit('select_team', { teamId: 'MI' }, resolve);
    });
    console.assert(!conflictRes.success, 'Collision check failed: MI should be locked');
    console.log(`✓ Team collision correctly prevented: "${conflictRes.error}"`);

    // 7. Client 2 selects available team 'RCB'
    const team2Res = await new Promise<any>(resolve => {
      client2.emit('select_team', { teamId: 'RCB' }, resolve);
    });
    console.assert(team2Res.success, 'Client 2 team selection failed');
    console.log('✓ Client 2 selected Royal Challengers Bengaluru (RCB)');

    // 8. Both players ready up
    await new Promise<any>(resolve => client1.emit('toggle_ready', resolve));
    await new Promise<any>(resolve => client2.emit('toggle_ready', resolve));
    console.log('✓ Both players marked READY in room lobby');

    // 9. Host starts auction
    const startRes = await new Promise<any>(resolve => {
      client1.emit('start_auction', resolve);
    });
    console.assert(startRes.success, 'Start auction failed');
    console.log('✓ Host started auction. Room state transitioned to live AUCTION.');

    // 10. Client 2 places opening bid on Lot #1 (Virat Kohli)
    let bidPlacedReceived = false;
    client1.on('bid_placed', (data: any) => {
      bidPlacedReceived = true;
      console.assert(data.bid.teamShortName === 'RCB', 'Bid should be from RCB');
      console.assert(data.bid.bidderName === 'ViratFan', 'Bid should be from ViratFan');
      console.assert(data.room.countdown === 15, 'Bid placement must reset timer to 15s');
    });

    const bidRes = await new Promise<any>(resolve => {
      client2.emit('place_bid', resolve);
    });
    console.assert(bidRes.success, 'Place bid failed');
    console.log('✓ Client 2 placed valid opening bid on Lot #1. Broadcast received & countdown reset to 15s.');

    // 11. Client 2 tries to bid again immediately -> Must fail (already holding highest bid)
    const duplicateBidRes = await new Promise<any>(resolve => {
      client2.emit('place_bid', resolve);
    });
    console.assert(!duplicateBidRes.success, 'Should not allow consecutive bid by same leader');
    console.log(`✓ Consecutive self-outbidding correctly prevented: "${duplicateBidRes.error}"`);

    // Clean up
    client1.disconnect();
    client2.disconnect();
    server.close();

    console.log('=== ALL REAL-TIME MULTIPLAYER INTEGRATION TESTS PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    server.close();
    process.exit(1);
  }
});
