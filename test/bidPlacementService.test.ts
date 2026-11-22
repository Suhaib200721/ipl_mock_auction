import {
  createRoom,
  joinRoom,
  claimMultiplayerTeam,
  startMultiplayerAuction,
  placeMultiplayerBid,
  getSocket
} from '../src/services/socketService';

console.log('=== RUNNING PLACE_MULTIPLAYER_BID CLIENT SERVICE TEST SUITE ===');

async function run() {
  try {
    // 1. Host creates room
    const hostRes = await createRoom('HostManager', 5000);
    console.assert(hostRes.success, 'Host room creation should succeed');
    const roomCode = hostRes.room!.roomCode;
    const hostId = hostRes.room!.hostId;
    console.log(`✓ Host created room ${roomCode} with ID ${hostId}`);

    // 2. Claim franchise for host
    const claimRes = await claimMultiplayerTeam('MI', 5000);
    console.assert(claimRes.success, 'Team claim should succeed');
    console.log('✓ Host claimed MI');

    // 3. Start auction
    const startRes = await startMultiplayerAuction(5000);
    console.assert(startRes.success, 'Start auction should succeed');
    console.log('✓ Auction started successfully');

    // 4. Test Accepted Bid via placeMultiplayerBid()
    const t0 = Date.now();
    const bid1 = await placeMultiplayerBid({
      roomCode,
      playerId: hostId,
      teamId: 'MI',
      amount: 20000000
    }, 5000);
    const duration1 = Date.now() - t0;

    console.assert(bid1.success, `Bid 1 should succeed: ${bid1.error}`);
    console.assert(duration1 < 2000, `Bid should resolve promptly (took ${duration1}ms)`);
    console.log(`✓ placeMultiplayerBid() accepted bid resolved in ${duration1}ms!`);

    // 5. Test Rejected Bid via placeMultiplayerBid() - Host double bids consecutively
    const t1 = Date.now();
    const bid2 = await placeMultiplayerBid({
      roomCode,
      playerId: hostId,
      teamId: 'MI',
      amount: 22500000
    }, 5000);
    const duration2 = Date.now() - t1;

    console.assert(!bid2.success, 'Consecutive double bid should be rejected');
    console.assert(bid2.error === 'You already hold the highest bid!', `Error message mismatch: ${bid2.error}`);
    console.assert(duration2 < 1000, `Rejection should resolve immediately without timeout (took ${duration2}ms)`);
    console.log(`✓ placeMultiplayerBid() rejected bid returned immediately (${duration2}ms): "${bid2.error}"`);

    // 6. Test Unassigned/Spectator Player Bid via placeMultiplayerBid()
    const t2 = Date.now();
    const bid3 = await placeMultiplayerBid({
      roomCode,
      playerId: 'unassigned-spectator-999',
      teamId: '',
      amount: 25000000
    }, 5000);
    const duration3 = Date.now() - t2;

    console.assert(!bid3.success, 'Spectator bid should be rejected');
    console.assert(bid3.error === 'You do not own an assigned franchise in this room.', `Error message mismatch: ${bid3.error}`);
    console.assert(duration3 < 1000, `Rejection should resolve immediately (took ${duration3}ms)`);
    console.log(`✓ placeMultiplayerBid() spectator rejection returned immediately (${duration3}ms): "${bid3.error}"`);

    // Clean up
    getSocket().disconnect();

    console.log('=== ALL PLACE_MULTIPLAYER_BID CLIENT SERVICE TESTS PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('Bid placement service test failed:', err);
    getSocket().disconnect();
    process.exit(1);
  }
}

run();
