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

// Returns every registration request regardless of status, for the admin
app.get('/api/admin/all', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM registration_requests ORDER BY created_at DESC');
            res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
     }
});


app.post('/api/admin/approve', async (req, res) => {
    const { request_id, admin_id } = req.body; 

    try {
        const [request] = await db.query('SELECT * FROM registration_requests WHERE request_id = ?', [request_id]);
        if (request.length === 0) return res.status(404).json({ message: "Request not found" });

        const student = request[0];

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
            SELECT sl.log_id, sl.visit_date, sl.time_in, sl.time_out, sl.status, s.full_name, s.student_number, s.college, s.program
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

// DELETE log entry
app.delete('/api/logs/delete/:log_id', async (req, res) => {
    const { log_id } = req.params;
    try {
        await db.query('DELETE FROM student_logs WHERE log_id = ?', [log_id]);
        res.json({ success: true, message: "Log deleted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/logs/archive', async (req, res) => {
    try {
        // Copy old logs to archive (logs older than 3 months)
        await db.query(`INSERT INTO archived_logs SELECT * FROM student_logs WHERE visit_date < DATE_SUB(NOW(), INTERVAL 3 MONTH)`);
        
        // Delete the archived logs from the active table to maintain speed
        await db.query(`DELETE FROM student_logs WHERE visit_date < DATE_SUB(NOW(), INTERVAL 3 MONTH)`);
        
        res.json({ success: true, message: "Logs archived successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// GUEST ENTRY LOGGING
app.post('/api/guests/log', async (req, res) => {
    const { guest_type, first_name, last_name, affiliation, purpose, other_purpose } = req.body;

    if (!guest_type || !first_name || !last_name) {
        return res.status(400).json({ message: "Please fill in all required fields." });
    }

    const full_name = `${first_name} ${last_name}`.trim();

    try {
        const [guestResult] = await db.query(
            'INSERT INTO guests (full_name, guest_type, affiliation, purpose, other_purpose) VALUES (?, ?, ?, ?, ?)',
            [full_name, guest_type, affiliation || null, purpose || null, other_purpose || null]
        );

        await db.query(
            'INSERT INTO guest_logs (guest_id, time_in, visit_date, status) VALUES (?, NOW(), CURDATE(), "inside")',
            [guestResult.insertId]
        );

        res.status(201).json({ success: true, message: "Visit logged successfully!" });
    } catch (err) {
        console.error("SQL ERROR during guest log:", err.message);
        res.status(500).json({ error: "Database error while logging guest visit." });
    }
});

app.get('/api/guests/all', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT gl.guest_log_id, gl.time_in, gl.time_out, gl.visit_date, gl.status,
                   g.guest_id, g.full_name, g.guest_type, g.affiliation, g.purpose, g.other_purpose
            FROM guest_logs gl JOIN guests g ON gl.guest_id = g.guest_id
            ORDER BY gl.visit_date DESC, gl.time_in DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Guests have no QR to scan out with, so exits are marked manually by an admin. !unsure with this
app.patch('/api/guests/exit/:guest_log_id', async (req, res) => {
    const { guest_log_id } = req.params;
    try {
        await db.query('UPDATE guest_logs SET time_out = NOW(), status = "exited" WHERE guest_log_id = ?', [guest_log_id]);
        res.json({ success: true, message: "Guest marked as exited." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STUDENT PERSONAL ANALYTICS (for the mobile app home screen)
app.get('/api/student/analytics/:student_number', async (req, res) => {
    const { student_number } = req.params;
    try {
        const [students] = await db.query('SELECT user_id FROM students WHERE student_number = ?', [student_number]);
        if (students.length === 0) return res.status(404).json({ message: 'Student not found.' });
        const user_id = students[0].user_id;

        const [myLogs] = await db.query(
            'SELECT time_in, time_out, visit_date FROM student_logs WHERE user_id = ?',
            [user_id]
        );

        // Live occupancy = everyone currently inside the library, students + guests
        const [[{ studentsInside }]] = await db.query(
            `SELECT COUNT(*) AS studentsInside FROM student_logs WHERE status = "inside"`
        );
        const [[{ guestsInside }]] = await db.query(
            `SELECT COUNT(*) AS guestsInside FROM guest_logs WHERE status = "inside"`
        );

        const totalVisits = myLogs.length;
        const currentOccupancy = studentsInside + guestsInside;

        // Weekly activity (Mon-Sat), averaged hours per weekday across this
        // student's whole history, plus visit counts to find their most
        // frequent day.
        const dayHourTotals = new Array(6).fill(0);
        const dayHourCounts = new Array(6).fill(0);
        const dayVisitCounts = new Array(6).fill(0);

        let totalStayMs = 0;
        let exitedCount = 0;

        myLogs.forEach(log => {
            if (!log.visit_date) return;
            const d = new Date(log.visit_date);
            const jsDay = d.getDay(); // 0=Sun..6=Sat
            if (jsDay === 0) return;  // library closed Sundays (ata), matches wireframe (Mon-Sat only)
            const idx = jsDay - 1;    // Mon=0 .. Sat=5
            dayVisitCounts[idx] += 1;

            if (log.time_in && log.time_out) {
                const hrs = (new Date(log.time_out) - new Date(log.time_in)) / (1000 * 60 * 60);
                dayHourTotals[idx] += hrs;
                dayHourCounts[idx] += 1;
                totalStayMs += (new Date(log.time_out) - new Date(log.time_in));
                exitedCount += 1;
            }
        });

        const weeklyActivity = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => ({
            day: label,
            hours: dayHourCounts[i] > 0 ? parseFloat((dayHourTotals[i] / dayHourCounts[i]).toFixed(1)) : 0,
        }));

        const maxVisits = Math.max(...dayVisitCounts);
        const frequentDayIdx = maxVisits > 0 ? dayVisitCounts.indexOf(maxVisits) : null;
        const frequentDay = frequentDayIdx !== null
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][frequentDayIdx]
            : '--';

        const avgStayHours = exitedCount > 0 ? (totalStayMs / exitedCount / (1000 * 60 * 60)) : 0;

        res.json({
            total_visits: totalVisits,
            current_occupancy: currentOccupancy,
            weekly_activity: weeklyActivity,
            frequent_day: frequentDay,
            avg_stay_hours: avgStayHours,
        });
    } catch (err) {
        console.error("SQL ERROR during student analytics:", err.message);
        res.status(500).json({ message: 'Server error computing analytics.' });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));