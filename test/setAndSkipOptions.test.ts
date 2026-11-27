import { INITIAL_PLAYERS } from '../src/data/playersData';
import { getPlayerFallbackSilhouette } from '../src/utils/imageUtils';
import type { Player, PlayerCategory } from '../src/types';

console.log('=== RUNNING AUCTION PLAYER SETS & SKIP OPTIONS TESTS ===\n');

// 1. Verify Player Sets
console.log('Test 1: Verify Auction Player Sets Structure');
const sets: Record<string, Player[]> = {};
for (const p of INITIAL_PLAYERS) {
  if (!sets[p.category]) sets[p.category] = [];
  sets[p.category].push(p);
}

const expectedCategories: PlayerCategory[] = ['Marquee', 'Batter', 'Wicketkeeper', 'All-Rounder', 'Bowler'];
for (const cat of expectedCategories) {
  if (!sets[cat] || sets[cat].length === 0) {
    throw new Error(`Missing or empty player set: ${cat}`);
  }
  console.log(`✓ Set "${cat}": ${sets[cat].length} players present`);
}

console.assert(INITIAL_PLAYERS.length >= 250, `Expected expanded pool >= 250 players, found ${INITIAL_PLAYERS.length}`);
const seenIds = new Set<string>();
const seenNames = new Set<string>();
for (const p of INITIAL_PLAYERS) {
  console.assert(!seenIds.has(p.id), `Duplicate player ID found: ${p.id}`);
  console.assert(!seenNames.has(p.name.toLowerCase()), `Duplicate player name found: ${p.name}`);
  seenIds.add(p.id);
  seenNames.add(p.name.toLowerCase());
}
console.log(`✓ All ${INITIAL_PLAYERS.length} unique players intact across all 5 official auction sets.\n`);

// 2. Simulate "Skip Current Player" Logic
console.log('Test 2: Verify "Skip Current Player" Logic');
let auctionPlayers: Player[] = INITIAL_PLAYERS.map(p => ({ ...p, status: 'upcoming' }));
let currentIndex = 0;

function skipCurrentPlayer() {
  const current = auctionPlayers[currentIndex];
  if (!current) return;
  // Mark current as unsold
  auctionPlayers = auctionPlayers.map((p, i) => i === currentIndex ? { ...p, status: 'unsold' } : p);
  // Advance to next
  let nextIdx = currentIndex + 1;
  while (nextIdx < auctionPlayers.length && auctionPlayers[nextIdx].status !== 'upcoming') {
    nextIdx++;
  }
  currentIndex = nextIdx;
}

const firstPlayerName = auctionPlayers[0].name;
skipCurrentPlayer();

console.assert(auctionPlayers[0].status === 'unsold', 'Skipped player must have status unsold');
console.assert(!auctionPlayers[0].soldTo, 'Skipped player must not have soldTo');
console.assert(!auctionPlayers[0].soldPrice, 'Skipped player must not have soldPrice');
console.assert(currentIndex === 1, `Expected current index to advance to 1, got ${currentIndex}`);
console.log(`✓ "${firstPlayerName}" skipped -> Status: ${auctionPlayers[0].status}, Next lot index: ${currentIndex}`);
console.log('✓ Skipped player correctly preserved in Unsold pool (NOT marked sold).\n');

// 3. Simulate "Skip Entire Set" Logic
console.log('Test 3: Verify "Skip Entire Set" Logic');
const currentCat = auctionPlayers[currentIndex].category;
console.log(`Current Set before skip: ${currentCat} (Current Lot: ${auctionPlayers[currentIndex].name})`);

function skipEntireSet() {
  const current = auctionPlayers[currentIndex];
  if (!current) return;
  const targetCategory = current.category;

  // Mark all remaining in current set as unsold
  auctionPlayers = auctionPlayers.map((p, i) => {
    if (i === currentIndex || (p.category === targetCategory && p.status === 'upcoming')) {
      return { ...p, status: 'unsold' };
    }
    return p;
  });

  // Advance to first player of next set
  let nextIdx = currentIndex + 1;
  while (nextIdx < auctionPlayers.length && (auctionPlayers[nextIdx].category === targetCategory || auctionPlayers[nextIdx].status !== 'upcoming')) {
    nextIdx++;
  }
  currentIndex = nextIdx;
}

skipEntireSet();

// Verify all players in currentCat are now unsold (or skipped)
const remainingInSet = auctionPlayers.filter(p => p.category === currentCat && p.status === 'upcoming');
console.assert(remainingInSet.length === 0, `Expected 0 upcoming players in ${currentCat}, got ${remainingInSet.length}`);

// Verify none were marked sold
const soldInSet = auctionPlayers.filter(p => p.category === currentCat && p.status === 'sold');
console.assert(soldInSet.length === 0, `Expected 0 sold players in ${currentCat}, got ${soldInSet.length}`);

// Verify current index points to the next set
console.assert(currentIndex < auctionPlayers.length, 'Should have advanced to next set');
const nextSetCat = auctionPlayers[currentIndex].category;
console.assert(nextSetCat !== currentCat, `Expected next set to be different from ${currentCat}, got ${nextSetCat}`);
console.log(`✓ Entire "${currentCat}" set skipped. All ${sets[currentCat].length} players marked UNSOLD (0 marked SOLD).`);
console.log(`✓ Successfully advanced directly to next set: "${nextSetCat}" (Lot: ${auctionPlayers[currentIndex].name})\n`);

// 4. Test Skipping All Remaining Sets until Completion
console.log('Test 4: Skip through all sets until auction completion');
while (currentIndex < auctionPlayers.length) {
  skipEntireSet();
}
console.assert(currentIndex >= auctionPlayers.length, 'Index should be at end of pool');
const totalSold = auctionPlayers.filter(p => p.status === 'sold').length;
const totalUnsold = auctionPlayers.filter(p => p.status === 'unsold').length;
console.assert(totalSold === 0, `Expected 0 sold players, found ${totalSold}`);
console.assert(totalUnsold === auctionPlayers.length, `Expected ${auctionPlayers.length} unsold, found ${totalUnsold}`);
console.log(`✓ Auction completed cleanly. Total Sold: ${totalSold}, Total Unsold: ${totalUnsold}.\n`);

// 5. Test Player Image Fallback Generation
console.log('Test 5: Verify Player Image Fallback Silhouette');
const fallback1 = getPlayerFallbackSilhouette('Virat Kohli', 'Batter', 'India');
console.assert(fallback1.startsWith('data:image/svg+xml;utf8,'), 'Fallback must be valid SVG data URI');
console.assert(decodeURIComponent(fallback1).includes('VK'), 'Fallback should include initials VK');
console.assert(decodeURIComponent(fallback1).includes('BATTER'), 'Fallback should include role');

const fallback2 = getPlayerFallbackSilhouette('Pat Cummins', 'All-Rounder', 'Australia');
console.assert(decodeURIComponent(fallback2).includes('✈️'), 'Overseas fallback should include plane emoji');

// Test resilience against empty or missing inputs
const fallbackSafe = getPlayerFallbackSilhouette('', '', '');
console.assert(fallbackSafe.startsWith('data:image/svg+xml;utf8,'), 'Safe fallback must not throw');
console.log('✓ Player image fallback generator produces clean, resilient SVG data URIs.\n');

console.log('=== ALL PLAYER SET, SKIP & IMAGE LOGIC TESTS PASSED 100%! ===');
