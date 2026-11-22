import { io, Socket } from 'socket.io-client';
import type { MultiplayerRoomState, BidRecord, MultiplayerResolvedLot, MultiplayerRoomSettings } from '../types';

let socket: Socket | null = null;

// Ensure persistent browser window singleton to prevent Vite HMR / React re-evaluation from duplicating sockets
declare global {
  interface Window {
    __IPL_SOCKET__?: Socket;
  }
}

export function getSocketUrl(): string {
  // 1. If configured explicitly via Vite env (Vercel deployment)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const customUrl = (
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL ||
      ''
    ).trim();

    if (customUrl) {
      return customUrl.replace(/\/+$/, '');
    }
  }

  // 2. In browser environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;

    // When running on local Vite dev server (port 5173, 5174, 3000, 4173), connect directly to local backend port 3001
    // Supports localhost, 127.0.0.1, or local LAN IPs (192.168.*, 10.*, 172.*)
    if (port === '5173' || port === '5174' || port === '3000' || port === '4173') {
      return `http://${hostname}:3001`;
    }

    // When served directly or in fullstack production
    return window.location.origin.replace(/\/+$/, '');
  }

  // 3. Fallback for Node/test runners
  return 'http://localhost:3001';
}

export function getServerHostDisplay(): string {
  const url = getSocketUrl();
  try {
    const parsed = new URL(url);
    return parsed.host || url;
  } catch {
    return url;
  }
}

export function getSocket(): Socket {
  if (typeof window !== 'undefined' && window.__IPL_SOCKET__) {
    socket = window.__IPL_SOCKET__;
    return socket;
  }

  if (!socket) {
    const url = getSocketUrl();
    console.log(`[SOCKET INIT ${new Date().toISOString()}] Initializing Socket.IO connection to: ${url}`);
    socket = io(url, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      timeout: 8000
    });

    if (typeof window !== 'undefined') {
      window.__IPL_SOCKET__ = socket;
    }

    socket.on('connect', () => {
      console.log(`[SOCKET CONNECTED ${new Date().toISOString()}] ID=${socket?.id}, URL=${url}`);
      if (typeof window !== 'undefined') {
        const savedRoomCode = sessionStorage.getItem('ipl_room_code');
        const savedPlayerId = sessionStorage.getItem('ipl_player_id');
        if (savedRoomCode && savedPlayerId) {
          console.log(`[SOCKET AUTO-RECONNECT ${new Date().toISOString()}] Restoring room=${savedRoomCode}, player=${savedPlayerId}`);
          socket?.emit('reconnect_player', { roomCode: savedRoomCode, playerId: savedPlayerId }, () => {});
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[SOCKET DISCONNECTED ${new Date().toISOString()}] Reason=${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.error(`[SOCKET CONNECT_ERROR ${new Date().toISOString()}]`, err.message);
    });
  }
  return socket;
}

export function isSocketConnected(): boolean {
  return !!socket && socket.connected;
}

export function onSocketConnectionChange(callback: (connected: boolean) => void): () => void {
  const s = getSocket();
  const handleConnect = () => callback(true);
  const handleDisconnect = () => callback(false);
  const handleError = () => callback(false);

  s.on('connect', handleConnect);
  s.on('disconnect', handleDisconnect);
  s.on('connect_error', handleError);

  // Trigger initial status
  callback(s.connected);

  return () => {
    s.off('connect', handleConnect);
    s.off('disconnect', handleDisconnect);
    s.off('connect_error', handleError);
  };
}

export function reconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.connect();
  } else {
    getSocket();
  }
}

export async function ensureSocketConnected(timeoutMs: number = 4000): Promise<boolean> {
  const s = getSocket();
  if (s.connected) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(s.connected);
      }
    }, timeoutMs);

    const onConnect = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        s.off('connect', onConnect);
        resolve(true);
      }
    };

    s.once('connect', onConnect);

    if (!s.connected) {
      s.connect();
    }
  });
}

// 1. CREATE AUCTION ROOM (Strict 10-second timeout guarantee)
export async function createRoom(
  hostName: string,
  timeoutMs: number = 10000
): Promise<{ success: boolean; room?: MultiplayerRoomState; error?: string }> {
  try {
    const s = getSocket();
    const isConnected = await ensureSocketConnected(4000);

    if (!isConnected && !s.connected) {
      return {
        success: false,
        error: `Unable to connect to multiplayer server (${getServerHostDisplay()}). Please verify the backend server is running.`
      };
    }

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          s.off('room_created', onRoomCreated);
          resolve({
            success: false,
            error: 'Room creation timed out after 10 seconds. The server did not respond.'
          });
        }
      }, timeoutMs);

      const onRoomCreated = (res: { success: boolean; room?: MultiplayerRoomState; error?: string }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          s.off('room_created', onRoomCreated);
          resolve(res);
        }
      };

      // Backup event listener in case callback is missed
      s.once('room_created', onRoomCreated);

      s.emit(
        'create_room',
        { hostName },
        (res: { success: boolean; room?: MultiplayerRoomState; error?: string }) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            s.off('room_created', onRoomCreated);
            resolve(res);
          }
        }
      );
    });
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unexpected error while creating room.'
    };
  }
}

// 2. JOIN AUCTION ROOM (Strict 10-second timeout guarantee)
export async function joinRoom(
  roomCode: string,
  playerName: string,
  timeoutMs: number = 10000
): Promise<{ success: boolean; room?: MultiplayerRoomState; playerId?: string; error?: string }> {
  try {
    const s = getSocket();
    const isConnected = await ensureSocketConnected(4000);

    if (!isConnected && !s.connected) {
      return {
        success: false,
        error: `Unable to connect to multiplayer server (${getServerHostDisplay()}). Please verify the backend server is running.`
      };
    }

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          s.off('room_joined', onRoomJoined);
          resolve({
            success: false,
            error: 'Joining room timed out after 10 seconds. Please check the room code and try again.'
          });
        }
      }, timeoutMs);

      const onRoomJoined = (res: { success: boolean; room?: MultiplayerRoomState; playerId?: string; error?: string }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          s.off('room_joined', onRoomJoined);
          resolve(res);
        }
      };

      s.once('room_joined', onRoomJoined);

      s.emit(
        'join_room',
        { roomCode, playerName },
        (res: { success: boolean; room?: MultiplayerRoomState; playerId?: string; error?: string }) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            s.off('room_joined', onRoomJoined);
            resolve(res);
          }
        }
      );
    });
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unexpected error while joining room.'
    };
  }
}

// 3A. CLAIM TEAM (Stage 3 Real-time franchise claim)
export function claimMultiplayerTeam(
  teamId: string,
  timeoutMs: number = 5000
): Promise<{ success: boolean; teamId?: string; teamName?: string; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Team claim request timed out. Please try again.' });
      }
    }, timeoutMs);

    s.emit('claim_team', { teamId }, (res: { success: boolean; teamId?: string; teamName?: string; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res);
      }
    });
  });
}

// 3B. RELEASE TEAM (Stage 3 Real-time franchise release)
export function releaseMultiplayerTeam(
  timeoutMs: number = 5000
): Promise<{ success: boolean; releasedTeamId?: string; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Team release request timed out.' });
      }
    }, timeoutMs);

    s.emit('release_team', (res: { success: boolean; releasedTeamId?: string; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res);
      }
    });
  });
}

// 3C. LEAVE MULTIPLAYER ROOM
export function leaveMultiplayerRoom(
  timeoutMs: number = 4000
): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const s = getSocket();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: true });
      }
    }, timeoutMs);

    s.emit('leave_room', (res: { success: boolean }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res || { success: true });
      }
    });
  });
}

// 3D. SELECT TEAM (Wrapper for backwards compatibility)
export function selectMultiplayerTeam(
  teamId: string | null,
  timeoutMs: number = 5000
): Promise<{ success: boolean; error?: string }> {
  if (teamId) {
    return claimMultiplayerTeam(teamId, timeoutMs);
  } else {
    return releaseMultiplayerTeam(timeoutMs);
  }
}

// 4. TOGGLE READY
export function toggleMultiplayerReady(
  timeoutMs: number = 5000
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Ready status update timed out.' });
      }
    }, timeoutMs);

    s.emit('toggle_ready', (res: { success: boolean; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res);
      }
    });
  });
}

// 5. UPDATE SETTINGS
export function updateRoomSettings(
  settings: Partial<MultiplayerRoomSettings>,
  timeoutMs: number = 5000
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Settings update timed out.' });
      }
    }, timeoutMs);

    s.emit('update_settings', settings, (res: { success: boolean; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res);
      }
    });
  });
}

// 6. START AUCTION
export function startMultiplayerAuction(
  timeoutMs: number = 6000
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Start auction request timed out.' });
      }
    }, timeoutMs);

    s.emit('start_auction', (res: { success: boolean; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res);
      }
    });
  });
}

export interface PlaceBidPayload {
  roomCode?: string;
  playerId?: string;
  teamId?: string;
  amount?: number;
  requestId?: string;
}

// 7. PLACE BID (Multi-client real-time bidding with multi-channel targeted acknowledgement & instant error propagation)
export async function placeMultiplayerBid(
  payload?: PlaceBidPayload,
  timeoutMs: number = 8000
): Promise<{ success: boolean; error?: string; bid?: BidRecord; room?: MultiplayerRoomState }> {
  const startTime = new Date().toISOString();
  try {
    const s = getSocket();
    const isConnected = await ensureSocketConnected(3000);
    const requestId = payload?.requestId || `bid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const reqPayload: PlaceBidPayload = { ...payload, requestId };

    console.log(`[BID CLIENT ${startTime}][ENTER]`, {
      socketId: s.id,
      connected: s.connected,
      backendUrl: getSocketUrl(),
      reqPayload
    });

    if (!isConnected && !s.connected) {
      console.warn(`[BID CLIENT ${startTime}][ABORT] Socket disconnected and failed to reconnect.`);
      return { success: false, error: 'Lost connection to multiplayer server. Please wait a moment...' };
    }

    return new Promise((resolve) => {
      let resolved = false;

      const cleanup = () => {
        s.off('bid_response', onBidResponse);
        s.off('bid_rejected', onBidRejected);
        s.off('bid_accepted', onBidAccepted);
        s.off('bid_placed', onBidPlacedBroadcast);
        s.off('room_updated', onRoomUpdatedBroadcast);
        s.off('disconnect', onDisconnect);
      };

      const finish = (channel: string, result: { success: boolean; error?: string; bid?: BidRecord; room?: MultiplayerRoomState }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cleanup();
          console.log(`[BID CLIENT ${new Date().toISOString()}][RESOLVED via ${channel}]`, result);
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        console.warn(`[BID CLIENT ${new Date().toISOString()}][TIMEOUT after ${timeoutMs}ms]`, {
          socketId: s.id,
          connected: s.connected,
          reqPayload
        });
        finish('TIMEOUT', { success: false, error: 'Bid placement timed out. Please try again.' });
      }, timeoutMs);

      // Channel 1A: Dedicated direct bid response event (covers both accepted and rejected)
      const onBidResponse = (res: any) => {
        if (res && typeof res === 'object') {
          if (res.requestId && res.requestId !== requestId) return;
          console.log(`[BID CLIENT ${new Date().toISOString()}][RECV bid_response]`, res);
          finish('direct_bid_response', res);
        }
      };
      s.on('bid_response', onBidResponse);

      // Channel 1B: Immediate targeted rejection event (instantly shows server validation errors)
      const onBidRejected = (res: any) => {
        if (res && typeof res === 'object') {
          if (res.requestId && res.requestId !== requestId) return;
          console.log(`[BID CLIENT ${new Date().toISOString()}][RECV bid_rejected]`, res);
          finish('direct_bid_rejected', res);
        }
      };
      s.on('bid_rejected', onBidRejected);

      // Channel 1C: Targeted acceptance event
      const onBidAccepted = (res: any) => {
        if (res && typeof res === 'object') {
          if (res.requestId && res.requestId !== requestId) return;
          console.log(`[BID CLIENT ${new Date().toISOString()}][RECV bid_accepted]`, res);
          finish('direct_bid_accepted', res);
        }
      };
      s.on('bid_accepted', onBidAccepted);

      // Channel 2: Room broadcast detection (if server accepted & published this new bid to the room)
      const onBidPlacedBroadcast = (data: { bid: BidRecord; room: MultiplayerRoomState }) => {
        if (data?.bid) {
          const normReqTeam = (reqPayload.teamId || '').trim().toUpperCase();
          const normBidTeam = (data.bid.teamId || '').trim().toUpperCase();
          const matchTeam = normReqTeam && normBidTeam === normReqTeam;
          const matchPlayer = reqPayload.playerId && data.room?.highestBidderId === reqPayload.playerId;
          const matchAmount = !reqPayload.amount || data.bid.amount >= reqPayload.amount;

          if ((matchTeam || matchPlayer) && matchAmount) {
            console.log(`[BID CLIENT ${new Date().toISOString()}][RECV bid_placed match]`, data.bid);
            finish('bid_placed_broadcast', { success: true, bid: data.bid, room: data.room });
          }
        }
      };
      s.on('bid_placed', onBidPlacedBroadcast);

      // Channel 3: Room updated state detection (only for newly advanced highest bid amount)
      const onRoomUpdatedBroadcast = (updatedRoom: MultiplayerRoomState) => {
        if (updatedRoom) {
          const normReqTeam = (reqPayload.teamId || '').trim().toUpperCase();
          const normRoomTeam = (updatedRoom.highestBidderTeamId || '').trim().toUpperCase();
          const matchTeam = normReqTeam && normRoomTeam === normReqTeam;
          const matchPlayer = reqPayload.playerId && updatedRoom.highestBidderId === reqPayload.playerId;
          const matchAmount = !reqPayload.amount || updatedRoom.currentBid >= reqPayload.amount;

          if ((matchTeam || matchPlayer) && matchAmount) {
            console.log(`[BID CLIENT ${new Date().toISOString()}][RECV room_updated highestBidder match]`);
            finish('room_updated_match', { success: true, room: updatedRoom });
          }
        }
      };
      s.on('room_updated', onRoomUpdatedBroadcast);

      // Channel 4: Abrupt disconnect handling (cleans up immediately)
      const onDisconnect = (reason: any) => {
        console.warn(`[BID CLIENT ${new Date().toISOString()}][DISCONNECT during bid]`, reason);
        finish('disconnect', { success: false, error: 'Socket disconnected while processing bid.' });
      };
      s.once('disconnect', onDisconnect);

      console.log(`[BID CLIENT ${startTime}][EMIT place_bid] Emitting to server...`);

      // Channel 5: Standard Socket.IO callback acknowledgement
      s.emit('place_bid', reqPayload, (res: { success: boolean; error?: string; bid?: BidRecord; room?: MultiplayerRoomState }) => {
        console.log(`[BID CLIENT ${new Date().toISOString()}][RECV callback ack]`, res);
        if (res && typeof res === 'object') {
          finish('callback_ack', res);
        }
      });
    });
  } catch (err: any) {
    console.error(`[BID CLIENT ${new Date().toISOString()}][EXCEPTION]`, err);
    return { success: false, error: err?.message || 'Error executing bid.' };
  }
}

// 8. ADVANCE LOT (Skip Current Player)
export async function advanceMultiplayerLot(
  payload?: { roomCode?: string; playerId?: string },
  timeoutMs: number = 5000
): Promise<{ success: boolean; error?: string }> {
  try {
    const s = getSocket();
    await ensureSocketConnected(3000);

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Next lot advance timed out.' });
        }
      }, timeoutMs);

      s.emit('next_lot', payload || {}, (res: { success: boolean; error?: string }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(res);
        }
      });
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error advancing lot.' };
  }
}

// 8B. SKIP ENTIRE SET
export async function skipMultiplayerSet(
  payload?: { roomCode?: string; playerId?: string },
  timeoutMs: number = 5000
): Promise<{ success: boolean; error?: string }> {
  try {
    const s = getSocket();
    await ensureSocketConnected(3000);

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Skip set request timed out.' });
        }
      }, timeoutMs);

      s.emit('skip_set', payload || {}, (res: { success: boolean; error?: string }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(res);
        }
      });
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error skipping set.' };
  }
}

// 9. TOGGLE PAUSE
export async function toggleMultiplayerPause(
  payload?: { roomCode?: string; playerId?: string },
  timeoutMs: number = 4000
): Promise<{ success: boolean; error?: string }> {
  try {
    const s = getSocket();
    await ensureSocketConnected(3000);

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Pause toggle timed out.' });
        }
      }, timeoutMs);

      s.emit('toggle_pause', payload || {}, (res: { success: boolean; error?: string }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(res);
        }
      });
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error toggling pause.' };
  }
}

// 10. RECONNECT PLAYER
export function reconnectMultiplayerPlayer(
  roomCode: string,
  playerId: string,
  timeoutMs: number = 6000
): Promise<{ success: boolean; room?: MultiplayerRoomState; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Reconnection timed out.' });
      }
    }, timeoutMs);

    s.emit('reconnect_player', { roomCode, playerId }, (res: { success: boolean; room?: MultiplayerRoomState; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res);
      }
    });
  });
}

export interface SocketCallbacks {
  onRoomUpdated: (room: MultiplayerRoomState) => void;
  onBidPlaced: (data: { bid: BidRecord; room: MultiplayerRoomState }) => void;
  onTimerTick: (data: { countdown: number; auctioneerCall: string }) => void;
  onLotResolved: (data: { resolvedLot: MultiplayerResolvedLot; room: MultiplayerRoomState }) => void;
  onAuctionCompleted: (room: MultiplayerRoomState) => void;
}

export function subscribeToRoomEvents(callbacks: SocketCallbacks) {
  const s = getSocket();

  s.on('room_updated', callbacks.onRoomUpdated);
  s.on('bid_placed', callbacks.onBidPlaced);
  s.on('timer_tick', callbacks.onTimerTick);
  s.on('lot_resolved', callbacks.onLotResolved);
  s.on('auction_completed', callbacks.onAuctionCompleted);

  return () => {
    s.off('room_updated', callbacks.onRoomUpdated);
    s.off('bid_placed', callbacks.onBidPlaced);
    s.off('timer_tick', callbacks.onTimerTick);
    s.off('lot_resolved', callbacks.onLotResolved);
    s.off('auction_completed', callbacks.onAuctionCompleted);
  };
}
