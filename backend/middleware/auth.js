const jwt = require('jsonwebtoken');
const db = require('../db');

function verifyToken(req, res, next) {
     const authHeader = req.headers['authorization'];
     const token = authHeader && authHeader.split(' ')[1];

     if (!token) {
     return res.status(401).json({ message: 'No token provided. Please log in.' });
     }

     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
     if (err) {
          return res.status(403).json({ message: 'Invalid or expired session. Please log in again.' });
     }

     // Enforces one active session per admin account. Every login
     // generates a fresh session_id and overwrites admins.current_session_id
     // — so if this token's session_id no longer matches the DB, a newer
     // login (on another device/browser) has superseded this one.
     try {
          const [rows] = await db.query(
          'SELECT current_session_id FROM admins WHERE admin_id = ?',
          [decoded.admin_id]
          );
          if (rows.length === 0 || rows[0].current_session_id !== decoded.session_id) {
               return res.status(401).json({ message: 'This account was signed in elsewhere. Please log in again.' });
          }
     } catch (dbErr) {
          console.error('Session check error:', dbErr.message);
          return res.status(500).json({ message: 'Server error verifying session.' });
     }

     req.admin = decoded; // { admin_id, role, name, session_id }
     next();
     });
}

function requireSuperAdmin(req, res, next) {
     if (!req.admin || req.admin.role !== 'super_admin') {
     return res.status(403).json({ message: 'Super admin access required.' });
     }
     next();
}

module.exports = { verifyToken, requireSuperAdmin };