const SessionModel = require('../models/SessionModel');
const ManagerModel = require('../models/ManagerModel');
const PlayerModel = require('../models/PlayerModel');
const BiddingLogModel = require('../models/BiddingLogModel');
const {
  MANAGER_COLORS,
  DEFAULT_CONFIG,
  getBaseBid,
  getBidIncrement,
  getSafetyBuffer,
} = require('../utils/constants');

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

class GameService {
  constructor() {
    this.session = null;
    this.timerInterval = null;
    this.emitState = null;
    this.emitAll = null;
    // In-memory map: socketId → { role, managerId, name }
    // Faster & more reliable than DB lookup for every admin action
    this.connectedSockets = new Map();
  }

  setEmitter(emitFn) {
    this.emitState = emitFn;
  }

  setAllEmitter(emitAllFn) {
    this.emitAll = emitAllFn;
  }

  registerSocket(socketId, role, managerId, name) {
    this.connectedSockets.set(socketId, { role, managerId, name });
  }

  removeSocket(socketId) {
    this.connectedSockets.delete(socketId);
  }

  getSocketInfo(socketId) {
    return this.connectedSockets.get(socketId) || null;
  }

  isAdmin(socketId) {
    const info = this.connectedSockets.get(socketId);
    return info?.role === 'admin';
  }

  async initialize() {
    this.session = await SessionModel.getOrCreateActiveSession();

    // Auto-resume timer if server restarted mid-auction
    if (['phase1', 'phase2'].includes(this.session.phase) && this.session.current_player_id) {
      console.log('Resuming active auction from database...');
      this.startTimer();
    }
  }

  formatPlayer(row) {
    if (!row) return null;
    return {
      id: row.id,
      Name: row.name,
      Rating: row.rating,
      Position: row.position,
      RoleGroup: row.role_group,
      AltPositions: parseJson(row.alt_positions, []),
      Playstyles: parseJson(row.playstyles, []),
      Pac: row.pac,
      Sho: row.sho,
      Pas: row.pas,
      Dri: row.dri,
      Def: row.def,
      Phy: row.phy,
      status: row.status,
      pool_type: row.pool_type,
    };
  }

  async buildState() {
    const session = this.session;
    const config = parseJson(session.config, DEFAULT_CONFIG);

    const managerRows = await ManagerModel.findBySession(session.id);
    const managers = {};

    for (const mgr of managerRows) {
      const squadRows = await ManagerModel.getSquad(mgr.id);
      managers[mgr.socket_id] = {
        id: mgr.id,
        name: mgr.name,
        budget: mgr.budget,
        color: mgr.color,
        role: mgr.role,
        hasSuperPower: Boolean(mgr.has_super_power),
        squad: squadRows.map((p) => ({
          ...this.formatPlayer(p),
          finalPrice: p.final_price,
        })),
      };
    }

    const allPlayers = await PlayerModel.findBySession(session.id);
    const playerPool = allPlayers.filter((p) => p.pool_type === 'main').map(this.formatPlayer.bind(this));
    const unsoldPool = allPlayers.filter((p) => p.pool_type === 'unsold').map(this.formatPlayer.bind(this));

    let currentPlayer = null;
    if (session.current_player_id) {
      const row = await PlayerModel.findById(session.current_player_id);
      currentPlayer = this.formatPlayer(row);
    }

    const biddingHistory = await BiddingLogModel.findBySession(session.id);

    let highestBidderId = null;
    if (session.highest_bidder_id) {
      const bidder = managerRows.find((m) => m.id === session.highest_bidder_id);
      highestBidderId = bidder ? bidder.socket_id : null;
    }

    const lastAuctionAction = parseJson(session.last_auction_action, null);

    const totalPlayers = allPlayers.length;

    return {
      sessionId: session.id,
      phase: session.phase,
      config,
      playersUploaded: Boolean(session.players_uploaded) || totalPlayers > 0,
      playerCounts: {
        GK: allPlayers.filter((p) => p.pool_type === 'main' && p.role_group === 'GK' && !p.status).length,
        DF: allPlayers.filter((p) => p.pool_type === 'main' && p.role_group === 'DF' && !p.status).length,
        CM: allPlayers.filter((p) => p.pool_type === 'main' && p.role_group === 'CM' && !p.status).length,
        ST: allPlayers.filter((p) => p.pool_type === 'main' && p.role_group === 'ST' && !p.status).length,
        total: allPlayers.filter((p) => p.pool_type === 'main').length,
      },
      managers,
      playerPool,
      unsoldPool,
      currentPlayer,
      currentBid: session.current_bid,
      highestBidderId,
      timerValue: session.timer_value,
      biddingHistory,
      lastAuctionAction,
    };
  }

  async broadcastState() {
    if (!this.emitState) return;
    const state = await this.buildState();
    this.emitState(state);
  }

  clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startTimer() {
    this.clearTimer();
    this.timerInterval = setInterval(async () => {
      if (!['phase1', 'phase2'].includes(this.session.phase)) return;
      if (!this.session.current_player_id || this.session.timer_value <= 0) return;

      this.session.timer_value -= 1;
      await SessionModel.updateSession(this.session.id, { timer_value: this.session.timer_value });
      await this.broadcastState();

      if (this.session.timer_value === 0) {
        this.clearTimer();
        await this.hammerDown();
      }
    }, 1000);
  }

  async hammerDown() {
    if (!this.session.current_player_id) return;

    const player = await PlayerModel.findById(this.session.current_player_id);

    if (this.session.highest_bidder_id && this.session.current_bid > 0) {
      const managerRows = await ManagerModel.findBySession(this.session.id);
      const winner = managerRows.find((m) => m.id === this.session.highest_bidder_id);

      await ManagerModel.update(winner.id, { budget: winner.budget - this.session.current_bid });
      await ManagerModel.addSquadPlayer(winner.id, player.id, this.session.current_bid);
      await PlayerModel.update(player.id, { status: 'sold' });

      const lastAuctionAction = {
        status: 'sold',
        player: this.formatPlayer(player),
        managerId: winner.id,
        managerSocketId: winner.socket_id,
        price: this.session.current_bid,
      };

      await SessionModel.updateSession(this.session.id, {
        last_auction_action: JSON.stringify(lastAuctionAction),
      });
      await BiddingLogModel.add(
        this.session.id,
        `🔨 SOLD! ${player.name} to ${winner.name} for ${this.session.current_bid}c!`,
        '#F59E0B'
      );
    } else {
      await PlayerModel.moveToUnsold(player.id);
      const lastAuctionAction = { status: 'skipped', player: this.formatPlayer(player) };
      await SessionModel.updateSession(this.session.id, {
        last_auction_action: JSON.stringify(lastAuctionAction),
      });
      await BiddingLogModel.add(
        this.session.id,
        `❌ ${player.name} went unsold and was skipped.`,
        '#9CA3AF'
      );
    }

    this.session = await SessionModel.updateSession(this.session.id, {
      current_player_id: null,
      current_bid: 0,
      highest_bidder_id: null,
      timer_value: 0,
    });

    await this.broadcastState();
  }

  // ─── Reconnect ──────────────────────────────────────────────────────────────

  async reconnectSession(socketId, token) {
    if (!token) return null;

    const manager = await ManagerModel.findByToken(this.session.id, token);
    if (!manager) return null;

    // Update socket_id to the new connection
    await ManagerModel.update(manager.id, { socket_id: socketId });

    // Register in memory map so admin actions work immediately
    this.registerSocket(socketId, manager.role, manager.id, manager.name);

    return { role: manager.role, name: manager.name };
  }

  // ─── Register ───────────────────────────────────────────────────────────────

  async registerManager(socketId, name, token) {
    // If token already in DB → restore session (reconnect via lobby)
    if (token) {
      const existing = await ManagerModel.findByToken(this.session.id, token);
      if (existing) {
        await ManagerModel.update(existing.id, { socket_id: socketId });
        await this.broadcastState();
        return { role: existing.role, name: existing.name };
      }
    }

    const managers = await ManagerModel.findBySession(this.session.id);
    if (managers.length >= 10) throw new Error('Roster is full! Max 10 managers.');

    const config = parseJson(this.session.config, DEFAULT_CONFIG);

    // First manager to register becomes admin automatically
    const adminCount = await ManagerModel.countAdmins(this.session.id);
    const role = adminCount === 0 ? 'admin' : 'manager';

    const created = await ManagerModel.create({
      sessionId: this.session.id,
      socketId,
      clientToken: token || null,
      name,
      budget: config.purse,
      color: MANAGER_COLORS[managers.length % MANAGER_COLORS.length],
      role,
      hasSuperPower: config.superPowerEnabled,
    });

    // Register in memory map immediately
    this.registerSocket(socketId, created.role, created.id, created.name);

    await BiddingLogModel.add(
      this.session.id,
      `👋 ${name} joined as ${role === 'admin' ? '👑 Admin' : 'Manager'}.`,
      role === 'admin' ? '#F59E0B' : '#10B981'
    );

    await this.broadcastState();
    return { role: created.role, name: created.name };
  }

  // ─── Upload Players (admin only, separate from game init) ───────────────────

  async uploadPlayers(socketId, players) {
    if (!this.isAdmin(socketId)) {
      throw new Error('Only admins can upload the player database.');
    }

    // Clear and re-insert so re-upload always refreshes
    await PlayerModel.deleteBySession(this.session.id);
    await PlayerModel.bulkInsert(this.session.id, players, 'main');

    this.session = await SessionModel.updateSession(this.session.id, { players_uploaded: 1 });

    await BiddingLogModel.add(
      this.session.id,
      `📋 Player database loaded: ${players.length} players ready for auction.`,
      '#3B82F6'
    );

    await this.broadcastState();
  }

  // ─── Init Game (config only — players already in DB) ────────────────────────

  async initGame(socketId, config) {
    if (!this.isAdmin(socketId)) {
      throw new Error('Only admins can launch the auction.');
    }

    if (!this.session.players_uploaded) {
      throw new Error('Upload the player database before launching the auction.');
    }

    // Reset all main-pool player statuses (don't delete — they're persisted)
    await PlayerModel.resetMainPoolStatuses(this.session.id);

    this.session = await SessionModel.updateSession(this.session.id, {
      phase: 'phase1',
      config: JSON.stringify(config),
      current_player_id: null,
      current_bid: 0,
      highest_bidder_id: null,
      timer_value: 0,
      last_auction_action: null,
    });

    // Reset all manager budgets and squads
    await ManagerModel.clearSquadsForSession(this.session.id);
    const managers = await ManagerModel.findBySession(this.session.id);
    for (const mgr of managers) {
      await ManagerModel.update(mgr.id, {
        budget: config.purse,
        has_super_power: config.superPowerEnabled ? 1 : 0,
      });
    }

    await BiddingLogModel.clear(this.session.id);
    await BiddingLogModel.add(this.session.id, '🚀 Phase 1 Auction is Live!', '#3B82F6');
    await this.broadcastState();
  }

  // ─── Grant Admin ────────────────────────────────────────────────────────────

  async grantAdmin(adminSocketId, targetManagerId) {
    if (!this.isAdmin(adminSocketId)) {
      throw new Error('Only admins can grant admin access.');
    }

    const target = await ManagerModel.update(targetManagerId, { role: 'admin' });

    // Update in-memory map for the target manager if they're connected
    for (const [sid, info] of this.connectedSockets) {
      if (info.managerId === targetManagerId) {
        this.connectedSockets.set(sid, { ...info, role: 'admin' });
        break;
      }
    }

    const adminInfo = this.getSocketInfo(adminSocketId);
    await BiddingLogModel.add(
      this.session.id,
      `👑 ${adminInfo?.name || 'Admin'} granted admin access to ${target.name}.`,
      '#F59E0B'
    );

    await this.broadcastState();
  }

  // ─── Bid Actions ────────────────────────────────────────────────────────────

  async drawPlayer(socketId, role) {
    if (!this.isAdmin(socketId)) throw new Error('Only admins can draw players.');

    this.clearTimer();

    const poolType = this.session.phase === 'phase2' ? 'unsold' : 'main';
    const players = await PlayerModel.findBySession(this.session.id, poolType);
    const available = players.filter((p) => p.role_group === role && !p.status);

    if (available.length === 0) {
      throw new Error(`No remaining players found for ${role} in this phase!`);
    }

    const selected = available[Math.floor(Math.random() * available.length)];
    const config = parseJson(this.session.config, DEFAULT_CONFIG);

    await PlayerModel.update(selected.id, { status: 'drawn' });
    await BiddingLogModel.clear(this.session.id);

    this.session = await SessionModel.updateSession(this.session.id, {
      current_player_id: selected.id,
      current_bid: getBaseBid(selected.rating),
      highest_bidder_id: null,
      timer_value: config.timerDuration,
    });

    await BiddingLogModel.add(
      this.session.id,
      `🎯 Drawn: ${selected.name} (${selected.rating} OVR) - Base: ${this.session.current_bid}c`,
      '#FFFFFF'
    );

    await this.broadcastState();
    this.startTimer();
  }

  async placeBid(socketId) {
    const manager = await ManagerModel.findBySocketId(this.session.id, socketId);
    if (!manager || !this.session.current_player_id) return;
    if (manager.id === this.session.highest_bidder_id) return;

    const config = parseJson(this.session.config, DEFAULT_CONFIG);
    const squad = await ManagerModel.getSquad(manager.id);

    if (squad.length >= config.maxPlayers) throw new Error('Hard squad cap reached!');

    const increment = getBidIncrement(this.session.current_bid);
    const nextBidValue = this.session.current_bid + increment;
    const safetyBuffer = getSafetyBuffer(squad.length);

    if (manager.budget - nextBidValue < safetyBuffer) {
      throw new Error(
        `Bid blocked! You must save at least ${safetyBuffer}c to draft a minimum squad of 15 players.`
      );
    }

    this.session = await SessionModel.updateSession(this.session.id, {
      current_bid: nextBidValue,
      highest_bidder_id: manager.id,
      timer_value: config.timerDuration,
    });

    await BiddingLogModel.add(
      this.session.id,
      `🔥 ${manager.name} bid ${nextBidValue}c`,
      manager.color
    );

    await this.broadcastState();
  }

  async forceHammer() {
    this.clearTimer();
    await this.hammerDown();
  }

  async triggerRebid() {
    const action = parseJson(this.session.last_auction_action, null);
    if (!action || action.used) return;

    action.used = true;
    const config = parseJson(this.session.config, DEFAULT_CONFIG);

    if (action.status === 'sold') {
      const managerRows = await ManagerModel.findBySession(this.session.id);
      const winner = managerRows.find((m) => m.id === action.managerId);
      const player = await PlayerModel.findById(action.player.id);

      await ManagerModel.update(winner.id, { budget: winner.budget + action.price });
      await ManagerModel.removeSquadPlayer(winner.id, player.id);
      await PlayerModel.update(player.id, { status: 'drawn' });

      this.session = await SessionModel.updateSession(this.session.id, {
        current_player_id: player.id,
        current_bid: action.price,
        highest_bidder_id: winner.id,
        timer_value: config.timerDuration,
        last_auction_action: JSON.stringify(action),
      });
    } else {
      const player = await PlayerModel.findById(action.player.id);
      await PlayerModel.update(player.id, { status: 'drawn' });

      this.session = await SessionModel.updateSession(this.session.id, {
        current_player_id: player.id,
        current_bid: getBaseBid(player.rating),
        highest_bidder_id: null,
        timer_value: config.timerDuration,
        last_auction_action: JSON.stringify(action),
      });
    }

    await BiddingLogModel.add(
      this.session.id,
      `🔄 Admin triggered Rebid for ${action.player.Name}!`,
      '#3B82F6'
    );

    await this.broadcastState();
    this.startTimer();
  }

  async useSuperPower(socketId, playerName) {
    const manager = await ManagerModel.findBySocketId(this.session.id, socketId);
    if (!manager || !manager.has_super_power || this.session.current_player_id) return;

    const squad = await ManagerModel.getSquad(manager.id);
    const target = squad.find((p) => p.name === playerName);
    if (!target) return;

    const config = parseJson(this.session.config, DEFAULT_CONFIG);

    await ManagerModel.update(manager.id, {
      budget: manager.budget + target.final_price,
      has_super_power: 0,
    });
    await ManagerModel.removeSquadPlayer(manager.id, target.id);
    await PlayerModel.update(target.id, { status: 'drawn', pool_type: 'main' });
    await BiddingLogModel.clear(this.session.id);

    this.session = await SessionModel.updateSession(this.session.id, {
      current_player_id: target.id,
      current_bid: getBaseBid(target.rating),
      highest_bidder_id: null,
      timer_value: config.timerDuration,
    });

    await BiddingLogModel.add(
      this.session.id,
      `⚡ SUPER POWER! ${manager.name} dropped ${target.name}. Re-auction starting now!`,
      '#8B5CF6'
    );

    await this.broadcastState();
    this.startTimer();
  }

  async endPhase1(socketId) {
    if (!this.isAdmin(socketId)) throw new Error('Only admins can end phases.');

    this.clearTimer();
    await PlayerModel.clearMainPool(this.session.id);

    this.session = await SessionModel.updateSession(this.session.id, {
      phase: 'phase2-prompt',
      current_player_id: null,
      current_bid: 0,
      highest_bidder_id: null,
      timer_value: 0,
    });

    await this.broadcastState();
  }

  async phase2Decision(socketId, agreed) {
    if (!this.isAdmin(socketId)) throw new Error('Only admins can decide on Phase 2.');

    if (agreed) {
      await PlayerModel.resetUnsoldStatuses(this.session.id);
      await BiddingLogModel.clear(this.session.id);
      await BiddingLogModel.add(
        this.session.id,
        '🏁 Phase 2 Activated: Bidding on Unsold Pools Only!',
        '#10B981'
      );
      this.session = await SessionModel.updateSession(this.session.id, { phase: 'phase2' });
    } else {
      await BiddingLogModel.add(this.session.id, '🛑 Auction terminated by Host.', '#EF4444');
      this.session = await SessionModel.updateSession(this.session.id, { phase: 'finished' });
    }

    await this.broadcastState();
  }

  async restartGame() {
    this.clearTimer();
    this.connectedSockets.clear(); // All roles revoked — everyone must re-register
    this.session = await SessionModel.resetSession(this.session.id);
    // Tell every client to clear their saved session and return to lobby
    if (this.emitAll) this.emitAll('game-wiped');
    await this.broadcastState();
  }
}

module.exports = new GameService();
