const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
     const authHeader = req.headers['authorization'];
     const token = authHeader && authHeader.split(' ')[1]; 

     if (!token) {
     return res.status(401).json({ message: 'No token provided. Please log in.' });
     }

     jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
     if (err) {
          return res.status(403).json({ message: 'Invalid or expired session. Please log in again.' });
     }
     req.admin = decoded; // { admin_id, role, name }
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