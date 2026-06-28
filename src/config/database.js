const mysql = require('mysql2/promise');
require('dotenv').config();

const sslEnabled = process.env.MYSQL_SSL === 'true';

const poolConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'auction',
  waitForConnections: true,
  connectionLimit: 10,
  ...(sslEnabled && { ssl: { rejectUnauthorized: false } }),
};

const pool = mysql.createPool(poolConfig);

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  if (Array.isArray(rows)) {
    return { rows, insertId: null };
  }
  return { rows: [], insertId: rows.insertId };
}

// Used only during DB creation (no database selected yet)
function getPoolWithoutDb() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 2,
    ...(sslEnabled && { ssl: { rejectUnauthorized: false } }),
  });
}

module.exports = { pool, query, getPoolWithoutDb };
