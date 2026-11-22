import React, { useState } from 'react';
import { Trophy, Download, Plane, ArrowLeft, ChevronDown, Sparkles, BarChart3 } from 'lucide-react';
import type { MultiplayerRoomState } from '../../types';
import { formatCurrency } from '../../utils/currencyUtils';
import { getPlayerFallbackSilhouette, getTeamFallbackLogo } from '../../utils/imageUtils';
import { TeamAnalysisDashboard } from '../analysis/TeamAnalysisDashboard';
import { TournamentComparisonView } from '../analysis/TournamentComparisonView';

interface MultiplayerResultsScreenProps {
  room: MultiplayerRoomState;
  currentUserId: string;
  onLeaveRoom: () => void;
}

export const MultiplayerResultsScreen: React.FC<MultiplayerResultsScreenProps> = ({
  room,
  currentUserId,
  onLeaveRoom
}) => {
  const me = room.players.find(p => p.id === currentUserId);
  const myTeamId = me?.teamId;
  const [activeTab, setActiveTab] = useState<'aiAnalysis' | 'comparison' | 'teams' | 'topBuys' | 'unsold'>('aiAnalysis');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(myTeamId || null);
  const [inspectedTeamId, setInspectedTeamId] = useState<string>(myTeamId || room.teams[0]?.id || 'MI');

  const soldPlayers = room.playerPool.filter(p => p.status === 'sold');
  const unsoldPlayers = room.playerPool.filter(p => p.status === 'unsold');
  const sortedBuys = [...soldPlayers].sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
  const highestPricedPlayer = sortedBuys[0] || null;

  const totalSpending = room.teams.reduce((acc, t) => acc + (t.initialPurse - t.currentPurse), 0);
  const totalBought = room.teams.reduce((acc, t) => acc + t.squadCount, 0);
  const teamMap = new Map(room.teams.map(t => [t.id, t]));

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'Player ID',
      'Player Name',
      'Category',
      'Role',
      'Nationality',
      'Overseas',
      'Base Price (INR)',
      'Auction Status',
      'Sold Price (INR)',
      'Sold Price Formatted',
      'Sold To Team',
      'Team Full Name',
      'Manager Name'
    ];

    const rows = room.playerPool.map(p => {
      const team = p.soldTo ? teamMap.get(p.soldTo) : null;
      return [
        `"${p.id}"`,
        `"${p.name}"`,
        `"${p.category}"`,
        `"${p.role}"`,
        `"${p.nationality}"`,
        p.isOverseas ? 'Yes' : 'No',
        p.basePrice,
        p.status,
        p.soldPrice || '',
        p.soldPrice ? `"${formatCurrency(p.soldPrice)}"` : '""',
        `"${p.soldTo || ''}"`,
        `"${team?.name || ''}"`,
        `"${team?.ownerName || 'None'}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `IPL_2027_Multiplayer_Auction_Report_${room.roomCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-2">
            Multiplayer Room {room.roomCode} • Official Results
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-100">
            MULTIPLAYER AUCTION <span className="text-gold-gradient">STANDINGS</span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Synchronized tournament summary across all connected human managers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Room</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Total Money Spent
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {formatCurrency(totalSpending)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            By {room.players.length} Human Managers
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Players Sold / Unsold
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {totalBought} Sold <span className="text-xs text-slate-500 font-sans font-normal">({unsoldPlayers.length} Unsold)</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {room.playerPool.length} Total Lots
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md sm:col-span-2">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Highest Signings of Room
          </div>
          {highestPricedPlayer ? (
            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="text-lg font-black text-slate-100">
                  {highestPricedPlayer.name}
                </div>
                <div className="text-xs text-slate-400">
                  Bought by <strong>{teamMap.get(highestPricedPlayer.soldTo || '')?.name}</strong> ({teamMap.get(highestPricedPlayer.soldTo || '')?.ownerName})
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">
                {formatCurrency(highestPricedPlayer.soldPrice || 0)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic mt-1">
              No sales completed in this session.
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('aiAnalysis')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${activeTab === 'aiAnalysis'
              ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-950" />
          <span>AI Team Evaluation</span>
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${activeTab === 'comparison'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-slate-950" />
          <span>Power Rankings & Comparison</span>
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'teams'
              ? 'bg-slate-200 text-slate-950 font-black shadow-md'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
        >
          All 10 Franchises ({room.teams.length})
        </button>

        <button
          onClick={() => setActiveTab('topBuys')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'topBuys'
              ? 'bg-slate-200 text-slate-950 font-black shadow-md'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
        >
          Top Buys ({sortedBuys.length})
        </button>

        <button
          onClick={() => setActiveTab('unsold')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'unsold'
              ? 'bg-slate-200 text-slate-950 font-black shadow-md'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
        >
          Unsold Lots ({unsoldPlayers.length})
        </button>
      </div>

      {/* Tab 1: AI Team Analysis Dashboard */}
      {activeTab === 'aiAnalysis' && (
        <TeamAnalysisDashboard
          teams={room.teams}
          initialTeamId={inspectedTeamId}
        />
      )}

      {/* Tab 2: Tournament Comparison & Rankings */}
      {activeTab === 'comparison' && (
        <TournamentComparisonView
          teams={room.teams}
          onSelectTeamToInspect={(teamId) => {
            setInspectedTeamId(teamId);
            setActiveTab('aiAnalysis');
          }}
        />
      )}

      {/* Tab 1: Teams Accordion */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          {room.teams.map(team => {
            const isExpanded = expandedTeamId === team.id;
            const isMyTeam = team.id === myTeamId;
            const spent = team.initialPurse - team.currentPurse;

            return (
              <div
                key={team.id}
                className={`rounded-2xl border transition-all overflow-hidden bg-slate-900/90 ${isMyTeam ? 'border-cyan-400/80 shadow-xl' : 'border-slate-800'
                  }`}
              >
                <div
                  onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                  className="p-4 md:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-850 transition"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl p-1.5 flex items-center justify-center bg-slate-950 border border-slate-700 shadow-md"
                      style={{ backgroundColor: team.primaryColor }}
                    >
                      <img
                        src={team.logo}
                        alt={team.shortName}
                        onError={(e) => {
                          e.currentTarget.src = getTeamFallbackLogo(team.shortName, team.primaryColor, team.secondaryColor);
                        }}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base md:text-lg font-black text-slate-100">
                          {team.name} ({team.shortName})
                        </h3>
                        {team.isHumanControlled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Manager: {team.ownerName} {isMyTeam && '(YOU)'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider bg-slate-800 text-slate-500">
                            INACTIVE (NO MANAGER)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                        <span>Squad: <strong>{team.squadCount}/25</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-sky-400">
                          <Plane className="w-3 h-3" /> Overseas: <strong>{team.overseasCount}/8</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Remaining Purse</div>
                      <div className="text-lg font-black font-mono text-amber-400">
                        {formatCurrency(team.currentPurse)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Spent: {formatCurrency(spent)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedTeamId(team.id);
                        setActiveTab('aiAnalysis');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-400/20 hover:bg-cyan-400 text-cyan-300 hover:text-slate-950 border border-cyan-400/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Run AI Squad Analysis"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">AI Analysis</span>
                    </button>

                    <div className={`p-1.5 rounded-lg bg-slate-800 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-slate-800/80 bg-slate-950/60">
                    <div className="py-3 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                        Batters: {team.roleCounts.batter}
                      </span>
                      <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300">
                        Bowlers: {team.roleCounts.bowler}
                      </span>
                      <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
                        All-Rounders: {team.roleCounts.allRounder}
                      </span>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                        Wicketkeepers: {team.roleCounts.wicketkeeper}
                      </span>
                    </div>

                    {team.purchasedPlayers.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs italic">
                        No players acquired by this franchise.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
                        {team.purchasedPlayers.map((player, idx) => (
                          <div
                            key={player.id}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                              <div className="w-8 h-9 rounded bg-slate-950 border border-slate-800 p-0.5 flex-shrink-0 flex items-center justify-center">
                                <img
                                  src={player.photoUrl}
                                  alt={player.name}
                                  onError={(e) => {
                                    e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role, player.nationality);
                                  }}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                                  <span>{player.name}</span>
                                  {player.isOverseas && <Plane className="w-3 h-3 text-sky-400" />}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {player.role} • {player.category}
                                </div>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <div className="text-xs font-black font-mono text-amber-400">
                                {formatCurrency(player.soldPrice || player.basePrice)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Top Buys */}
      {activeTab === 'topBuys' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-black uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Top Most Expensive Signings of Room {room.roomCode}
          </h3>

          {sortedBuys.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs italic">
              No sales recorded in this room.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {sortedBuys.map((player, idx) => {
                const team = teamMap.get(player.soldTo || '');
                return (
                  <div key={player.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black font-mono ${idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                        }`}>
                        #{idx + 1}
                      </span>

                      <div className="w-10 h-12 rounded bg-slate-950 border border-slate-800 p-0.5 flex items-center justify-center">
                        <img
                          src={player.photoUrl}
                          alt={player.name}
                          onError={(e) => {
                            e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role, player.nationality);
                          }}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      <div>
                        <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <span>{player.name}</span>
                          {player.isOverseas && <Plane className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                        <div className="text-xs text-slate-400">
                          {player.role} • {player.category} • Base: {formatCurrency(player.basePrice)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Franchise (Manager)</div>
                        <div className="text-xs font-bold text-slate-200">
                          {team?.shortName} ({team?.ownerName || 'None'})
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Hammer Price</div>
                        <div className="text-lg font-black font-mono text-amber-400">
                          {formatCurrency(player.soldPrice || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Unsold Lots */}
      {activeTab === 'unsold' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-black uppercase tracking-wider text-rose-400 mb-4">
            Unsold Players ({unsoldPlayers.length})
          </h3>

          {unsoldPlayers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs italic">
              No unsold players in this session.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {unsoldPlayers.map(player => (
                <div
                  key={player.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3"
                >
                  <div className="w-10 h-12 rounded bg-slate-900 border border-slate-800 p-0.5 flex-shrink-0 flex items-center justify-center grayscale opacity-80">
                    <img
                      src={player.photoUrl}
                      alt={player.name}
                      onError={(e) => {
                        e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role, player.nationality);
                      }}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {player.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {player.role} • {player.category}
                    </div>
                    <div className="text-xs font-mono font-bold text-rose-400 mt-0.5">
                      Base: {formatCurrency(player.basePrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
