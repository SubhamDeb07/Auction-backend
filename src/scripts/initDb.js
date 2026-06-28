const fs = require('fs');
const path = require('path');
const { query, getPoolWithoutDb } = require('../config/database');

async function createDatabaseIfNeeded() {
  const dbName = process.env.MYSQL_DATABASE || 'auction';
  const bootstrapPool = getPoolWithoutDb();
  try {
    await bootstrapPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database "${dbName}" is ready.`);
  } finally {
    await bootstrapPool.end();
  }
}

async function initDatabase() {
  await createDatabaseIfNeeded();

  const sqlPath = path.join(__dirname, '../migrations/init.sql');
  const statements = fs
    .readFileSync(sqlPath, 'utf8')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await query(`${statement};`);
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME' && error.code !== 'ER_TABLE_EXISTS_ERROR') {
        throw error;
      }
    }
  }

  await runColumnMigrations();
}

async function runColumnMigrations() {
  const columnMigrations = [
    `ALTER TABLE auction_sessions ADD COLUMN players_uploaded TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE managers ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'manager'`,
    `ALTER TABLE managers ADD COLUMN client_token VARCHAR(64) NULL`,
    `ALTER TABLE players ADD COLUMN image MEDIUMBLOB NULL`,
    `ALTER TABLE players ADD COLUMN image_mime VARCHAR(50) NULL`,
  ];

  for (const migration of columnMigrations) {
    try {
      await query(migration);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

  const indexMigrations = [
    `ALTER TABLE managers ADD UNIQUE KEY uniq_session_token (session_id, client_token)`,
  ];

  for (const migration of indexMigrations) {
    try {
      await query(migration);
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') throw error;
    }
  }
}

module.exports = { initDatabase, createDatabaseIfNeeded };
