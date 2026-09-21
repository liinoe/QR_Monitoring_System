const jwt = require('jsonwebtoken');
const db = require('../db'); 

const verifyToken = async (req, res, next) => {
     const authHeader = req.headers['authorization'];
     const token = authHeader && authHeader.split(' ')[1];

     if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

     try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Check the database to see if this session is still the active one
          const [admins] = await db.query('SELECT session_id FROM admins WHERE admin_id = ?', [decoded.admin_id]);
          
          if (admins.length === 0 || admins[0].session_id !== decoded.session_id) {
               return res.status(401).json({ 
                    message: "Your session has expired because your account was logged in from another device or browser." 
               });
          }

          req.admin = decoded;
          next();
     } catch (err) {
          return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
     }
};

const requireSuperAdmin = (req, res, next) => {
     // req.admin is set by the verifyToken middleware above
     if (!req.admin || req.admin.role !== 'super_admin') {
          return res.status(403).json({ message: "Access denied. Super admin privileges required." });
     }
     next();
};

module.exports = { verifyToken, requireSuperAdmin };