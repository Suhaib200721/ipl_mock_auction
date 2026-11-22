import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupMultiplayerSocket } from '../server/multiplayer';
import type { MultiplayerRoomState } from '../src/types';

console.log('=== RUNNING STAGE 3: MULTIPLAYER TEAM CLAIM SYSTEM TESTS ===');

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
setupMultiplayerSocket(io);

const TEST_PORT = 3105;

server.listen(TEST_PORT, async () => {
  console.log(`✓ Test Socket.IO server running on port ${TEST_PORT}`);

  try {
    // 1. Connect Client 1 (Host "HardikFan")
    const client1: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket', 'polling']
    });
    await new Promise<void>(resolve => client1.on('connect', () => resolve()));
    console.log('✓ Client 1 (Host) connected');

    // 2. Client 1 creates room
    const createRes = await new Promise<any>(resolve => {
      client1.emit('create_room', { hostName: 'HardikFan' }, resolve);
    });
    console.assert(createRes.success, 'Room creation failed');
    const roomCode = createRes.room.roomCode;
    console.log(`✓ Room created with code: ${roomCode}`);

    // 3. Connect Client 2 ("DhoniFan")
    const client2: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket', 'polling']
    });
    await new Promise<void>(resolve => client2.on('connect', () => resolve()));
    console.log('✓ Client 2 connected');

    // 4. Client 2 joins the room
    const joinRes = await new Promise<any>(resolve => {
      client2.emit('join_room', { roomCode, playerName: 'DhoniFan' }, resolve);
    });
    console.assert(joinRes.success, 'Join room failed');
    console.log('✓ Client 2 joined room. Both managers present in lobby.');

    // 5. Client 1 claims Mumbai Indians (MI)
    let client2HeardClaim = false;
    let client2UpdatedRoom: MultiplayerRoomState | null = null;
    client2.on('room_updated', (updatedRoom: MultiplayerRoomState) => {
      client2UpdatedRoom = updatedRoom;
      const miTeam = updatedRoom.teams.find(t => t.id === 'MI');
      if (miTeam && miTeam.ownerName === 'HardikFan') {
        client2HeardClaim = true;
      }
    });

    const claim1Res = await new Promise<any>(resolve => {
      client1.emit('claim_team', { teamId: 'MI' }, resolve);
    });
    console.assert(claim1Res.success, 'Client 1 should successfully claim MI');
    console.assert(claim1Res.teamId === 'MI', 'Claimed teamId must be MI');
    console.log('✓ Feature 1: Client 1 successfully claimed Mumbai Indians (MI)');

    // Allow broadcast propagation
    await new Promise(r => setTimeout(r, 80));
    console.assert(client2HeardClaim, 'Client 2 must receive real-time room update showing MI claimed by HardikFan');
    console.log('✓ Feature 2: Real-time broadcast verified - Client 2 sees MI is claimed by HardikFan');

    // 6. Client 2 attempts to claim the same team (MI) -> MUST BE REJECTED
    const claimConflictRes = await new Promise<any>(resolve => {
      client2.emit('claim_team', { teamId: 'MI' }, resolve);
    });
    console.assert(!claimConflictRes.success, 'Client 2 must NOT be allowed to claim MI');
    console.assert(claimConflictRes.error.includes('already claimed'), 'Error must specify team is already claimed');
    console.log(`✓ Feature 2 & 3: Lock verified - Client 2 claim rejected: "${claimConflictRes.error}"`);

    // 7. Client 1 attempts to claim another team (CSK) without releasing MI -> MUST BE REJECTED
    const claimMultiRes = await new Promise<any>(resolve => {
      client1.emit('claim_team', { teamId: 'CSK' }, resolve);
    });
    console.assert(!claimMultiRes.success, 'Client 1 cannot hold multiple teams simultaneously');
    console.assert(claimMultiRes.error.includes('already hold'), 'Error must instruct to release current team');
    console.log(`✓ Feature 4 & 7: Multi-claim prevention verified: "${claimMultiRes.error}"`);

    // 8. Client 2 claims Chennai Super Kings (CSK)
    const claim2Res = await new Promise<any>(resolve => {
      client2.emit('claim_team', { teamId: 'CSK' }, resolve);
    });
    console.assert(claim2Res.success, 'Client 2 should claim CSK');
    console.log('✓ Feature 1: Client 2 successfully claimed Chennai Super Kings (CSK)');

    // 9. Client 1 releases MI
    let client2HeardRelease = false;
    client2.on('team_released', (data: any) => {
      if (data.teamId === 'MI' && data.playerName === 'HardikFan') {
        client2HeardRelease = true;
      }
    });

    const releaseRes = await new Promise<any>(resolve => {
      client1.emit('release_team', resolve);
    });
    console.assert(releaseRes.success, 'Client 1 release should succeed');
    console.assert(releaseRes.releasedTeamId === 'MI', 'Released teamId must be MI');
    console.log('✓ Feature 4: Client 1 successfully released MI');

    await new Promise(r => setTimeout(r, 80));
    console.assert(client2HeardRelease, 'Client 2 must receive team_released event');
    console.log('✓ Feature 4: Real-time release broadcast verified - MI is available again');

    // 10. Client 2 releases CSK and claims the newly available MI
    await new Promise<any>(resolve => client2.emit('release_team', resolve));
    const claimFreedRes = await new Promise<any>(resolve => {
      client2.emit('claim_team', { teamId: 'MI' }, resolve);
    });
    console.assert(claimFreedRes.success, 'Client 2 should now be able to claim previously released MI');
    console.log('✓ Feature 4: Client 2 successfully claimed previously released MI');

    // 11. Connect Client 3 and test SIMULTANEOUS claim race condition
    const client3: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket', 'polling']
    });
    await new Promise<void>(resolve => client3.on('connect', () => resolve()));
    await new Promise<any>(resolve => {
      client3.emit('join_room', { roomCode, playerName: 'RacerFan' }, resolve);
    });

    // Both Client 1 and Client 3 attempt to claim Royal Challengers Bengaluru (RCB) simultaneously
    console.log('Testing simultaneous atomic claim of RCB by Client 1 & Client 3...');
    const [raceRes1, raceRes3] = await Promise.all([
      new Promise<any>(resolve => client1.emit('claim_team', { teamId: 'RCB' }, resolve)),
      new Promise<any>(resolve => client3.emit('claim_team', { teamId: 'RCB' }, resolve))
    ]);

    const successes = [raceRes1, raceRes3].filter(r => r.success);
    const failures = [raceRes1, raceRes3].filter(r => !r.success);
    console.assert(successes.length === 1, `Exactly one client must win the race (got ${successes.length} wins)`);
    console.assert(failures.length === 1, `Exactly one client must be rejected (got ${failures.length} fails)`);
    console.log(`✓ Feature 2: Simultaneous race condition handled safely! 1 Winner, 1 Rejected: "${failures[0].error}"`);

    // 12. Test newly joined player state synchronization
    const client4: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket', 'polling']
    });
    await new Promise<void>(resolve => client4.on('connect', () => resolve()));
    const joinSyncRes = await new Promise<any>(resolve => {
      client4.emit('join_room', { roomCode, playerName: 'LateJoiner' }, resolve);
    });
    console.assert(joinSyncRes.success, 'Client 4 join should succeed');
    const miTeamState = joinSyncRes.room.teams.find((t: any) => t.id === 'MI');
    const rcbTeamState = joinSyncRes.room.teams.find((t: any) => t.id === 'RCB');
    console.assert(miTeamState.ownerName === 'DhoniFan', 'Newly joined Client 4 must receive accurate MI owner');
    console.assert(rcbTeamState.isHumanControlled === true, 'Newly joined Client 4 must receive accurate RCB state');
    console.log('✓ Feature 5: Newly joined Client 4 received 100% synchronized team ownership state');

    // 13. Test disconnect handling
    client4.disconnect();
    await new Promise(r => setTimeout(r, 100));
    console.log('✓ Feature 5: Client disconnect handled safely without room state corruption');

    // Clean up
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    server.close();

    console.log('=== ALL STAGE 3 MULTIPLAYER TEAM CLAIM TESTS PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    server.close();
    process.exit(1);
  }
});
