import React, { useState, useEffect } from 'react';
import { PlusCircle, LogIn, ArrowLeft, AlertCircle, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import {
  createRoom,
  joinRoom,
  isSocketConnected,
  ensureSocketConnected,
  onSocketConnectionChange,
  reconnectSocket,
  getServerHostDisplay
} from '../../services/socketService';
import type { MultiplayerRoomState } from '../../types';

interface MultiplayerEntryScreenProps {
  onRoomJoined: (room: MultiplayerRoomState, playerId: string) => void;
  onBackToHome: () => void;
}

export const MultiplayerEntryScreen: React.FC<MultiplayerEntryScreenProps> = ({
  onRoomJoined,
  onBackToHome
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [hostName, setHostName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean>(isSocketConnected());
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Initial connection probe
    ensureSocketConnected(3000).then(connected => {
      setServerOnline(connected);
    });

    // Event-driven real-time socket connection monitor
    const unsubscribe = onSocketConnectionChange((connected) => {
      setServerOnline(connected);
      if (connected) {
        setIsReconnecting(false);
        setErrorMessage(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleManualReconnect = async () => {
    setIsReconnecting(true);
    setErrorMessage(null);
    reconnectSocket();
    const connected = await ensureSocketConnected(4000);
    setServerOnline(connected);
    setIsReconnecting(false);
    if (!connected) {
      setErrorMessage(`Unable to connect to multiplayer server (${getServerHostDisplay()}). Please verify the backend is running.`);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      setErrorMessage('Please enter your manager name.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // Strict 10-second safety timeout guarantee
    const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: `Room creation timed out after 10 seconds. Please check if the multiplayer server is reachable (${getServerHostDisplay()}).`
        });
      }, 10000);
    });

    try {
      const res = await Promise.race([
        createRoom(hostName.trim(), 10000),
        timeoutPromise
      ]);

      if (res.success && res.room) {
        onRoomJoined(res.room, res.room.hostId);
      } else {
        setErrorMessage(res.error || 'Failed to create auction room.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to multiplayer server.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setErrorMessage('Please enter the 6-character room code.');
      return;
    }
    if (!joinName.trim()) {
      setErrorMessage('Please enter your manager name.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: 'Joining room timed out after 10 seconds. Please verify the room code and server connection.'
        });
      }, 10000);
    });

    try {
      const res = await Promise.race([
        joinRoom(roomCode.trim().toUpperCase(), joinName.trim(), 10000),
        timeoutPromise
      ]);

      if (res.success && res.room && res.playerId) {
        onRoomJoined(res.room, res.playerId);
      } else {
        setErrorMessage(res.error || 'Failed to join auction room.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to multiplayer server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Return Button */}
      <button
        onClick={onBackToHome}
        className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-200 mb-8 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Mode Selection</span>
      </button>

      {/* Main Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
            MULTIPLAYER AUCTION ROOMS
          </h2>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Real-time auction against connected human managers via Socket.IO.
          </p>
        </div>

        {/* Server Connection Status Banner */}
        <div className="mb-6 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            {serverOnline ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold tracking-wide">Connected to Multiplayer Server</span>
              </>
            ) : isReconnecting ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-amber-400 font-medium">Connecting to Backend ({getServerHostDisplay()})...</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <WifiOff className="w-4 h-4 text-rose-400" />
                <span className="text-rose-400 font-medium">Server Offline ({getServerHostDisplay()})</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!serverOnline && (
              <button
                type="button"
                onClick={handleManualReconnect}
                disabled={isReconnecting}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-cyan-400 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
                <span>{isReconnecting ? 'Connecting...' : 'Reconnect'}</span>
              </button>
            )}
            <span className="text-[11px] font-mono text-slate-500">
              {serverOnline ? getServerHostDisplay() : 'Backend required'}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setTab('create'); setErrorMessage(null); }}
            className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'create'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Room</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('join'); setErrorMessage(null); }}
            className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'join'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Join Room</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 animate-bid-pop">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Create Room */}
        {tab === 'create' ? (
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Your Manager Name
              </label>
              <input
                type="text"
                maxLength={24}
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. CaptainSuhaib, DravidFan"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 text-sm transition"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="font-bold text-slate-300">Room Creator Host Privileges:</div>
              <div>• Generates an exclusive 6-character room code to share with friends.</div>
              <div>• Configure minimum players and launch the live bidding room.</div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Generating Room...</span>
                </div>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>Create Auction Room</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Tab 2: Join Room */
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                6-Character Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. IPL27A"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono font-bold tracking-widest uppercase placeholder-slate-600 focus:outline-none focus:border-cyan-400 text-base transition text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Your Manager Name
              </label>
              <input
                type="text"
                maxLength={24}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="e.g. MasterBlaster, KohliFan"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 text-sm transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Room...</span>
                </div>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Join Auction Room</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
