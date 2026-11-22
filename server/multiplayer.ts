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

export function setupMultiplayerSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    // 1. CREATE AUCTION ROOM
    socket.on('create_room', (data: { hostName: string }, callback?: (res: { success: boolean; room?: MultiplayerRoomState; error?: string }) => void) => {
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
        if (typeof callback === 'function') {
          callback(response);
        }
        socket.emit('room_created', response);
      } catch (err: any) {
        const errorResponse = { success: false, error: err?.message || 'Failed to create room' };
        if (typeof callback === 'function') {
          callback(errorResponse);
        }
        socket.emit('room_created', errorResponse);
      }
    });

    // 2. JOIN AUCTION ROOM
    socket.on('join_room', (data: { roomCode: string; playerName: string }, callback?: (res: { success: boolean; room?: MultiplayerRoomState; playerId?: string; error?: string }) => void) => {
      try {
        const code = (data?.roomCode || '').trim().toUpperCase();
        const playerName = (data?.playerName || 'Player').trim().slice(0, 24);

        const room = rooms.get(code);
        if (!room) {
          const errorResponse = { success: false, error: `Room code "${code}" not found.` };
          if (typeof callback === 'function') callback(errorResponse);
          socket.emit('room_joined', errorResponse);
          return;
        }

        if (room.players.length >= 10) {
          const errorResponse = { success: false, error: 'Room is full (max 10 human managers).' };
          if (typeof callback === 'function') callback(errorResponse);
          socket.emit('room_joined', errorResponse);
          return;
        }

        if (room.status === 'auction' || room.status === 'completed') {
          const errorResponse = { success: false, error: 'Auction has already started in this room.' };
          if (typeof callback === 'function') callback(errorResponse);
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
        if (typeof callback === 'function') callback(response);
        socket.emit('room_joined', response);
      } catch (err: any) {
        const errorResponse = { success: false, error: err?.message || 'Failed to join room' };
        if (typeof callback === 'function') callback(errorResponse);
        socket.emit('room_joined', errorResponse);
      }
    });

    // 3. CLAIM TEAM (Atomic real-time team claiming)
    socket.on('claim_team', (data: { teamId: string }, callback?: (res: { success: boolean; teamId?: string; teamName?: string; error?: string }) => void) => {
      try {
        if (!currentRoomCode || !currentPlayerId) {
          const errRes = { success: false, error: 'Not connected to an active room.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const room = rooms.get(currentRoomCode);
        if (!room) {
          const errRes = { success: false, error: 'Auction room not found.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        if (room.status !== 'waiting' && room.status !== 'ready') {
          const errRes = { success: false, error: 'Team claiming is only permitted in the lobby.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) {
          const errRes = { success: false, error: 'Player identity not found in room roster.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const targetTeamId = (data?.teamId || '').trim();
        const targetTeam = room.teams.find(t => t.id === targetTeamId);
        if (!targetTeam) {
          const errRes = { success: false, error: `Invalid franchise ID "${targetTeamId}".` };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        // Prevent claiming if player already holds another team
        if (player.teamId && player.teamId !== targetTeamId) {
          const currentTeam = room.teams.find(t => t.id === player.teamId);
          const errRes = {
            success: false,
            error: `You already hold ${currentTeam?.name || player.teamId}. Please release it before claiming another franchise.`
          };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        // Atomic check: Is target team already claimed by another player?
        const existingClaimant = room.players.find(p => p.teamId === targetTeamId && p.id !== currentPlayerId);
        if (existingClaimant || (targetTeam.isHumanControlled && targetTeam.ownerName && targetTeam.ownerName !== player.name)) {
          const owner = existingClaimant ? existingClaimant.name : (targetTeam.ownerName || 'another manager');
          const errRes = {
            success: false,
            error: `${targetTeam.name} (${targetTeam.shortName}) is already claimed by ${owner}.`
          };
          if (typeof callback === 'function') callback(errRes);
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

        const successRes = { success: true, teamId: targetTeamId, teamName: targetTeam.name };
        if (typeof callback === 'function') callback(successRes);
      } catch (err: any) {
        const errRes = { success: false, error: err?.message || 'Server error while claiming team.' };
        if (typeof callback === 'function') callback(errRes);
      }
    });

    // 3B. RELEASE TEAM (Allow player to unclaim/release their franchise)
    socket.on('release_team', (callback?: (res: { success: boolean; releasedTeamId?: string; error?: string }) => void) => {
      try {
        if (!currentRoomCode || !currentPlayerId) {
          const errRes = { success: false, error: 'Not connected to an active room.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const room = rooms.get(currentRoomCode);
        if (!room) {
          const errRes = { success: false, error: 'Auction room not found.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        if (room.status !== 'waiting' && room.status !== 'ready') {
          const errRes = { success: false, error: 'Cannot release franchise while auction is in progress.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) {
          const errRes = { success: false, error: 'Player identity not found.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        if (!player.teamId) {
          const errRes = { success: false, error: 'You do not currently hold any franchise.' };
          if (typeof callback === 'function') callback(errRes);
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
          teamId: releasedTeamId
        });

        const successRes = { success: true, releasedTeamId };
        if (typeof callback === 'function') callback(successRes);
      } catch (err: any) {
        const errRes = { success: false, error: err?.message || 'Server error while releasing team.' };
        if (typeof callback === 'function') callback(errRes);
      }
    });

    // 3C. SELECT TEAM (Backwards-compatibility wrapper for select_team)
    socket.on('select_team', (data: { teamId: string | null }, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!currentRoomCode || !currentPlayerId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Not in a room.' });
        return;
      }
      const room = rooms.get(currentRoomCode);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found.' });
        return;
      }

      const player = room.players.find(p => p.id === currentPlayerId);
      if (!player) {
        if (typeof callback === 'function') callback({ success: false, error: 'Player not found in room.' });
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
        if (typeof callback === 'function') callback({ success: true });
        return;
      }

      // Check if team is already claimed by someone else
      const existingClaim = room.players.find(p => p.teamId === targetTeamId && p.id !== currentPlayerId);
      if (existingClaim) {
        if (typeof callback === 'function') callback({ success: false, error: `Team already selected by ${existingClaim.name}.` });
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
      if (typeof callback === 'function') callback({ success: true });
    });

    // 3D. LEAVE ROOM (Clean player departure & team release)
    socket.on('leave_room', (callback?: (res: { success: boolean }) => void) => {
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
        if (typeof callback === 'function') callback({ success: true });
      } catch {
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    // 4. TOGGLE READY
    socket.on('toggle_ready', (callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        if (!currentRoomCode || !currentPlayerId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Not in a room.' });
          return;
        }
        const room = rooms.get(currentRoomCode);
        if (!room) {
          if (typeof callback === 'function') callback({ success: false, error: 'Room not found.' });
          return;
        }

        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) {
          if (typeof callback === 'function') callback({ success: false, error: 'Player not found.' });
          return;
        }

        if (!player.teamId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Please select an IPL team first.' });
          return;
        }

        player.isReady = !player.isReady;
        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        if (typeof callback === 'function') callback({ success: true });
      } catch (err: any) {
        if (typeof callback === 'function') callback({ success: false, error: err?.message || 'Error updating ready state.' });
      }
    });

    // 5. UPDATE SETTINGS (Host only)
    socket.on('update_settings', (data: Partial<MultiplayerRoomSettings>, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        if (!currentRoomCode || !currentPlayerId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Not in a room.' });
          return;
        }
        const room = rooms.get(currentRoomCode);
        if (!room) {
          if (typeof callback === 'function') callback({ success: false, error: 'Room not found.' });
          return;
        }

        if (room.hostId !== currentPlayerId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Only the host can modify room settings.' });
          return;
        }

        room.settings = { ...room.settings, ...data };
        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        if (typeof callback === 'function') callback({ success: true });
      } catch (err: any) {
        if (typeof callback === 'function') callback({ success: false, error: err?.message || 'Error updating settings.' });
      }
    });

    // 6. START AUCTION (Host only - Allows single player or multiplayer)
    socket.on('start_auction', (callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        if (!currentRoomCode || !currentPlayerId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Not in a room.' });
          return;
        }
        const room = rooms.get(currentRoomCode);
        if (!room) {
          if (typeof callback === 'function') callback({ success: false, error: 'Room not found.' });
          return;
        }

        if (room.hostId !== currentPlayerId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Only the host can start the auction.' });
          return;
        }

        // Check min players requirement: Allow starting with 1 player (single player mode)
        if (room.players.length < 1) {
          if (typeof callback === 'function') callback({ success: false, error: 'Need at least 1 player to start.' });
          return;
        }

        // Check all joined players have chosen a team
        const unassigned = room.players.filter(p => !p.teamId);
        if (unassigned.length > 0) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: `All players must select an IPL franchise before starting (${unassigned[0].name} has no team).`
            });
          }
          return;
        }

        // Verify host has claimed a team
        const host = room.players.find(p => p.id === room.hostId);
        if (!host || !host.teamId) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: 'You must claim an IPL franchise before starting the auction.'
            });
          }
          return;
        }

        room.status = 'auction';
        room.currentPlayerIndex = 0;
        resetRoomLot(room, 0);

        startServerTimer(io, room);

        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        if (typeof callback === 'function') callback({ success: true });
      } catch (err: any) {
        console.error('Error starting auction:', err);
        if (typeof callback === 'function') callback({ success: false, error: err?.message || 'Error starting auction.' });
      }
    });

    // 7. PLACE BID (Authoritative Server Validation & Real-Time Opponent Synchronization)
    socket.on('place_bid', (dataOrCallback?: any, maybeCallback?: any) => {
      const data = typeof dataOrCallback === 'object' && dataOrCallback !== null ? dataOrCallback : {};
      const callback = typeof dataOrCallback === 'function'
        ? dataOrCallback
        : (typeof maybeCallback === 'function' ? maybeCallback : () => {});

      const safeCallback = (res: any) => {
        if (typeof callback === 'function') {
          try {
            callback(res);
          } catch (e) {
            console.error('Error invoking place_bid callback:', e);
          }
        }
      };

      try {
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        if (!code) {
          return safeCallback({ success: false, error: 'Not connected to an active room.' });
        }

        const room = rooms.get(code);
        if (!room) {
          return safeCallback({ success: false, error: `Auction room "${code}" not found.` });
        }

        // Re-bind socket room and session context
        currentRoomCode = code;
        socket.join(code);
        if (pId) {
          currentPlayerId = pId;
        }

        if (room.status !== 'auction') {
          return safeCallback({ success: false, error: 'Auction is not currently in progress.' });
        }

        if (room.isPaused) {
          return safeCallback({ success: false, error: 'Auction is currently paused by host.' });
        }

        if (room.countdown <= 0) {
          return safeCallback({ success: false, error: 'Bidding window has expired.' });
        }

        // Find player by ID, team, or socket ID
        let player = room.players.find(p => p.id === pId);
        if (!player && data.teamId) {
          player = room.players.find(p => p.teamId === data.teamId);
        }
        if (!player) {
          player = room.players.find(p => p.socketId === socket.id);
        }

        if (!player || !player.teamId) {
          return safeCallback({ success: false, error: 'You do not own an assigned franchise in this room.' });
        }

        // Keep player connection synchronized
        player.socketId = socket.id;
        player.isConnected = true;
        currentPlayerId = player.id;

        const team = room.teams.find(t => t.id === player.teamId);
        if (!team) {
          return safeCallback({ success: false, error: 'Franchise not found in room roster.' });
        }

        const currentLot = room.playerPool[room.currentPlayerIndex];
        if (!currentLot) {
          return safeCallback({ success: false, error: 'No active player lot.' });
        }

        // Cannot bid if already holding highest bid
        if (room.highestBidderId === player.id || (room.highestBidderTeamId && room.highestBidderTeamId === team.id)) {
          return safeCallback({ success: false, error: 'You already hold the highest bid!' });
        }

        // Compute next bid amount authoritatively
        const nextAmount = room.currentBid === 0
          ? currentLot.basePrice
          : getNextBidAmount(room.currentBid, currentLot.basePrice, DEFAULT_RULES);

        // Validate budget, squad size, overseas limits, and minimum squad reserve
        const validation = validateBid(team, currentLot, nextAmount, DEFAULT_RULES);
        if (!validation.isValid) {
          return safeCallback({ success: false, error: validation.reason || 'Invalid bid.' });
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
        io.to(room.roomCode).emit('bid_placed', {
          bid: newBid,
          room: sanitized
        });
        io.to(room.roomCode).emit('room_updated', sanitized);

        safeCallback({ success: true, bid: newBid, room: sanitized });
      } catch (err: any) {
        console.error('Error in place_bid handler:', err);
        safeCallback({ success: false, error: err?.message || 'Error processing bid.' });
      }
    });

    // 8. ADVANCE TO NEXT LOT (Host only - Skip Current Player)
    socket.on('next_lot', (dataOrCallback?: any, maybeCallback?: any) => {
      const data = typeof dataOrCallback === 'object' && dataOrCallback !== null ? dataOrCallback : {};
      const callback = typeof dataOrCallback === 'function'
        ? dataOrCallback
        : (typeof maybeCallback === 'function' ? maybeCallback : () => {});

      const safeCallback = (res: any) => {
        if (typeof callback === 'function') {
          try { callback(res); } catch (e) { console.error('Error in next_lot callback:', e); }
        }
      };

      try {
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        if (!code || !pId) return safeCallback({ success: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return safeCallback({ success: false, error: 'Room not found.' });

        if (room.hostId !== pId) {
          return safeCallback({ success: false, error: 'Only the host can advance lots.' });
        }

        const cur = room.playerPool[room.currentPlayerIndex];
        if (cur && cur.status !== 'sold' && room.currentBid === 0) {
          cur.status = 'unsold';
        }

        advanceRoomToNextLot(io, room);
        safeCallback({ success: true });
      } catch (err: any) {
        console.error('Error in next_lot handler:', err);
        safeCallback({ success: false, error: err?.message || 'Error advancing lot.' });
      }
    });

    // 8B. SKIP ENTIRE SET (Host only - Skip Remaining Players in Set)
    socket.on('skip_set', (dataOrCallback?: any, maybeCallback?: any) => {
      const data = typeof dataOrCallback === 'object' && dataOrCallback !== null ? dataOrCallback : {};
      const callback = typeof dataOrCallback === 'function'
        ? dataOrCallback
        : (typeof maybeCallback === 'function' ? maybeCallback : () => {});

      const safeCallback = (res: any) => {
        if (typeof callback === 'function') {
          try { callback(res); } catch (e) { console.error('Error in skip_set callback:', e); }
        }
      };

      try {
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        if (!code || !pId) {
          return safeCallback({ success: false, error: 'Not in a room.' });
        }
        const room = rooms.get(code);
        if (!room) {
          return safeCallback({ success: false, error: 'Room not found.' });
        }

        if (room.hostId !== pId) {
          return safeCallback({ success: false, error: 'Only the host can skip sets.' });
        }

        const currentLot = room.playerPool[room.currentPlayerIndex];
        if (!currentLot) {
          return safeCallback({ success: false, error: 'No active lot.' });
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

        safeCallback({ success: true });
      } catch (err: any) {
        console.error('Error in skip_set handler:', err);
        safeCallback({ success: false, error: err?.message || 'Error skipping set.' });
      }
    });

    // 9. PAUSE / RESUME AUCTION (Host only)
    socket.on('toggle_pause', (dataOrCallback?: any, maybeCallback?: any) => {
      const data = typeof dataOrCallback === 'object' && dataOrCallback !== null ? dataOrCallback : {};
      const callback = typeof dataOrCallback === 'function'
        ? dataOrCallback
        : (typeof maybeCallback === 'function' ? maybeCallback : () => {});

      const safeCallback = (res: any) => {
        if (typeof callback === 'function') {
          try { callback(res); } catch (e) { console.error('Error in toggle_pause callback:', e); }
        }
      };

      try {
        const code = (data.roomCode || currentRoomCode || '').trim().toUpperCase();
        const pId = data.playerId || currentPlayerId;

        if (!code || !pId) return safeCallback({ success: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return safeCallback({ success: false, error: 'Room not found.' });

        if (room.hostId !== pId) {
          return safeCallback({ success: false, error: 'Only the host can pause/resume.' });
        }

        room.isPaused = !room.isPaused;
        room.auctioneerCall = room.isPaused ? 'Auction paused by host.' : 'Auction resumed!';
        io.to(room.roomCode).emit('room_updated', sanitizeRoom(room));
        safeCallback({ success: true });
      } catch (err: any) {
        console.error('Error in toggle_pause handler:', err);
        safeCallback({ success: false, error: err?.message || 'Error toggling pause.' });
      }
    });

    // 10. RECONNECT / RECOVER STATE
    socket.on('reconnect_player', (dataOrCallback?: any, maybeCallback?: any) => {
      const data = typeof dataOrCallback === 'object' && dataOrCallback !== null ? dataOrCallback : {};
      const callback = typeof dataOrCallback === 'function'
        ? dataOrCallback
        : (typeof maybeCallback === 'function' ? maybeCallback : () => {});

      const safeCallback = (res: any) => {
        if (typeof callback === 'function') {
          try {
            callback(res);
          } catch (e) {
            console.error('Error invoking reconnect_player callback:', e);
          }
        }
      };

      try {
        const code = (data.roomCode || '').trim().toUpperCase();
        if (!code) return safeCallback({ success: false, error: 'Room code missing.' });
        const room = rooms.get(code);
        if (!room) return safeCallback({ success: false, error: 'Room not found.' });

        const player = room.players.find(p => p.id === data.playerId);
        if (!player) return safeCallback({ success: false, error: 'Player identity not found in this room.' });

        player.socketId = socket.id;
        player.isConnected = true;
        currentRoomCode = code;
        currentPlayerId = data.playerId;

        socket.join(code);
        io.to(code).emit('room_updated', sanitizeRoom(room));
        safeCallback({ success: true, room: sanitizeRoom(room) });
      } catch (err: any) {
        console.error('Error in reconnect_player handler:', err);
        safeCallback({ success: false, error: err?.message || 'Failed to reconnect.' });
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
