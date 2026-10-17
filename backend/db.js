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

// SQL mode = the normal MySQL 8 default (same as a local MySQL install).
// Some cloud hosts (e.g. Aiven) default to "ANSI" mode, where "double quotes" mean a
// column name instead of text, which breaks queries like status = "inside".
const SQL_MODE = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

// Runs once for every new database connection: Philippine time + the SQL mode above.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+08:00'");
  conn.query(`SET SESSION sql_mode = '${SQL_MODE}'`);
});

module.exports = pool.promise();
