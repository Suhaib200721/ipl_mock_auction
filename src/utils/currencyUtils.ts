import type { SquadRules } from '../types';

export const DEFAULT_RULES: SquadRules = {
  minSquadSize: 18,
  maxSquadSize: 25,
  maxOverseas: 8,
  initialPurse: 1200000000, // ₹120 Crore
  minBidIncrementBelow1Cr: 1000000, // ₹10 Lakhs (or ₹5L if below 50L)
  minBidIncrement1To2Cr: 2000000,   // ₹20 Lakhs
  minBidIncrement2To5Cr: 2500000,   // ₹25 Lakhs
  minBidIncrementAbove5Cr: 5000000, // ₹50 Lakhs
};

/**
 * Formats a number in Rupees into Indian IPL format (Crores and Lakhs).
 * Example: 125000000 -> ₹12.50 Cr, 7500000 -> ₹75 L, 3000000 -> ₹30 L
 */
export function formatCurrency(amount: number): string {
  if (amount == null || isNaN(amount)) return '₹0';
  
  if (amount >= 10000000) { // >= 1 Crore (100 Lakhs)
    const cr = amount / 10000000;
    // Show 2 decimal places if fractional, else 1 or clean
    const formatted = cr % 1 === 0 ? cr.toFixed(2) : cr.toFixed(2);
    return `₹${formatted} Cr`;
  }
  
  if (amount >= 100000) { // >= 1 Lakh
    const lk = amount / 100000;
    const formatted = lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(1);
    return `₹${formatted} L`;
  }
  
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculates the next bid amount based on the current bid and IPL tier rules.
 */
export function getNextBidAmount(currentBid: number, basePrice: number, rules: SquadRules = DEFAULT_RULES): number {
  if (currentBid <= 0) {
    return basePrice;
  }
  
  let increment = rules.minBidIncrementBelow1Cr;
  if (currentBid < 5000000) {
    increment = 500000; // ₹5 Lakhs for low tiers
  } else if (currentBid < 10000000) {
    increment = rules.minBidIncrementBelow1Cr; // ₹10 Lakhs
  } else if (currentBid < 20000000) {
    increment = rules.minBidIncrement1To2Cr; // ₹20 Lakhs
  } else if (currentBid < 50000000) {
    increment = rules.minBidIncrement2To5Cr; // ₹25 Lakhs
  } else {
    increment = rules.minBidIncrementAbove5Cr; // ₹50 Lakhs
  }
  
  return currentBid + increment;
}

/**
 * Parses user input / shorthand into Rupees
 */
export function parsePriceToRupees(str: string): number {
  const cleaned = str.replace(/[₹,\s]/g, '').toUpperCase();
  if (cleaned.endsWith('CR')) {
    return parseFloat(cleaned.replace('CR', '')) * 10000000;
  }
  if (cleaned.endsWith('L') || cleaned.endsWith('LAKH') || cleaned.endsWith('LAKHS')) {
    return parseFloat(cleaned.replace(/LAKHS?|L/, '')) * 100000;
  }
  return parseFloat(cleaned) || 0;
}
