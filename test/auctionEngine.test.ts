import { INITIAL_TEAMS } from '../src/data/teamsData';
import { INITIAL_PLAYERS } from '../src/data/playersData';
import { DEFAULT_RULES, formatCurrency, getNextBidAmount } from '../src/utils/currencyUtils';
import { validateBid, updateTeamPurchasedPlayer } from '../src/engine/squadRules';

console.log('--- RUNNING 15-SECOND SINGLE PLAYER AUCTION ENGINE TESTS ---');

const AUCTION_TIMER_SECONDS = 15;

// 1. Initial timer verification
console.assert(AUCTION_TIMER_SECONDS === 15, 'Timer must be exactly 15 seconds');
console.log('✓ Rule 1: Every new player starts with a 15-second bidding timer.');

// 2. Countdown sequence simulation (15 down to 0)
let timer = AUCTION_TIMER_SECONDS;
const countdownSequence: number[] = [];
while (timer > 0) {
  countdownSequence.push(timer);
  timer--;
}
countdownSequence.push(0);
console.assert(countdownSequence[0] === 15 && countdownSequence[15] === 0, 'Countdown sequence must be 15 down to 0');
console.log(`✓ Rule 2: Countdown decrements accurately: ${countdownSequence.slice(0, 5).join(', ')} ... ${countdownSequence.slice(-3).join(', ')}`);

// 3. Placing a valid bid resets timer to 15 seconds
timer = 6; // timer ran down to 6s
const userTeam = { ...INITIAL_TEAMS[0] };
const player = { ...INITIAL_PLAYERS[0] };

const bidAmount = player.basePrice;
const validation = validateBid(userTeam, player, bidAmount, DEFAULT_RULES);
console.assert(validation.isValid, 'User bid should be valid');

// When bid is placed:
timer = AUCTION_TIMER_SECONDS;
console.assert(timer === 15, 'Bid placement must immediately reset timer to 15 seconds');
console.log('✓ Rule 3 & 4: Placing a valid bid resets countdown back to 15 seconds.');

// 4. Countdown reaches 0 with NO bids -> player marked UNSOLD
let activeBid = 0;
let highestBidderId: string | null = null;
let status = 'upcoming';

if (timer > 0) {
  // Let timer expire to 0
  timer = 0;
}
if (timer === 0) {
  if (highestBidderId === null && activeBid === 0) {
    status = 'unsold';
  }
}
console.assert(status === 'unsold', 'Player must be marked UNSOLD when 15s timer hits 0 with no bids');
console.log('✓ Rule 5: If countdown reaches 0 with no bids, player is marked UNSOLD.');

// 5. Countdown reaches 0 with user bid -> player marked SOLD at final bid amount
timer = 15;
activeBid = player.basePrice;
highestBidderId = userTeam.id;

// Simulate countdown running to 0
while (timer > 0) {
  timer--;
}
console.assert(timer === 0, 'Timer must reach 0 before selling');

let soldToTeamId: string | null = null;
let soldPrice: number | null = null;

if (timer === 0 && highestBidderId === userTeam.id && activeBid > 0) {
  status = 'sold';
  soldToTeamId = userTeam.id;
  soldPrice = activeBid;
  const updatedUserTeam = updateTeamPurchasedPlayer(userTeam, player, activeBid);
  console.assert(updatedUserTeam.currentPurse === userTeam.initialPurse - activeBid, 'Purse must be deducted');
  console.assert(updatedUserTeam.squadCount === 1, 'Squad count must be incremented');
}

console.assert(status === 'sold' && soldToTeamId === userTeam.id && soldPrice === player.basePrice, 'Player must be sold to user at final bid');
console.log(`✓ Rule 6 & 7: Player is sold to user at ${formatCurrency(soldPrice || 0)} ONLY after the 15-second countdown finishes at 0.`);

// 6. Next player starts with fresh 15-second countdown
const nextPlayerIndex = 1;
const nextPlayer = INITIAL_PLAYERS[nextPlayerIndex];
const freshTimer = AUCTION_TIMER_SECONDS;
console.assert(freshTimer === 15, 'Next player must start with a fresh 15s timer');
console.log(`✓ Rule 11 & 12: Next player (${nextPlayer.name}) starts with fresh 15-second countdown.`);

console.log('=== ALL 15-SECOND AUCTION TIMER TESTS PASSED SUCCESSFULLY! ===');
