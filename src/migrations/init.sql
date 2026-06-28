CREATE TABLE IF NOT EXISTS auction_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phase VARCHAR(32) NOT NULL DEFAULT 'setup',
  config JSON NOT NULL,
  current_player_id INT NULL,
  current_bid INT NOT NULL DEFAULT 0,
  highest_bidder_id INT NULL,
  timer_value INT NOT NULL DEFAULT 0,
  last_auction_action JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  players_uploaded TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS managers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  socket_id VARCHAR(64) NOT NULL,
  client_token VARCHAR(64) NULL,
  name VARCHAR(128) NOT NULL,
  budget INT NOT NULL,
  color VARCHAR(16) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'manager',
  has_super_power TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_session_socket (session_id, socket_id),
  UNIQUE KEY uniq_session_token (session_id, client_token),
  CONSTRAINT fk_managers_session FOREIGN KEY (session_id) REFERENCES auction_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  rating INT NOT NULL,
  position VARCHAR(16) NOT NULL,
  role_group VARCHAR(8) NOT NULL,
  alt_positions JSON NOT NULL,
  playstyles JSON NOT NULL,
  pac INT NOT NULL DEFAULT 75,
  sho INT NOT NULL DEFAULT 75,
  pas INT NOT NULL DEFAULT 75,
  dri INT NOT NULL DEFAULT 75,
  def INT NOT NULL DEFAULT 75,
  phy INT NOT NULL DEFAULT 75,
  pool_type VARCHAR(16) NOT NULL DEFAULT 'main',
  status VARCHAR(16) NULL,
  player_data JSON NOT NULL,
  CONSTRAINT fk_players_session FOREIGN KEY (session_id) REFERENCES auction_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS squad_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  manager_id INT NOT NULL,
  player_id INT NOT NULL,
  final_price INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_manager_player (manager_id, player_id),
  CONSTRAINT fk_squad_manager FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE CASCADE,
  CONSTRAINT fk_squad_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bidding_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  log_text TEXT NOT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#FFFFFF',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_session FOREIGN KEY (session_id) REFERENCES auction_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_managers_session ON managers(session_id);
CREATE INDEX idx_players_session ON players(session_id);
CREATE INDEX idx_squad_manager ON squad_players(manager_id);
CREATE INDEX idx_logs_session ON bidding_logs(session_id);
