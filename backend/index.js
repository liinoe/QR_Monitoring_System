const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. UPDATED REGISTRATION ROUTE
// ==========================================
app.post('/api/register', async (req, res) => {
    const { full_name, email, student_number, college, program, year_level } = req.body;
    if (!full_name || !email || !student_number || !college || !program || !year_level) {
        return res.status(400).json({ message: "Please fill in all required fields." });
    }
    try {
        const [existing] = await db.query('SELECT * FROM students WHERE email = ? OR student_number = ?', [email, student_number]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "This student number or email is already registered." });
        }

        await db.query(
            'INSERT INTO registration_requests (full_name, email, student_number, college, program, year_level, approval_status, created_at) VALUES (?, ?, ?, ?, ?, ?, "pending", NOW())',
            [full_name, email, student_number, college, program, year_level]
        );

        await db.query(
            `INSERT INTO students (
                full_name, email, student_number, college, program, year_level, qr_code, status
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, "pending")`,
            [full_name, email, student_number, college, program, year_level]
        );

        res.status(201).json({ message: "Registration submitted successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database transaction error during entry configuration." });
    }
});

// ADMIN DASHBOARD ROUTE
app.get('/api/admin/pending', async (req, res) => {
     try {
          const [rows] = await db.query('SELECT * FROM registration_requests WHERE approval_status = "pending" ORDER BY created_at DESC');
          res.json(rows);
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
});

// ==========================================
// 2. UPDATED ADMIN APPROVE ROUTE
// ==========================================
app.post('/api/admin/approve', async (req, res) => {
    const { request_id, admin_id } = req.body; 

    try {
        const [request] = await db.query('SELECT * FROM registration_requests WHERE request_id = ?', [request_id]);
        if (request.length === 0) return res.status(404).json({ message: "Request not found" });

        const student = request[0];

        // FIX: We no longer generate or save a static token here. 
        // We just change their status to approved!
        await db.query(
            `UPDATE students SET status = "approved" WHERE student_number = ?`,
            [student.student_number]
        );

        await db.query(
            'UPDATE registration_requests SET approval_status = "approved", approved_by = ?, approved_at = NOW() WHERE request_id = ?', 
            [admin_id || 1, request_id] 
        );

        res.json({ success: true, message: "Approved successfully!" });
    } catch (err) {
        console.error("SQL ERROR during Approval:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/reject', async (req, res) => {
     const { request_id } = req.body;
     try {
          const [request] = await db.query('SELECT * FROM registration_requests WHERE request_id = ?', [request_id]);
          if (request.length > 0) {
              await db.query('DELETE FROM students WHERE student_number = ?', [request[0].student_number]);
          }
          await db.query('UPDATE registration_requests SET approval_status = "rejected" WHERE request_id = ?', [request_id]);
          res.json({ message: "Registration rejected." });
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
});

// SCANNING
app.post('/api/logs/scan', async (req, res) => {
    const { qr_code } = req.body;
    try {
        // Decodes and strictly checks the 15-second window
        const decoded = jwt.verify(qr_code, SECRET_KEY);
        const [students] = await db.query('SELECT * FROM students WHERE student_number = ?', [decoded.student_number]);

        if (students.length === 0 || students[0].status !== 'approved') {
            return res.status(403).json({ success: false, message: "Access Denied" });
        }

        const student = students[0];
        const [activeLogs] = await db.query('SELECT log_id FROM student_logs WHERE user_id = ? AND status = "inside"', [student.user_id]);

        if (activeLogs.length > 0) {
            await db.query('UPDATE student_logs SET time_out = NOW(), status = "exited" WHERE log_id = ?', [activeLogs[0].log_id]);
            res.json({ success: true, action: 'exit', full_name: student.full_name, program: student.program, student_number: student.student_number });
        } else {
            await db.query('INSERT INTO student_logs (user_id, time_in, visit_date, status) VALUES (?, NOW(), CURDATE(), "inside")', [student.user_id]);
            res.json({ success: true, action: 'entry', full_name: student.full_name, program: student.program, student_number: student.student_number });
        }
    } catch (err) {
        res.status(401).json({ success: false, message: "QR Code Expired" });
    }
});

app.get('/api/logs/all', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT sl.log_id, sl.visit_date, sl.time_in, sl.time_out, sl.status, s.full_name, s.student_number, s.program
            FROM student_logs sl JOIN students s ON sl.user_id = s.user_id
            ORDER BY sl.visit_date DESC, sl.time_in DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOGIN ENDPOINT
app.post('/api/login', async (req, res) => {
  const { email } = req.body;
  try {
    const [students] = await db.query('SELECT * FROM students WHERE email = ?', [email.trim().toLowerCase()]);
    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'School email not registered.' });
    }
    return res.status(200).json({ message: 'Login successful', student: students[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PROFILE API DATA FETCHER
app.get('/api/student/profile/:student_number', async (req, res) => {
  const { student_number } = req.params;
  
  try {
    const [students] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const student = students[0];

    // FIX: Generate a fresh 15-second expiration token inside the profile fetcher!
    // Every time the mobile app requests an update (every 10 seconds), it generates a new token.
    if (student.status === 'approved') {
        const freshToken = jwt.sign(
            { student_number: student.student_number }, 
            SECRET_KEY, 
            { expiresIn: '15s' }
        );
        student.qr_code = freshToken; 
    }

    return res.status(200).json(student);
    
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/logs/live-board', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.college, COUNT(*) as count FROM student_logs sl JOIN students s ON sl.user_id = s.user_id
            WHERE sl.status = 'inside' GROUP BY s.college
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));