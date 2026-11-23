import { Server as SocketIOServer, Socket } from 'socket.io';
import { INITIAL_TEAMS } from '../src/data/teamsData';
import { INITIAL_PLAYERS } from '../src/data/playersData';
import { DEFAULT_RULES, getNextBidAmount, formatCurrency } from '../src/utils/currencyUtils';
import { validateBid, updateTeamPurchasedPlayer } from '../src/engine/squadRules';
import type {
  MultiplayerPlayer,
  MultiplayerRoomState,
  MultiplayerRoomSettings,
  BidRecord,
  Player,
  Team
} from '../src/types';

interface InternalRoomState extends MultiplayerRoomState {
  timerInterval?: NodeJS.Timeout;
}

const rooms = new Map<string, InternalRoomState>();

// Generate 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

/**
 * Safely extracts payload data and an optional acknowledgement callback from Socket.IO event arguments.
 * Ensures the returned callback never throws a TypeError, even if the client omitted the callback,
 * passed arguments in an unexpected order, or if invoking the callback fails.
 */
function extractSocketPayload<T = any>(...args: any[]): { data: T; callback: (res: any) => void } {
  let data: any = {};
  let rawCallback: any = null;

  for (const arg of args) {
    if (typeof arg === 'function') {
      rawCallback = arg;
    } else if (typeof arg === 'object' && arg !== null) {
      data = arg;
    }
  }

  const safeCallback = (res: any) => {
    if (typeof rawCallback === 'function') {
      try {
        rawCallback(res);
      } catch (err) {
        console.error('[SOCKET CALLBACK ERROR]', err);
      }
    }
  };

  return { data: data as T, callback: safeCallback };
}

export function setupMultiplayerSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    console.log(`[SERVER SOCKET ${new Date().toISOString()}] CONNECT: socket=${socket.id}, transport=${socket.conn.transport.name}`);

    // 1. CREATE AUCTION ROOM
    socket.on('create_room', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<{ hostName?: string }>(...args);
      try {
        const hostName = (data?.hostName || 'Host').trim().slice(0, 24);
        const roomCode = generateRoomCode();
        const playerId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        const initialSettings: MultiplayerRoomSettings = {
          minPlayersToStart: 1, // Can test with 1 or set up to 10
          timerSeconds: 15,
          startingPurse: 1200000000,
          maxSquadSize: 25,
          maxOverseas: 8
        };

        const hostPlayer: MultiplayerPlayer = {
          id: playerId,
          socketId: socket.id,
          name: hostName,
          teamId: null,
          isHost: true,
          isReady: false,
          isConnected: true
        };

        const roomTeams: Team[] = INITIAL_TEAMS.map(t => ({
          ...t,
          purchasedPlayers: [],
          currentPurse: initialSettings.startingPurse,
          initialPurse: initialSettings.startingPurse,
          squadCount: 0,
          indianCount: 0,
          overseasCount: 0,
          roleCounts: { batter: 0, bowler: 0, allRounder: 0, wicketkeeper: 0 },
          ownerName: undefined,
          isHumanControlled: false
        }));

        const newRoom: InternalRoomState = {
          roomId: `room-${Date.now()}`,
          roomCode,
          hostId: playerId,
          status: 'waiting',
          players: [hostPlayer],
          settings: initialSettings,
          teams: roomTeams,
          playerPool: INITIAL_PLAYERS.map(p => ({ ...p, status: 'upcoming' })),
          currentPlayerIndex: 0,
          currentBid: 0,
          highestBidderId: null,
          highestBidderTeamId: null,
          highestBidderName: null,
          bidHistory: [],
          countdown: 15,
          isPaused: false,
          auctioneerCall: `Room ${roomCode} created. Waiting for managers to join...`,
          lastResolvedLot: null
        };

        rooms.set(roomCode, newRoom);
        currentRoomCode = roomCode;
        currentPlayerId = playerId;

        socket.join(roomCode);
        const response = { success: true, room: sanitizeRoom(newRoom) };
        callback(response);
        socket.emit('room_created', response);
      } catch (err: any) {
        const errorResponse = { success: false, error: err?.message || 'Failed to create room' };
        callback(errorResponse);
        socket.emit('room_created', errorResponse);
      }
    });

    // 2. JOIN AUCTION ROOM
    socket.on('join_room', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<{ roomCode?: string; playerName?: string }>(...args);
      try {
        const code = (data?.roomCode || '').trim().toUpperCase();
        const playerName = (data?.playerName || 'Player').trim().slice(0, 24);

        const room = rooms.get(code);
        if (!room) {
          const errorResponse = { success: false, error: `Room code "${code}" not found.` };
          callback(errorResponse);
          socket.emit('room_joined', errorResponse);
          return;
        }

        if (room.players.length >= 10) {
          const errorResponse = { success: false, error: 'Room is full (max 10 human managers).' };
          callback(errorResponse);
          socket.emit('room_joined', errorResponse);
          return;
        }

        if (room.status === 'auction' || room.status === 'completed') {
          const errorResponse = { success: false, error: 'Auction has already started in this room.' };
          callback(errorResponse);
          socket.emit('room_joined', errorResponse);
          return;
        }

        const playerId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newPlayer: MultiplayerPlayer = {
          id: playerId,
          socketId: socket.id,
          name: playerName,
          teamId: null,
          isHost: false,
          isReady: false,
          isConnected: true
        };

        room.players.push(newPlayer);
        currentRoomCode = code;
        currentPlayerId = playerId;

        socket.join(code);
        io.to(code).emit('room_updated', sanitizeRoom(room));
        const response = { success: true, room: sanitizeRoom(room), playerId };
        callback(response);
        socket.emit('room_joined', response);
      } catch (err: any) {
        const errorResponse = { success: false, error: err?.message || 'Failed to join room' };
        callback(errorResponse);
        socket.emit('room_joined', errorResponse);
      }
    });

    // 3. CLAIM TEAM (Atomic real-time team claiming)
    socket.on('claim_team', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<{ teamId?: string }>(...args);
      try {
        if (!currentRoomCode || !currentPlayerId) {
          callback({ success: false, error: 'Not connected to an active room.' });
          return;
        }

        const room = rooms.get(currentRoomCode);
        if (!room) {
          callback({ success: false, error: 'Auction room not found.' });
          return;
        }

        if (room.status !== 'waiting' && room.status !== 'ready') {
          callback({ success: false, error: 'Team claiming is only permitted in the lobby.' });
          return;
        }

        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) {
          callback({ success: false, error: 'Player identity not found in room roster.' });
          return;
        }

        const targetTeamId = (data?.teamId || '').trim();
        const targetTeam = room.teams.find(t => t.id === targetTeamId);
        if (!targetTeam) {
          callback({ success: false, error: `Invalid franchise ID "${targetTeamId}".` });
          return;
        }

        // Prevent claiming if player already holds another team
        if (player.teamId && player.teamId !== targetTeamId) {
          const currentTeam = room.teams.find(t => t.id === player.teamId);
          callback({
            success: false,
            error: `You already hold ${currentTeam?.name || player.teamId}. Please release it before claiming another franchise.`
          });
          return;
        }

        // Atomic check: Is target team already claimed by another player?
        const existingClaimant = room.players.find(p => p.teamId === targetTeamId && p.id !== currentPlayerId);
        if (existingClaimant || (targetTeam.isHumanControlled && targetTeam.ownerName && targetTeam.ownerName !== player.name)) {
          const owner = existingClaimant ? existingClaimant.name : (targetTeam.ownerName || 'another manager');
          callback({
            success: false,
            error: `${targetTeam.name} (${targetTeam.shortName}) is already claimed by ${owner}.`
          });
          return;
        }

        // Assign team to player
        player.teamId = targetTeamId;
        player.isReady = false; // Reset ready flag on franchise change
        targetTeam.ownerName = player.name;
        targetTeam.isHumanControlled = true;

        const sanitized = sanitizeRoom(room);
        io.to(currentRoomCode).emit('room_updated', sanitized);
        io.to(currentRoomCode).emit('team_claimed', {
          playerId: player.id,
          playerName: player.name,
          teamId: targetTeamId,
          teamName: targetTeam.name
        });

        callback({ success: true, teamId: targetTeamId, teamName: targetTeam.name });
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Server error while claiming team.' });
      }
    });

    // 3B. RELEASE TEAM (Allow player to unclaim/release their franchise)
    socket.on('release_team', (...args: any[]) => {
      const { callback } = extractSocketPayload(...args);
      try {
        if (!currentRoomCode || !currentPlayerId) {
          callback({ success: false, error: 'Not connected to an active room.' });
          return;
        }

        const room = rooms.get(currentRoomCode);
        if (!room) {
          callback({ success: false, error: 'Auction room not found.' });
          return;
        }

        if (room.status !== 'waiting' && room.status !== 'ready') {
          callback({ success: false, error: 'Cannot release franchise while auction is in progress.' });
          return;
        }

        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) {
          callback({ success: false, error: 'Player identity not found.' });
          return;
        }

        if (!player.teamId) {
          callback({ success: false, error: 'You do not currently hold any franchise.' });
          return;
        }

        const releasedTeamId = player.teamId;
        const targetTeam = room.teams.find(t => t.id === releasedTeamId);
        if (targetTeam) {
          targetTeam.ownerName = undefined;
          targetTeam.isHumanControlled = false;
        }

        player.teamId = null;
        player.isReady = false;

        const sanitized = sanitizeRoom(room);
        io.to(currentRoomCode).emit('room_updated', sanitized);
        io.to(currentRoomCode).emit('team_released', {
          playerId: player.id,
          playerName: player.name,
          releasedTeamId
        });

        callback({ success: true, releasedTeamId });
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Server error while releasing team.' });
      }
    });

    // 3C. SELECT TEAM (Backwards-compatibility wrapper for select_team)
    socket.on('select_team', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<{ teamId?: string | null }>(...args);
      try {
        if (!currentRoomCode || !currentPlayerId) {
          callback({ success: false, error: 'Not in a room.' });
          return;
        }
        const room = rooms.get(currentRoomCode);
        if (!room) {
          callback({ success: false, error: 'Room not found.' });
          return;
        }

        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) {
          callback({ success: false, error: 'Player not found in room.' });
          return;
        }

        const targetTeamId = data?.teamId;

        if (!targetTeamId) {
          // Release team
          if (player.teamId) {
            const prevTeam = room.teams.find(t => t.id === player.teamId);
            if (prevTeam) {
              prevTeam.ownerName = undefined;
              prevTeam.isHumanControlled = false;
            }
            player.teamId = null;
            player.isReady = false;
          }
          io.to(currentRoomCode).emit('room_updated', sanitizeRoom(room));
          callback({ success: true });
          return;
        }

        // Check if team is already claimed by someone else
        const existingClaim = room.players.find(p => p.teamId === targetTeamId && p.id !== currentPlayerId);
        if (existingClaim) {
          callback({ success: false, error: `Team already selected by ${existingClaim.name}.` });
          return;
        }

        // Free previous team if any
        if (player.teamId && player.teamId !== targetTeamId) {
          const prevTeam = room.teams.find(t => t.id === player.teamId);
          if (prevTeam) {
            prevTeam.ownerName = undefined;
            prevTeam.isHumanControlled = false;
          }
        }

        // Assign new team
        player.teamId = targetTeamId;
        const newTeam = room.teams.find(t => t.id === targetTeamId);
        if (newTeam) {
          newTeam.ownerName = player.name;
          newTeam.isHumanControlled = true;
        }

        io.to(currentRoomCode).emit('room_updated', sanitizeRoom(room));
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Error selecting team.' });
      }
    });

    // 3D. LEAVE ROOM (Clean player departure & team release)
    socket.on('leave_room', (...args: any[]) => {
      const { callback } = extractSocketPayload(...args);
      try {
        if (currentRoomCode && currentPlayerId) {
          const room = rooms.get(currentRoomCode);
          if (room) {
            const player = room.players.find(p => p.id === currentPlayerId);
            if (player && player.teamId) {
              const team = room.teams.find(t => t.id === player.teamId);
              if (team) {
                team.ownerName = undefined;
                team.isHumanControlled = false;
              }
            }

            room.players = room.players.filter(p => p.id !== currentPlayerId);

            // If host left, designate next connected player as host
            if (room.hostId === currentPlayerId && room.players.length > 0) {
              const nextHost = room.players.find(p => p.isConnected) || room.players[0];
              nextHost.isHost = true;
              room.hostId = nextHost.id;
            }

            socket.leave(currentRoomCode);
            io.to(currentRoomCode).emit('room_updated', sanitizeRoom(room));
          }
          currentRoomCode = null;
          currentPlayerId = null;
        }
        callback({ success: true });
      } catch {
        callback({ success: false });
      }
    });

    // 4. TOGGLE READY
    socket.on('toggle_ready', (...args: any[]) => {
      const { callback } = extractSocketPayload(...args);
      try {
        if (!currentRoomCode || !currentPlayerId) {
          callback({ success: false, error: 'Not in a room.' });
          return;
        }
        const room = rooms.get(currentRoomCode);
        if (!room) {
          callback({ success: false, error: 'Room not found.' });
          return;
        }

        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) {
          callback({ success: false, error: 'Player not found.' });
          return;
        }

        if (!player.teamId) {
          callback({ success: false, error: 'Please select an IPL team first.' });
          return;
        }

        player.isReady = !player.isReady;
        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Error updating ready state.' });
      }
    });

    // 5. UPDATE SETTINGS (Host only)
    socket.on('update_settings', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<Partial<MultiplayerRoomSettings>>(...args);
      try {
        if (!currentRoomCode || !currentPlayerId) {
          callback({ success: false, error: 'Not in a room.' });
          return;
        }
        const room = rooms.get(currentRoomCode);
        if (!room) {
          callback({ success: false, error: 'Room not found.' });
          return;
        }

        if (room.hostId !== currentPlayerId) {
          callback({ success: false, error: 'Only the host can modify room settings.' });
          return;
        }

        room.settings = { ...room.settings, ...data };
        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Error updating settings.' });
      }
    });

    // 6. START AUCTION (Host only - Allows single player or multiplayer)
    socket.on('start_auction', (...args: any[]) => {
      const { callback } = extractSocketPayload(...args);
      try {
        if (!currentRoomCode || !currentPlayerId) {
          callback({ success: false, error: 'Not in a room.' });
          return;
        }
        const room = rooms.get(currentRoomCode);
        if (!room) {
          callback({ success: false, error: 'Room not found.' });
          return;
        }

        if (room.hostId !== currentPlayerId) {
          callback({ success: false, error: 'Only the host can start the auction.' });
          return;
        }

        // Check min players requirement: Allow starting with 1 player (single player mode)
        if (room.players.length < 1) {
          callback({ success: false, error: 'Need at least 1 player to start.' });
          return;
        }

        // Check all joined players have chosen a team
        const unassigned = room.players.filter(p => !p.teamId);
        if (unassigned.length > 0) {
          callback({
            success: false,
            error: `All players must select an IPL franchise before starting (${unassigned[0].name} has no team).`
          });
          return;
        }

        // Verify host has claimed a team
        const host = room.players.find(p => p.id === room.hostId);
        if (!host || !host.teamId) {
          callback({
            success: false,
            error: 'You must claim an IPL franchise before starting the auction.'
          });
          return;
        }

        room.status = 'auction';
        room.currentPlayerIndex = 0;
        resetRoomLot(room, 0);

        startServerTimer(io, room);

        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        callback({ success: true });
      } catch (err: any) {
        console.error('Error starting auction:', err);
        callback({ success: false, error: err?.message || 'Error starting auction.' });
      }
    });

    // 7. PLACE BID (Authoritative Server Validation & Real-Time Opponent Synchronization)
    socket.on('place_bid', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<any>(...args);

      const pId = data.playerId || currentPlayerId;
      let player: MultiplayerPlayer | undefined;

      const safeRespond = (res: { success: boolean; error?: string; bid?: BidRecord; room?: MultiplayerRoomState }) => {
        const time = new Date().toISOString();
        const responsePayload = {
          ...res,
          requestId: data.requestId,
          teamId: data.teamId,
          playerId: pId
        };
        console.log(`[SERVER BID ${time}] safeRespond for socket=${socket.id}, success=${res.success}, error=${res.error || 'none'}`);

        // 1. Direct Socket Event Response to Sender
        try {
          socket.emit('bid_response', responsePayload);
          if (res.success) {
            socket.emit('bid_accepted', responsePayload);
          } else {
            socket.emit('bid_rejected', responsePayload);
          }
          console.log(`[SERVER BID ${time}] Emitted direct 'bid_response' to socket=${socket.id}`);
        } catch (e) {
          console.error(`[SERVER BID ${time}] Error emitting bid_response:`, e);
        }

        // 2. Targeted fallback to player's known socket ID (in case socket reconnected during transit)
        if (player && player.socketId && player.socketId !== socket.id) {
          try {
            io.to(player.socketId).emit('bid_response', responsePayload);
            io.to(player.socketId).emit(res.success ? 'bid_accepted' : 'bid_rejected', responsePayload);
          } catch (e) {
            console.error(`[SERVER BID ${time}] Error emitting targeted response to player.socketId:`, e);
          }
        }

        // 3. Acknowledgement Callback to Sender (safeCallback checks function and try/catches)
        callback(responsePayload);
      };

      try {
        const time = new Date().toISOString();
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        console.log(`[SERVER BID ${time}] RECV place_bid: socket=${socket.id}, room=${code}, player=${pId}, team=${data.teamId}, amount=${data.amount}`);

        if (!code) {
          console.warn(`[SERVER BID REJECTED ${time}] Socket ${socket.id} has no active room code.`);
          return safeRespond({ success: false, error: 'Not connected to an active room.' });
        }

        const room = rooms.get(code);
        if (!room) {
          console.warn(`[SERVER BID REJECTED ${time}] Room "${code}" not found.`);
          return safeRespond({ success: false, error: `Auction room "${code}" not found.` });
        }

        // Re-bind socket room and session context
        currentRoomCode = code;
        socket.join(code);
        if (pId) {
          currentPlayerId = pId;
        }

        if (room.status !== 'auction') {
          console.warn(`[SERVER BID REJECTED ${time}] Room "${code}" status is "${room.status}", not "auction".`);
          return safeRespond({ success: false, error: 'Auction is not currently in progress.' });
        }

        if (room.isPaused) {
          console.warn(`[SERVER BID REJECTED ${time}] Auction is paused by host.`);
          return safeRespond({ success: false, error: 'Auction is currently paused by host.' });
        }

        if (room.countdown <= 0) {
          console.warn(`[SERVER BID REJECTED ${time}] Bidding window expired (countdown=${room.countdown}).`);
          return safeRespond({ success: false, error: 'Bidding window has expired.' });
        }

        // Find player by ID, team, or socket ID (with case-insensitive franchise matching)
        const targetTeamId = (data.teamId || '').trim().toUpperCase();
        player = room.players.find(p => p.id === pId);
        if (!player && targetTeamId) {
          player = room.players.find(p => (p.teamId || '').toUpperCase() === targetTeamId);
        }
        if (!player) {
          player = room.players.find(p => p.socketId === socket.id);
        }

        if (!player || !player.teamId) {
          console.warn(`[SERVER BID REJECTED ${time}] Player ${pId} (team=${targetTeamId}) has no assigned team in room ${code}.`);
          return safeRespond({ success: false, error: 'You do not own an assigned franchise in this room.' });
        }

        // Keep player connection synchronized
        player.socketId = socket.id;
        player.isConnected = true;
        currentPlayerId = player.id;

        const effectiveTeamId = (player.teamId || targetTeamId).toUpperCase();
        const team = room.teams.find(t => t.id.toUpperCase() === effectiveTeamId);
        if (!team) {
          console.warn(`[SERVER BID REJECTED ${time}] Franchise "${effectiveTeamId}" not found in room roster.`);
          return safeRespond({ success: false, error: 'Franchise not found in room roster.' });
        }

        const currentLot = room.playerPool[room.currentPlayerIndex];
        if (!currentLot) {
          console.warn(`[SERVER BID REJECTED ${time}] No active player lot at index ${room.currentPlayerIndex}.`);
          return safeRespond({ success: false, error: 'No active player lot.' });
        }

        // Cannot bid if already holding highest bid
        if (room.highestBidderId === player.id || (room.highestBidderTeamId && room.highestBidderTeamId === team.id)) {
          console.warn(`[SERVER BID REJECTED ${time}] Player ${player.name} (${team.shortName}) already holds highest bid.`);
          return safeRespond({ success: false, error: 'You already hold the highest bid!' });
        }

        // Compute next bid amount authoritatively
        const nextAmount = room.currentBid === 0
          ? currentLot.basePrice
          : getNextBidAmount(room.currentBid, currentLot.basePrice, DEFAULT_RULES);

        // Validate budget, squad size, overseas limits, and minimum squad reserve
        const validation = validateBid(team, currentLot, nextAmount, DEFAULT_RULES);
        if (!validation.isValid) {
          console.warn(`[SERVER BID REJECTED ${time}] Validation failed for ${team.shortName}: ${validation.reason}`);
          return safeRespond({ success: false, error: validation.reason || 'Invalid bid.' });
        }

        // Atomic bid registration
        const newBid: BidRecord = {
          id: `bid-mp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          playerId: currentLot.id,
          teamId: team.id,
          teamName: team.name,
          teamShortName: team.shortName,
          amount: nextAmount,
          timestamp: Date.now(),
          bidderType: 'multiplayer',
          bidderName: player.name
        };

        room.currentBid = nextAmount;
        room.highestBidderId = player.id;
        room.highestBidderTeamId = team.id;
        room.highestBidderName = player.name;
        room.bidHistory.unshift(newBid);

        // RESET COUNTDOWN TO EXACTLY 15 SECONDS!
        room.countdown = room.settings.timerSeconds || 15;
        room.auctioneerCall = `${player.name} (${team.shortName}) raises bid to ${formatCurrency(nextAmount)}! Timer reset to 15s.`;

        const sanitized = sanitizeRoom(room);
        console.log(`[SERVER BID ACCEPTED ${time}] ${player.name} (${team.shortName}) -> ${formatCurrency(nextAmount)} on Lot #${currentLot.id} (${currentLot.name})`);

        // Respond to the bidder FIRST so their Promise resolves before the room broadcast arrives
        safeRespond({ success: true, bid: newBid, room: sanitized });

        // Then broadcast the updated state to all other players in the room
        io.to(room.roomCode).emit('bid_placed', {
          bid: newBid,
          room: sanitized
        });
        io.to(room.roomCode).emit('room_updated', sanitized);
      } catch (err: any) {
        console.error(`[SERVER BID ERROR ${new Date().toISOString()}] Error in place_bid handler:`, err);
        safeRespond({ success: false, error: err?.message || 'Error processing bid.' });
      }
    });

    // 8. ADVANCE TO NEXT LOT (Host only - Skip Current Player)
    socket.on('next_lot', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<any>(...args);

      try {
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        if (!code || !pId) return callback({ success: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return callback({ success: false, error: 'Room not found.' });

        if (room.hostId !== pId) {
          return callback({ success: false, error: 'Only the host can advance lots.' });
        }

        const cur = room.playerPool[room.currentPlayerIndex];
        if (cur && cur.status !== 'sold' && room.currentBid === 0) {
          cur.status = 'unsold';
        }

        advanceRoomToNextLot(io, room);
        callback({ success: true });
      } catch (err: any) {
        console.error('Error in next_lot handler:', err);
        callback({ success: false, error: err?.message || 'Error advancing lot.' });
      }
    });

    // 8B. SKIP ENTIRE SET (Host only - Skip Remaining Players in Set)
    socket.on('skip_set', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<any>(...args);

      try {
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        if (!code || !pId) {
          return callback({ success: false, error: 'Not in a room.' });
        }
        const room = rooms.get(code);
        if (!room) {
          return callback({ success: false, error: 'Room not found.' });
        }

        if (room.hostId !== pId) {
          return callback({ success: false, error: 'Only the host can skip sets.' });
        }

        const currentLot = room.playerPool[room.currentPlayerIndex];
        if (!currentLot) {
          return callback({ success: false, error: 'No active lot.' });
        }
        const currentCategory = currentLot.category;

        // Mark current lot and all remaining players in this category as unsold (never sold)
        for (let i = room.currentPlayerIndex; i < room.playerPool.length; i++) {
          if (room.playerPool[i].category === currentCategory && room.playerPool[i].status === 'upcoming') {
            room.playerPool[i].status = 'unsold';
          }
        }
        if (room.playerPool[room.currentPlayerIndex].status !== 'sold') {
          room.playerPool[room.currentPlayerIndex].status = 'unsold';
        }

        // Find next player in a different set
        let nextIdx = room.currentPlayerIndex + 1;
        while (nextIdx < room.playerPool.length && (room.playerPool[nextIdx].category === currentCategory || room.playerPool[nextIdx].status !== 'upcoming')) {
          nextIdx++;
        }

        if (nextIdx < room.playerPool.length) {
          room.currentPlayerIndex = nextIdx;
          resetRoomLot(room, nextIdx);
          room.auctioneerCall = `Skipped remainder of ${currentCategory} set. Commencing Set: ${room.playerPool[nextIdx].category}!`;
          io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        } else {
          room.status = 'completed';
          if (room.timerInterval) clearInterval(room.timerInterval);
          io.to(room.roomCode).emit('auction_completed', sanitizeRoom(room));
        }

        callback({ success: true });
      } catch (err: any) {
        console.error('Error in skip_set handler:', err);
        callback({ success: false, error: err?.message || 'Error skipping set.' });
      }
    });

    // 9. PAUSE / RESUME AUCTION (Host only)
    socket.on('toggle_pause', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<any>(...args);

      try {
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        if (!code || !pId) return callback({ success: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return callback({ success: false, error: 'Room not found.' });

        if (room.hostId !== pId) {
          return callback({ success: false, error: 'Only the host can pause/resume.' });
        }

        room.isPaused = !room.isPaused;
        room.auctioneerCall = room.isPaused ? 'Auction paused by host.' : 'Auction resumed!';
        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        callback({ success: true });
      } catch (err: any) {
        console.error('Error in toggle_pause handler:', err);
        callback({ success: false, error: err?.message || 'Error toggling pause.' });
      }
    });

    // 10. RECONNECT / RECOVER STATE
    socket.on('reconnect_player', (...args: any[]) => {
      const { data, callback } = extractSocketPayload<any>(...args);

      try {
        const code = (data.roomCode || '').trim().toUpperCase();
        if (!code) return callback({ success: false, error: 'Room code missing.' });
        const room = rooms.get(code);
        if (!room) return callback({ success: false, error: 'Room not found.' });

        const player = room.players.find(p => p.id === data.playerId);
        if (!player) return callback({ success: false, error: 'Player identity not found in this room.' });

        player.socketId = socket.id;
        player.isConnected = true;
        currentRoomCode = code;
        currentPlayerId = data.playerId;

        socket.join(code);
        io.to(code).emit('room_updated', sanitizeRoom(room));
        callback({ success: true, room: sanitizeRoom(room) });
      } catch (err: any) {
        console.error('Error in reconnect_player handler:', err);
        callback({ success: false, error: err?.message || 'Failed to reconnect.' });
      }
    });

    // 11. DISCONNECT
    socket.on('disconnect', () => {
      try {
        if (currentRoomCode && currentPlayerId) {
          const room = rooms.get(currentRoomCode);
          if (room) {
            const player = room.players.find(p => p.id === currentPlayerId);
            if (player) {
              player.isConnected = false;
            }

            // If host disconnected and others are present, promote next connected player
            if (room.hostId === currentPlayerId) {
              const nextHost = room.players.find(p => p.isConnected && p.id !== currentPlayerId);
              if (nextHost) {
                nextHost.isHost = true;
                room.hostId = nextHost.id;
              }
            }

            io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));

            // Clean up empty room if no connected players left for 10 minutes
            const anyConnected = room.players.some(p => p.isConnected);
            if (!anyConnected) {
              if (room.timerInterval) clearInterval(room.timerInterval);
              setTimeout(() => {
                const checkRoom = rooms.get(currentRoomCode!);
                if (checkRoom && !checkRoom.players.some(p => p.isConnected)) {
                  rooms.delete(currentRoomCode!);
                }
              }, 600000);
            }
          }
        }
      } catch (err) {
        console.error('Error in disconnect handler:', err);
      }
    });
  });
}

function resetRoomLot(room: InternalRoomState, index: number) {
  const lot = room.playerPool[index];
  if (!lot) return;

  room.currentBid = 0;
  room.highestBidderId = null;
  room.highestBidderTeamId = null;
  room.highestBidderName = null;
  room.bidHistory = [];
  room.countdown = room.settings.timerSeconds || 15;
  room.lastResolvedLot = null;
  room.auctioneerCall = `Lot #${lot.id} • ${lot.name} is on the podium! 15s timer started. Base price: ${formatCurrency(lot.basePrice)}.`;
}

function startServerTimer(io: SocketIOServer, room: InternalRoomState) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }

  room.timerInterval = setInterval(() => {
    if (room.status !== 'auction' || room.isPaused) {
      return;
    }

    if (room.lastResolvedLot) {
      // Waiting for lot resolution overlay
      return;
    }

    if (room.countdown > 0) {
      room.countdown -= 1;

      // Broadcast timer tick to all players in the room
      io.to(room.roomCode).emit('timer_tick', {
        countdown: room.countdown,
        auctioneerCall: room.auctioneerCall
      });

      if (room.countdown === 0) {
        // Hammer falls! Resolve lot
        resolveRoomLot(io, room);
      }
    }
  }, 1000);
}

function resolveRoomLot(io: SocketIOServer, room: InternalRoomState) {
  const currentLot = room.playerPool[room.currentPlayerIndex];
  if (!currentLot) return;

  if (room.highestBidderTeamId && room.currentBid > 0) {
    // Player is SOLD to the winning human player's franchise
    const winningTeam = room.teams.find(t => t.id === room.highestBidderTeamId)!;
    const finalPrice = room.currentBid;

    const updatedTeam = updateTeamPurchasedPlayer(winningTeam, currentLot, finalPrice);
    room.teams = room.teams.map(t => t.id === winningTeam.id ? updatedTeam : t);
    room.playerPool[room.currentPlayerIndex] = {
      ...currentLot,
      status: 'sold',
      soldPrice: finalPrice,
      soldTo: winningTeam.id
    };

    room.lastResolvedLot = {
      type: 'sold',
      player: currentLot,
      winningTeam: updatedTeam,
      winningPlayerName: room.highestBidderName || undefined,
      price: finalPrice
    };

    room.auctioneerCall = `SOLD! ${currentLot.name} sold to ${winningTeam.name} (${room.highestBidderName}) for ${formatCurrency(finalPrice)}!`;
  } else {
    // Player is UNSOLD
    room.playerPool[room.currentPlayerIndex] = {
      ...currentLot,
      status: 'unsold'
    };

    room.lastResolvedLot = {
      type: 'unsold',
      player: currentLot
    };

    room.auctioneerCall = `${currentLot.name} received no bids and is UNSOLD!`;
  }

  io.to(room.roomCode).emit('lot_resolved', {
    resolvedLot: room.lastResolvedLot,
    room: sanitizeRoom(room)
  });
}

function advanceRoomToNextLot(io: SocketIOServer, room: InternalRoomState) {
  let nextIdx = room.currentPlayerIndex + 1;
  while (nextIdx < room.playerPool.length && room.playerPool[nextIdx].status !== 'upcoming') {
    nextIdx++;
  }

  if (nextIdx < room.playerPool.length) {
    room.currentPlayerIndex = nextIdx;
    resetRoomLot(room, nextIdx);
    io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
  } else {
    // Complete Auction
    room.status = 'completed';
    if (room.timerInterval) clearInterval(room.timerInterval);
    io.to(room.roomCode).emit('auction_completed', sanitizeRoom(room));
  }
}

// Remove internal timeout references before broadcasting
function sanitizeRoom(room: InternalRoomState): MultiplayerRoomState {
  const { timerInterval: _, ...sanitized } = room;
  return sanitized;
}
