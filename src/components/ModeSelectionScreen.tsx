import React from 'react';
import { User, Users, Sparkles, ArrowRight } from 'lucide-react';

interface ModeSelectionScreenProps {
  onSelectMode: (mode: 'singleplayer' | 'multiplayer') => void;
}

export const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({
  onSelectMode
}) => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[80vh]">
      {/* Brand Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-widest uppercase mb-4 shadow-inner">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Official IPL 2027 Simulator</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-slate-100 tracking-tight">
          IPL 2027 <span className="text-gold-gradient">MOCK AUCTION</span>
        </h1>
        <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto mt-3 font-medium">
          BUILD YOUR DREAM IPL SQUAD.
        </p>
        <p className="text-slate-500 text-xs md:text-sm mt-1">
          Select your desired game mode to enter the auction room.
        </p>
      </div>

      {/* Two Game Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Mode 1: Single Player Auction */}
        <div
          onClick={() => onSelectMode('singleplayer')}
          className="group relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-8 border-2 border-slate-800 hover:border-amber-400/80 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-t-2xl opacity-75 group-hover:opacity-100 transition-opacity" />

          <div>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
              <User className="w-8 h-8" />
            </div>

            <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">
              Mode 1 • Solo Experience
            </div>
            <h2 className="text-2xl font-black text-slate-100 group-hover:text-amber-300 transition-colors">
              SINGLE PLAYER AUCTION
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Take the exclusive paddle for your favorite IPL franchise. You are the sole bidder in the auditorium with full control to build your squad at your own pace.
            </p>

            <ul className="mt-6 space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>You are the only active bidder</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Zero AI bidders — other 9 teams remain inactive</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>15-second bidding clock with manual increment control</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-amber-400 transition-colors">
              Play Solo Auction
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-800 group-hover:bg-amber-400 group-hover:text-slate-950 text-slate-300 flex items-center justify-center transition-all">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Mode 2: Real-Time Multiplayer Auction */}
        <div
          onClick={() => onSelectMode('multiplayer')}
          className="group relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-8 border-2 border-slate-800 hover:border-cyan-400/80 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-cyan-500/10 flex flex-col justify-between"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 rounded-t-2xl opacity-75 group-hover:opacity-100 transition-opacity" />

          <div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
              <Users className="w-8 h-8" />
            </div>

            <div className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-1">
              Mode 2 • Stage 2 Real-Time
            </div>
            <h2 className="text-2xl font-black text-slate-100 group-hover:text-cyan-300 transition-colors">
              MULTIPLAYER AUCTION
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Create or join an auction room with friends in real time via Socket.IO. Each connected human player controls one IPL team in live synchronized bidding.
            </p>

            <ul className="mt-6 space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Real connected human managers only</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Zero AI bidding — teams without players stay inactive</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Server-synchronized 15s timer & live room lobby</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-cyan-400 transition-colors">
              Create / Join Room
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-800 group-hover:bg-cyan-400 group-hover:text-slate-950 text-slate-300 flex items-center justify-center transition-all">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
