const jwt = require('jsonwebtoken');
const db = require('../db');

// Every admin request must carry a token whose session still exists in
// admin_sessions. Each signed-in browser has its own session row, so logging
// out (or being signed out) in one browser never affects the others.
//
// Each request also refreshes last_seen_at — that "heartbeat" is how the
// login route knows whether this account is actively open somewhere and so
// needs approval for a new sign-in.
const verifyToken = async (req, res, next) => {
     const authHeader = req.headers['authorization'];
     const token = authHeader && authHeader.split(' ')[1];

     if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

     let decoded;
     try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
     } catch (err) {
          return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
     }

     // Tokens issued before this change have no session_id — send them back to login once.
     if (!decoded.session_id) {
          return res.status(401).json({ message: "Your session has ended. Please log in again." });
     }

     try {
          const [result] = await db.query(
               'UPDATE admin_sessions SET last_seen_at = NOW() WHERE session_id = ? AND admin_id = ?',
               [decoded.session_id, decoded.admin_id]
          );
          if (result.affectedRows === 0) {
               return res.status(401).json({ message: "Your session has ended. Please log in again." });
          }
     } catch (err) {
          // A database hiccup is NOT a reason to sign the admin out.
          console.error("Session check error:", err.message);
          return res.status(500).json({ error: "Could not verify session." });
     }

     req.admin = decoded;
     req.sessionId = decoded.session_id;
     next();
};

const requireSuperAdmin = (req, res, next) => {
     // req.admin is set by the verifyToken middleware above
     if (!req.admin || req.admin.role !== 'super_admin') {
          return res.status(403).json({ message: "Access denied. Super admin privileges required." });
     }
     next();
};

module.exports = { verifyToken, requireSuperAdmin };