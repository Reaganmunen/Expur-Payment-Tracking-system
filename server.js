require('dotenv').config();

const app = require('./src/app');
const { pool } = require('./src/config/db');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to .env');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
