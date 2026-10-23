process.env.TZ = "Asia/Manila";

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();
const cron = require('node-cron');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { verifyToken, requireSuperAdmin } = require('./middleware/auth');
const { checkCorImage, uploadCor, corViewUrl, deleteCor } = require('./corStorage');
const { otpLimiter, registerLimiter, forgotPasswordLimiter, loginLimiter, guestLimiter, availabilityLimiter } = require('./rateLimits');

const app = express();
// Render sits in front of this server (a proxy). This lets the rate limits see
// each visitor's real IP address instead of Render's.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// maxAge: the browser remembers the CORS permission for 10 minutes instead of asking
// (an extra "preflight" request) before almost every admin request.
app.use(cors({ maxAge: 600 }));
// 4 MB limit: registrations now include a compressed COR photo (~150 KB).
app.use(express.json({ limit: '4mb' }));

// Serves /public/reset-password.html and any other static assets. This is
// what the "one-time link" in the reset email actually opens — a plain
// HTML page.
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] })); // /reset-password works too

// Opening the backend address in a browser shows a short note instead of "Cannot GET /".
app.get('/', (req, res) => {
    res.type('text/plain').send('QLess API is running. This is the server for the QLess library app and website.');
});

// Academic calendar: semesters with start/end dates that switch by themselves
// (passes expire on the end date, renewal opens on the next start date).
require('./semesters')(app, { db, verifyToken, requireSuperAdmin, cron });

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

// Sends one email. If BREVO_API_KEY is set (deployed on Render, where SMTP ports
// are blocked) it uses Brevo's web API; otherwise it uses the SMTP settings above.
async function sendEmail({ to, subject, html }) {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (process.env.BREVO_API_KEY) {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: { name: 'QLess Library', email: from },
                to: [{ email: to }],
                subject,
                htmlContent: html,
            }),
        });
        if (!response.ok) throw new Error(`Brevo error ${response.status}: ${await response.text()}`);
        return;
    }
    await transporter.sendMail({ from, to, subject, html });
}

// Address used in the reset-password email link.
//   - Deployed: set RESET_BASE_URL in .env (e.g. https://qless.example.com).
//   - Local testing: leave it empty — the link then uses the same address the
//     app used to reach this server (e.g. http://192.168.1.64:5000), so it keeps
//     working even when the laptop's Wi-Fi IP changes.
const RESET_BASE_URL = (process.env.RESET_BASE_URL || '').replace(/\/$/, '');

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

// Only CvSU school emails can register, e.g. juan.delacruz@cvsu.edu.ph
// Names: letters only (incl. ñ and accented letters), plus spaces, hyphens,
// apostrophes and periods. Same rule as the mobile Register screen.
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;
const NAME_RULE_MESSAGE = "Names can only contain letters, spaces, hyphens, apostrophes and periods.";
// Checks surname / first name / middle name; empty middle name is fine.
const namesAreValid = (...names) => names.every((n) => !n || !String(n).trim() || NAME_REGEX.test(String(n).trim()));

const CVSU_EMAIL_REGEX = /^[^\s@]+@cvsu\.edu\.ph$/i;

// Student password rule: 8+ characters with an uppercase letter, a lowercase
// letter and a number. Same rule as the mobile app's checklist.
const PASSWORD_RULE_MESSAGE = "Password needs at least 8 characters, an uppercase letter, a lowercase letter, and a number.";

// True if the password follows the rule above.
function isStrongPassword(pw) {
    return typeof pw === 'string' && pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw);
}

// Makes a random 10-character password for a new / reset staff account, e.g. "Kp7mXr4tQa".
// Skips look-alike characters (0/O, 1/l/I) so it's easy to read out or write down.
// Always has an uppercase letter, a lowercase letter and a number (passes isStrongPassword).
function generateTempPassword() {
    const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ', LOWER = 'abcdefghijkmnopqrstuvwxyz', DIGITS = '23456789';
    const ALL = UPPER + LOWER + DIGITS;
    const pick = (set) => set[crypto.randomInt(set.length)];
    const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
    while (chars.length < 10) chars.push(pick(ALL));
    // shuffle so the first three aren't always upper/lower/number
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

// Adds admins.password_is_temp once (1 = still using the password the super admin gave them).
async function ensureAdminColumns() {
    const [cols] = await db.query("SHOW COLUMNS FROM admins LIKE 'password_is_temp'");
    if (cols.length === 0) {
        await db.query('ALTER TABLE admins ADD COLUMN password_is_temp TINYINT(1) NOT NULL DEFAULT 0');
        console.log('Added admins.password_is_temp column');
    }
}
ensureAdminColumns().catch((err) => console.error('ensureAdminColumns error:', err.message));

// EMAIL VERIFICATION (OTP) FOR NEW REGISTRATIONS
// One row per email: the latest 6-digit code (saved as a SHA-256 hash, never as
// plain text), when it expires, how many wrong tries so far, and when it was sent.
const OTP_TTL_MINUTES = 10;      // a code works for 10 minutes
const OTP_MAX_ATTEMPTS = 5;      // after 5 wrong tries the student must request a new code
const OTP_RESEND_SECONDS = 60;   // wait 1 minute before sending another code

// Creates the email_verifications table if it doesn't exist yet.
async function ensureOtpTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS email_verifications (
            email VARCHAR(255) NOT NULL PRIMARY KEY,
            code_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            last_sent_at DATETIME NOT NULL
        )`);
}
ensureOtpTable().catch((err) => console.error('ensureOtpTable error:', err.message));

// Adds the "archived" columns to admins if they aren't there yet.
// (MySQL has no "ADD COLUMN IF NOT EXISTS", so we check the table first.)
// An archived staff account can't sign in, but its records stay (who approved what).
async function ensureAdminArchiveColumns() {
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME IN ('is_archived', 'archived_at')`
    );
    const have = cols.map((c) => c.COLUMN_NAME);
    if (!have.includes('is_archived')) {
        await db.query('ALTER TABLE admins ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!have.includes('archived_at')) {
        await db.query('ALTER TABLE admins ADD COLUMN archived_at DATETIME NULL');
    }
}
ensureAdminArchiveColumns().catch((err) => console.error('ensureAdminArchiveColumns error:', err.message));

// Adds students.privacy_consent_at if it isn't there yet: the date and time the
// student agreed to the Privacy Notice in the app (proof of consent, Data Privacy Act).
async function ensurePrivacyConsentColumn() {
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'privacy_consent_at'`
    );
    if (cols.length === 0) {
        await db.query('ALTER TABLE students ADD COLUMN privacy_consent_at DATETIME NULL');
    }
}
ensurePrivacyConsentColumn().catch((err) => console.error('ensurePrivacyConsentColumn error:', err.message));

// Adds registration_requests.cor_public_id if it isn't there yet: the Cloudinary ID
// of the student's COR photo. Cleared (NULL) once the photo is deleted after review.
async function ensureCorColumn() {
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registration_requests' AND COLUMN_NAME = 'cor_public_id'`
    );
    if (cols.length === 0) {
        await db.query('ALTER TABLE registration_requests ADD COLUMN cor_public_id VARCHAR(255) NULL');
    }
}
ensureCorColumn().catch((err) => console.error('ensureCorColumn error:', err.message));

// Deletes the COR photo of a registration request (after approve / reject) and
// clears its ID. Never blocks the approval if Cloudinary is unreachable.
async function removeCorForRequest(requestId) {
    try {
        const [[row]] = await db.query('SELECT cor_public_id FROM registration_requests WHERE request_id = ?', [requestId]);
        if (row && row.cor_public_id) {
            await deleteCor(row.cor_public_id);
            await db.query('UPDATE registration_requests SET cor_public_id = NULL WHERE request_id = ?', [requestId]);
        }
    } catch (err) {
        console.error('removeCorForRequest error:', err.message);
    }
}

// Turns a code into its SHA-256 hash (what we store and compare).
const hashOtp = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

// Checks a code typed by the student. Returns { ok: true } or { ok: false, message }.
// A wrong code counts as one attempt. The row is deleted only after the
// registration is saved (see /api/register), so a later error doesn't waste the code.
async function checkOtp(email, code) {
    const [rows] = await db.query(
        'SELECT code_hash, attempts, expires_at < NOW() AS expired FROM email_verifications WHERE email = ?',
        [email]
    );
    if (rows.length === 0) return { ok: false, message: 'Please request a verification code first.' };
    const row = rows[0];
    if (row.expired) return { ok: false, message: 'This code has expired. Please tap "Resend code".' };
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
        return { ok: false, message: 'Too many wrong tries. Please tap "Resend code" for a new one.' };
    }
    if (!/^\d{6}$/.test(String(code || '')) || hashOtp(code) !== row.code_hash) {
        await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?', [email]);
        const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
        return { ok: false, message: left > 0 ? `Incorrect code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Incorrect code. Please tap "Resend code" for a new one.' };
    }
    return { ok: true };
}

// Email with the 6-digit code — same look as the reset-password email.
function buildOtpEmail(code) {
    return `
    <div style="background:#F7F8F7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
        <tr>
          <td style="background:#0E3B1F;padding:28px 28px 24px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">
              <span style="color:#F0CD5A;">Q</span>Less
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Ladislao N. Diwa Memorial Library</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Verify your email</h1>
            <p style="margin:0 0 22px;font-size:14px;line-height:21px;color:#4B5563;">
              Enter this code in the QLess app to finish your registration.
            </p>
            <div style="text-align:center;font-size:34px;font-weight:800;letter-spacing:10px;color:#0E3B1F;background:#E8F1E9;border-radius:14px;padding:16px 0;">${code}</div>
            <div style="margin-top:22px;padding:14px 16px;background:#FBF3DC;border-radius:14px;font-size:13px;line-height:19px;color:#946800;">
              This code expires in <b>${OTP_TTL_MINUTES} minutes</b>. Never share it with anyone.
            </div>
            <p style="margin:20px 0 0;font-size:12px;line-height:18px;color:#9CA3AF;">
              Didn't register for QLess? You can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </div>`;
}

// Allowed year levels. Veterinary Medicine is a 6-year program.
const VETMED_COLLEGE = 'College of Veterinary Medicine and Biomedical Sciences';
const BASE_YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

// Returns true if this phone number already belongs to ANOTHER student's
// account. Rejected accounts don't count (they're inactive and may resubmit).
// Compares only the last 10 digits, so older records saved as "0912...",
// "63912..." or "+63 912 345 6789" still match "+639123456789".
async function isPhoneUsedByAnother(phone_number, student_number) {
    const last10 = String(phone_number || '').replace(/\D/g, '').slice(-10);
    if (last10.length !== 10) return false;
    const [rows] = await db.query(
        `SELECT student_number FROM students
         WHERE RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', ''), 10) = ?
           AND student_number <> ? AND status <> 'rejected'
         LIMIT 1`,
        [last10, student_number || '']
    );
    return rows.length > 0;
}

// True if the year level is allowed for that college (6th Year = Vet Med only).
function isValidYearLevel(college, year_level) {
    const allowed = college === VETMED_COLLEGE ? [...BASE_YEAR_LEVELS, '6th Year'] : BASE_YEAR_LEVELS;
    return allowed.includes(year_level);
}

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
// SEND OTP — the app calls this when the student taps Submit on a new registration.
// Emails a 6-digit code to the CvSU email. The registration itself is only saved
// once the correct code is sent with it to /api/register.
app.post('/api/register/send-otp', otpLimiter, async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const student_number = String(req.body.student_number || '');
    if (!CVSU_EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: "Please use your CvSU email ending in @cvsu.edu.ph." });
    }
    try {
        // Same rule as /api/register: the email can't belong to another student.
        const [byEmail] = await db.query('SELECT student_number FROM students WHERE LOWER(email) = ?', [email]);
        if (byEmail.length > 0 && byEmail[0].student_number !== student_number) {
            return res.status(400).json({ message: "This email is already associated with a different student number." });
        }

        // Wait 1 minute between codes (stops spamming someone's inbox).
        const [rows] = await db.query(
            'SELECT TIMESTAMPDIFF(SECOND, last_sent_at, NOW()) AS since FROM email_verifications WHERE email = ?',
            [email]
        );
        if (rows.length > 0 && rows[0].since < OTP_RESEND_SECONDS) {
            const wait = OTP_RESEND_SECONDS - rows[0].since;
            return res.status(429).json({ message: `Please wait ${wait} seconds before requesting a new code.`, retry_after_seconds: wait });
        }

        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await db.query(
            `INSERT INTO email_verifications (email, code_hash, expires_at, attempts, last_sent_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, NOW())
             ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at),
                                     attempts = 0, last_sent_at = NOW()`,
            [email, hashOtp(code), OTP_TTL_MINUTES]
        );
        await sendEmail({ to: email, subject: 'Your QLess verification code', html: buildOtpEmail(code) });

        res.json({ success: true, message: `We sent a 6-digit code to ${email}.`, retry_after_seconds: OTP_RESEND_SECONDS });
    } catch (err) {
        console.error('Send OTP error:', err.message);
        res.status(500).json({ message: "We couldn't send the code right now. Please try again." });
    }
});

app.post('/api/register', registerLimiter, async (req, res) => {
    const {
        surname, first_name, middle_name,
        phone_number, address, sex,
        student_number, password,
        college, program, year_level
    } = req.body;
    // Emails are compared in lowercase everywhere (login too), so save them that way.
    const email = (req.body.email || '').trim().toLowerCase();

    if (!surname || !first_name || !email || !phone_number || !address || !sex ||
        !student_number || !password || !college || !program || !year_level) {
        return res.status(400).json({ message: "Please fill in all required fields." });
    }
    if (!isStrongPassword(password)) {
        return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
    }
    if (!namesAreValid(surname, first_name, middle_name)) {
        return res.status(400).json({ message: NAME_RULE_MESSAGE });
    }
    // The student must agree to the Privacy Notice before we keep their details.
    if (req.body.privacy_consent !== true) {
        return res.status(400).json({ message: "Please read and agree to the Privacy Notice and Terms of Use." });
    }
    // A photo of the COR is required (proof of enrollment for the student number).
    const corError = checkCorImage(req.body.cor_image);
    if (corError) {
        return res.status(400).json({ message: corError });
    }
    if (!VALID_SEX_VALUES.includes(sex)) {
        return res.status(400).json({ message: "Invalid value for sex." });
    }
    if (!CVSU_EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: "Please use your CvSU email ending in @cvsu.edu.ph." });
    }
    if (!/^\d{9}$/.test(student_number)) {
        return res.status(400).json({ message: "Student number must be exactly 9 digits." });
    }
    if (!isValidYearLevel(college, year_level)) {
        return res.status(400).json({ message: "Invalid year level for the selected college." });
    }

    try {
        // The email must be verified with the code sent by /api/register/send-otp.
        // otp_error tells the app to keep the code pop-up open so the student can retry.
        const otp = await checkOtp(email, req.body.otp);
        if (!otp.ok) {
            return res.status(400).json({ otp_error: true, message: otp.message });
        }

        const currentPeriod = await getCurrentPeriod();

        // One active account per phone number.
        if (await isPhoneUsedByAnother(phone_number, student_number)) {
            return res.status(400).json({ message: "This phone number is already used by another account." });
        }

        const [byNumber] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        const [byEmail] = await db.query('SELECT * FROM students WHERE LOWER(email) = ?', [email]);

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
                // Upload the COR photo FIRST, so a failed upload changes nothing.
                const corId = await uploadCor(req.body.cor_image, student_number);
                await db.query(
                    `UPDATE students SET
                        full_name = ?, surname = ?, first_name = ?, middle_name = ?,
                        email = ?, phone_number = ?, address = ?, sex = ?, password = ?,
                        college = ?, program = ?, year_level = ?,
                        status = "pending", status_reason = NULL, qr_code = NULL, registered_period = ?,
                        privacy_consent_at = NOW()
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
                        approval_status, created_at, cor_public_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW(), ?)`,
                    [full_name, surname, first_name, middle_name || null,
                     email, phone_number, address, sex,
                     student_number, college, program, year_level, currentPeriod, corId]
                );

                await db.query('DELETE FROM email_verifications WHERE email = ?', [email]); // code used up
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

        // Brand new student. Store the COR photo first (Cloudinary); only its ID goes in the database.
        const corId = await uploadCor(req.body.cor_image, student_number);
        await db.query(
            `INSERT INTO registration_requests (
                full_name, surname, first_name, middle_name,
                email, phone_number, address, sex,
                student_number, college, program, year_level, period,
                approval_status, created_at, cor_public_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW(), ?)`,
            [full_name, surname, first_name, middle_name || null,
             email, phone_number, address, sex,
             student_number, college, program, year_level, currentPeriod, corId]
        );

        await db.query(
            `INSERT INTO students (
                full_name, surname, first_name, middle_name,
                email, phone_number, address, sex, password,
                student_number, college, program, year_level,
                qr_code, status, registered_period, privacy_consent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, "pending", ?, NOW())`,
            [full_name, surname, first_name, middle_name || null,
             email, phone_number, address, sex, hashedPassword,
             student_number, college, program, year_level, currentPeriod]
        );

        await db.query('DELETE FROM email_verifications WHERE email = ?', [email]); // code used up
        res.status(201).json({ message: "Registration submitted successfully!" });
    } catch (err) {
        console.error(err);
        if (err.corUpload) {
            return res.status(502).json({ message: "We couldn't save your registration form photo. Please try again." });
        }
        res.status(500).json({ error: "Database transaction error during entry configuration." });
    }
});

// Live check for the mobile Register screen: is this student number free?
// Only says yes/no, a reason ("registered" / "deactivated") and a message;
// never returns whose account it is.
// A previously REJECTED account counts as free, since /api/register lets it resubmit.
app.get('/api/register/check-student-number/:student_number', availabilityLimiter, async (req, res) => {
    const { student_number } = req.params;
    if (!/^\d{9}$/.test(student_number)) {
        return res.status(400).json({ available: false, message: "Student number must be exactly 9 digits." });
    }
    try {
        const [rows] = await db.query('SELECT status FROM students WHERE student_number = ?', [student_number]);
        if (rows.length === 0) {
            return res.json({ available: true, message: "Student number is available." });
        }
        // ?for_change=1 → a rejected student correcting their number: ANY existing
        // account with this number means it's taken.
        if (req.query.for_change === '1') {
            return res.json({ available: false, reason: "taken", message: "This student number is already used by another account." });
        }
        const status = rows[0].status;
        if (status === 'rejected') {
            return res.json({ available: true, message: "Your earlier registration was rejected — you can register again." });
        }
        if (status === 'deactivated') {
            return res.json({ available: false, reason: "deactivated", message: "This account is deactivated. Please visit the library front desk." });
        }
        return res.json({ available: false, reason: "registered", message: "Already registered. Please log in instead." });
    } catch (err) {
        console.error("Student number check error:", err.message);
        res.status(500).json({ message: "Could not check right now." });
    }
});

// Live check for the mobile Register screen: is this CvSU email free?
// ?student_number=... lets a student re-registering after a rejection reuse
// their own email. Only answers yes/no; never says whose account it is.
app.get('/api/register/check-email/:email', availabilityLimiter, async (req, res) => {
    const email = String(req.params.email || '').trim().toLowerCase();
    const { student_number } = req.query;
    if (!CVSU_EMAIL_REGEX.test(email)) {
        return res.status(400).json({ available: false, message: "Must be a CvSU email ending in @cvsu.edu.ph" });
    }
    try {
        const [rows] = await db.query(
            'SELECT student_number, status FROM students WHERE LOWER(email) = ? LIMIT 1',
            [email]
        );
        if (rows.length === 0) {
            return res.json({ available: true, message: "Email is available." });
        }
        const owner = rows[0];
        // Same student whose earlier registration was rejected: they may resubmit.
        if (owner.student_number === student_number && owner.status === 'rejected') {
            return res.json({ available: true, message: "Email is available." });
        }
        if (owner.status === 'deactivated') {
            return res.json({ available: false, reason: "deactivated", message: "This email belongs to a deactivated account. Please visit the library front desk." });
        }
        return res.json({ available: false, reason: "registered", message: "This email is already registered. Please log in instead." });
    } catch (err) {
        console.error("Email check error:", err.message);
        res.status(500).json({ message: "Could not check right now." });
    }
});

// Live check for the mobile Register screen: is this phone number free?
// ?student_number=... lets a student re-registering after a rejection reuse
// their own phone. Only answers yes/no; never says whose number it is.
app.get('/api/register/check-phone/:phone_number', availabilityLimiter, async (req, res) => {
    const { phone_number } = req.params;
    const { student_number } = req.query;
    if (!/^\+639\d{9}$/.test(phone_number)) {
        return res.status(400).json({ available: false, message: "Please enter all 10 digits after +63." });
    }
    try {
        if (await isPhoneUsedByAnother(phone_number, student_number)) {
            return res.json({ available: false, reason: "in_use", message: "This phone number is already used by another account." });
        }
        res.json({ available: true, message: "Phone number is available." });
    } catch (err) {
        console.error("Phone check error:", err.message);
        res.status(500).json({ message: "Could not check right now." });
    }
});

// ---------------------------------------------------------------------------
// STUDENT LOGIN PASS (token)
// At login the app gets a signed token and keeps it on the phone, so the
// student stays logged in (even offline) until they log out. Routes that
// change a student's own account check this token instead of a password.
// ---------------------------------------------------------------------------
const STUDENT_TOKEN_DAYS = 180; // about one school year

// Creates the login pass for a student.
function issueStudentToken(student_number) {
    return jwt.sign({ student_number, type: 'student' }, process.env.JWT_SECRET, { expiresIn: `${STUDENT_TOKEN_DAYS}d` });
}

// Middleware: only lets the request through if it has a valid student login pass.
// Puts the student's number in req.student for the route to use.
// WRONG-PASSWORD LIMIT (stops password guessing)
// After 5 wrong passwords for the same account within 15 minutes, that account's
// password checks are blocked for 5 minutes. A warning starts at the 3rd wrong try. Counted per ACCOUNT (not per device),
// so switching phones or browsers doesn't help a guesser. A correct password resets it.
// Kept in memory: a server restart clears it (fine for this purpose).
const MAX_WRONG_PASSWORDS = 5;
const WRONG_PASSWORD_WINDOW_MS = 15 * 60 * 1000; // count wrong tries within 15 minutes
const LOCKOUT_MS = 5 * 60 * 1000;                // then block for 5 minutes
const WARN_FROM_TRY = 3;                         // show "tries left" from the 3rd wrong password
const wrongPasswords = new Map(); // key ("student:202312345" / "admin:a@b.com") -> { count, firstAt, lockedUntil }

// How many seconds this account is still locked (0 = not locked).
function lockedSeconds(key) {
    const entry = wrongPasswords.get(key);
    if (!entry || !entry.lockedUntil) return 0;
    const left = entry.lockedUntil - Date.now();
    if (left <= 0) { wrongPasswords.delete(key); return 0; }
    return Math.ceil(left / 1000);
}

// Counts one wrong password; locks the account when the limit is reached.
function recordWrongPassword(key) {
    const now = Date.now();
    let entry = wrongPasswords.get(key);
    if (!entry || now - entry.firstAt > WRONG_PASSWORD_WINDOW_MS) entry = { count: 0, firstAt: now, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_WRONG_PASSWORDS) entry.lockedUntil = now + LOCKOUT_MS;
    wrongPasswords.set(key, entry);
    return MAX_WRONG_PASSWORDS - entry.count; // tries left
}

// Correct password: forget the wrong tries.
function clearWrongPasswords(key) {
    wrongPasswords.delete(key);
}

// Message for a wrong password: plain for the 1st and 2nd try, then a warning
// with how many tries are left, then the "locked" message on the last one.
function wrongPasswordMessage(triesLeft, forStaff = false) {
    if (triesLeft <= 0) return lockedMessage(LOCKOUT_MS / 1000, forStaff);
    const used = MAX_WRONG_PASSWORDS - triesLeft;
    if (used < WARN_FROM_TRY) return 'Incorrect password.';
    const minutes = LOCKOUT_MS / 60000;
    return `Incorrect password. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left before your account is locked for ${minutes} minutes.`;
}

// The message shown while an account is locked (staff can't use Forgot Password,
// so they're told to ask the Super Admin instead).
function lockedMessage(seconds, forStaff = false) {
    const minutes = Math.ceil(seconds / 60);
    const wait = `Too many wrong passwords. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}`;
    return forStaff ? `${wait}, or ask the Super Admin to reset your password.` : `${wait}, or use Forgot Password.`;
}

// Removes old entries every 30 minutes so the list doesn't grow forever.
setInterval(() => {
    const now = Date.now();
    for (const [key, e] of wrongPasswords) {
        if ((e.lockedUntil && e.lockedUntil < now) || (!e.lockedUntil && now - e.firstAt > WRONG_PASSWORD_WINDOW_MS)) wrongPasswords.delete(key);
    }
}, 30 * 60 * 1000);

function verifyStudentToken(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Please log in again." });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'student') throw new Error('not a student token');
        req.student = decoded;
        next();
    } catch {
        return res.status(401).json({ message: "Your login has expired. Please log in again." });
    }
}

// RESUBMIT A REJECTED REGISTRATION (PUT = replace the whole registration).
// The mobile app sends the full, corrected form with the student's login pass,
// so only the logged-in account owner can resubmit (no password needed).
// Only rejected accounts can use this; the account goes back to "pending".
// ---------------------------------------------------------------------------
// FIXING A WRONG STUDENT NUMBER (on resubmit)
// A rejected student may correct their student number ONLY if the account was
// never approved (no visit logs, no approved / expired / deactivated request).
// An approved student's number was already verified, so it stays locked.
// ---------------------------------------------------------------------------
async function canChangeStudentNumber(userId, studentNumber) {
    const [[{ logs }]] = await db.query('SELECT COUNT(*) AS logs FROM student_logs WHERE user_id = ?', [userId]);
    const [[{ verified }]] = await db.query(
        `SELECT COUNT(*) AS verified FROM registration_requests
         WHERE student_number = ? AND approval_status IN ("approved", "expired", "deactivated")`,
        [studentNumber]
    );
    return logs === 0 && verified === 0;
}

// Changes a student number everywhere it's stored, inside the given transaction
// connection. Finds every table with a student_number column, so nothing is left
// pointing to the old number. Foreign-key checks are paused only for this
// connection while the rows are updated together, then turned back on.
async function moveStudentNumber(conn, oldNumber, newNumber) {
    const [tables] = await conn.query(
        `SELECT TABLE_NAME AS t FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'student_number'`
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
        for (const { t } of tables) {
            await conn.query(`UPDATE \`${t}\` SET student_number = ? WHERE student_number = ?`, [newNumber, oldNumber]);
        }
    } finally {
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    }
}

app.put('/api/registration/:student_number', verifyStudentToken, async (req, res) => {
    const { student_number } = req.params;
    // The login pass must belong to this same student.
    if (req.student.student_number !== student_number) {
        return res.status(403).json({ message: "You can only resubmit your own registration." });
    }
    const {
        surname, first_name, middle_name,
        phone_number, address, sex,
        college, program, year_level,
    } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    // Same checks as a new registration.
    if (!surname || !first_name || !email || !phone_number || !address || !sex ||
        !college || !program || !year_level) {
        return res.status(400).json({ message: "Please fill in all required fields." });
    }
    if (!VALID_SEX_VALUES.includes(sex)) {
        return res.status(400).json({ message: "Invalid value for sex." });
    }
    if (!CVSU_EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: "Please use your CvSU email ending in @cvsu.edu.ph." });
    }
    if (!/^\+639\d{9}$/.test(phone_number)) {
        return res.status(400).json({ message: "Please enter all 10 digits after +63." });
    }
    if (!isValidYearLevel(college, year_level)) {
        return res.status(400).json({ message: "Invalid year level for the selected college." });
    }
    if (!namesAreValid(surname, first_name, middle_name)) {
        return res.status(400).json({ message: NAME_RULE_MESSAGE });
    }
    // A new COR photo is required when resubmitting too.
    const corError = checkCorImage(req.body.cor_image);
    if (corError) {
        return res.status(400).json({ message: corError });
    }

    try {
        const [rows] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "No account found for this student number." });
        }
        const student = rows[0];

        if (student.status !== 'rejected') {
            return res.status(409).json({ message: "Only rejected registrations can be resubmitted." });
        }

        // Did the student correct their student number?
        const newNumber = String(req.body.new_student_number || '').trim();
        const changingNumber = newNumber !== '' && newNumber !== student_number;
        if (changingNumber) {
            if (!/^\d{9}$/.test(newNumber)) {
                return res.status(400).json({ message: "Student number must be exactly 9 digits." });
            }
            if (!(await canChangeStudentNumber(student.user_id, student_number))) {
                return res.status(403).json({ message: "Your student number was already verified, so it can't be changed here. Please visit the library front desk." });
            }
            const [taken] = await db.query('SELECT user_id FROM students WHERE student_number = ? LIMIT 1', [newNumber]);
            if (taken.length > 0) {
                return res.status(400).json({ message: "This student number is already used by another account." });
            }
        }
        // The number this registration will use from now on.
        const finalNumber = changingNumber ? newNumber : student_number;

        // Email and phone must not belong to someone else.
        const [emailOwner] = await db.query(
            'SELECT student_number FROM students WHERE LOWER(email) = ? AND student_number <> ? LIMIT 1',
            [email, student_number]
        );
        if (emailOwner.length > 0) {
            return res.status(400).json({ message: "This email is already registered to another account." });
        }
        if (await isPhoneUsedByAnother(phone_number, student_number)) {
            return res.status(400).json({ message: "This phone number is already used by another account." });
        }

        const currentPeriod = await getCurrentPeriod();
        const full_name = buildFullName(first_name, middle_name, surname);

        // Upload the new COR photo FIRST, so a failed upload changes nothing.
        const corId = await uploadCor(req.body.cor_image, finalNumber);

        // Everything below is saved together (all or nothing).
        const conn = await db.getConnection();
        try {
        await conn.beginTransaction();

        // Corrected student number → update it in every table first.
        if (changingNumber) await moveStudentNumber(conn, student_number, finalNumber);

        // Replace the student's details and send them back to "pending".
        await conn.query(
            `UPDATE students SET
                full_name = ?, surname = ?, first_name = ?, middle_name = ?,
                email = ?, phone_number = ?, address = ?, sex = ?,
                college = ?, program = ?, year_level = ?,
                status = "pending", status_reason = NULL, qr_code = NULL, registered_period = ?
             WHERE student_number = ?`,
            [full_name, surname, first_name, middle_name || null,
             email, phone_number, address, sex,
             college, program, year_level, currentPeriod, finalNumber]
        );

        // New request row so it shows up as Pending on the admin Registrations page,
        // with the new COR photo (stored in Cloudinary; only its ID is saved here).
        await conn.query(
            `INSERT INTO registration_requests (
                full_name, surname, first_name, middle_name,
                email, phone_number, address, sex,
                student_number, college, program, year_level, period,
                approval_status, created_at, cor_public_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW(), ?)`,
            [full_name, surname, first_name, middle_name || null,
             email, phone_number, address, sex,
             finalNumber, college, program, year_level, currentPeriod, corId]
        );

        await conn.commit();
        } catch (err) {
            await conn.rollback();
            await deleteCor(corId); // nothing was saved, so don't keep the photo
            throw err;
        } finally {
            conn.release();
        }

        // A new student number needs a new login pass (the old one has the old number).
        res.json({
            success: true,
            message: "Registration resubmitted! Please wait for admin approval.",
            ...(changingNumber ? { student_number: finalNumber, token: issueStudentToken(finalNumber) } : {}),
        });
    } catch (err) {
        console.error("Resubmit error:", err.message);
        if (err.corUpload) {
            return res.status(502).json({ message: "We couldn't save your registration form photo. Please try again." });
        }
        res.status(500).json({ message: "Could not resubmit right now. Please try again." });
    }
});

// RENEWAL — academic info only. Deliberately cannot touch name, email,
// phone, address, sex, or password: those simply aren't in this payload.
// Needs the student's login pass, and only renews THAT student's own account.
app.post('/api/renew', verifyStudentToken, async (req, res) => {
    const { student_number, college, program, year_level } = req.body;
    if (!student_number || !college || !program || !year_level) {
        return res.status(400).json({ message: "Please complete all academic info fields." });
    }
    if (req.student.student_number !== student_number) {
        return res.status(403).json({ message: "You can only renew your own account." });
    }
    if (!isValidYearLevel(college, year_level)) {
        return res.status(400).json({ message: "Invalid year level for the selected college." });
    }
    // A photo of this semester's COR is required for renewal too.
    const corError = checkCorImage(req.body.cor_image);
    if (corError) {
        return res.status(400).json({ message: corError });
    }

    try {
        const [existing] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "No account found for this student number." });
        }
        const student = existing[0];
        // Semester ended and the next one hasn't started yet: renewal isn't open.
        if (student.status === 'expired') {
            return res.status(403).json({ message: "Your pass expired when the semester ended. Renewal opens when the next semester starts." });
        }
        const currentPeriod = await getCurrentPeriod();

        // Store the new COR photo. If they already sent one for this semester's
        // pending renewal, that older photo is deleted (only the latest is kept).
        const corId = await uploadCor(req.body.cor_image, student_number);
        const [oldCors] = await db.query(
            `SELECT cor_public_id FROM registration_requests
             WHERE student_number = ? AND period = ? AND approval_status = "pending" AND cor_public_id IS NOT NULL`,
            [student_number, currentPeriod]
        );
        for (const old of oldCors) await deleteCor(old.cor_public_id);

        await db.query(
            `UPDATE students SET
                college = ?, program = ?, year_level = ?,
                status = "pending", status_reason = NULL, qr_code = NULL, registered_period = ?
             WHERE student_number = ?`,
            [college, program, year_level, currentPeriod, student_number]
        );

        const [result] = await db.query(
            `UPDATE registration_requests 
             SET college = ?, program = ?, year_level = ?, created_at = NOW(), cor_public_id = ?
             WHERE student_number = ? AND period = ? AND approval_status = "pending"`,
            [college, program, year_level, corId, student_number, currentPeriod]
        );

        // No existing pending row for this period was found to update —
        // create one now instead of silently doing nothing.
        if (result.affectedRows === 0) {
            await db.query(
                `INSERT INTO registration_requests (
                    full_name, surname, first_name, middle_name,
                    email, phone_number, address, sex,
                    student_number, college, program, year_level, period,
                    approval_status, created_at, cor_public_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW(), ?)`,
                [student.full_name, student.surname, student.first_name, student.middle_name,
                 student.email, student.phone_number, student.address, student.sex,
                 student_number, college, program, year_level, currentPeriod, corId]
            );
        }

        res.status(201).json({ message: "Renewal submitted! Please wait for admin approval." });
    } catch (err) {
        console.error("Renewal error:", err.message);
        if (err.corUpload) {
            return res.status(502).json({ message: "We couldn't save your registration form photo. Please try again." });
        }
        res.status(500).json({ error: "Database transaction error during renewal." });
    }
});

// CHANGE PASSWORD — requires the current password, standard security
// practice. Distinct from the forgot-password flow below: this is for a
// student who remembers their password and wants to change it; the
// forgot-password flow is for someone who's actually locked out.
app.post('/api/student/change-password', loginLimiter, async (req, res) => {
    const { student_number, current_password, new_password } = req.body;
    if (!student_number || !current_password || !new_password) {
        return res.status(400).json({ message: "All fields are required." });
    }
    if (!isStrongPassword(new_password)) {
        return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
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

        // Same wrong-password limit as login, so this can't be used to guess passwords.
        const limitKey = `student:${student.student_number}`;
        const lockLeft = lockedSeconds(limitKey);
        if (lockLeft > 0) {
            return res.status(429).json({ message: lockedMessage(lockLeft), retry_after_seconds: lockLeft });
        }

        const match = await bcrypt.compare(current_password, student.password);
        if (!match) {
            const left = recordWrongPassword(limitKey);
            return res.status(401).json({
                message: wrongPasswordMessage(left).replace('Incorrect password.', 'Current password is incorrect.'),
            });
        }
        clearWrongPasswords(limitKey);
        // The new password must actually be new.
        if (await bcrypt.compare(new_password, student.password)) {
            return res.status(400).json({ message: "Your new password must be different from your current one." });
        }

        const newHashed = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE students SET password = ? WHERE student_number = ?', [newHashed, student_number]);

        res.json({ success: true, message: "Password changed successfully." });
    } catch (err) {
        console.error("Change password error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Limits for reset emails, per student: one email every 2 minutes, at most 5 a day.
// Stops someone from spamming a student's inbox (or using up the Gmail sending limit).
const RESET_COOLDOWN_SECONDS = 120;
const RESET_DAILY_LIMIT = 5;

// FORGOT PASSWORD — step 1: request a reset link. Always responds with
// the same generic message whether or not the email is registered, so
// this endpoint can't be used to check which emails are real accounts.
// If the student is still in the cooldown (or hit today's limit), no new
// email is sent, but the reply looks the same, so it still can't be used
// to find out which emails are registered.
app.post('/api/student/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email || !email.trim()) {
        return res.status(400).json({ message: "Please enter your email address." });
    }

    const genericResponse = {
        success: true,
        message: "If that email is registered, a password reset link has been sent.",
        retry_after_seconds: RESET_COOLDOWN_SECONDS, // the app waits this long before allowing "Resend"
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

        // Cooldown + daily limit: count this student's reset requests.
        const [[recent]] = await db.query(
            `SELECT COUNT(*) AS today_count,
                    COALESCE(MAX(created_at) > NOW() - INTERVAL ? SECOND, 0) AS too_soon
             FROM password_reset_tokens
             WHERE student_number = ? AND created_at > NOW() - INTERVAL 1 DAY`,
            [RESET_COOLDOWN_SECONDS, student_number]
        );
        if (Number(recent.too_soon) === 1 || Number(recent.today_count) >= RESET_DAILY_LIMIT) {
            return res.json(genericResponse); // same reply, but no email sent
        }

        // Cancel any earlier unused link for this student first, so only the
        // most recently requested email can ever work. (Marked as used instead
        // of deleted, so it still counts toward the daily limit.)
        await db.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE student_number = ? AND used_at IS NULL',
            [student_number]
        );

        const { token, tokenHash, expiresAt } = generateResetToken();
        await db.query(
            'INSERT INTO password_reset_tokens (student_number, token_hash, expires_at) VALUES (?, ?, ?)',
            [student_number, tokenHash, expiresAt]
        );

        const baseUrl = RESET_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const resetLink = `${baseUrl}/reset-password?token=${token}`; // page lives on the website (RESET_BASE_URL)

        await sendEmail({
            to: email.trim().toLowerCase(),
            subject: 'Reset your QLess Library password',
            html: buildResetEmail(resetLink),
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

// Email sent with the reset link — styled like the app (deep green header, gold Q,
// big green button). Uses simple tables + inline styles so it looks right in Gmail/Outlook.
function buildResetEmail(resetLink) {
    return `
    <div style="background:#F7F8F7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
        <tr>
          <td style="background:#0E3B1F;padding:28px 28px 24px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">
              <span style="color:#F0CD5A;">Q</span>Less
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Ladislao N. Diwa Memorial Library</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Reset your password</h1>
            <p style="margin:0 0 22px;font-size:14px;line-height:21px;color:#4B5563;">
              We received a request to reset the password of your QLess Library account.
              Tap the button below to choose a new one.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="background:#1B5E20;border-radius:14px;">
                  <a href="${resetLink}" style="display:block;padding:15px 20px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Reset Password</a>
                </td>
              </tr>
            </table>
            <div style="margin-top:22px;padding:14px 16px;background:#FBF3DC;border-radius:14px;font-size:13px;line-height:19px;color:#946800;">
              This link works <b>once</b> and expires in <b>30 minutes</b>.
            </div>
            <p style="margin:20px 0 0;font-size:12px;line-height:18px;color:#9CA3AF;">
              Didn't ask for this? You can ignore this email — your password stays the same.
            </p>
          </td>
        </tr>
      </table>
    </div>`;
}

// Lets the reset page check the link BEFORE the student types a new password,
// so an expired or used link shows a clear message right away.
app.get('/api/student/reset-password/check', async (req, res) => {
    const token = String(req.query.token || '');
    if (!token) return res.json({ valid: false });
    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [rows] = await db.query(
            'SELECT token_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
            [tokenHash]
        );
        res.json({ valid: rows.length > 0 });
    } catch (err) {
        res.json({ valid: false });
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
    if (!isStrongPassword(new_password)) {
        return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
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

// Lists only the PENDING registration requests, newest first
// (used by the Dashboard's "Pending Registrations" card).
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

// "DID ANYTHING CHANGE?" CHECK for the admin pages (Dashboard, Student Logs,
// Guest Logs, Analytics, sidebar badge). The pages call this every few seconds
// instead of downloading every log. Each part is a short "signature" text that
// changes whenever its data changes:
//   logs          - a student entered / exited / was force-exited / a log was voided
//   guests        - same for guest visits
//   registrations - new registration, renewal, approve / reject / deactivate / expire
//   students      - a student's info was edited, or their status changed
// A page reloads its full data only when a part it uses is different.
// pending_count is sent too, so the sidebar badge needs no extra download.
app.get('/api/admin/changes', verifyToken, async (req, res) => {
    try {
        // Builds the signature for one log table (student_logs or guest_logs).
        const logSignature = async (table, idColumn) => {
            const [[r]] = await db.query(
                `SELECT COUNT(*) AS total, MAX(${idColumn}) AS last_id,
                        COALESCE(SUM(status = 'inside'), 0) AS inside,
                        COALESCE(SUM(forced_exit = 1), 0) AS forced,
                        COALESCE(SUM(status = 'voided'), 0) AS voided,
                        MAX(time_out) AS last_out
                 FROM ${table}`
            );
            const lastOut = r.last_out ? new Date(r.last_out).getTime() : 0;
            return [r.total, r.last_id || 0, r.inside, r.forced, r.voided, lastOut].join('|');
        };

        const [[reg]] = await db.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(approval_status = 'pending'), 0)     AS pending,
                    COALESCE(SUM(approval_status = 'approved'), 0)    AS approved,
                    COALESCE(SUM(approval_status = 'rejected'), 0)    AS rejected,
                    COALESCE(SUM(approval_status = 'deactivated'), 0) AS deactivated,
                    COALESCE(SUM(approval_status = 'expired'), 0)     AS expired,
                    MAX(created_at) AS latest
             FROM registration_requests`
        );
        const [[stu]] = await db.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(status = 'approved'), 0)    AS approved,
                    COALESCE(SUM(status = 'deactivated'), 0) AS deactivated,
                    COALESCE(SUM(status = 'expired'), 0)     AS expired,
                    (SELECT COUNT(*) FROM student_edit_logs) AS edits,
                    (SELECT MAX(edit_id) FROM student_edit_logs) AS last_edit
             FROM students`
        );

        res.json({
            logs: await logSignature('student_logs', 'log_id'),
            guests: await logSignature('guest_logs', 'guest_log_id'),
            registrations: [reg.total, reg.pending, reg.approved, reg.rejected, reg.deactivated, reg.expired,
                reg.latest ? new Date(reg.latest).getTime() : 0].join('|'),
            students: [stu.total, stu.approved, stu.deactivated, stu.expired, stu.edits, stu.last_edit || 0].join('|'),
            pending_count: Number(reg.pending),
            registrations_total: Number(reg.total), // lets the Registrations page count new arrivals
        });
    } catch (err) {
        console.error('Changes check error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Tiny "did anything change?" check for the admin Registrations page.
// Instead of downloading every request every few seconds, the page calls this.
// The "signature" changes when a request is added (new registration), renewed
// (created_at is updated), or its status changes (approve/reject/etc.).
// The page reloads the full list only when the signature is different.
app.get('/api/admin/registrations/summary', verifyToken, async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(approval_status = 'pending'), 0)     AS pending,
                    COALESCE(SUM(approval_status = 'approved'), 0)    AS approved,
                    COALESCE(SUM(approval_status = 'rejected'), 0)    AS rejected,
                    COALESCE(SUM(approval_status = 'deactivated'), 0) AS deactivated,
                    MAX(created_at) AS latest
             FROM registration_requests`
        );
        const latest = row.latest ? new Date(row.latest).getTime() : 0;
        res.json({
            total: Number(row.total),
            pending: Number(row.pending),
            signature: [row.total, row.pending, row.approved, row.rejected, row.deactivated, latest].join('|'),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approves a registration: marks the student "approved" and gives them a new
// random QR code (their library pass). Also records which admin approved it.
// VIEW A STUDENT'S COR (any signed-in admin or library staff).
// Returns a temporary link (10 minutes) to the photo; the photo itself stays private.
app.get('/api/admin/registrations/:request_id/cor', verifyToken, async (req, res) => {
    try {
        const [[row]] = await db.query('SELECT cor_public_id FROM registration_requests WHERE request_id = ?', [req.params.request_id]);
        if (!row) return res.status(404).json({ message: "Request not found." });
        if (!row.cor_public_id) {
            return res.status(404).json({ message: "No registration form photo for this request (already reviewed, or sent before the registration form upload was required)." });
        }
        res.json({ url: corViewUrl(row.cor_public_id) });
    } catch (err) {
        console.error("View COR error:", err.message);
        res.status(500).json({ message: "Could not load the registration form photo." });
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
        await removeCorForRequest(request_id); // COR checked → delete the photo

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
        await removeCorForRequest(request_id); // COR checked → delete the photo

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

// Turns a deactivated account back on and issues a brand-new QR code
// (the old QR stays invalid).
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
// True from the 5:30 PM cut-off until midnight (Philippine time).
// After the cut-off no one may ENTER the library, but people can still exit.
const isPastEntryCutoff = () => {
    const manilaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    return manilaNow.getHours() * 60 + manilaNow.getMinutes() >= 17 * 60 + 30; // 5:30 PM
};
const LIBRARY_CLOSED_MESSAGE = 'The library is closed for entry after 5:30 PM. Exits are still allowed.';

app.post('/api/logs/scan', async (req, res) => {
    const { qr_code } = req.body;
    try {
        const [students] = await db.query('SELECT * FROM students WHERE qr_code = ?', [qr_code]);

        if (students.length === 0 || students[0].status !== 'approved') {
            return res.status(403).json({ success: false, message: "Access Denied" });
        }

        const student = students[0];

        // Repeat-scan guard: if this student entered or exited in the last 1 second,
        // ignore the scan (e.g. a phone left on the scanner gets read again and again).
        // The scanner page also ignores repeats; this catches it even after a page reload.
        const [[recent]] = await db.query(
            `SELECT COUNT(*) AS n FROM student_logs
             WHERE user_id = ? AND (time_in >= NOW() - INTERVAL 1 SECOND OR time_out >= NOW() - INTERVAL 1 SECOND)`,
            [student.user_id]
        );
        if (recent.n > 0) {
            return res.status(409).json({
                success: false,
                duplicate: true,
                message: "Already scanned. Please remove your QR code from the scanner.",
            });
        }

        const [activeLogs] = await db.query('SELECT log_id FROM student_logs WHERE user_id = ? AND status = "inside"', [student.user_id]);

        if (activeLogs.length > 0) {
            await db.query('UPDATE student_logs SET time_out = NOW(), status = "exited" WHERE log_id = ?', [activeLogs[0].log_id]);
            res.json({ success: true, action: 'exit', student_number: student.student_number, program: student.program });
        } else {
            // Not inside yet = this would be an entry, which is blocked after 5:30 PM.
            if (isPastEntryCutoff()) {
                // Was this student logged out by the system today (5:31 PM auto logout or
                // an admin's Force Exit)? Then they're probably scanning to leave — tell them
                // they're already logged out instead of just "Library Closed".
                const [[forced]] = await db.query(
                    `SELECT DATE_FORMAT(time_out, '%l:%i %p') AS out_time FROM student_logs
                     WHERE user_id = ? AND visit_date = CURDATE() AND forced_exit = 1
                     ORDER BY time_out DESC LIMIT 1`,
                    [student.user_id]
                );
                if (forced) {
                    return res.status(403).json({
                        success: false,
                        closed: true,
                        already_exited: true,
                        message: `You were already logged out at ${forced.out_time.trim()}. The library is closed for entry.`,
                    });
                }
                return res.status(403).json({ success: false, closed: true, message: LIBRARY_CLOSED_MESSAGE });
            }
            await db.query('INSERT INTO student_logs (user_id, time_in, visit_date, status) VALUES (?, NOW(), CURDATE(), "inside")', [student.user_id]);
            res.json({ success: true, action: 'entry', student_number: student.student_number, program: student.program });
        }
    } catch (err) {
        console.error("SQL ERROR during scan:", err.message);
        res.status(500).json({ success: false, message: "Scan failed. Please try again." });
    }
});

// Every student entry/exit log joined with the student's info, newest first
// (used by Student Logs, Dashboard and Analytics on the website).
app.get('/api/logs/all', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT sl.log_id, sl.visit_date, sl.time_in, sl.time_out, sl.status, sl.forced_exit, s.full_name, s.student_number, s.college, s.program, s.sex
            FROM student_logs sl JOIN students s ON sl.user_id = s.user_id
            ORDER BY sl.visit_date DESC, sl.time_in DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FORCE EXIT ALL ACTIVE LOGS (Bulk action for closing time)
// FORCE EXIT ALL PATRONS (Dashboard button): logs out every student AND guest
// still inside, flagged as forced exits so they're left out of the average stay.
// Same SQL as the 5:31 PM auto logout, for early closures or emergencies.
app.patch('/api/patrons/force-exit-all', verifyToken, async (req, res) => {
    try {
        const [studentResult] = await db.query(
            'UPDATE student_logs SET time_out = NOW(), status = "exited", forced_exit = 1 WHERE status = "inside"'
        );
        const [guestResult] = await db.query(
            'UPDATE guest_logs SET time_out = NOW(), status = "exited", forced_exit = 1 WHERE status = "inside"'
        );
        const students = studentResult.affectedRows;
        const guests = guestResult.affectedRows;
        res.json({
            success: true,
            students,
            guests,
            message: `Logged out ${students} student(s) and ${guests} guest(s).`,
        });
    } catch (err) {
        console.error("Force exit all patrons error:", err.message);
        res.status(500).json({ message: "Force exit failed. Please try again." });
    }
});

// Older one-table versions (kept so nothing breaks; the website now uses the one above).
app.patch('/api/logs/force-exit-all', verifyToken, async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE student_logs SET time_out = NOW(), status = "exited", forced_exit = 1 WHERE status = "inside"'
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

// STUDENT LOGIN — mobile app, separate from admin login.
// Students can log in with their CvSU email OR their 9-digit student number.
// ("email" is still accepted too, so older app versions keep working.)
app.post('/api/login', loginLimiter, async (req, res) => {
  const identifier = String(req.body.identifier || req.body.email || '').trim().toLowerCase();
  const { password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Please enter your email or student number and your password.' });
  }
  try {
    // 9 digits = student number; anything else is treated as an email.
    const isStudentNumber = /^\d{9}$/.test(identifier);
    const [students] = isStudentNumber
      ? await db.query('SELECT * FROM students WHERE student_number = ?', [identifier])
      : await db.query('SELECT * FROM students WHERE LOWER(email) = ?', [identifier]);

    if (!students || students.length === 0) {
      return res.status(404).json({
        message: isStudentNumber
          ? 'No account found for this student number.'
          : 'No account found for this email.',
      });
    }

    const student = students[0];

    if (!student.password) {
      return res.status(403).json({ message: 'This account needs a password set up. Please contact the library or re-register.' });
    }

    // Too many wrong passwords recently? (Counted per student, whether they typed
    // their email or student number.)
    const limitKey = `student:${student.student_number}`;
    const lockLeft = lockedSeconds(limitKey);
    if (lockLeft > 0) {
      return res.status(429).json({ message: lockedMessage(lockLeft), retry_after_seconds: lockLeft });
    }

    const match = await bcrypt.compare(password, student.password);
    if (!match) {
      const left = recordWrongPassword(limitKey);
      return res.status(401).json({ message: wrongPasswordMessage(left) });
    }
    clearWrongPasswords(limitKey);

    // Send the student's info (never the password) plus their login pass.
    const { password: _omit, ...safeStudent } = student;
    return res.status(200).json({
        message: 'Login successful',
        student: safeStudent,
        token: issueStudentToken(student.student_number),
    });
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
    if (!name || !name.trim() || !email || !password) {
        return res.status(400).json({ message: "Please fill in all fields." });
    }
    // Same email shape and password rules as everywhere else — this is the most
    // powerful account in the system, so it must have a strong password.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ message: "Please enter a valid email." });
    }
    if (!isStrongPassword(password)) {
        return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
    }
    try {
        const [existing] = await db.query('SELECT COUNT(*) as count FROM admins');
        if (existing[0].count > 0) {
            return res.status(403).json({ message: "Setup already completed. Please log in." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, "super_admin")',
            [name.trim(), email.trim().toLowerCase(), hashedPassword]
        );

        res.status(201).json({ success: true, message: "Super admin account created. Please log in." });
    } catch (err) {
        console.error("Bootstrap error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// ADMIN LOGIN + SIGN-IN APPROVAL
//
// Rules:
//   * Each browser that signs in gets its own row in admin_sessions.
//   * If this account is NOT open anywhere right now, login works immediately.
//   * If it IS open in another browser (seen in the last ACTIVE_WINDOW_SECONDS),
//     the new browser has to wait until one of the signed-in browsers clicks
//     Allow. Deny, Cancel, or no answer within APPROVAL_TIMEOUT_SECONDS = no login.
//   * Once allowed, both browsers stay signed in.
// "Open" is judged by the heartbeat every admin request leaves in
// admin_sessions.last_seen_at (see middleware/auth.js), so a closed or
// sleeping laptop stops counting after ACTIVE_WINDOW_SECONDS and can't lock
// the account.
// ---------------------------------------------------------------------------
const ACTIVE_WINDOW_SECONDS = 120;
const APPROVAL_TIMEOUT_SECONDS = 60;

// Reads the browser name (user agent) and IP address from a request,
// to show in the "New sign-in request" pop-up.
const clientInfo = (req) => ({
    userAgent: (req.headers['user-agent'] || '').slice(0, 255),
    ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim().slice(0, 64),
});

// Keeps only the safe admin fields to send to the website (never the password).
const publicAdmin = (admin) => ({
    admin_id: admin.admin_id, name: admin.name, email: admin.email, role: admin.role,
    password_is_temp: !!admin.password_is_temp, // true = show the "change your password?" prompt
});

// Creates a session row for this browser and returns a token bound to it.
async function issueAdminSession(admin, info) {
    const sessionId = crypto.randomUUID();
    await db.query(
        'INSERT INTO admin_sessions (session_id, admin_id, user_agent, ip_address) VALUES (?, ?, ?, ?)',
        [sessionId, admin.admin_id, info.userAgent || null, info.ip || null]
    );
    const token = jwt.sign(
        { admin_id: admin.admin_id, role: admin.role, name: admin.name, session_id: sessionId },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
    return { token, admin: publicAdmin(admin) };
}

// Admin sign-in: checks email + password, then either signs in right away
// or (if the account is open in another browser) creates an approval request.
app.post('/api/admin/login', loginLimiter, async (req, res) => {
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

        // Too many wrong passwords for this staff account recently?
        const limitKey = `admin:${admin.admin_id}`;
        const lockLeft = lockedSeconds(limitKey);
        if (lockLeft > 0) {
            return res.status(429).json({ message: lockedMessage(lockLeft, true), retry_after_seconds: lockLeft });
        }

        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            const left = recordWrongPassword(limitKey);
            return res.status(401).json({ message: wrongPasswordMessage(left, true) });
        }
        clearWrongPasswords(limitKey);

        // Archived accounts can no longer sign in (the super admin can restore them).
        if (admin.is_archived) {
            return res.status(403).json({ message: "This account has been archived. Please contact the super admin." });
        }

        // Housekeeping: forget browsers that haven't been seen for a day, and
        // close out approval requests nobody answered.
        await db.query('DELETE FROM admin_sessions WHERE last_seen_at < NOW() - INTERVAL 1 DAY');
        await db.query('UPDATE admin_login_requests SET status = "expired" WHERE status = "pending" AND expires_at <= NOW()');

        const [[{ activeCount }]] = await db.query(
            'SELECT COUNT(*) AS activeCount FROM admin_sessions WHERE admin_id = ? AND last_seen_at > NOW() - INTERVAL ? SECOND',
            [admin.admin_id, ACTIVE_WINDOW_SECONDS]
        );

        const info = clientInfo(req);

        if (activeCount === 0) {
            const session = await issueAdminSession(admin, info);
            return res.json({ success: true, ...session });
        }

        // Account is open in another browser — ask it for approval.
        const requestId = crypto.randomUUID();
        await db.query(
            `INSERT INTO admin_login_requests (request_id, admin_id, user_agent, ip_address, expires_at)
             VALUES (?, ?, ?, ?, NOW() + INTERVAL ? SECOND)`,
            [requestId, admin.admin_id, info.userAgent || null, info.ip || null, APPROVAL_TIMEOUT_SECONDS]
        );

        return res.status(202).json({
            approval_required: true,
            request_id: requestId,
            expires_in: APPROVAL_TIMEOUT_SECONDS,
            message: "This account is already signed in on another browser. Waiting for it to approve this sign-in.",
        });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Polled by the WAITING browser (not signed in yet). The random request_id
// is only ever given to the browser that entered the correct password.
app.get('/api/admin/login-requests/:request_id/status', async (req, res) => {
    const { request_id } = req.params;
    try {
        await db.query(
            'UPDATE admin_login_requests SET status = "expired" WHERE request_id = ? AND status = "pending" AND expires_at <= NOW()',
            [request_id]
        );
        const [rows] = await db.query(
            `SELECT r.status, TIMESTAMPDIFF(SECOND, NOW(), r.expires_at) AS seconds_left, a.*
             FROM admin_login_requests r JOIN admins a ON a.admin_id = r.admin_id
             WHERE r.request_id = ?`,
            [request_id]
        );
        if (rows.length === 0) return res.status(404).json({ status: 'not_found' });
        const row = rows[0];

        if (row.status === 'approved') {
            // Hand out the session exactly once, even if two polls race.
            const [claim] = await db.query(
                'UPDATE admin_login_requests SET status = "completed" WHERE request_id = ? AND status = "approved"',
                [request_id]
            );
            if (claim.affectedRows === 1) {
                const session = await issueAdminSession(row, clientInfo(req));
                return res.json({ status: 'approved', ...session });
            }
            return res.json({ status: 'completed' });
        }

        res.json({ status: row.status, seconds_left: Math.max(0, row.seconds_left) });
    } catch (err) {
        console.error("Login request status error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// The waiting browser gave up (Cancel button, or closed the page).
app.post('/api/admin/login-requests/:request_id/cancel', async (req, res) => {
    try {
        await db.query(
            'UPDATE admin_login_requests SET status = "cancelled" WHERE request_id = ? AND status = "pending"',
            [req.params.request_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Polled by SIGNED-IN browsers to find sign-in attempts they need to answer.
app.get('/api/admin/login-requests/pending', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT request_id, user_agent, ip_address, created_at,
                    TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
             FROM admin_login_requests
             WHERE admin_id = ? AND status = "pending" AND expires_at > NOW()
             ORDER BY created_at ASC`,
            [req.admin.admin_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Allow / Deny from a signed-in browser.
app.post('/api/admin/login-requests/:request_id/decision', verifyToken, async (req, res) => {
    const { decision } = req.body;
    if (!['approve', 'deny'].includes(decision)) {
        return res.status(400).json({ message: "Decision must be 'approve' or 'deny'." });
    }
    try {
        const [result] = await db.query(
            `UPDATE admin_login_requests
             SET status = ?, decided_by_session = ?, decided_at = NOW()
             WHERE request_id = ? AND admin_id = ? AND status = "pending" AND expires_at > NOW()`,
            [decision === 'approve' ? 'approved' : 'denied', req.sessionId, req.params.request_id, req.admin.admin_id]
        );
        if (result.affectedRows === 0) {
            return res.status(409).json({ message: "This request was already answered or has expired." });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ends ONLY this browser's session.
app.post('/api/admin/logout', verifyToken, async (req, res) => {
    try {
        await db.query('DELETE FROM admin_sessions WHERE session_id = ?', [req.sessionId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE STAFF ACCOUNT — super_admin only, done from inside the dashboard.
// The server makes the password and sends it back ONCE so the super admin can
// copy it and give it to the staff member (it is saved hashed and can't be viewed again).
app.post('/api/admin/create', verifyToken, requireSuperAdmin, async (req, res) => {
    const { name, email, role } = req.body;
    if (!name || !email || !role) {
        return res.status(400).json({ message: "Please fill in all fields." });
    }
    if (!['admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role." });
    }
    try {
        const cleanEmail = email.trim().toLowerCase();
        const [existing] = await db.query('SELECT admin_id FROM admins WHERE email = ?', [cleanEmail]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "An account with this email already exists." });
        }

        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        await db.query(
            'INSERT INTO admins (name, email, password, role, password_is_temp) VALUES (?, ?, ?, ?, 1)',
            [name.trim(), cleanEmail, hashedPassword, role]
        );

        res.status(201).json({ success: true, message: "Account created successfully.", email: cleanEmail, temp_password: tempPassword });
    } catch (err) {
        console.error("Create admin error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// RESET A STAFF PASSWORD — super_admin only (for staff who forgot theirs).
// Makes a new password, shows it once, and signs that account out everywhere.
app.post('/api/admin/staff/:admin_id/reset-password', verifyToken, requireSuperAdmin, async (req, res) => {
    const adminId = Number(req.params.admin_id);
    if (adminId === req.admin.admin_id) {
        return res.status(400).json({ message: "Use Change Password for your own account." });
    }
    try {
        const [rows] = await db.query('SELECT admin_id, email, is_archived FROM admins WHERE admin_id = ?', [adminId]);
        if (rows.length === 0) return res.status(404).json({ message: "Account not found." });
        if (rows[0].is_archived) {
            return res.status(400).json({ message: "Restore this account first before resetting its password." });
        }

        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        await db.query('UPDATE admins SET password = ?, password_is_temp = 1 WHERE admin_id = ?', [hashedPassword, adminId]);
        await db.query('DELETE FROM admin_sessions WHERE admin_id = ?', [adminId]); // old password's sessions end

        res.json({ success: true, email: rows[0].email, temp_password: tempPassword });
    } catch (err) {
        console.error("Reset staff password error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// CHANGE MY PASSWORD — any signed-in admin. Needs the current password.
app.post('/api/admin/change-password', verifyToken, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ message: "Please fill in all fields." });
    }
    if (!isStrongPassword(new_password)) {
        return res.status(400).json({ message: "Password must be 8+ characters with an uppercase letter, a lowercase letter and a number." });
    }
    try {
        const [rows] = await db.query('SELECT password FROM admins WHERE admin_id = ?', [req.admin.admin_id]);
        if (rows.length === 0) return res.status(404).json({ message: "Account not found." });

        const match = await bcrypt.compare(current_password, rows[0].password);
        if (!match) return res.status(401).json({ message: "Your current password is incorrect." });
        if (current_password === new_password) {
            return res.status(400).json({ message: "Choose a password different from your current one." });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE admins SET password = ?, password_is_temp = 0 WHERE admin_id = ?', [hashedPassword, req.admin.admin_id]);
        // Sign out the account's OTHER browsers; this one stays signed in.
        await db.query('DELETE FROM admin_sessions WHERE admin_id = ? AND session_id <> ?', [req.admin.admin_id, req.sessionId]);

        res.json({ success: true, message: "Password changed." });
    } catch (err) {
        console.error("Change password error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// "Keep my password": the staff member chose to keep the password they were given,
// so the "change your password?" prompt stops showing.
app.post('/api/admin/keep-password', verifyToken, async (req, res) => {
    try {
        await db.query('UPDATE admins SET password_is_temp = 0 WHERE admin_id = ?', [req.admin.admin_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all staff accounts, for the "Manage Staff Accounts" table.
app.get('/api/admin/staff', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT admin_id, name, email, role, password_is_temp, created_at, is_archived, archived_at
             FROM admins ORDER BY is_archived ASC, created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ARCHIVE A STAFF ACCOUNT — super_admin only.
// Like deactivating: the account can't sign in anymore and is signed out everywhere,
// but it is NOT deleted, so the logs of what it approved stay correct.
app.post('/api/admin/staff/:admin_id/archive', verifyToken, requireSuperAdmin, async (req, res) => {
    const adminId = Number(req.params.admin_id);
    if (adminId === req.admin.admin_id) {
        return res.status(400).json({ message: "You can't archive your own account." });
    }
    try {
        const [rows] = await db.query('SELECT admin_id, name, role, is_archived FROM admins WHERE admin_id = ?', [adminId]);
        if (rows.length === 0) return res.status(404).json({ message: "Account not found." });
        if (rows[0].is_archived) return res.status(400).json({ message: "This account is already archived." });

        // Always keep at least one active super admin, or no one could manage accounts.
        if (rows[0].role === 'super_admin') {
            const [[{ others }]] = await db.query(
                'SELECT COUNT(*) AS others FROM admins WHERE role = "super_admin" AND is_archived = 0 AND admin_id <> ?',
                [adminId]
            );
            if (others === 0) {
                return res.status(400).json({ message: "At least one active super admin is required." });
            }
        }

        await db.query('UPDATE admins SET is_archived = 1, archived_at = NOW() WHERE admin_id = ?', [adminId]);
        await db.query('DELETE FROM admin_sessions WHERE admin_id = ?', [adminId]); // signs them out everywhere
        await db.query('UPDATE admin_login_requests SET status = "expired" WHERE admin_id = ? AND status = "pending"', [adminId]);

        res.json({ success: true, message: `${rows[0].name}'s account was archived.` });
    } catch (err) {
        console.error("Archive staff error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// RESTORE AN ARCHIVED STAFF ACCOUNT — super_admin only. They can sign in again
// with their old password (or the super admin can reset it).
app.post('/api/admin/staff/:admin_id/restore', verifyToken, requireSuperAdmin, async (req, res) => {
    const adminId = Number(req.params.admin_id);
    try {
        const [rows] = await db.query('SELECT admin_id, name, is_archived FROM admins WHERE admin_id = ?', [adminId]);
        if (rows.length === 0) return res.status(404).json({ message: "Account not found." });
        if (!rows[0].is_archived) return res.status(400).json({ message: "This account is not archived." });

        await db.query('UPDATE admins SET is_archived = 0, archived_at = NULL WHERE admin_id = ?', [adminId]);
        res.json({ success: true, message: `${rows[0].name}'s account was restored.` });
    } catch (err) {
        console.error("Restore staff error:", err.message);
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
    if (!namesAreValid(updates.surname, updates.first_name, updates.middle_name)) {
        return res.status(400).json({ message: NAME_RULE_MESSAGE });
    }
    // Same phone rule as the mobile app: +63 followed by 10 digits starting with 9.
    if (updates.phone_number !== undefined && !/^\+639\d{9}$/.test(updates.phone_number)) {
        return res.status(400).json({ message: "Please enter all 10 digits of the phone number after +63." });
    }

    try {
        const [existingRows] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (existingRows.length === 0) {
            return res.status(404).json({ message: "Student not found." });
        }
        const existing = existingRows[0];

        // Same one-account-per-phone rule when an admin changes the phone number.
        if (updates.phone_number && updates.phone_number !== existing.phone_number &&
            await isPhoneUsedByAnother(updates.phone_number, student_number)) {
            return res.status(400).json({ message: "This phone number is already used by another account." });
        }

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

// Starts a new semester: saves the new period name, sets every approved
// student back to "pending" (their QR stops working), and creates a renewal
// request for each so they can renew from the mobile app.
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
            "INSERT INTO settings (setting_key, setting_value) VALUES ('current_period', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
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

// Returns one student's profile for the mobile app (without the password).
// Needs the student's login pass, and only their OWN profile can be read:
// it contains the QR code, phone number and address.
app.get('/api/student/profile/:student_number', verifyStudentToken, async (req, res) => {
    const { student_number } = req.params;
    if (req.student.student_number !== student_number) {
        return res.status(403).json({ message: "You can only view your own profile." });
    }

    try {
        const [students] = await db.query('SELECT * FROM students WHERE student_number = ?', [student_number]);
        if (!students || students.length === 0) {
        return res.status(404).json({ message: 'Student profile not found.' });
        }
        const { password: _omit, ...safeStudent } = students[0];
        // Rejected and never approved → the Resubmit form lets them fix the student number.
        safeStudent.can_change_student_number =
            safeStudent.status === 'rejected' && (await canChangeStudentNumber(safeStudent.user_id, student_number));
        return res.status(200).json(safeStudent);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// SCANNER SCREEN LIVE NUMBERS in ONE request (public, counts only — no names):
// students inside per college + guests inside. The scanner page asks every 5 s.
app.get('/api/scanner/live', async (req, res) => {
    try {
        const [colleges] = await db.query(`
            SELECT s.college, COUNT(*) as count FROM student_logs sl JOIN students s ON sl.user_id = s.user_id
            WHERE sl.status = 'inside' GROUP BY s.college
        `);
        const [[{ guests }]] = await db.query('SELECT COUNT(*) AS guests FROM guest_logs WHERE status = "inside"');
        res.json({ colleges, guests: Number(guests) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// How many students are inside right now, grouped by college (public live board).
// (Kept for older versions of the scanner page; the new one uses /api/scanner/live.)
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
app.post('/api/guests/log', guestLimiter, async (req, res) => {
    const { guest_type, first_name, last_name, affiliation, purpose, other_purpose } = req.body;

    if (!guest_type || !first_name || !last_name) {
        return res.status(400).json({ message: "Please fill in all required fields." });
    }

    // Guests can't log a new visit after the 5:30 PM cut-off (logging out still works).
    if (isPastEntryCutoff()) {
        return res.status(403).json({ closed: true, message: LIBRARY_CLOSED_MESSAGE });
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

// Every guest visit joined with the guest's info, newest first (Guest Logs page).
app.get('/api/guests/all', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT gl.guest_log_id, gl.time_in, gl.time_out, gl.visit_date, gl.status, gl.forced_exit,
                   g.guest_id, g.full_name, g.guest_type, g.affiliation, g.purpose, g.other_purpose
            FROM guest_logs gl JOIN guests g ON gl.guest_id = g.guest_id
            ORDER BY gl.visit_date DESC, gl.time_in DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUBLIC — lists guests currently inside, for the self-service Guest Logout
// kiosk screen. Deliberately minimal fields (no affiliation/email-equivalent)
// since this is publicly viewable, same principle as /api/logs/scan.
app.get('/api/guests/inside', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT gl.guest_log_id, g.full_name, g.purpose, g.other_purpose
            FROM guest_logs gl JOIN guests g ON gl.guest_id = g.guest_id
            WHERE gl.status = "inside"
            ORDER BY gl.time_in DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUBLIC — lets a guest mark themselves as exited from the kiosk, without
// admin auth. Separate from the existing /api/guests/exit/:guest_log_id
// (which stays admin-only) so this can't be used to prematurely exit
// someone else's visit outside the guest's own action, beyond picking
// their own name off the inside list.
app.patch('/api/guests/self-exit/:guest_log_id', guestLimiter, async (req, res) => {
    const { guest_log_id } = req.params;
    try {
        const [result] = await db.query(
            'UPDATE guest_logs SET time_out = NOW(), status = "exited" WHERE guest_log_id = ? AND status = "inside"',
            [guest_log_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "This visit was already logged out or could not be found." });
        }
        res.json({ success: true, message: "You have been logged out. Thank you for visiting!" });
    } catch (err) {
        console.error("Guest self-exit error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Guests have no QR to scan out with, so exits are marked manually by an admin.
app.patch('/api/guests/force-exit-all', verifyToken, async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE guest_logs SET time_out = NOW(), status = "exited", forced_exit = 1 WHERE status = "inside"'
        );
        res.json({ 
            success: true, 
            message: `Successfully forced exit for ${result.affectedRows} guest(s).` 
        });
    } catch (err) {
        console.error("Force exit all guests error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Number of guests inside right now.
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

// ---------------------------------------------------------------------------
// REPORTING PERIODS — shared by the mobile app and mirrored in the web
// Analytics page (Analytics.jsx: semesterInfo / semesterRange, "Semester" tab).
// Keep both sides identical so the numbers always match.
//   The mobile stats use the real dates from the academic calendar
//   (reportingSemester below). These fixed months are only the fallback when no
//   semesters have been added yet: 1st Sem = Aug–Dec, 2nd Sem = Jan–May, Midyear = Jun–Jul.
// Ranges are [start, endExclusive) on visit_date.
// ---------------------------------------------------------------------------
const SEM_SHORT_NAMES = { '1st': '1st Sem', '2nd': '2nd Sem', 'Summer': 'Midyear' };

// Returns the semester a date falls in: its start date, the day after it
// ends, and a label like "1st Sem · AY 2026–2027".
function currentSemester(date = new Date()) {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    let ayStart, sem, start, endExclusive;
    if (month >= 8) {
        ayStart = year; sem = '1st';
        start = new Date(ayStart, 7, 1); endExclusive = new Date(ayStart + 1, 0, 1);
    } else if (month <= 5) {
        ayStart = year - 1; sem = '2nd';
        start = new Date(ayStart + 1, 0, 1); endExclusive = new Date(ayStart + 1, 5, 1);
    } else {
        ayStart = year - 1; sem = 'Summer';
        start = new Date(ayStart + 1, 5, 1); endExclusive = new Date(ayStart + 1, 7, 1);
    }
    return { start, endExclusive, label: `${SEM_SHORT_NAMES[sem]} · AY ${ayStart}–${ayStart + 1}` };
}

// "2026-10-12" → a Date at local midnight (no timezone shift).
const ymdToDate = (ymd) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const TERM_SHORT_NAMES = { '1st': '1st Sem', '2nd': '2nd Sem', 'Midyear': 'Midyear' };

// The semester the mobile stats should cover, taken from the academic calendar
// in Settings (the real start/end dates), so it always matches the current period:
//   1) the semester running today, or
//   2) during a break, the semester that just ended (so stats don't go blank).
// Falls back to the fixed months above if no semesters have been added yet.
async function reportingSemester(date = new Date()) {
    try {
        const [rows] = await db.query(
            `SELECT term, ay_start, status,
                    DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
                    DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
             FROM semesters
             WHERE status = 'active' OR (status = 'ended' AND start_date <= CURDATE())
             ORDER BY (status = 'active') DESC, start_date DESC
             LIMIT 1`
        );
        if (rows.length > 0) {
            const sem = rows[0];
            const start = ymdToDate(sem.start_date);
            const endExclusive = ymdToDate(sem.end_date);
            endExclusive.setDate(endExclusive.getDate() + 1); // include the last day
            return {
                start,
                endExclusive,
                label: `${TERM_SHORT_NAMES[sem.term] || sem.term} · AY ${sem.ay_start}–${sem.ay_start + 1}`,
            };
        }
    } catch (err) {
        console.error('reportingSemester error:', err.message); // semesters table missing → use fixed months
    }
    return currentSemester(date);
}

// STUDENT PERSONAL ANALYTICS (for the mobile app home screen)
// Total visits, the activity chart, frequent day and average stay all cover
// the CURRENT SEMESTER only (matches the semester renewal cycle).
// current_occupancy is live (everyone inside right now).
app.get('/api/student/analytics/:student_number', verifyStudentToken, async (req, res) => {
    const { student_number } = req.params;
    if (req.student.student_number !== student_number) {
        return res.status(403).json({ message: "You can only view your own analytics." });
    }
    try {
        const [students] = await db.query('SELECT user_id FROM students WHERE student_number = ?', [student_number]);
        if (students.length === 0) return res.status(404).json({ message: 'Student not found.' });
        const user_id = students[0].user_id;
        const semester = await reportingSemester();

        const [myLogs] = await db.query(
            `SELECT time_in, time_out, visit_date, forced_exit FROM student_logs
             WHERE user_id = ? AND visit_date >= ? AND visit_date < ?`,
            [user_id, semester.start, semester.endExclusive]
        );

        const [[{ studentsInside }]] = await db.query(
            `SELECT COUNT(*) AS studentsInside FROM student_logs WHERE status = "inside"`
        );
        const [[{ guestsInside }]] = await db.query(
            `SELECT COUNT(*) AS guestsInside FROM guest_logs WHERE status = "inside"`
        );

        const totalVisits = myLogs.length;
        const currentOccupancy = studentsInside + guestsInside;

        // One slot per weekday, Sunday first (Sun–Sat, same order as the web app).
        const dayHourTotals = new Array(7).fill(0);
        const dayHourCounts = new Array(7).fill(0);
        const dayVisitCounts = new Array(7).fill(0);

        let totalStayMs = 0;
        let exitedCount = 0;

        myLogs.forEach(log => {
            if (!log.visit_date) return;
            const d = new Date(log.visit_date);
            const idx = d.getDay(); // 0 = Sunday … 6 = Saturday
            dayVisitCounts[idx] += 1;

            if (log.time_in && log.time_out && !log.forced_exit) {
                const hrs = (new Date(log.time_out) - new Date(log.time_in)) / (1000 * 60 * 60);
                dayHourTotals[idx] += hrs;
                dayHourCounts[idx] += 1;
                totalStayMs += (new Date(log.time_out) - new Date(log.time_in));
                exitedCount += 1;
            }
        });

        const weeklyActivity = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => ({
            day: label,
            hours: dayHourCounts[i] > 0 ? parseFloat((dayHourTotals[i] / dayHourCounts[i]).toFixed(1)) : 0,
        }));

        const maxVisits = Math.max(...dayVisitCounts);
        const frequentDayIdx = maxVisits > 0 ? dayVisitCounts.indexOf(maxVisits) : null;
        const frequentDay = frequentDayIdx !== null
            ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][frequentDayIdx]
            : '--';

        const avgStayHours = exitedCount > 0 ? (totalStayMs / exitedCount / (1000 * 60 * 60)) : 0;

        // The student's 3 latest visits this semester, for the "Recent Visits" card.
        // (Sent with the analytics so the app doesn't need an extra request.)
        const [recentVisits] = await db.query(
            `SELECT log_id, visit_date, time_in, time_out, status, forced_exit FROM student_logs
             WHERE user_id = ? AND visit_date >= ? AND visit_date < ?
             ORDER BY time_in DESC LIMIT 3`,
            [user_id, semester.start, semester.endExclusive]
        );

        res.json({
            recent_visits: recentVisits,
            total_visits: totalVisits,
            current_occupancy: currentOccupancy,
            weekly_activity: weeklyActivity,
            frequent_day: frequentDay,
            avg_stay_hours: avgStayHours,
            period_label: semester.label,
        });
    } catch (err) {
        console.error("SQL ERROR during student analytics:", err.message);
        res.status(500).json({ message: 'Server error computing analytics.' });
    }
});

// MY VISITS — the student's own entry/exit history for the current semester,
// newest first (the "My Visits" page in the app). A new semester starts a new list;
// older visits stay saved in the database.
app.get('/api/student/visits/:student_number', verifyStudentToken, async (req, res) => {
    const { student_number } = req.params;
    if (req.student.student_number !== student_number) {
        return res.status(403).json({ message: "You can only view your own visits." });
    }
    try {
        const [students] = await db.query('SELECT user_id FROM students WHERE student_number = ?', [student_number]);
        if (students.length === 0) return res.status(404).json({ message: 'Student not found.' });

        const semester = await reportingSemester();
        const [visits] = await db.query(
            `SELECT log_id, visit_date, time_in, time_out, status, forced_exit FROM student_logs
             WHERE user_id = ? AND visit_date >= ? AND visit_date < ?
             ORDER BY time_in DESC LIMIT 500`,
            [students[0].user_id, semester.start, semester.endExclusive]
        );
        res.json({ period_label: semester.label, visits });
    } catch (err) {
        console.error("SQL ERROR during student visits:", err.message);
        res.status(500).json({ message: 'Could not load your visits.' });
    }
});

// LIBRARY PEAK HOURS (for the mobile app home screen) — public, no personal data.
//
// Uses EXACTLY the same method as the web Analytics page (Peak Hour KPI +
// heatmap), so both always show the same answer:
//   * period   = the current semester (by visit_date), today included
//                — the web's "Semester" tab
//   * data     = every student + guest entry log in that period
//   * counted  = check-ins, bucketed by the HOUR of time_in
//   * peak     = the 2-hour window with the most check-ins (earliest wins a tie)
//   * hours    = 7 AM–6 PM (library hours), the same columns as the web heatmap
// If you change the rule on one side, change it on the other too.
// Library hours: opens 7:00 AM, closes 6:00 PM, cut-off 5:30 PM.
const LIBRARY_OPEN_MINUTES = 7 * 60;          // 7:00 AM
const LIBRARY_CUTOFF_MINUTES = 17 * 60 + 30;  // 5:30 PM (patrons should be out)
const LIBRARY_CLOSE_MINUTES = 18 * 60;        // 6:00 PM
// One chart column per hour the library is open: 7 AM ... 5 PM (the 5–6 PM slot).
const PEAK_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// See the explanation above: peak and quiet hours for the mobile Home screen.
app.get('/api/library/peak-hours', async (req, res) => {
    try {
        const now = new Date();
        const period = await reportingSemester(now);

        const [studentRows] = await db.query(
            'SELECT time_in, time_out FROM student_logs WHERE visit_date >= ? AND visit_date < ?',
            [period.start, period.endExclusive]
        );
        const [guestRows] = await db.query(
            'SELECT time_in, time_out FROM guest_logs WHERE visit_date >= ? AND visit_date < ?',
            [period.start, period.endExclusive]
        );
        const entries = [...studentRows, ...guestRows];

        // Check-ins per hour of day (all 24 hours, like the web KPI).
        const hourCounts = new Array(24).fill(0);
        for (const log of entries) {
            if (!log.time_in) continue;
            const d = new Date(log.time_in);
            if (isNaN(d)) continue;
            hourCounts[d.getHours()] += 1;
        }

        // Best 2-hour window — same loop and tie rule as Analytics.jsx.
        let bestStart = 0, bestCount = -1;
        for (let h = 0; h < 23; h++) {
            const windowCount = hourCounts[h] + hourCounts[h + 1];
            if (windowCount > bestCount) {
                bestCount = windowCount;
                bestStart = h;
            }
        }
        const hasData = bestCount > 0;

        // Days elapsed in the semester so far — same divisor the web's "Avg. Daily Visits" uses.
        // (stops at the semester's last day when looking at a semester that already ended)
        const lastDay = new Date(Math.min(new Date(now.getFullYear(), now.getMonth(), now.getDate()), period.endExclusive - 86400000));
        const daysElapsed = Math.max(1, Math.floor((lastDay - period.start) / 86400000) + 1);

        const hours = PEAK_HOURS.map(h => ({
            hour: h,
            checkins: hourCounts[h],
            avg_checkins: parseFloat((hourCounts[h] / daysElapsed).toFixed(1)),
        }));

        // Quietest stretch: among open hours OUTSIDE the busiest window, the
        // hours with the fewest check-ins. If several consecutive hours tie
        // (common while data is thin), return the longest such run so the app
        // says "10 AM–5 PM" instead of picking one arbitrary hour.
        let quietStart = null, quietEnd = null;
        if (hasData) {
            const outside = hours.filter(x => x.hour < bestStart || x.hour >= bestStart + 2);
            if (outside.length) {
                const minCount = Math.min(...outside.map(x => x.checkins));
                let runStart = null, bestLen = 0;
                for (let i = 0; i <= hours.length; i++) {
                    const x = hours[i];
                    const isQuiet = x && (x.hour < bestStart || x.hour >= bestStart + 2) && x.checkins === minCount;
                    if (isQuiet && runStart === null) runStart = x.hour;
                    if (!isQuiet && runStart !== null) {
                        const runEnd = hours[i - 1].hour + 1;
                        if (runEnd - runStart > bestLen) { bestLen = runEnd - runStart; quietStart = runStart; quietEnd = runEnd; }
                        runStart = null;
                    }
                }
            }
        }

        // Busiest single hour's average headcount this month, used by the app's
        // "Right now: Not busy / Moderate / Busy" pill as its yardstick.
        let peakAvgInside = 0;
        if (hasData) {
            const insideMinutes = {};
            const dayKeys = new Set();
            for (const log of entries) {
                if (!log.time_in) continue;
                const start = new Date(log.time_in);
                const end = log.time_out ? new Date(log.time_out) : now;
                if (end <= start) continue;
                dayKeys.add(start.toDateString());
                for (const h of PEAK_HOURS) {
                    const slotStart = new Date(start); slotStart.setHours(h, 0, 0, 0);
                    const slotEnd = new Date(start); slotEnd.setHours(h + 1, 0, 0, 0);
                    const overlap = Math.min(end, slotEnd) - Math.max(start, slotStart);
                    if (overlap > 0) insideMinutes[h] = (insideMinutes[h] || 0) + overlap / 60000;
                }
            }
            const days = Math.max(1, dayKeys.size);
            peakAvgInside = Math.max(0, ...Object.values(insideMinutes).map(m => m / 60 / days));
        }

        res.json({
            hours,
            peak_start: hasData ? bestStart : null,
            peak_end: hasData ? bestStart + 2 : null,
            peak_checkins: hasData ? bestCount : 0,
            quiet_start: quietStart,
            quiet_end: quietEnd,
            peak_avg_inside: parseFloat(peakAvgInside.toFixed(1)),
            period_label: period.label,
            total_checkins: entries.length,
            open_hour: PEAK_HOURS[0],
            close_hour: PEAK_HOURS[PEAK_HOURS.length - 1] + 1,
            // Used by the app's "Right now" pill: open from 7:00 AM until the 5:30 PM cut-off.
            open_minutes: LIBRARY_OPEN_MINUTES,
            cutoff_minutes: LIBRARY_CUTOFF_MINUTES,
            close_minutes: LIBRARY_CLOSE_MINUTES,
        });
    } catch (err) {
        console.error("SQL ERROR during peak hours:", err.message);
        res.status(500).json({ message: 'Server error computing peak hours.' });
    }
});

// AUTO LOGOUT RIGHT AFTER THE 5:30 PM CUT-OFF (5:31 PM, every day)
// Safety net for entries an admin forgot to force-exit before leaving.
// This runs the exact same SQL as the manual "Force Exit All" buttons, but
// on a schedule — it does NOT replace those buttons. Admins should still use
// "Force Exit All" for early closures, holidays, or any other situation this
// scheduled job wasn't designed to foresee.
const CLOSING_HOUR = 17;
const CLOSING_MINUTE = 31; // 5:31 PM

// Marks everyone still "inside" (students and guests) as exited, flagged as a
// forced exit (so it's left out of average-stay stats). Used by the 5:31 PM
// schedule and the startup catch-up below.
const runAutoLogout = async (reason) => {
    try {
        const [studentResult] = await db.query(
            'UPDATE student_logs SET time_out = NOW(), status = "exited", forced_exit = 1 WHERE status = "inside"'
        );
        const [guestResult] = await db.query(
            'UPDATE guest_logs SET time_out = NOW(), status = "exited", forced_exit = 1 WHERE status = "inside"'
        );
        console.log(
            `[Auto Logout - ${reason}] Force-exited ${studentResult.affectedRows} student(s) and ${guestResult.affectedRows} guest(s).`
        );
    } catch (err) {
        console.error(`[Auto Logout - ${reason}] Failed to auto-exit active logs:`, err.message);
    }
};

// Runs the auto logout every day at 5:31 PM Philippine time.
cron.schedule('31 17 * * *', () => runAutoLogout('scheduled 5:31 PM'), {
    timezone: 'Asia/Manila',
});

// CATCH-UP CHECK: node-cron only fires forward from whenever the server
// process starts — if the server is restarted any time after 5:31 PM
// (a deploy, a crash, a manual restart), that day's scheduled run is
// already missed and won't fire again until tomorrow. This runs the same
// cleanup once immediately on boot if it's already past closing time today,
// so a late restart doesn't leave "inside" entries stuck until the next day.
// True if it's already past 5:31 PM today in the Philippines.
const isPastClosingTimeToday = () => {
    const manilaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const minutesNow = manilaNow.getHours() * 60 + manilaNow.getMinutes();
    return minutesNow >= (CLOSING_HOUR * 60 + CLOSING_MINUTE);
};

if (isPastClosingTimeToday()) {
    runAutoLogout('startup catch-up');
}

// LEFTOVERS FROM EARLIER DAYS: if the server was OFF at 5:31 PM (e.g. the laptop was
// closed) and is started again the next morning, the catch-up above doesn't run
// (it isn't past 5:31 PM yet), so people from earlier days would stay "inside" for days.
// This closes every log from a PAST day that is still inside. The time out is set to
// that day's closing time (5:31 PM, or the time in if they came in later), not "now",
// and it's flagged as a forced exit so it's left out of the average stay.
const closeStaleLogs = async () => {
    const closeSql = (table) => `
        UPDATE ${table}
        SET time_out = GREATEST(time_in, TIMESTAMP(visit_date, '${String(CLOSING_HOUR).padStart(2, '0')}:${String(CLOSING_MINUTE).padStart(2, '0')}:00')),
            status = "exited", forced_exit = 1
        WHERE status = "inside" AND visit_date < CURDATE()`;
    try {
        const [students] = await db.query(closeSql('student_logs'));
        const [guests] = await db.query(closeSql('guest_logs'));
        if (students.affectedRows || guests.affectedRows) {
            console.log(`[Auto Logout - earlier days] Closed ${students.affectedRows} student(s) and ${guests.affectedRows} guest(s) left inside from past days.`);
        }
    } catch (err) {
        console.error('[Auto Logout - earlier days] Failed:', err.message);
    }
};
closeStaleLogs(); // once when the server starts
// …and every day at 12:05 AM, in case the server stayed on but missed 5:31 PM.
cron.schedule('5 0 * * *', closeStaleLogs, { timezone: 'Asia/Manila' });

// Offline mode for the entrance scanner (offline pack + syncing saved scans).
require('./offlineScanner')(app, { db });

// Starts the server. '0.0.0.0' lets phones on the same Wi-Fi reach it.
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));