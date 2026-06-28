module.exports.MANAGER_COLORS = [
  '#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6',
  '#EC4899', '#6366F1', '#F97316', '#14B8A6', '#06B6D4',
];

module.exports.DEFAULT_CONFIG = {
  purse: 10000,
  timerDuration: 15,
  maxPlayers: 20,
  superPowerEnabled: true,
  minRatings: { GK: 87, DF: 84, CM: 84, ST: 85 },
};

module.exports.getBaseBid = (rating) => (rating >= 91 ? 500 : 100);

module.exports.getBidIncrement = (currentBid) => (currentBid < 1000 ? 50 : 100);

module.exports.getSafetyBuffer = (squadLength) => {
  const requiredRemainingSlots = Math.max(0, 15 - (squadLength + 1));
  return requiredRemainingSlots * 100;
};

module.exports.mapRoleGroup = (rawPos) => {
  const pos = String(rawPos || 'CM').toUpperCase();
  if (pos.includes('GK')) return 'GK';
  if (pos.includes('CB') || pos.includes('LB') || pos.includes('RB') || pos.includes('LWB') || pos.includes('RWB') || pos.includes('DF')) return 'DF';
  if (pos.includes('ST') || pos.includes('CF') || pos.includes('LW') || pos.includes('RW')) return 'ST';
  return 'CM';
};
