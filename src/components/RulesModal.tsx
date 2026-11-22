import React from 'react';
import type { SquadRules } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { X, ShieldAlert, Info } from 'lucide-react';

interface RulesModalProps {
  rules: SquadRules;
  onUpdateRules: (newRules: SquadRules) => void;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  rules,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-bid-pop">
      <div className="relative max-w-2xl w-full rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-100">
                AUCTION & SQUAD SIMULATION RULES
              </h2>
              <p className="text-xs text-slate-400">
                Official guidelines & constraints governing the IPL 2027 Mock Auction engine.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 py-4 overflow-y-auto pr-1 text-xs">
          {/* Disclaimer Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Unofficial Simulation Notice:</strong>
              This application is an unofficial 2027 mock simulation. Player valuations, categories, and auction dynamics are modeled from verifiable historical IPL auction data.
            </div>
          </div>

          {/* Squad Constraints */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-200 text-sm uppercase tracking-wider text-amber-400">
              Squad Quotas & Composition
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Maximum Squad Size</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">{rules.maxSquadSize} Players</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Minimum Squad Size</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">{rules.minSquadSize} Players</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Max Overseas Quota</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">{rules.maxOverseas} Players</div>
              </div>
            </div>

            <div className="text-slate-400 text-[11px] leading-relaxed">
              • A team cannot bid on an overseas player if they have already reached the 8 overseas player limit.
              <br />
              • Each franchise starts with a purse of <strong>{formatCurrency(rules.initialPurse)}</strong>.
              <br />
              • Budget reserve rule: Franchises must always retain enough purse to reach the minimum squad requirement (18 players) at the ₹30L minimum base rate.
            </div>
          </div>

          {/* Bid Increment Tiers */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <h4 className="font-bold text-slate-200 text-sm uppercase tracking-wider text-amber-400">
              Standard Bid Increment Tiers
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Below ₹50 Lakhs</div>
                <div className="font-bold text-slate-100 mt-0.5">+ ₹5 Lakhs</div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">₹50L to ₹1 Crore</div>
                <div className="font-bold text-slate-100 mt-0.5">+ ₹10 Lakhs</div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">₹1 Cr to ₹2 Crore</div>
                <div className="font-bold text-slate-100 mt-0.5">+ ₹20 Lakhs</div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Above ₹5 Crore</div>
                <div className="font-bold text-slate-100 mt-0.5">+ ₹50 Lakhs</div>
              </div>
            </div>
          </div>

          {/* Base Price Tiers */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-200 text-sm uppercase tracking-wider text-amber-400">
              Configurable Player Base Price Tiers
            </h4>
            <div className="flex flex-wrap gap-2">
              {['₹30 Lakhs', '₹50 Lakhs', '₹75 Lakhs', '₹1 Crore', '₹1.5 Crore', '₹2 Crore'].map(tier => (
                <span key={tier} className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono font-bold">
                  {tier}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition"
          >
            Close & Return
          </button>
        </div>
      </div>
    </div>
  );
};
