import React from 'react';
import { Volume2, VolumeX, Shield, Users, RotateCcw, Trophy, LayoutGrid } from 'lucide-react';
import type { Team, AppMode } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface NavbarProps {
  appMode: AppMode;
  selectedTeam: Team | null;
  roomCode?: string;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenRules: () => void;
  onOpenSquads: () => void;
  onOpenResults: () => void;
  onResetAuction: () => void;
  onSwitchMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  appMode,
  selectedTeam,
  roomCode,
  isMuted,
  onToggleSound,
  onOpenRules,
  onOpenSquads,
  onOpenResults,
  onResetAuction,
  onSwitchMode
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-4 py-2.5 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Mode Badges */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-200 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300">
            <Trophy className="w-6 h-6 text-slate-950 font-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-wider text-base md:text-lg bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
                IPL 2027 MOCK AUCTION
              </span>
              {appMode === 'singleplayer' && (
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Single Player Mode
                </span>
              )}
              {appMode === 'multiplayer' && (
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  Multiplayer {roomCode ? `(${roomCode})` : 'Mode'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide hidden md:block">
              Build Your Dream IPL Squad • Unofficial Broadcast Simulator
            </p>
          </div>
        </div>

        {/* Selected User Team Status Bar */}
        {selectedTeam && (
          <div className="hidden sm:flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 shadow-inner">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-md border border-white/20"
              style={{ backgroundColor: selectedTeam.primaryColor }}
            >
              {selectedTeam.shortName}
            </div>
            <div className="text-left text-xs leading-tight">
              <div className="text-slate-400 font-medium text-[11px]">Your Franchise</div>
              <div className="font-bold text-slate-100 flex items-center gap-2">
                <span>{selectedTeam.shortName}</span>
                <span className="text-amber-400 font-mono">
                  {formatCurrency(selectedTeam.currentPurse)}
                </span>
                <span className="text-[11px] text-slate-400">
                  ({selectedTeam.squadCount}/25 squad • {selectedTeam.overseasCount}/8 overseas)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* Switch Mode Button */}
          <button
            onClick={onSwitchMode}
            title="Switch Game Mode (Solo vs Multiplayer)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition"
          >
            <LayoutGrid className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Modes</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={onToggleSound}
            title={isMuted ? 'Unmute Auction Sounds' : 'Mute Auction Sounds'}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Rules modal button */}
          <button
            onClick={onOpenRules}
            title="Auction Rules & Purse Tiers"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Rules</span>
          </button>

          {/* Squads modal button */}
          <button
            onClick={onOpenSquads}
            title="View All 10 Team Squads"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition"
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">Squads</span>
          </button>

          {/* Results button */}
          {selectedTeam && (
            <button
              onClick={onOpenResults}
              title="View Auction Standings & Export"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-xs font-bold text-white shadow-md shadow-amber-900/30 transition"
            >
              <Trophy className="w-4 h-4 text-amber-200" />
              <span className="hidden sm:inline">Results</span>
            </button>
          )}

          {/* Reset button for single player */}
          {appMode === 'singleplayer' && (
            <button
              onClick={onResetAuction}
              title="Restart Auction / Change Team"
              className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
