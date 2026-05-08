const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/students', async (req, res) => {
     try {
     const [rows] = await db.query('SELECT * FROM students');
     res.json(rows);
     } catch (err) {
     res.status(500).json({ error: err.message });
     }
});

// STUDENT PROFILE
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

app.get('/api/student/profile/:student_number', async (req, res) => {
  const { student_number } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
    if (rows.length === 0) return res.status(404).json({ message: "Student not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SCAN INTERFACE LOGIC
app.post('/api/logs/scan', async (req, res) => {
     const { student_number } = req.body;

     try {
     // 1. Find the student by their number
     const [students] = await db.query('SELECT user_id FROM students WHERE student_number = ?', [student_number]);
     
     if (students.length === 0) {
          return res.status(404).json({ message: "Student not found" });
     }

     const userId = students[0].user_id;

     // 2. Check if they are currently "inside"
     const [activeLogs] = await db.query(
          'SELECT log_id FROM student_logs WHERE user_id = ? AND status = "inside"',
          [userId]
     );

     if (activeLogs.length > 0) {
          // 3. LOG OUT: If they are inside, set time_out and change status to 'exited'
          await db.query(
          'UPDATE student_logs SET time_out = NOW(), status = "exited" WHERE log_id = ?',
          [activeLogs[0].log_id]
          );
          res.json({ message: "Check-out successful" });
     } else {
          // 4. LOG IN: If they aren't inside, create a new log entry
          await db.query(
          'INSERT INTO student_logs (user_id, time_in, visit_date, status) VALUES (?, NOW(), CURDATE(), "inside")',
          [userId]
          );
          res.json({ message: "Check-in successful" });
     }
     } catch (err) {
     res.status(500).json({ error: err.message });
     }
});

// LIVE DASHBOARD API
app.get('/api/dashboard/stats', async (req, res) => {
     try {
     // Count students currently 'inside'
     const [inside] = await db.query('SELECT COUNT(*) as count FROM student_logs WHERE status = "inside"');
     
     // Count total unique visitors today
     const [totalToday] = await db.query('SELECT COUNT(DISTINCT user_id) as count FROM student_logs WHERE visit_date = CURDATE()');
     
     // Count pending registration requests
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

// REGISTRATION LOGIC
app.post('/api/register', async (req, res) => {
     const { full_name, email, student_number, program, year_level } = req.body;

     // Validation: Ensure all fields are present
     if (!full_name || !email || !student_number || !program || !year_level) {
     return res.status(400).json({ message: "Please fill in all required fields." });
     }

     try {
     // Check if the student_number already exists in the requests or students table
     const [existingRequest] = await db.query(
          'SELECT student_number FROM registration_requests WHERE student_number = ?', 
          [student_number]
     );

     if (existingRequest.length > 0) {
          return res.status(400).json({ message: "A registration request for this student number already exists." });
     }

     // Insert into registration_requests with default status 'pending'
     const query = `
          INSERT INTO registration_requests 
          (full_name, email, student_number, program, year_level, approval_status, created_at) 
          VALUES (?, ?, ?, ?, ?, 'pending', NOW())
     `;

     await db.query(query, [full_name, email, student_number, program, year_level]);

     res.status(201).json({ message: "Registration submitted successfully! Please wait for admin approval." });
     } catch (err) {
     console.error(err);
     res.status(500).json({ error: "Database error. Please try again later." });
     }
});

// PENDING REGISTRATIONS
app.get('/api/admin/pending', async (req, res) => {
     try {
     const [rows] = await db.query(
          'SELECT * FROM registration_requests WHERE approval_status = "pending"'
     );
     res.json(rows);
     } catch (err) {
     console.error("Database Error:", err);
     res.status(500).json({ error: "Internal Server Error" });
     }
});

// ADMIN APPROVAL API
app.post('/api/admin/approve', async (req, res) => {
     const { request_id, admin_id } = req.body; // request_id matches your PRIMARY KEY

     try {
     // 1. Get the student's data from the pending table
     const [request] = await db.query('SELECT * FROM registration_requests WHERE request_id = ?', [request_id]);
     
     if (request.length === 0) {
          return res.status(404).json({ message: "Registration request not found" });
     }

     const student = request[0];
     
     // Create the unique token string for the QR code
     const qr_string = `LIB-${student.student_number}-${Date.now()}`;

     // 2. Insert into the main 'students' table 
     // Matches your DB: qr_code (column name) and 'approved' (ENUM status)
     await db.query(
          'INSERT INTO students (full_name, email, student_number, program, year_level, qr_code, status) VALUES (?, ?, ?, ?, ?, ?, "approved")',
          [student.full_name, student.email, student.student_number, student.program, student.year_level, qr_string]
     );

     // 3. Update the original request status
     // Matches your DB: approval_status ENUM and approved_at DATETIME
     await db.query(
          'UPDATE registration_requests SET approval_status = "approved", approved_by = ?, approved_at = NOW() WHERE request_id = ?', 
          [admin_id || null, request_id] 
     );

     res.json({ message: "Student approved and moved to main records!" });
     } catch (err) {
     console.error("Database Error:", err);
     // If you get a 'Duplicate entry' error here, it means the student was already approved
     res.status(500).json({ error: "Approval failed. Check if student number already exists in students table." });
     }
});

