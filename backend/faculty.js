// FACULTY ACCOUNTS — their own tables, separate from students.
//
//   faculty                        one row per faculty member (Employee ID, college, QR pass, status)
//   faculty_registration_requests  what the admin reviews (one row per submission, with the proof of ID)
//   faculty_logs                   library entries / exits (faculty_id -> faculty.faculty_id)
//   faculty_password_reset_tokens  one-time reset links (same flow as students)
//   faculty_edit_logs              who edited a faculty record
//
// Faculty have NO semester renewal: once approved, the pass works until an admin
// deactivates the account. semesters.js only touches students, so nothing there changes.
//
// Use in index.js:   const faculty = require('./faculty')(app, { ...shared helpers });

const EMPLOYEE_ID_REGEX = /^[1-9]\d{0,8}$/;      // numbers only, 1-9 digits, no leading zero (same rule in the mobile app)
const EMPLOYEE_ID_ERROR = 'Employee ID must be numbers only (up to 9 digits, no leading zero).';
const FACULTY_TOKEN_DAYS = 180;
const EDITABLE_FIELDS = ['surname', 'first_name', 'middle_name', 'phone_number', 'address', 'sex', 'college'];

module.exports = function registerFacultyRoutes(app, deps) {
    const {
        db, jwt, bcrypt, crypto, verifyToken, requireSuperAdmin, sendEmail, buildOtpEmail,
        OTP_TTL_MINUTES, OTP_RESEND_SECONDS, OTP_MAX_PER_HOUR, OTP_MAX_ATTEMPTS,
        buildFullName, getCurrentPeriod, isStrongPassword, PASSWORD_RULE_MESSAGE,
        namesAreValid, NAME_RULE_MESSAGE, VALID_SEX_VALUES, CVSU_EMAIL_REGEX,
        lockedSeconds, lockedMessage, recordWrongPassword, clearWrongPasswords, wrongPasswordMessage,
        reportingSemester, checkCorImage, uploadCor, corViewUrl, deleteCor,
        otpLimiter, registerLimiter, loginLimiter, availabilityLimiter,
    } = deps;

    const cleanId = (id) => String(id || '').trim();
    const hashOtp = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

    // ------------------------------------------------------------------ tables
    async function ensureTables() {
        await db.query(`
            CREATE TABLE IF NOT EXISTS faculty (
                faculty_id INT NOT NULL AUTO_INCREMENT,
                full_name VARCHAR(150) NOT NULL,
                surname VARCHAR(100) DEFAULT NULL,
                first_name VARCHAR(100) DEFAULT NULL,
                middle_name VARCHAR(100) DEFAULT NULL,
                email VARCHAR(100) NOT NULL,
                phone_number VARCHAR(20) DEFAULT NULL,
                address VARCHAR(255) DEFAULT NULL,
                sex ENUM('male','female') DEFAULT NULL,
                password VARCHAR(255) DEFAULT NULL,
                employee_id VARCHAR(20) NOT NULL,
                college VARCHAR(100) NOT NULL,
                qr_code VARCHAR(255) DEFAULT NULL,
                status ENUM('pending','approved','rejected','deactivated') NOT NULL DEFAULT 'pending',
                status_reason VARCHAR(500) DEFAULT NULL,
                registered_period VARCHAR(50) DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                privacy_consent_at DATETIME DEFAULT NULL,
                PRIMARY KEY (faculty_id),
                UNIQUE KEY uq_faculty_email (email),
                UNIQUE KEY uq_faculty_employee_id (employee_id),
                UNIQUE KEY uq_faculty_qr (qr_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

        await db.query(`
            CREATE TABLE IF NOT EXISTS faculty_registration_requests (
                request_id INT NOT NULL AUTO_INCREMENT,
                full_name VARCHAR(150) NOT NULL,
                surname VARCHAR(100) DEFAULT NULL,
                first_name VARCHAR(100) DEFAULT NULL,
                middle_name VARCHAR(100) DEFAULT NULL,
                email VARCHAR(100) NOT NULL,
                phone_number VARCHAR(20) DEFAULT NULL,
                address VARCHAR(255) DEFAULT NULL,
                sex ENUM('male','female') DEFAULT NULL,
                employee_id VARCHAR(20) NOT NULL,
                college VARCHAR(100) DEFAULT NULL,
                period VARCHAR(50) DEFAULT NULL,
                approval_status ENUM('pending','approved','rejected','deactivated') NOT NULL DEFAULT 'pending',
                reason VARCHAR(500) DEFAULT NULL,
                approved_by INT DEFAULT NULL,
                approved_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                proof_public_id VARCHAR(255) DEFAULT NULL,
                PRIMARY KEY (request_id),
                KEY idx_faculty_requests_employee (employee_id),
                CONSTRAINT faculty_requests_admin_fk FOREIGN KEY (approved_by) REFERENCES admins (admin_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

        // An earlier draft kept faculty logs against students.user_id. If that empty table is
        // still there, replace it (a table that already holds rows is left alone and reported).
        const [oldCols] = await db.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faculty_logs'`
        );
        const names = oldCols.map((c) => c.COLUMN_NAME);
        if (names.length > 0 && !names.includes('faculty_id')) {
            const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM faculty_logs');
            if (Number(n) === 0) await db.query('DROP TABLE faculty_logs');
            else console.error('faculty_logs has the old layout AND rows. Move them by hand (see migration_faculty.sql).');
        }
        await db.query(`
            CREATE TABLE IF NOT EXISTS faculty_logs (
                log_id INT NOT NULL AUTO_INCREMENT,
                faculty_id INT NOT NULL,
                time_in DATETIME DEFAULT NULL,
                time_out DATETIME DEFAULT NULL,
                visit_date DATE DEFAULT NULL,
                status ENUM('inside','exited','voided') DEFAULT 'inside',
                forced_exit TINYINT(1) NOT NULL DEFAULT 0,
                PRIMARY KEY (log_id),
                KEY idx_faculty_logs_faculty (faculty_id),
                KEY idx_faculty_logs_visit (visit_date),
                CONSTRAINT faculty_logs_faculty_fk FOREIGN KEY (faculty_id) REFERENCES faculty (faculty_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

        await db.query(`
            CREATE TABLE IF NOT EXISTS faculty_password_reset_tokens (
                token_id INT NOT NULL AUTO_INCREMENT,
                employee_id VARCHAR(20) NOT NULL,
                token_hash CHAR(64) NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (token_id),
                KEY idx_faculty_reset_hash (token_hash),
                KEY idx_faculty_reset_employee (employee_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

        await db.query(`
            CREATE TABLE IF NOT EXISTS faculty_edit_logs (
                edit_id INT NOT NULL AUTO_INCREMENT,
                employee_id VARCHAR(20) NOT NULL,
                admin_id INT NOT NULL,
                changes JSON NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (edit_id),
                KEY idx_faculty_edit_employee (employee_id),
                CONSTRAINT faculty_edit_admin_fk FOREIGN KEY (admin_id) REFERENCES admins (admin_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    }
    ensureTables().catch((err) => console.error('Faculty tables error:', err.message));

    // ------------------------------------------------------------------ helpers
    const safeFaculty = (row) => { const { password, ...rest } = row; return rest; };

    function issueFacultyToken(employee_id) {
        return jwt.sign({ employee_id, type: 'faculty' }, process.env.JWT_SECRET, { expiresIn: `${FACULTY_TOKEN_DAYS}d` });
    }

    // Middleware: valid faculty login pass; puts { employee_id } in req.faculty.
    function verifyFacultyToken(req, res, next) {
        const header = req.headers['authorization'] || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ message: 'Please log in again.' });
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.type !== 'faculty') throw new Error('not a faculty token');
            req.faculty = decoded;
            next();
        } catch {
            return res.status(401).json({ message: 'Your login has expired. Please log in again.' });
        }
    }

    // Phone numbers are unique across students AND faculty (last 10 digits compared).
    async function phoneUsedByAnother(phone, ownEmployeeId) {
        const last10 = String(phone || '').replace(/\D/g, '').slice(-10);
        if (last10.length !== 10) return false;
        const [f] = await db.query(
            `SELECT 1 FROM faculty WHERE RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', ''), 10) = ?
               AND employee_id <> ? AND status <> 'rejected' LIMIT 1`, [last10, ownEmployeeId || '']);
        if (f.length) return true;
        const [s] = await db.query(
            `SELECT 1 FROM students WHERE RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', ''), 10) = ?
               AND status <> 'rejected' LIMIT 1`, [last10]);
        return s.length > 0;
    }

    // Employee ID can't be a number a student already has (login accepts either kind of number).
    const idUsedByStudent = async (employee_id) =>
        (await db.query('SELECT 1 FROM students WHERE student_number = ? LIMIT 1', [employee_id]))[0].length > 0;

    // Same OTP check as students (email_verifications is shared).
    async function checkOtp(email, code) {
        const [rows] = await db.query(
            'SELECT code_hash, attempts, expires_at < NOW() AS expired FROM email_verifications WHERE email = ?', [email]);
        if (rows.length === 0) return { ok: false, message: 'Please request a verification code first.' };
        const row = rows[0];
        if (row.expired) return { ok: false, message: 'This code has expired. Please tap "Resend code".' };
        if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, message: 'Too many wrong tries. Please tap "Resend code" for a new one.' };
        if (!/^\d{6}$/.test(String(code || '')) || hashOtp(code) !== row.code_hash) {
            await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?', [email]);
            const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
            return { ok: false, message: left > 0 ? `Incorrect code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Incorrect code. Please tap "Resend code" for a new one.' };
        }
        return { ok: true };
    }

    // True if this faculty member never had an approved registration or any log
    // (so a wrong Employee ID may still be corrected on resubmit).
    async function canChangeEmployeeId(person) {
        const [[{ logs }]] = await db.query('SELECT COUNT(*) AS logs FROM faculty_logs WHERE faculty_id = ?', [person.faculty_id]);
        const [[{ verified }]] = await db.query(
            `SELECT COUNT(*) AS verified FROM faculty_registration_requests
             WHERE employee_id = ? AND approval_status IN ('approved','deactivated')`, [person.employee_id]);
        return Number(logs) === 0 && Number(verified) === 0;
    }

    async function removeProofForRequest(requestId) {
        try {
            const [[row]] = await db.query('SELECT proof_public_id FROM faculty_registration_requests WHERE request_id = ?', [requestId]);
            if (row && row.proof_public_id) {
                await deleteCor(row.proof_public_id);
                await db.query('UPDATE faculty_registration_requests SET proof_public_id = NULL WHERE request_id = ?', [requestId]);
            }
        } catch (err) {
            console.error('removeProofForRequest error:', err.message);
        }
    }

    // ------------------------------------------------------------------ login (called by /api/login)
    // Returns null if no faculty account matches (the caller then says "not found"),
    // otherwise { status, body } to send back.
    async function login(identifier, password) {
        const byId = /^\d{1,9}$/.test(identifier);
        const [rows] = byId
            ? await db.query('SELECT * FROM faculty WHERE employee_id = ?', [identifier])
            : await db.query('SELECT * FROM faculty WHERE LOWER(email) = ?', [identifier]);
        if (rows.length === 0) return null;
        const person = rows[0];
        if (!person.password) {
            return { status: 403, body: { message: 'This account needs a password set up. Please contact the library or re-register.' } };
        }
        const limitKey = `faculty:${person.employee_id}`;
        const lockLeft = lockedSeconds(limitKey);
        if (lockLeft > 0) return { status: 429, body: { message: lockedMessage(lockLeft), retry_after_seconds: lockLeft } };

        if (!(await bcrypt.compare(password, person.password))) {
            const left = recordWrongPassword(limitKey);
            return { status: 401, body: { message: wrongPasswordMessage(left) } };
        }
        clearWrongPasswords(limitKey);
        return {
            status: 200,
            body: { message: 'Login successful', user_type: 'faculty', faculty: { ...safeFaculty(person), user_type: 'faculty' }, token: issueFacultyToken(person.employee_id) },
        };
    }

    // ------------------------------------------------------------------ live checks (register screen)
    app.get('/api/faculty/register/check-employee-id/:employee_id', availabilityLimiter, async (req, res) => {
        const employee_id = cleanId(req.params.employee_id);
        if (!EMPLOYEE_ID_REGEX.test(employee_id)) return res.status(400).json({ available: false, message: EMPLOYEE_ID_ERROR });
        try {
            if (await idUsedByStudent(employee_id)) {
                return res.json({ available: false, reason: 'taken', message: 'This ID number is already used by another account.' });
            }
            const [rows] = await db.query('SELECT status FROM faculty WHERE employee_id = ?', [employee_id]);
            if (rows.length === 0) return res.json({ available: true, message: 'Employee ID is available.' });
            if (req.query.for_change === '1') return res.json({ available: false, reason: 'taken', message: 'This employee ID is already used by another account.' });
            const status = rows[0].status;
            if (status === 'rejected') return res.json({ available: true, message: 'Your earlier registration was rejected — you can register again.' });
            if (status === 'deactivated') return res.json({ available: false, reason: 'deactivated', message: 'This account is deactivated. Please visit the library front desk.' });
            return res.json({ available: false, reason: 'registered', message: 'Already registered. Please log in instead.' });
        } catch (err) {
            console.error('Employee ID check error:', err.message);
            res.status(500).json({ message: 'Could not check right now.' });
        }
    });

    app.get('/api/faculty/register/check-email/:email', availabilityLimiter, async (req, res) => {
        const email = String(req.params.email || '').trim().toLowerCase();
        const employee_id = cleanId(req.query.employee_id);
        if (!CVSU_EMAIL_REGEX.test(email)) return res.status(400).json({ available: false, message: 'Must be a CvSU email ending in @cvsu.edu.ph' });
        try {
            const [rows] = await db.query('SELECT employee_id, status FROM faculty WHERE LOWER(email) = ? LIMIT 1', [email]);
            if (rows.length === 0) {
                const [s] = await db.query('SELECT 1 FROM students WHERE LOWER(email) = ? LIMIT 1', [email]);
                if (s.length) return res.json({ available: false, reason: 'registered', message: 'This email is already registered. Please log in instead.' });
                return res.json({ available: true, message: 'Email is available.' });
            }
            const owner = rows[0];
            if (owner.employee_id === employee_id && owner.status === 'rejected') return res.json({ available: true, message: 'Email is available.' });
            if (owner.status === 'deactivated') return res.json({ available: false, reason: 'deactivated', message: 'This email belongs to a deactivated account. Please visit the library front desk.' });
            return res.json({ available: false, reason: 'registered', message: 'This email is already registered. Please log in instead.' });
        } catch (err) {
            console.error('Faculty email check error:', err.message);
            res.status(500).json({ message: 'Could not check right now.' });
        }
    });

    app.get('/api/faculty/register/check-phone/:phone_number', availabilityLimiter, async (req, res) => {
        if (!/^\+639\d{9}$/.test(req.params.phone_number)) return res.status(400).json({ available: false, message: 'Please enter all 10 digits after +63.' });
        try {
            if (await phoneUsedByAnother(req.params.phone_number, cleanId(req.query.employee_id))) {
                return res.json({ available: false, reason: 'in_use', message: 'This phone number is already used by another account.' });
            }
            res.json({ available: true, message: 'Phone number is available.' });
        } catch (err) {
            console.error('Faculty phone check error:', err.message);
            res.status(500).json({ message: 'Could not check right now.' });
        }
    });

    // ------------------------------------------------------------------ email code
    app.post('/api/faculty/register/send-otp', otpLimiter, async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const employee_id = cleanId(req.body.employee_id);
        if (!CVSU_EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Please use your CvSU email ending in @cvsu.edu.ph.' });
        try {
            const [byEmail] = await db.query('SELECT employee_id FROM faculty WHERE LOWER(email) = ?', [email]);
            if (byEmail.length > 0 && byEmail[0].employee_id !== employee_id) {
                return res.status(400).json({ message: 'This email is already associated with a different employee ID.' });
            }
            const [studentEmail] = await db.query('SELECT 1 FROM students WHERE LOWER(email) = ? LIMIT 1', [email]);
            if (studentEmail.length > 0) return res.status(400).json({ message: 'This email is already registered to another account.' });

            const [rows] = await db.query(
                `SELECT TIMESTAMPDIFF(SECOND, last_sent_at, NOW()) AS since,
                        TIMESTAMPDIFF(SECOND, hour_started_at, NOW()) AS hour_age, hour_count
                 FROM email_verifications WHERE email = ?`, [email]);
            if (rows.length > 0 && rows[0].since < OTP_RESEND_SECONDS) {
                const wait = OTP_RESEND_SECONDS - rows[0].since;
                return res.status(429).json({ message: `Please wait ${wait} seconds before requesting a new code.`, retry_after_seconds: wait });
            }
            const sameHour = rows.length > 0 && rows[0].hour_age !== null && rows[0].hour_age < 3600;
            const sentThisHour = sameHour ? Number(rows[0].hour_count) : 0;
            if (sentThisHour >= OTP_MAX_PER_HOUR) {
                const waitSeconds = 3600 - rows[0].hour_age;
                const minutes = Math.ceil(waitSeconds / 60);
                return res.status(429).json({
                    rate_limited: true, retry_after_seconds: waitSeconds,
                    message: `You've requested ${OTP_MAX_PER_HOUR} codes in the last hour. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or use the latest code we sent if it hasn't expired.`,
                });
            }
            const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
            await db.query(
                `INSERT INTO email_verifications (email, code_hash, expires_at, attempts, last_sent_at, hour_started_at, hour_count)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, NOW(), NOW(), 1)
                 ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at),
                                         attempts = 0, last_sent_at = NOW(),
                                         hour_started_at = IF(?, hour_started_at, NOW()),
                                         hour_count = ?`,
                [email, hashOtp(code), OTP_TTL_MINUTES, sameHour ? 1 : 0, sentThisHour + 1]);
            await sendEmail({ to: email, subject: 'Your QLess verification code', html: buildOtpEmail(code) });
            res.json({ success: true, message: `We sent a 6-digit code to ${email}.`, retry_after_seconds: OTP_RESEND_SECONDS });
        } catch (err) {
            console.error('Faculty send OTP error:', err.message);
            res.status(500).json({ message: "We couldn't send the code right now. Please try again." });
        }
    });

    // ------------------------------------------------------------------ registration
    app.post('/api/faculty/register', registerLimiter, async (req, res) => {
        const { surname, first_name, middle_name, phone_number, address, sex, password, college } = req.body;
        const email = String(req.body.email || '').trim().toLowerCase();
        const employee_id = cleanId(req.body.employee_id);

        if (!surname || !first_name || !email || !phone_number || !address || !sex || !employee_id || !password || !college) {
            return res.status(400).json({ message: 'Please fill in all required fields.' });
        }
        if (!isStrongPassword(password)) return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
        if (!namesAreValid(surname, first_name, middle_name)) return res.status(400).json({ message: NAME_RULE_MESSAGE });
        if (req.body.privacy_consent !== true) return res.status(400).json({ message: 'Please read and agree to the Privacy Notice and Terms of Use.' });
        const proofError = checkCorImage(req.body.proof_image, 'Employee ID');
        if (proofError) return res.status(400).json({ message: proofError });
        if (!VALID_SEX_VALUES.includes(sex)) return res.status(400).json({ message: 'Invalid value for sex.' });
        if (!CVSU_EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Please use your CvSU email ending in @cvsu.edu.ph.' });
        if (!EMPLOYEE_ID_REGEX.test(employee_id)) return res.status(400).json({ message: EMPLOYEE_ID_ERROR });

        try {
            const otp = await checkOtp(email, req.body.otp);
            if (!otp.ok) return res.status(400).json({ otp_error: true, message: otp.message });

            if (await phoneUsedByAnother(phone_number, employee_id)) {
                return res.status(400).json({ message: 'This phone number is already used by another account.' });
            }
            if (await idUsedByStudent(employee_id)) {
                return res.status(400).json({ message: 'This ID number is already used by another account.' });
            }
            const [studentEmail] = await db.query('SELECT 1 FROM students WHERE LOWER(email) = ? LIMIT 1', [email]);
            if (studentEmail.length > 0) return res.status(400).json({ message: 'This email is already registered to another account.' });

            const [byId] = await db.query('SELECT * FROM faculty WHERE employee_id = ?', [employee_id]);
            const [byEmail] = await db.query('SELECT * FROM faculty WHERE LOWER(email) = ?', [email]);
            if (byId.length > 0 && byId[0].email !== email) {
                return res.status(400).json({ message: 'This employee ID is already registered under a different account.' });
            }
            if (byEmail.length > 0 && byEmail[0].employee_id !== employee_id) {
                return res.status(400).json({ message: 'This email is already associated with a different employee ID.' });
            }
            const existing = byId[0] || byEmail[0] || null;
            if (existing && existing.status !== 'rejected') {
                return res.status(400).json({
                    message: existing.status === 'deactivated'
                        ? 'This account has been deactivated. Please contact the library to resolve this.'
                        : 'This account already exists. Please log in.',
                });
            }

            const currentPeriod = await getCurrentPeriod();
            const hashedPassword = await bcrypt.hash(password, 10);
            const full_name = buildFullName(first_name, middle_name, surname);
            const proofId = await uploadCor(req.body.proof_image, employee_id); // upload first: a failed upload changes nothing

            await db.query(
                `INSERT INTO faculty_registration_requests (
                    full_name, surname, first_name, middle_name, email, phone_number, address, sex,
                    employee_id, college, period, approval_status, created_at, proof_public_id
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?)`,
                [full_name, surname, first_name, middle_name || null, email, phone_number, address, sex, employee_id, college, currentPeriod, proofId]);

            if (existing) {
                // A REJECTED faculty member registering again: replace their details, back to pending.
                await db.query(
                    `UPDATE faculty SET full_name = ?, surname = ?, first_name = ?, middle_name = ?, email = ?, phone_number = ?,
                            address = ?, sex = ?, password = ?, college = ?, status = 'pending', status_reason = NULL,
                            qr_code = NULL, registered_period = ?, privacy_consent_at = NOW()
                     WHERE faculty_id = ?`,
                    [full_name, surname, first_name, middle_name || null, email, phone_number, address, sex, hashedPassword, college, currentPeriod, existing.faculty_id]);
            } else {
                await db.query(
                    `INSERT INTO faculty (full_name, surname, first_name, middle_name, email, phone_number, address, sex, password,
                                          employee_id, college, qr_code, status, registered_period, privacy_consent_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, NOW())`,
                    [full_name, surname, first_name, middle_name || null, email, phone_number, address, sex, hashedPassword, employee_id, college, currentPeriod]);
            }
            await db.query('DELETE FROM email_verifications WHERE email = ?', [email]); // code used up
            res.status(201).json({ message: existing ? 'Registration resubmitted! Please wait for admin approval.' : 'Registration submitted successfully!' });
        } catch (err) {
            console.error('Faculty register error:', err);
            if (err.corUpload) return res.status(502).json({ message: "We couldn't save your employee ID photo. Please try again." });
            res.status(500).json({ message: 'Could not register right now. Please try again.' });
        }
    });

    // RESUBMIT a REJECTED registration (logged-in faculty only). Same idea as the student version.
    app.put('/api/faculty/registration/:employee_id', verifyFacultyToken, async (req, res) => {
        const current_id = cleanId(req.params.employee_id);
        if (req.faculty.employee_id !== current_id) return res.status(403).json({ message: 'You can only resubmit your own registration.' });
        const { surname, first_name, middle_name, phone_number, address, sex, college } = req.body;
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!surname || !first_name || !email || !phone_number || !address || !sex || !college) return res.status(400).json({ message: 'Please fill in all required fields.' });
        if (!VALID_SEX_VALUES.includes(sex)) return res.status(400).json({ message: 'Invalid value for sex.' });
        if (!CVSU_EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Please use your CvSU email ending in @cvsu.edu.ph.' });
        if (!/^\+639\d{9}$/.test(phone_number)) return res.status(400).json({ message: 'Please enter all 10 digits after +63.' });
        if (!namesAreValid(surname, first_name, middle_name)) return res.status(400).json({ message: NAME_RULE_MESSAGE });
        const proofError = checkCorImage(req.body.proof_image, 'Employee ID');
        if (proofError) return res.status(400).json({ message: proofError });

        try {
            const [rows] = await db.query('SELECT * FROM faculty WHERE employee_id = ?', [current_id]);
            if (rows.length === 0) return res.status(404).json({ message: 'No account found for this employee ID.' });
            const person = rows[0];
            if (person.status !== 'rejected') return res.status(409).json({ message: 'Only rejected registrations can be resubmitted.' });

            const newId = cleanId(req.body.new_employee_id);
            const changing = newId !== '' && newId !== current_id;
            if (changing) {
                if (!EMPLOYEE_ID_REGEX.test(newId)) return res.status(400).json({ message: EMPLOYEE_ID_ERROR });
                if (!(await canChangeEmployeeId(person))) return res.status(403).json({ message: "Your employee ID was already verified, so it can't be changed here. Please visit the library front desk." });
                const [taken] = await db.query('SELECT 1 FROM faculty WHERE employee_id = ? LIMIT 1', [newId]);
                if (taken.length > 0 || (await idUsedByStudent(newId))) return res.status(400).json({ message: 'This employee ID is already used by another account.' });
            }
            const finalId = changing ? newId : current_id;

            const [emailOwner] = await db.query('SELECT 1 FROM faculty WHERE LOWER(email) = ? AND employee_id <> ? LIMIT 1', [email, current_id]);
            const [studentEmail] = await db.query('SELECT 1 FROM students WHERE LOWER(email) = ? LIMIT 1', [email]);
            if (emailOwner.length > 0 || studentEmail.length > 0) return res.status(400).json({ message: 'This email is already registered to another account.' });
            if (await phoneUsedByAnother(phone_number, current_id)) return res.status(400).json({ message: 'This phone number is already used by another account.' });

            const currentPeriod = await getCurrentPeriod();
            const full_name = buildFullName(first_name, middle_name, surname);
            const proofId = await uploadCor(req.body.proof_image, finalId);

            const conn = await db.getConnection();
            try {
                await conn.beginTransaction();
                const [[locked]] = await conn.query('SELECT status FROM faculty WHERE employee_id = ? FOR UPDATE', [current_id]);
                if (!locked || locked.status !== 'rejected') { const dup = new Error('Already resubmitted'); dup.alreadySubmitted = true; throw dup; }
                if (changing) await conn.query('UPDATE faculty_registration_requests SET employee_id = ? WHERE employee_id = ?', [finalId, current_id]);
                await conn.query(
                    `UPDATE faculty SET full_name = ?, surname = ?, first_name = ?, middle_name = ?, email = ?, phone_number = ?,
                            address = ?, sex = ?, college = ?, employee_id = ?, status = 'pending', status_reason = NULL,
                            qr_code = NULL, registered_period = ?
                     WHERE employee_id = ?`,
                    [full_name, surname, first_name, middle_name || null, email, phone_number, address, sex, college, finalId, currentPeriod, current_id]);
                await conn.query(
                    `INSERT INTO faculty_registration_requests (
                        full_name, surname, first_name, middle_name, email, phone_number, address, sex,
                        employee_id, college, period, approval_status, created_at, proof_public_id
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?)`,
                    [full_name, surname, first_name, middle_name || null, email, phone_number, address, sex, finalId, college, currentPeriod, proofId]);
                await conn.commit();
            } catch (err) {
                await conn.rollback();
                await deleteCor(proofId);
                throw err;
            } finally {
                conn.release();
            }
            res.json({
                success: true,
                message: 'Registration resubmitted! Please wait for admin approval.',
                ...(changing ? { employee_id: finalId, token: issueFacultyToken(finalId) } : {}),
            });
        } catch (err) {
            if (err.alreadySubmitted) return res.status(409).json({ message: 'Your registration was already resubmitted. Please wait for admin approval.' });
            console.error('Faculty resubmit error:', err.message);
            if (err.corUpload) return res.status(502).json({ message: "We couldn't save your employee ID photo. Please try again." });
            res.status(500).json({ message: 'Could not resubmit right now. Please try again.' });
        }
    });

    // ------------------------------------------------------------------ the faculty member's own data
    app.get('/api/faculty/profile/:employee_id', verifyFacultyToken, async (req, res) => {
        const employee_id = cleanId(req.params.employee_id);
        if (req.faculty.employee_id !== employee_id) return res.status(403).json({ message: 'You can only view your own profile.' });
        try {
            const [rows] = await db.query('SELECT * FROM faculty WHERE employee_id = ?', [employee_id]);
            if (rows.length === 0) return res.status(404).json({ message: 'Faculty profile not found.' });
            const profile = { ...safeFaculty(rows[0]), user_type: 'faculty' };
            profile.can_change_employee_id = profile.status === 'rejected' && (await canChangeEmployeeId(rows[0]));
            res.json(profile);
        } catch (err) {
            console.error('Faculty profile error:', err.message);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Same numbers as the student home screen: this semester's visits, weekly chart, busiest day, average stay.
    app.get('/api/faculty/analytics/:employee_id', verifyFacultyToken, async (req, res) => {
        const employee_id = cleanId(req.params.employee_id);
        if (req.faculty.employee_id !== employee_id) return res.status(403).json({ message: 'You can only view your own analytics.' });
        try {
            const [rows] = await db.query('SELECT faculty_id FROM faculty WHERE employee_id = ?', [employee_id]);
            if (rows.length === 0) return res.status(404).json({ message: 'Faculty not found.' });
            const faculty_id = rows[0].faculty_id;
            const semester = await reportingSemester();

            const [myLogs] = await db.query(
                `SELECT time_in, time_out, visit_date, forced_exit FROM faculty_logs
                 WHERE faculty_id = ? AND status <> 'voided' AND visit_date >= ? AND visit_date < ?`,
                [faculty_id, semester.start, semester.endExclusive]);
            const [[{ inside }]] = await db.query(
                `SELECT (SELECT COUNT(*) FROM student_logs WHERE status = 'inside')
                      + (SELECT COUNT(*) FROM faculty_logs WHERE status = 'inside')
                      + (SELECT COUNT(*) FROM guest_logs WHERE status = 'inside') AS inside`);

            const dayHourTotals = new Array(7).fill(0), dayHourCounts = new Array(7).fill(0), dayVisitCounts = new Array(7).fill(0);
            let totalStayMs = 0, exitedCount = 0;
            myLogs.forEach((log) => {
                if (!log.visit_date) return;
                const idx = new Date(log.visit_date).getDay();
                dayVisitCounts[idx] += 1;
                if (log.time_in && log.time_out && !log.forced_exit) {
                    const ms = new Date(log.time_out) - new Date(log.time_in);
                    dayHourTotals[idx] += ms / 3600000;
                    dayHourCounts[idx] += 1;
                    totalStayMs += ms;
                    exitedCount += 1;
                }
            });
            const weeklyActivity = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => ({
                day, hours: dayHourCounts[i] > 0 ? parseFloat((dayHourTotals[i] / dayHourCounts[i]).toFixed(1)) : 0,
            }));
            const maxVisits = Math.max(...dayVisitCounts);
            const frequentDay = maxVisits > 0
                ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayVisitCounts.indexOf(maxVisits)]
                : '--';
            const [recentVisits] = await db.query(
                `SELECT log_id, visit_date, time_in, time_out, status, forced_exit FROM faculty_logs
                 WHERE faculty_id = ? AND visit_date >= ? AND visit_date < ? ORDER BY time_in DESC LIMIT 3`,
                [faculty_id, semester.start, semester.endExclusive]);

            res.json({
                recent_visits: recentVisits,
                total_visits: myLogs.length,
                current_occupancy: Number(inside),
                weekly_activity: weeklyActivity,
                frequent_day: frequentDay,
                avg_stay_hours: exitedCount > 0 ? totalStayMs / exitedCount / 3600000 : 0,
                period_label: semester.label,
            });
        } catch (err) {
            console.error('Faculty analytics error:', err.message);
            res.status(500).json({ message: 'Server error computing analytics.' });
        }
    });

    app.get('/api/faculty/visits/:employee_id', verifyFacultyToken, async (req, res) => {
        const employee_id = cleanId(req.params.employee_id);
        if (req.faculty.employee_id !== employee_id) return res.status(403).json({ message: 'You can only view your own visits.' });
        try {
            const [rows] = await db.query('SELECT faculty_id FROM faculty WHERE employee_id = ?', [employee_id]);
            if (rows.length === 0) return res.status(404).json({ message: 'Faculty not found.' });
            const semester = await reportingSemester();
            const [visits] = await db.query(
                `SELECT log_id, visit_date, time_in, time_out, status, forced_exit FROM faculty_logs
                 WHERE faculty_id = ? AND visit_date >= ? AND visit_date < ? ORDER BY time_in DESC LIMIT 500`,
                [rows[0].faculty_id, semester.start, semester.endExclusive]);
            res.json({ period_label: semester.label, visits });
        } catch (err) {
            console.error('Faculty visits error:', err.message);
            res.status(500).json({ message: 'Could not load your visits.' });
        }
    });

    app.post('/api/faculty/change-password', loginLimiter, async (req, res) => {
        const { employee_id, current_password, new_password } = req.body;
        if (!employee_id || !current_password || !new_password) return res.status(400).json({ message: 'All fields are required.' });
        if (!isStrongPassword(new_password)) return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
        try {
            const [rows] = await db.query('SELECT * FROM faculty WHERE employee_id = ?', [cleanId(employee_id)]);
            if (rows.length === 0) return res.status(404).json({ message: 'Account not found.' });
            const person = rows[0];
            if (!person.password) return res.status(403).json({ message: 'This account has no password set up yet.' });
            const limitKey = `faculty:${person.employee_id}`;
            const lockLeft = lockedSeconds(limitKey);
            if (lockLeft > 0) return res.status(429).json({ message: lockedMessage(lockLeft), retry_after_seconds: lockLeft });
            if (!(await bcrypt.compare(current_password, person.password))) {
                const left = recordWrongPassword(limitKey);
                return res.status(401).json({ message: wrongPasswordMessage(left) });
            }
            clearWrongPasswords(limitKey);
            if (await bcrypt.compare(new_password, person.password)) return res.status(400).json({ message: 'Your new password must be different from your current one.' });
            await db.query('UPDATE faculty SET password = ? WHERE employee_id = ?', [await bcrypt.hash(new_password, 10), person.employee_id]);
            res.json({ success: true, message: 'Password changed successfully.' });
        } catch (err) {
            console.error('Faculty change password error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------------------------------ admin (website)
    // Registration requests, newest first (all statuses; the page filters by tab).
    app.get('/api/admin/faculty/registrations', verifyToken, async (req, res) => {
        try {
            const [rows] = await db.query('SELECT * FROM faculty_registration_requests ORDER BY created_at DESC');
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Temporary (10 minute) link to the proof of Employee ID.
    app.get('/api/admin/faculty/registrations/:request_id/proof', verifyToken, async (req, res) => {
        try {
            const [[row]] = await db.query('SELECT proof_public_id FROM faculty_registration_requests WHERE request_id = ?', [req.params.request_id]);
            if (!row) return res.status(404).json({ message: 'Request not found.' });
            if (!row.proof_public_id) return res.status(404).json({ message: 'No employee ID photo for this request (already reviewed).' });
            res.json(corViewUrl(row.proof_public_id)); // { url, pdf_url }
        } catch (err) {
            console.error('View proof error:', err.message);
            res.status(500).json({ message: 'Could not load the employee ID photo.' });
        }
    });

    // Faculty passes don't depend on a semester, so approval works any time.
    app.post('/api/admin/faculty/approve', verifyToken, async (req, res) => {
        const { request_id } = req.body;
        try {
            const [request] = await db.query('SELECT * FROM faculty_registration_requests WHERE request_id = ?', [request_id]);
            if (request.length === 0) return res.status(404).json({ message: 'Request not found' });
            const qrToken = crypto.randomUUID();
            await db.query(`UPDATE faculty SET status = 'approved', status_reason = NULL, qr_code = ? WHERE employee_id = ?`, [qrToken, request[0].employee_id]);
            await db.query(`UPDATE faculty_registration_requests SET approval_status = 'approved', approved_by = ?, approved_at = NOW() WHERE request_id = ?`, [req.admin.admin_id, request_id]);
            await removeProofForRequest(request_id);
            res.json({ success: true, message: 'Approved successfully!' });
        } catch (err) {
            console.error('Faculty approve error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/faculty/reject', verifyToken, async (req, res) => {
        const { request_id, reason } = req.body;
        if (!reason || !reason.trim()) return res.status(400).json({ message: 'A reason is required to reject a registration.' });
        try {
            const [request] = await db.query('SELECT * FROM faculty_registration_requests WHERE request_id = ?', [request_id]);
            if (request.length === 0) return res.status(404).json({ message: 'Request not found.' });
            await db.query(`UPDATE faculty SET status = 'rejected', status_reason = ?, qr_code = NULL WHERE employee_id = ?`, [reason.trim(), request[0].employee_id]);
            await db.query(`UPDATE faculty_registration_requests SET approval_status = 'rejected', reason = ? WHERE request_id = ?`, [reason.trim(), request_id]);
            await removeProofForRequest(request_id);
            res.json({ success: true, message: 'Registration rejected.' });
        } catch (err) {
            console.error('Faculty reject error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Deactivating is how a faculty account is ended (there is no renewal). The QR stops working.
    app.post('/api/admin/faculty/deactivate', verifyToken, async (req, res) => {
        const employee_id = cleanId(req.body.employee_id);
        const reason = String(req.body.reason || '').trim();
        if (!employee_id) return res.status(400).json({ message: 'employee_id is required.' });
        if (!reason) return res.status(400).json({ message: 'A reason is required to deactivate an account.' });
        try {
            const [r] = await db.query(`UPDATE faculty SET status = 'deactivated', status_reason = ?, qr_code = NULL WHERE employee_id = ? AND status = 'approved'`, [reason, employee_id]);
            if (r.affectedRows === 0) return res.status(404).json({ message: 'No approved faculty account with this employee ID.' });
            await db.query(
                `UPDATE faculty_registration_requests SET approval_status = 'deactivated', reason = ?
                 WHERE request_id = (SELECT request_id FROM (SELECT MAX(request_id) AS request_id FROM faculty_registration_requests
                                      WHERE employee_id = ? AND approval_status = 'approved') latest)`,
                [reason, employee_id]);
            res.json({ success: true, message: 'Account deactivated. QR access revoked.' });
        } catch (err) {
            console.error('Faculty deactivate error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/faculty/reactivate', verifyToken, async (req, res) => {
        const employee_id = cleanId(req.body.employee_id);
        if (!employee_id) return res.status(400).json({ message: 'employee_id is required.' });
        try {
            const [r] = await db.query(`UPDATE faculty SET status = 'approved', status_reason = NULL, qr_code = ? WHERE employee_id = ? AND status = 'deactivated'`, [crypto.randomUUID(), employee_id]);
            if (r.affectedRows === 0) return res.status(404).json({ message: 'No deactivated faculty account with this employee ID.' });
            await db.query(
                `UPDATE faculty_registration_requests SET approval_status = 'approved'
                 WHERE request_id = (SELECT request_id FROM (SELECT MAX(request_id) AS request_id FROM faculty_registration_requests
                                      WHERE employee_id = ? AND approval_status = 'deactivated') latest)`,
                [employee_id]);
            res.json({ success: true, message: 'Account reactivated. New QR pass issued.' });
        } catch (err) {
            console.error('Faculty reactivate error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/admin/faculty', verifyToken, async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT faculty_id, full_name, surname, first_name, middle_name, email, phone_number, address, sex,
                        employee_id, college, status, status_reason, registered_period, created_at
                 FROM faculty ORDER BY full_name ASC`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Edit a faculty member's details (never the Employee ID, email, status or QR). Every edit is logged.
    app.put('/api/admin/faculty/:employee_id', verifyToken, async (req, res) => {
        const employee_id = cleanId(req.params.employee_id);
        const updates = {};
        for (const f of EDITABLE_FIELDS) if (req.body[f] !== undefined) updates[f] = req.body[f];
        if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No editable fields provided.' });
        if (updates.sex && !VALID_SEX_VALUES.includes(updates.sex)) return res.status(400).json({ message: 'Invalid value for sex.' });
        if (!namesAreValid(updates.surname, updates.first_name, updates.middle_name)) return res.status(400).json({ message: NAME_RULE_MESSAGE });
        if (updates.phone_number !== undefined && !/^\+639\d{9}$/.test(updates.phone_number)) return res.status(400).json({ message: 'Please enter all 10 digits of the phone number after +63.' });
        try {
            const [rows] = await db.query('SELECT * FROM faculty WHERE employee_id = ?', [employee_id]);
            if (rows.length === 0) return res.status(404).json({ message: 'Faculty not found.' });
            const existing = rows[0];
            if (updates.phone_number && updates.phone_number !== existing.phone_number && (await phoneUsedByAnother(updates.phone_number, employee_id))) {
                return res.status(400).json({ message: 'This phone number is already used by another account.' });
            }
            if (['surname', 'first_name', 'middle_name'].some((f) => f in updates)) {
                updates.full_name = buildFullName(updates.first_name ?? existing.first_name, updates.middle_name ?? existing.middle_name, updates.surname ?? existing.surname);
            }
            await db.query(`UPDATE faculty SET ${Object.keys(updates).map((f) => `${f} = ?`).join(', ')} WHERE employee_id = ?`, [...Object.values(updates), employee_id]);
            await db.query('INSERT INTO faculty_edit_logs (employee_id, admin_id, changes) VALUES (?, ?, ?)', [employee_id, req.admin.admin_id, JSON.stringify(updates)]);
            res.json({ success: true, message: 'Faculty information updated.' });
        } catch (err) {
            console.error('Update faculty error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Faculty entry / exit history (same shape as /api/logs/all, with employee_id instead of student_number).
    app.get('/api/faculty-logs/all', verifyToken, async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT fl.log_id, fl.visit_date, fl.time_in, fl.time_out, fl.status, fl.forced_exit,
                       f.full_name, f.employee_id, f.college, f.sex
                FROM faculty_logs fl JOIN faculty f ON fl.faculty_id = f.faculty_id
                ORDER BY fl.visit_date DESC, fl.time_in DESC`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.patch('/api/faculty-logs/void/:log_id', verifyToken, requireSuperAdmin, async (req, res) => {
        try {
            await db.query('UPDATE faculty_logs SET status = "voided" WHERE log_id = ?', [req.params.log_id]);
            res.json({ success: true, message: 'Log voided successfully.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return { login };
};