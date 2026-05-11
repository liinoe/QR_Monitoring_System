const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// FIXED: ONE consistent key for signing and verifying
const SECRET_KEY = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// GET ALL STUDENTS
app.get('/api/students', async (req, res) => {
     try {
          const [rows] = await db.query('SELECT * FROM students');
          res.json(rows);
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
});

// STUDENT PROFILE WITH AUTO-JWT 
// This route updates the DB every time the mobile app fetches data
app.get('/api/student/profile/:student_number', async (req, res) => {
     const { student_number } = req.params;
     try {
     const [rows] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
     if (rows.length === 0) return res.status(404).json({ message: "Student not found" });

     const student = rows[0];
     const today = new Date();
     
     // Semester Expiration Logic
     if (student.valid_until && new Date(student.valid_until) < today) {
          return res.status(403).json({ message: "Semester membership expired", status: 'expired' });
     }

     const fresh_qr = jwt.sign(
          { student_number: student.student_number },
          SECRET_KEY,
          { expiresIn: '5m' }
     );

     await db.query('UPDATE students SET qr_code = ? WHERE student_number = ?', [fresh_qr, student_number]);
     res.json({ ...student, qr_code: fresh_qr });
     
     } catch (err) {
     res.status(500).json({ error: err.message });
     }
});

// SCAN INTERFACE LOGIC (Verify and Log)
app.post('/api/logs/scan', async (req, res) => {
     const { qr_code } = req.body;
     try {
     const decoded = jwt.verify(qr_code, SECRET_KEY);
     const [students] = await db.query('SELECT * FROM students WHERE student_number = ?', [decoded.student_number]);

     if (students.length === 0 || students[0].status !== 'approved') {
          return res.status(403).json({ success: false, message: "Access Denied: Not Approved" });
     }

     // Secondary security check for semester date
     if (students[0].valid_until && new Date(students[0].valid_until) < new Date()) {
          return res.status(403).json({ success: false, message: "Access Denied: Semester Expired" });
     }

     const student = students[0];
     const [activeLogs] = await db.query('SELECT log_id FROM student_logs WHERE user_id = ? AND status = "inside"', [student.user_id]);

     if (activeLogs.length > 0) {
          await db.query('UPDATE student_logs SET time_out = NOW(), status = "exited" WHERE log_id = ?', [activeLogs[0].log_id]);
          res.json({ success: true, action: 'exit', full_name: student.full_name });
     } else {
          await db.query('INSERT INTO student_logs (user_id, time_in, visit_date, status) VALUES (?, NOW(), CURDATE(), "inside")', [student.user_id]);
          res.json({ success: true, action: 'entry', full_name: student.full_name });
     }
     } catch (err) {
     res.status(401).json({ success: false, message: "Invalid or Expired QR" });
     }
});

// LIVE DASHBOARD STATS
app.get('/api/dashboard/stats', async (req, res) => {
     try {
          const [inside] = await db.query('SELECT COUNT(*) as count FROM student_logs WHERE status = "inside"');
          const [totalToday] = await db.query('SELECT COUNT(DISTINCT user_id) as count FROM student_logs WHERE visit_date = CURDATE()');
          const [pending] = await db.query('SELECT COUNT(*) as count FROM registration_requests WHERE approval_status = "pending"');

          res.json({
               currentlyInside: inside[0].count,
               totalVisitorsToday: totalToday[0].count,
               pendingRegistrations: pending[0].count
          });
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
});

// REGISTRATION AND ADMIN APPROVAL
app.post('/api/register', async (req, res) => {
     const { full_name, email, student_number, college, program, year_level } = req.body;
     if (!full_name || !email || !student_number || !college || !program || !year_level) {
          return res.status(400).json({ message: "Please fill in all required fields." });
     }
     try {
          await db.query(
               'INSERT INTO registration_requests (full_name, email, student_number, college, program, year_level, approval_status, created_at) VALUES (?, ?, ?, ?, ?, ?, "pending", NOW())',
               [full_name, email, student_number, college, program, year_level]
          );
          res.status(201).json({ message: "Registration submitted successfully!" });
     } catch (err) {
          res.status(500).json({ error: "Database error." });
     }
});

app.post('/api/admin/approve', async (req, res) => {
     const { request_id, admin_id } = req.body; 
     try {
          const [request] = await db.query('SELECT * FROM registration_requests WHERE request_id = ?', [request_id]);
          if (request.length === 0) return res.status(404).json({ message: "Request not found" });

          const student = request[0];
          const qr_jwt = jwt.sign({ student_number: student.student_number }, SECRET_KEY, { expiresIn: '5m' });

          await db.query(
               'INSERT INTO students (full_name, email, student_number, program, year_level, qr_code, status) VALUES (?, ?, ?, ?, ?, ?, "approved")',
               [student.full_name, student.email, student.student_number, student.program, student.year_level, qr_jwt]
          );

          await db.query(
               'UPDATE registration_requests SET approval_status = "approved", approved_by = ?, approved_at = NOW() WHERE request_id = ?', 
               [admin_id || null, request_id] 
          );

          res.json({ message: "Approved successfully!" });
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
});

app.get('/api/admin/pending', async (req, res) => {
     try {
          const [rows] = await db.query(`
               SELECT *
               FROM registration_requests
               WHERE approval_status = 'pending'
               ORDER BY created_at DESC
          `);

          res.json(rows);

     } catch (err) {
          console.error("Pending Requests Error:", err);

          res.status(500).json({
               error: err.message
          });
     }
});



// STUDENT LOGS
app.get('/api/logs/all', async (req, res) => {
     try {
          const query = `
               SELECT 
                    l.log_id, 
                    s.full_name, 
                    s.student_number, 
                    s.program,
                    l.time_in, 
                    l.time_out, 
                    l.visit_date, 
                    l.status
               FROM student_logs l
               LEFT JOIN students s ON l.user_id = s.user_id
               ORDER BY l.time_in DESC
          `;
          const [rows] = await db.query(query);
          res.json(rows);
     } catch (err) {
          console.error("Database Error:", err);
          res.status(500).json({ error: err.message });
     }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LibraPass Server running at http://localhost:${PORT}`);
});