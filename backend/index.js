const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken, requireSuperAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Reads the single active academic period value.
async function getCurrentPeriod() {
    const [rows] = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'current_period'");
    return rows.length > 0 ? rows[0].setting_value : null;
}

// Builds the display full_name from parts. full_name stays a real, stored
// column so every existing query/UI that reads it (web dashboard, scanner,
// logs, analytics) keeps working untouched.
function buildFullName(first_name, middle_name, surname) {
    const middle = middle_name && middle_name.trim() ? `${middle_name.trim()} ` : '';
    return `${first_name.trim()} ${middle}${surname.trim()}`.replace(/\s+/g, ' ').trim();
}

const VALID_SEX_VALUES = ['male', 'female', 'prefer_not_to_say'];

// Register screen shows this so students know which
// semester they're registering/renewing for.
app.get('/api/settings/current-period', async (req, res) => {
    try {
        const period = await getCurrentPeriod();
        res.json({ current_period: period });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FRESH REGISTRATION ONLY
app.post('/api/register', async (req, res) => {
    const {
        surname, first_name, middle_name,
        email, phone_number, address, sex,
        student_number, password,
        college, program, year_level
    } = req.body;

    if (!surname || !first_name || !email || !phone_number || !address || !sex ||
        !student_number || !password || !college || !program || !year_level) {
        return res.status(400).json({ message: "Please fill in all required fields." });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    if (!VALID_SEX_VALUES.includes(sex)) {
        return res.status(400).json({ message: "Invalid value for sex." });
    }

    try {
        const currentPeriod = await getCurrentPeriod();

        const [byNumber] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        const [byEmail] = await db.query('SELECT * FROM students WHERE email = ?', [email]);

        if (byNumber.length > 0 && byNumber[0].email !== email) {
            return res.status(400).json({
                message: "This student number is already registered under a different account."
            });
        }
        if (byEmail.length > 0 && byEmail[0].student_number !== student_number) {
            return res.status(400).json({
                message: "This email is already associated with a different student number."
            });
        }

        const existingStudent = byNumber[0] || byEmail[0] || null;
        if (existingStudent) {
            // Renewal has its own endpoint now — a fresh registration attempt
            // against an existing account is always a duplicate, never a
            // renewal shortcut.
            return res.status(400).json({
                message: "This account already exists. Please log in, or use Renew Registration from your Home screen."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const full_name = buildFullName(first_name, middle_name, surname);

        await db.query(
            `INSERT INTO registration_requests (
                full_name, surname, first_name, middle_name,
                email, phone_number, address, sex,
                student_number, college, program, year_level, period,
                approval_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW())`,
            [full_name, surname, first_name, middle_name || null,
             email, phone_number, address, sex,
             student_number, college, program, year_level, currentPeriod]
        );

        await db.query(
            `INSERT INTO students (
                full_name, surname, first_name, middle_name,
                email, phone_number, address, sex, password,
                student_number, college, program, year_level,
                qr_code, status, registered_period
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, "pending", ?)`,
            [full_name, surname, first_name, middle_name || null,
             email, phone_number, address, sex, hashedPassword,
             student_number, college, program, year_level, currentPeriod]
        );

        res.status(201).json({ message: "Registration submitted successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database transaction error during entry configuration." });
    }
});

// RENEWAL — academic info only
app.post('/api/renew', async (req, res) => {
    const { student_number, college, program, year_level } = req.body;
    if (!student_number || !college || !program || !year_level) {
        return res.status(400).json({ message: "Please complete all academic info fields." });
    }

    try {
        const [existing] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "No account found for this student number." });
        }
        const student = existing[0];
        const currentPeriod = await getCurrentPeriod();

        if (student.registered_period === currentPeriod) {
            return res.status(400).json({
                message: `You're already registered for ${currentPeriod}. Renewal opens next semester.`
            });
        }

        await db.query(
            `UPDATE students SET
                college = ?, program = ?, year_level = ?,
                status = "pending", qr_code = NULL, registered_period = ?
             WHERE student_number = ?`,
            [college, program, year_level, currentPeriod, student_number]
        );

        await db.query(
            `INSERT INTO registration_requests (
                full_name, surname, first_name, middle_name,
                email, phone_number, address, sex,
                student_number, college, program, year_level, period,
                approval_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW())`,
            [student.full_name, student.surname, student.first_name, student.middle_name,
             student.email, student.phone_number, student.address, student.sex,
             student_number, college, program, year_level, currentPeriod]
        );

        res.status(201).json({ message: "Renewal submitted! Please wait for admin approval." });
    } catch (err) {
        console.error("Renewal error:", err.message);
        res.status(500).json({ error: "Database transaction error during renewal." });
    }
});

// CHANGE PASSWORD — requires the current password, standard security practice.
app.post('/api/student/change-password', async (req, res) => {
    const { student_number, current_password, new_password } = req.body;
    if (!student_number || !current_password || !new_password) {
        return res.status(400).json({ message: "All fields are required." });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    try {
        const [students] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (students.length === 0) {
            return res.status(404).json({ message: "Student not found." });
        }
        const student = students[0];

        if (!student.password) {
            return res.status(403).json({ message: "This account has no password set up yet." });
        }

        const match = await bcrypt.compare(current_password, student.password);
        if (!match) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }

        const newHashed = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE students SET password = ? WHERE student_number = ?', [newHashed, student_number]);

        res.json({ success: true, message: "Password changed successfully." });
    } catch (err) {
        console.error("Change password error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ADMIN DASHBOARD ROUTE
app.get('/api/admin/pending', verifyToken, async (req, res) => {
     try {
          const [rows] = await db.query('SELECT * FROM registration_requests WHERE approval_status = "pending" ORDER BY created_at DESC');
          res.json(rows);
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
});

// Returns every registration request regardless of status, for the admin
// Registrations page's All/Pending/Approved/Rejected filter tabs.
app.get('/api/admin/all', verifyToken, async (req, res) => {
     try {
          const [rows] = await db.query('SELECT * FROM registration_requests ORDER BY created_at DESC');
          res.json(rows);
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
});

app.post('/api/admin/approve', verifyToken, async (req, res) => {
    const { request_id } = req.body;
    const admin_id = req.admin.admin_id; // trust the token, not the request body

    try {
        const [request] = await db.query('SELECT * FROM registration_requests WHERE request_id = ?', [request_id]);
        if (request.length === 0) return res.status(404).json({ message: "Request not found" });

        const student = request[0];

        const qrToken = crypto.randomUUID();

        await db.query(
            `UPDATE students SET status = "approved", qr_code = ? WHERE student_number = ?`,
            [qrToken, student.student_number]
        );

        await db.query(
            'UPDATE registration_requests SET approval_status = "approved", approved_by = ?, approved_at = NOW() WHERE request_id = ?',
            [admin_id, request_id]
        );

        res.json({ success: true, message: "Approved successfully!" });
    } catch (err) {
        console.error("SQL ERROR during Approval:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/reject', verifyToken, async (req, res) => {
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


app.post('/api/admin/deactivate', verifyToken, async (req, res) => {
    const { student_number, request_id } = req.body;
    if (!student_number || !request_id) {
        return res.status(400).json({ message: "student_number and request_id are required." });
    }
    try {
        await db.query(
            'UPDATE students SET status = "deactivated", qr_code = NULL WHERE student_number = ?',
            [student_number]
        );
        await db.query(
            'UPDATE registration_requests SET approval_status = "deactivated" WHERE request_id = ?',
            [request_id]
        );
        res.json({ success: true, message: "Account deactivated. QR access revoked." });
    } catch (err) {
        console.error("Deactivate error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/reactivate', verifyToken, async (req, res) => {
    const { student_number, request_id } = req.body;
    if (!student_number || !request_id) {
        return res.status(400).json({ message: "student_number and request_id are required." });
    }
    try {
        const qrToken = crypto.randomUUID();
        await db.query(
            'UPDATE students SET status = "approved", qr_code = ? WHERE student_number = ?',
            [qrToken, student_number]
        );
        await db.query(
            'UPDATE registration_requests SET approval_status = "approved" WHERE request_id = ?',
            [request_id]
        );
        res.json({ success: true, message: "Account reactivated. New QR pass issued." });
    } catch (err) {
        console.error("Reactivate error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// SCANNING — kiosk-facing, intentionally not behind admin auth
app.post('/api/logs/scan', async (req, res) => {
    const { qr_code } = req.body;
    try {
        const [students] = await db.query('SELECT * FROM students WHERE qr_code = ?', [qr_code]);

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
        console.error("SQL ERROR during scan:", err.message);
        res.status(500).json({ success: false, message: "Scan failed. Please try again." });
    }
});

app.get('/api/logs/all', verifyToken, async (req, res) => {
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

// STUDENT LOGIN — mobile app, separate from admin login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    const [students] = await db.query('SELECT * FROM students WHERE email = ?', [email.trim().toLowerCase()]);
    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'School email not registered.' });
    }

    const student = students[0];

    // Students registered before the password field existed will have
    // password = NULL. Block login with a clear message rather than
    // crashing bcrypt.compare on a null hash.
    if (!student.password) {
      return res.status(403).json({ message: 'This account needs a password set up. Please contact the library or re-register.' });
    }

    const match = await bcrypt.compare(password, student.password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    // Never send the password hash back to the client
    const { password: _omit, ...safeStudent } = student;
    return res.status(200).json({ message: 'Login successful', student: safeStudent });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Tells the frontend whether to show the Bootstrap screen or the normal Login screen
app.get('/api/admin/check-setup', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT COUNT(*) as count FROM admins');
        res.json({ needsSetup: rows[0].count === 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ONE-TIME first super admin creation. Locks itself out once any admin exists.
app.post('/api/admin/bootstrap', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: "Please fill in all fields." });
    }
    try {
        const [existing] = await db.query('SELECT COUNT(*) as count FROM admins');
        if (existing[0].count > 0) {
            return res.status(403).json({ message: "Setup already completed. Please log in." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, "super_admin")',
            [name, email.trim().toLowerCase(), hashedPassword]
        );

        res.status(201).json({ success: true, message: "Super admin account created. Please log in." });
    } catch (err) {
        console.error("Bootstrap error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ADMIN LOGIN
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }
    try {
        const [admins] = await db.query('SELECT * FROM admins WHERE email = ?', [email.trim().toLowerCase()]);
        if (admins.length === 0) {
            return res.status(404).json({ message: "Account not found." });
        }

        const admin = admins[0];
        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            return res.status(401).json({ message: "Incorrect password." });
        }

        const token = jwt.sign(
            { admin_id: admin.admin_id, role: admin.role, name: admin.name },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            admin: { admin_id: admin.admin_id, name: admin.name, email: admin.email, role: admin.role }
        });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// CREATE STAFF ACCOUNT — super_admin only, done from inside the dashboard
app.post('/api/admin/create', verifyToken, requireSuperAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: "Please fill in all fields." });
    }
    if (!['admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role." });
    }
    try {
        const [existing] = await db.query('SELECT admin_id FROM admins WHERE email = ?', [email.trim().toLowerCase()]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "An account with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email.trim().toLowerCase(), hashedPassword, role]
        );

        res.status(201).json({ success: true, message: "Account created successfully." });
    } catch (err) {
        console.error("Create admin error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// List all staff accounts, for the "Manage Staff Accounts" table.
app.get('/api/admin/staff', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT admin_id, name, email, role, created_at FROM admins ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reads the current period + how many students would be affected, so the
app.get('/api/admin/semester-status', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const currentPeriod = await getCurrentPeriod();
        const [[{ approvedCount }]] = await db.query(
            'SELECT COUNT(*) AS approvedCount FROM students WHERE status = "approved"'
        );
        res.json({ current_period: currentPeriod, approved_student_count: approvedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/start-new-semester', verifyToken, requireSuperAdmin, async (req, res) => {
    const { new_period } = req.body;
    if (!new_period || !new_period.trim()) {
        return res.status(400).json({ message: "Please provide a name for the new academic period." });
    }
    try {
        await db.query(
            "UPDATE settings SET setting_value = ? WHERE setting_key = 'current_period'",
            [new_period.trim()]
        );

        const [result] = await db.query(
            'UPDATE students SET status = "pending", qr_code = NULL WHERE status = "approved"'
        );

        res.json({
            success: true,
            message: `New semester started: ${new_period.trim()}. ${result.affectedRows} student(s) will need to renew.`,
            affected_count: result.affectedRows,
        });
    } catch (err) {
        console.error("Start new semester error:", err.message);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/student/profile/:student_number', async (req, res) => {
    const { student_number } = req.params;

    try {
        const [students] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (!students || students.length === 0) {
        return res.status(404).json({ message: 'Student profile not found.' });
        }
        const { password: _omit, ...safeStudent } = students[0];
        return res.status(200).json(safeStudent);

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
app.delete('/api/logs/delete/:log_id', verifyToken, requireSuperAdmin, async (req, res) => {
    const { log_id } = req.params;
    try {
        await db.query('DELETE FROM student_logs WHERE log_id = ?', [log_id]);
        res.json({ success: true, message: "Log deleted successfully." });
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

app.get('/api/guests/all', verifyToken, async (req, res) => {
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

// Guests have no QR to scan out with, so exits are marked manually by an admin.
app.patch('/api/guests/exit/:guest_log_id', verifyToken, async (req, res) => {
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

        const dayHourTotals = new Array(6).fill(0);
        const dayHourCounts = new Array(6).fill(0);
        const dayVisitCounts = new Array(6).fill(0);

        let totalStayMs = 0;
        let exitedCount = 0;

        myLogs.forEach(log => {
            if (!log.visit_date) return;
            const d = new Date(log.visit_date);
            const jsDay = d.getDay();
            if (jsDay === 0) return;
            const idx = jsDay - 1;
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