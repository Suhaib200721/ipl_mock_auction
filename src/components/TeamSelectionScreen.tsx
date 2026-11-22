import React, { useState } from 'react';
import type { Team } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getTeamFallbackLogo } from '../utils/imageUtils';
import { Trophy, User, CheckCircle2, ArrowRight, ShieldCheck, PauseCircle } from 'lucide-react';

interface TeamSelectionScreenProps {
  teams: Team[];
  onConfirmTeam: (teamId: string) => void;
}

export const TeamSelectionScreen: React.FC<TeamSelectionScreenProps> = ({
  teams,
  onConfirmTeam
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const otherTeams = teams.filter(t => t.id !== selectedTeamId);

  const handleSelect = (teamId: string) => {
    setSelectedTeamId(teamId);
  };

  const handleProceedToConfirmation = () => {
    if (selectedTeamId) {
      setShowConfirmation(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {!showConfirmation ? (
        <div>
          {/* Hero Banner */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-widest uppercase mb-3">
              Single Player Auction Simulator
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight mb-2">
              SELECT YOUR <span className="text-gold-gradient">FRANCHISE</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
              Choose the IPL franchise you want to build. In this solo auction mode, you are the exclusive bidder with complete control over which players to purchase or pass.
            </p>
          </div>

          {/* 10 Team Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {teams.map(team => {
              const isSelected = selectedTeamId === team.id;
              return (
                <div
                  key={team.id}
                  onClick={() => handleSelect(team.id)}
                  style={{
                    borderColor: isSelected ? team.primaryColor : 'rgba(51, 65, 85, 0.4)',
                    boxShadow: isSelected ? `0 0 25px ${team.primaryColor}55` : 'none'
                  }}
                  className={`relative group rounded-xl p-5 border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden bg-slate-900/80 hover:bg-slate-900 hover:border-slate-700 ${isSelected ? 'scale-[1.02] bg-slate-900' : ''
                    }`}
                >
                  {/* Top color indicator bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-2 transition-all"
                    style={{ backgroundColor: team.primaryColor }}
                  />

                  {/* Selected check badge */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
                    </div>
                  )}

                  {/* Team Logo & Abbreviation */}
                  <div className="pt-2 flex flex-col items-center text-center">
                    <div className="w-20 h-20 mb-3 relative flex items-center justify-center p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <img
                        src={team.logo}
                        alt={`${team.name} Logo`}
                        onError={(e) => {
                          e.currentTarget.src = getTeamFallbackLogo(team.shortName, team.primaryColor, team.secondaryColor);
                        }}
                        className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="text-xs font-black tracking-widest uppercase text-slate-400">
                      {team.shortName}
                    </div>
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                      {team.name}
                    </h3>
                  </div>

                  {/* Team Bio & Purse Info */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
                    <div className="text-[11px] text-slate-400 line-clamp-2 italic mb-3">
                      "{team.strategyBio}"
                    </div>

                    <div className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400">Auction Purse</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatCurrency(team.initialPurse)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(team.id);
                      }}
                      className={`w-full mt-3 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md ${isSelected
                          ? 'bg-amber-400 text-slate-950 font-black shadow-amber-400/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                    >
                      {isSelected ? '✓ Selected' : 'Choose Team'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="sticky bottom-6 flex justify-center z-20">
            <button
              disabled={!selectedTeamId}
              onClick={handleProceedToConfirmation}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl text-base font-black uppercase tracking-wider transition-all duration-300 shadow-2xl ${selectedTeamId
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/30 scale-100 hover:scale-105 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                }`}
            >
              <span>Confirm Selection & Review Setup</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* Confirmation Screen */
        <div className="max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl animate-bid-pop">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-100">
              AUCTION ROOM CONFIRMATION
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Verify your selected team and solo auction parameters before commencing live bidding.
            </p>
          </div>

          {/* User's Team Spotlight */}
          {selectedTeam && (
            <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-slate-950 to-slate-900 border-2 border-amber-400/60 shadow-xl relative overflow-hidden">
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: selectedTeam.primaryColor }}
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-xl bg-slate-950 p-2 border border-slate-800 flex items-center justify-center">
                    <img
                      src={selectedTeam.logo}
                      alt={selectedTeam.name}
                      onError={(e) => {
                        e.currentTarget.src = getTeamFallbackLogo(selectedTeam.shortName, selectedTeam.primaryColor, selectedTeam.secondaryColor);
                      }}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <User className="w-3 h-3" /> USER CONTROLLED
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> EXCLUSIVE BIDDER
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-100">
                      {selectedTeam.name} ({selectedTeam.shortName})
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mt-1">
                      {selectedTeam.strategyBio}
                    </p>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-800 sm:pl-6">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Starting Purse</div>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {formatCurrency(selectedTeam.initialPurse)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Squad Limit: 25 Players • Max 8 Overseas
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 9 Inactive Franchises List */}
          <div className="mb-8">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <PauseCircle className="w-4 h-4 text-slate-500" />
              9 Other Franchises (Spectating / Inactive in Single Player Mode)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {otherTeams.map(team => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs opacity-75"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center font-black text-[10px] text-white"
                      style={{ backgroundColor: team.primaryColor }}
                    >
                      {team.shortName}
                    </div>
                    <div>
                      <div className="font-bold text-slate-300">{team.name}</div>
                      <div className="text-[10px] text-slate-500">
                        Inactive in Solo Mode
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-slate-500 font-bold">
                    {formatCurrency(team.initialPurse)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons: Back or Start Auction */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              onClick={() => setShowConfirmation(false)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              ← Choose A Different Team
            </button>

            <button
              onClick={() => selectedTeamId && onConfirmTeam(selectedTeamId)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/20 transition-all scale-100 hover:scale-105"
            >
              Enter Live Auction Stage ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
