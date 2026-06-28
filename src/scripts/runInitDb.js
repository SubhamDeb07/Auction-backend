require('dotenv').config();
const { createDatabaseIfNeeded, initDatabase } = require('./initDb');

async function run() {
  await createDatabaseIfNeeded();
  await initDatabase();
  console.log('MySQL schema initialized successfully.');
  process.exit(0);
}

run().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
});
