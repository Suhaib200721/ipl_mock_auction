import React from 'react';
import type { BidRecord, Team } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getTeamFallbackLogo } from '../utils/imageUtils';
import { History, TrendingUp, AlertCircle, User } from 'lucide-react';

interface LiveBidRightPanelProps {
  bids: BidRecord[];
  teams: Team[];
  userTeamId: string;
  auctioneerCall: string;
}

export const LiveBidRightPanel: React.FC<LiveBidRightPanelProps> = ({
  bids,
  teams,
  userTeamId: _,
  auctioneerCall
}) => {
  const teamMap = new Map(teams.map(t => [t.id, t]));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-amber-400" />
          <span>BID TICKER</span>
        </h3>
        <span className="text-[10px] text-slate-400 font-medium">Solo Paddle</span>
      </div>

      {/* Auctioneer Live Status Call */}
      <div className="mb-3 p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/30 flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
        <div className="text-xs font-bold text-amber-300 leading-snug">
          {auctioneerCall || 'Auctioneer waiting for opening bid...'}
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="space-y-2 overflow-y-auto pr-1 flex-1 max-h-[580px]">
        {bids.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-600 opacity-60" />
            No bids placed yet for this lot.
            <div className="text-[11px] text-slate-600 mt-1">
              Click BID to place your opening bid or Pass to mark Unsold.
            </div>
          </div>
        ) : (
          bids.map((bid, index) => {
            const isLatest = index === 0;
            const team = teamMap.get(bid.teamId);

            return (
              <div
                key={bid.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  isLatest
                    ? 'bg-amber-500/10 border-amber-400/80 shadow-md animate-bid-pop'
                    : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center font-black text-[9px] text-white p-0.5"
                      style={{ backgroundColor: team?.primaryColor || '#334155' }}
                    >
                      {team ? (
                        <img
                          src={team.logo}
                          alt={team.shortName}
                          onError={(e) => {
                            e.currentTarget.src = getTeamFallbackLogo(team.shortName, team.primaryColor, team.secondaryColor);
                          }}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        bid.teamShortName
                      )}
                    </div>

                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 truncate">
                        <span>{bid.teamName}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-black flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" /> YOU
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-mono text-xs font-black text-amber-400 flex items-center justify-end gap-1">
                      {isLatest && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                      {formatCurrency(bid.amount)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
