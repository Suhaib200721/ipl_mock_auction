import React from 'react';
import type { Player, PlayerCategory } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getPlayerFallbackSilhouette } from '../utils/imageUtils';
import { Plane, Filter } from 'lucide-react';

interface QueueBottomPanelProps {
  upcomingPlayers: Player[];
  selectedCategory: PlayerCategory | 'All';
  onSelectCategory: (category: PlayerCategory | 'All') => void;
  onJumpToPlayer: (player: Player) => void;
  currentIndex: number;
  totalPlayers: number;
}

export const QueueBottomPanel: React.FC<QueueBottomPanelProps> = ({
  upcomingPlayers,
  selectedCategory,
  onSelectCategory,
  onJumpToPlayer,
  currentIndex,
  totalPlayers
}) => {
  const categories: (PlayerCategory | 'All')[] = [
    'All',
    'Marquee',
    'Batter',
    'All-Rounder',
    'Bowler',
    'Wicketkeeper'
  ];

  const filteredUpcoming = selectedCategory === 'All'
    ? upcomingPlayers
    : upcomingPlayers.filter(p => p.category === selectedCategory);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-slate-300">
            AUCTION QUEUE • {selectedCategory === 'All' ? 'ALL SETS' : `SET: ${selectedCategory.toUpperCase()}`}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold">
            Player {currentIndex + 1} of {totalPlayers}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-bold hidden sm:inline">
            {filteredUpcoming.length} in this queue
          </span>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3 h-3 text-slate-500 mr-1 flex-shrink-0" />
          {categories.map(cat => {
            const count = cat === 'All'
              ? upcomingPlayers.length
              : upcomingPlayers.filter(p => p.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedCategory === cat
                    ? 'bg-slate-950/20 text-slate-950 font-black'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue Carousel - Shows ALL upcoming players in set/category without truncation */}
      <div className="flex items-center gap-2.5 overflow-x-auto py-1">
        {filteredUpcoming.length === 0 ? (
          <div className="py-4 text-xs text-slate-500 italic">
            No remaining upcoming players in this set.
          </div>
        ) : (
          filteredUpcoming.map((player, idx) => (
            <div
              key={player.id}
              onClick={() => onJumpToPlayer(player)}
              className="flex-shrink-0 w-44 p-2 rounded-lg bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-amber-400/50 cursor-pointer transition-all group flex items-center gap-2.5"
            >
              <div className="w-10 h-12 rounded bg-slate-900 border border-slate-800 p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  key={`${player.id}-${player.photoUrl}`}
                  src={player.photoUrl || getPlayerFallbackSilhouette(player.name, player.role, player.nationality)}
                  alt={player.name}
                  onError={(e) => {
                    e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role, player.nationality);
                  }}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>#{idx + 1}</span>
                  {player.isOverseas && <Plane className="w-2.5 h-2.5 text-sky-400" />}
                </div>
                <div className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-300">
                  {player.name}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>{player.role}</span>
                  <span className="font-mono text-slate-300 font-semibold">
                    {formatCurrency(player.basePrice)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
