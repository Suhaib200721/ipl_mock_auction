import React from 'react';
import type { Player } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getPlayerFallbackSilhouette } from '../utils/imageUtils';
import { XCircle, ArrowRight } from 'lucide-react';

interface UnsoldOverlayProps {
  player: Player;
  onNext: () => void;
}

export const UnsoldOverlay: React.FC<UnsoldOverlayProps> = ({
  player,
  onNext
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-bid-pop">
      <div className="relative max-w-md w-full rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-4 border-rose-600/80 shadow-2xl p-6 md:p-8 text-center overflow-hidden">
        {/* Animated UNSOLD Dark Red Stamp */}
        <div className="inline-block transform -rotate-12 px-8 py-2 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-red-800 text-white font-black text-3xl md:text-5xl uppercase tracking-widest shadow-2xl border-4 border-rose-400 mb-6 animate-stamp-sold">
          UNSOLD
        </div>

        {/* Player Spotlight Card */}
        <div className="flex items-center justify-center gap-5 my-4">
          <div className="w-24 h-28 rounded-xl bg-slate-950 border-2 border-slate-700 p-1 flex items-center justify-center overflow-hidden opacity-75 grayscale contrast-125">
            <img
              src={player.photoUrl}
              alt={player.name}
              onError={(e) => {
                e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role, player.nationality);
              }}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="text-left">
            <div className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> No Bids Received
            </div>
            <h3 className="text-xl font-black text-slate-200">
              {player.name}
            </h3>
            <div className="text-xs text-slate-400 mt-1">
              Base Price: {formatCurrency(player.basePrice)}
            </div>
            <div className="text-[11px] text-slate-500">
              Eligible for accelerated round later.
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={onNext}
          className="w-full mt-6 py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold uppercase tracking-wider text-sm border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Next Lot</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
