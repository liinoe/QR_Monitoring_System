const mysql = require('mysql2');
require('dotenv').config();

// SSL for cloud databases (Aiven requires it). Set DB_SSL=true when deployed.
// DB_CA = the provider's CA certificate text (optional but more secure).
function sslOptions() {
  if (process.env.DB_SSL !== 'true') return undefined; // local MySQL: no SSL
  if (process.env.DB_CA) return { ca: process.env.DB_CA.replace(/\\n/g, '\n') };
  return { rejectUnauthorized: false };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306, // cloud databases often use a different port
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, 
  timezone: '+08:00',
  ssl: sslOptions(),
});

pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+08:00'");
});

module.exports = pool.promise();
