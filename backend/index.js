const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { verifyToken, requireSuperAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serves /public/reset-password.html and any other static assets. This is
// what the "one-time link" in the reset email actually opens — a plain
// HTML page.
app.use(express.static(path.join(__dirname, 'public')));

// Email transport for the forgot-password flow. Needs real SMTP
// credentials in .env — EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS,
// EMAIL_FROM (optional, defaults to EMAIL_USER). For Gmail specifically,
// EMAIL_USER's normal password will NOT work — Gmail requires an "App
// Password" (2-Step Verification must be on) generated from the Google
// Account security settings.

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const RESET_BASE_URL = process.env.RESET_BASE_URL || `http://localhost:${PORT}`;

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

// Generates a one-time reset token. The raw token is what goes in the
// email link and is the only thing that can ever redeem the reset — only
// its SHA-256 hash is stored, the same principle as never storing
// plaintext passwords. 30-minute expiry is standard for this kind of flow.
function generateResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    return { token, tokenHash, expiresAt };
}

const VALID_SEX_VALUES = ['male', 'female', 'prefer_not_to_say'];

// Fields an admin is allowed to edit on an existing student account via
// PUT /api/admin/students/:student_number. student_number and email are
// deliberately excluded — they're identity/login keys tied to QR history
// and auth. status/qr_code are excluded too — those stay in the dedicated
// approve/reject/deactivate/reactivate flow.
const STUDENT_EDITABLE_FIELDS = [
    'surname', 'first_name', 'middle_name',
    'phone_number', 'address', 'sex',
    'college', 'program', 'year_level'
];

// Parses "1st Semester A.Y. 2025-2026" / "2nd Semester A.Y. 2025-2026" /
// "Summer A.Y. 2025-2026" style strings and derives the logical next
// period(s) so the "Start New Semester" dropdown can offer real choices
// instead of free text. Returns [] if the current value doesn't match the
// expected pattern (e.g. old/manually-typed data) — the frontend falls
// back to a manual "Custom" entry in that case.
function computeNextPeriods(current) {
    if (!current) return [];
    const m = current.match(/^(1st Semester|2nd Semester|Summer)\s+A\.Y\.\s+(\d{4})-(\d{4})$/i);
    if (!m) return [];
    const [, termRaw, startYear, endYear] = m;
    const sy = parseInt(startYear, 10);
    const ey = parseInt(endYear, 10);
    const term = termRaw.toLowerCase();

    if (term === '1st semester') {
        return [`2nd Semester A.Y. ${sy}-${ey}`];
    }
    if (term === '2nd semester') {
        return [
            `Summer A.Y. ${sy}-${ey}`,
            `1st Semester A.Y. ${sy + 1}-${ey + 1}`,
        ];
    }
    // summer
    return [`1st Semester A.Y. ${sy + 1}-${ey + 1}`];
}

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

// FRESH REGISTRATION. Also handles the one legitimate case of an existing
// student resubmitting: a previously REJECTED account. Renewal (approved
// students whose semester lapsed) has its own separate endpoint (/api/renew).
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
        const hashedPassword = await bcrypt.hash(password, 10);
        const full_name = buildFullName(first_name, middle_name, surname);

        if (existingStudent) {
            // A previously REJECTED student is allowed to resubmit — they
            // were never approved in the first place, so this is a genuine
            // fresh attempt, not a duplicate. Full info is re-collected in
            // case whatever caused the rejection needs correcting.
            if (existingStudent.status === 'rejected') {
                await db.query(
                    `UPDATE students SET
                        full_name = ?, surname = ?, first_name = ?, middle_name = ?,
                        email = ?, phone_number = ?, address = ?, sex = ?, password = ?,
                        college = ?, program = ?, year_level = ?,
                        status = "pending", status_reason = NULL, qr_code = NULL, registered_period = ?
                     WHERE student_number = ?`,
                    [full_name, surname, first_name, middle_name || null,
                     email, phone_number, address, sex, hashedPassword,
                     college, program, year_level, currentPeriod, existingStudent.student_number]
                );

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

                return res.status(201).json({ message: "Registration resubmitted! Please wait for admin approval." });
            }

            // Approved, pending, or deactivated — never a fresh-registration
            // target. Approved/pending direct to login/renewal; deactivated
            // is intentionally admin-only to resolve (see Deactivate route).
            return res.status(400).json({
                message: existingStudent.status === 'deactivated'
                    ? "This account has been deactivated. Please contact the library to resolve this."
                    : "This account already exists. Please log in, or use Renew Registration from your Home screen."
            });
        }

        // Brand new student
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

// RENEWAL — academic info only. Deliberately cannot touch name, email,
// phone, address, sex, or password: those simply aren't in this payload.
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

        await db.query(
            `UPDATE students SET
                college = ?, program = ?, year_level = ?,
                status = "pending", status_reason = NULL, qr_code = NULL, registered_period = ?
             WHERE student_number = ?`,
            [college, program, year_level, currentPeriod, student_number]
        );

        const [result] = await db.query(
            `UPDATE registration_requests 
             SET college = ?, program = ?, year_level = ?, created_at = NOW()
             WHERE student_number = ? AND period = ? AND approval_status = "pending"`,
            [college, program, year_level, student_number, currentPeriod]
        );

        // No existing pending row for this period was found to update —
        // create one now instead of silently doing nothing.
        if (result.affectedRows === 0) {
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
        }

        res.status(201).json({ message: "Renewal submitted! Please wait for admin approval." });
    } catch (err) {
        console.error("Renewal error:", err.message);
        res.status(500).json({ error: "Database transaction error during renewal." });
    }
});

// CHANGE PASSWORD — requires the current password, standard security
// practice. Distinct from the forgot-password flow below: this is for a
// student who remembers their password and wants to change it; the
// forgot-password flow is for someone who's actually locked out.
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

// FORGOT PASSWORD — step 1: request a reset link. Always responds with
// the same generic message whether or not the email is registered, so
// this endpoint can't be used to check which emails are real accounts.
app.post('/api/student/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.trim()) {
        return res.status(400).json({ message: "Please enter your email address." });
    }

    const genericResponse = {
        success: true,
        message: "If that email is registered, a password reset link has been sent."
    };

    try {
        const [students] = await db.query(
            'SELECT student_number FROM students WHERE email = ?',
            [email.trim().toLowerCase()]
        );

        if (students.length === 0) {
            return res.json(genericResponse);
        }

        const student_number = students[0].student_number;

        // Invalidate any earlier unused link for this student first, so
        // only the most recently requested email can ever work — avoids a
        // confusing situation where two old emails are both still "live".
        await db.query(
            'DELETE FROM password_reset_tokens WHERE student_number = ? AND used_at IS NULL',
            [student_number]
        );

        const { token, tokenHash, expiresAt } = generateResetToken();
        await db.query(
            'INSERT INTO password_reset_tokens (student_number, token_hash, expires_at) VALUES (?, ?, ?)',
            [student_number, tokenHash, expiresAt]
        );

        const resetLink = `${RESET_BASE_URL}/reset-password.html?token=${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: email.trim().toLowerCase(),
            subject: 'Reset your eDiwa Library password',
            html: `
                <p>We received a request to reset your eDiwa Library password.</p>
                <p><a href="${resetLink}">Click here to reset your password</a></p>
                <p>This link is valid for 30 minutes and can only be used once.
                If you didn't request this, you can safely ignore this email.</p>
            `,
        });

        res.json(genericResponse);
    } catch (err) {
        console.error("Forgot password error:", err.message);
        // Still return the generic message even on internal failure — a
        // distinct error response here would itself leak whether the
        // email exists, defeating the point of the generic message above.
        res.json(genericResponse);
    }
});

// FORGOT PASSWORD — step 2: the reset-password.html page (opened from the
// email link) posts here with the raw token + new password. Token must be
// unused and unexpired; it's marked used immediately after a successful
// reset so the same link can never work twice.
app.post('/api/student/reset-password', async (req, res) => {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
        return res.status(400).json({ message: "Missing token or new password." });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [rows] = await db.query(
            'SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: "This reset link is invalid or has expired. Please request a new one." });
        }

        const resetRequest = rows[0];
        const hashedPassword = await bcrypt.hash(new_password, 10);

        await db.query('UPDATE students SET password = ? WHERE student_number = ?', [hashedPassword, resetRequest.student_number]);
        await db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_id = ?', [resetRequest.token_id]);

        res.json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
    } catch (err) {
        console.error("Reset password error:", err.message);
        res.status(500).json({ message: "Something went wrong. Please try again." });
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
            `UPDATE students SET status = "approved", status_reason = NULL, qr_code = ? WHERE student_number = ?`,
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

// REJECT — no longer deletes the student row. The account stays, marked
// "rejected" with a reason, so the mobile app can show the student WHY,
// and offer them a way to resubmit (see /api/register above). Deleting on
// reject made it structurally impossible to ever notify anyone of anything.
app.post('/api/admin/reject', verifyToken, async (req, res) => {
    const { request_id, reason } = req.body;
    if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "A reason is required to reject a registration." });
    }
    try {
        const [request] = await db.query('SELECT * FROM registration_requests WHERE request_id = ?', [request_id]);
        if (request.length === 0) return res.status(404).json({ message: "Request not found." });

        const student_number = request[0].student_number;

        await db.query(
            'UPDATE students SET status = "rejected", status_reason = ?, qr_code = NULL WHERE student_number = ?',
            [reason.trim(), student_number]
        );
        await db.query(
            'UPDATE registration_requests SET approval_status = "rejected", reason = ? WHERE request_id = ?',
            [reason.trim(), request_id]
        );

        res.json({ success: true, message: "Registration rejected." });
    } catch (err) {
        console.error("Reject error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Revokes a previously-approved student's access without deleting their
// record. Distinct from "rejected" so a deactivated approved student isn't
// confused with a request that was never approved.
app.post('/api/admin/deactivate', verifyToken, async (req, res) => {
    const { student_number, request_id, reason } = req.body;
    if (!student_number || !request_id) {
        return res.status(400).json({ message: "student_number and request_id are required." });
    }
    if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "A reason is required to deactivate an account." });
    }
    try {
        await db.query(
            'UPDATE students SET status = "deactivated", status_reason = ?, qr_code = NULL WHERE student_number = ?',
            [reason.trim(), student_number]
        );
        await db.query(
            'UPDATE registration_requests SET approval_status = "deactivated", reason = ? WHERE request_id = ?',
            [reason.trim(), request_id]
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
            'UPDATE students SET status = "approved", status_reason = NULL, qr_code = ? WHERE student_number = ?',
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

// SCANNING — kiosk-facing, intentionally not behind admin auth.
// Deliberately does NOT return full_name: this response is displayed on a
// publicly-viewable kiosk screen, so only student_number + program go
// back to the client. Anyone reading the full DB row still sees the name,
// but it never leaves the server for this endpoint.
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
            res.json({ success: true, action: 'exit', student_number: student.student_number, program: student.program });
        } else {
            await db.query('INSERT INTO student_logs (user_id, time_in, visit_date, status) VALUES (?, NOW(), CURDATE(), "inside")', [student.user_id]);
            res.json({ success: true, action: 'entry', student_number: student.student_number, program: student.program });
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

// FORCE EXIT ALL ACTIVE LOGS (Bulk action for closing time)
app.patch('/api/logs/force-exit-all', verifyToken, async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE student_logs SET time_out = NOW(), status = "exited" WHERE status = "inside"'
        );
        res.json({ 
            success: true, 
            message: `Successfully forced exit for ${result.affectedRows} student(s).` 
        });
    } catch (err) {
        console.error("Force exit all error:", err.message);
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

    if (!student.password) {
      return res.status(403).json({ message: 'This account needs a password set up. Please contact the library or re-register.' });
    }

    const match = await bcrypt.compare(password, student.password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

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

        // A fresh session_id on every login is what enforces single-session:
        // this overwrites whatever session_id was active before, so any
        // other device still holding the old token will fail the
        // verifyToken check on its very next request.
        const session_id = crypto.randomUUID();
        await db.query(
            'UPDATE admins SET current_session_id = ?, session_created_at = NOW() WHERE admin_id = ?',
            [session_id, admin.admin_id]
        );

        const token = jwt.sign(
            { admin_id: admin.admin_id, role: admin.role, name: admin.name, session_id },
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

// List all students for the Students management page (edit college/program/etc.)
app.get('/api/admin/students', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT user_id, full_name, surname, first_name, middle_name, email,
                    phone_number, address, sex, student_number, college, program,
                    year_level, status, status_reason, registered_period, created_at
             FROM students ORDER BY full_name ASC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit an existing student's info — college/program shifts, corrections, etc.
// Does NOT touch status or qr_code; that stays in the approve/deactivate flow.
// Every successful edit is recorded in student_edit_logs for accountability.
app.put('/api/admin/students/:student_number', verifyToken, async (req, res) => {
    const { student_number } = req.params;
    const updates = {};
    for (const field of STUDENT_EDITABLE_FIELDS) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No editable fields provided." });
    }
    if (updates.sex && !VALID_SEX_VALUES.includes(updates.sex)) {
        return res.status(400).json({ message: "Invalid value for sex." });
    }

    try {
        const [existingRows] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (existingRows.length === 0) {
            return res.status(404).json({ message: "Student not found." });
        }
        const existing = existingRows[0];

        // Keep full_name in sync if any name part changed.
        const surname = updates.surname ?? existing.surname;
        const first_name = updates.first_name ?? existing.first_name;
        const middle_name = updates.middle_name ?? existing.middle_name;
        const nameChanged = ['surname', 'first_name', 'middle_name'].some(f => f in updates);
        if (nameChanged) {
            updates.full_name = buildFullName(first_name, middle_name, surname);
        }

        const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
        const values = Object.values(updates);

        await db.query(
            `UPDATE students SET ${setClauses} WHERE student_number = ?`,
            [...values, student_number]
        );

        await db.query(
            `INSERT INTO student_edit_logs (student_number, admin_id, changes) VALUES (?, ?, ?)`,
            [student_number, req.admin.admin_id, JSON.stringify(updates)]
        );

        res.json({ success: true, message: "Student information updated." });
    } catch (err) {
        console.error("Update student error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Reads the current period + how many students would be affected, plus the
// computed valid "next period" options for the Start New Semester dropdown.
app.get('/api/admin/semester-status', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const currentPeriod = await getCurrentPeriod();
        const [[{ approvedCount }]] = await db.query(
            'SELECT COUNT(*) AS approvedCount FROM students WHERE status = "approved"'
        );
        res.json({
            current_period: currentPeriod,
            approved_student_count: approvedCount,
            next_period_options: computeNextPeriods(currentPeriod),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/start-new-semester', verifyToken, requireSuperAdmin, async (req, res) => {
    const { new_period, is_custom } = req.body;
    if (!new_period || !new_period.trim()) {
        return res.status(400).json({ message: "Please select or enter a name for the new academic period." });
    }
    const trimmed = new_period.trim();

    try {
        const currentPeriod = await getCurrentPeriod();
        const validOptions = computeNextPeriods(currentPeriod);

        if (!is_custom && validOptions.length > 0 && !validOptions.includes(trimmed)) {
            return res.status(400).json({
                message: "That doesn't match an expected next period. Use 'Custom' if this is intentional."
            });
        }

        await db.query(
            "UPDATE settings SET setting_value = ? WHERE setting_key = 'current_period'",
            [trimmed]
        );

        // Fetch approved students before updating status
        const [approvedStudents] = await db.query(
            'SELECT * FROM students WHERE status = "approved"'
        );

        // Flip status to pending and clear QR
        const [result] = await db.query(
            'UPDATE students SET status = "pending", qr_code = NULL WHERE status = "approved"'
        );

        // Insert a pending renewal request row for the new period (academic info starts blank until mobile submission)
        for (const student of approvedStudents) {
            await db.query(
                `INSERT INTO registration_requests (
                    full_name, surname, first_name, middle_name,
                    email, phone_number, address, sex,
                    student_number, college, program, year_level, period,
                    approval_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, "pending", NOW())`,
                [
                    student.full_name, student.surname, student.first_name, student.middle_name,
                    student.email, student.phone_number, student.address, student.sex,
                    student.student_number, trimmed
                ]
            );
        }

        res.json({
            success: true,
            message: `New semester started: ${trimmed}. ${result.affectedRows} student(s) set to pending renewal.`,
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

// VOID log entry (Soft Delete)
app.patch('/api/logs/void/:log_id', verifyToken, requireSuperAdmin, async (req, res) => {
    const { log_id } = req.params;
    const { reason } = req.body;
    try {
        // You could also create a 'void_reason' column in student_logs to store the reason provided from the frontend
        await db.query('UPDATE student_logs SET status = "voided" WHERE log_id = ?', [log_id]);
        res.json({ success: true, message: "Log voided successfully." });
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

app.get('/api/guests/live-count', async (req, res) => {
    try {
        const [[{ count }]] = await db.query(
            'SELECT COUNT(*) as count FROM guest_logs WHERE status = "inside"'
        );
        res.json({ count });
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
            'SELECT time_in, time_out, visit_date FROM student_logs WHERE user_id = ? AND status != "voided"',
            [user_id]
        );

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