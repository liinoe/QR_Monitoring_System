// Academic calendar: the super admin sets each semester's start and end dates
// (from the school calendar), and the system switches semesters by itself.
//
//   On the END date (the day after it):  every approved student's QR pass stops
//                                        working → status "expired".
//   On the next START date:              the new semester becomes the current
//                                        period, and expired students can renew
//                                        in the app (they become "pending" with a
//                                        renewal request, like before).
//
// Checked every day at 12:01 AM (Philippine time), when the server starts,
// and right after the super admin adds or edits a semester.
//
// Undo: if a semester ended because of a wrong end date, the super admin can undo
// it during the break (within 7 days, before the next semester starts). Everyone's
// pass comes back with the same QR code, and the corrected end date is saved.
//
// Use in index.js:   require('./semesters')(app, { db, verifyToken, requireSuperAdmin, cron });

const TERM_NAMES = { '1st': '1st Semester', '2nd': '2nd Semester', 'Midyear': 'Midyear' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Today's date in the Philippines as "YYYY-MM-DD" (so midnight is Manila midnight).
const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// "2nd", 2026 → "2nd Semester A.Y. 2026-2027".
const buildName = (term, ayStart) => `${TERM_NAMES[term]} A.Y. ${ayStart}-${ayStart + 1}`;

// Number of days from date a to date b ("YYYY-MM-DD" strings).
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

// Selects semesters with dates as plain "YYYY-MM-DD" text (no timezone surprises).
const SEMESTER_COLUMNS = `semester_id, term, ay_start, name, status,
    DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
    DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date`;

module.exports = function registerSemesterRoutes(app, { db, verifyToken, requireSuperAdmin, cron }) {
    // Creates the semesters table and adds the "expired" status, if they don't exist yet.
    async function ensureSchema() {
        await db.query(`
            CREATE TABLE IF NOT EXISTS semesters (
                semester_id INT AUTO_INCREMENT PRIMARY KEY,
                term ENUM('1st','2nd','Midyear') NOT NULL,
                ay_start SMALLINT NOT NULL,
                name VARCHAR(100) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status ENUM('upcoming','active','ended') NOT NULL DEFAULT 'upcoming',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_semester_name (name)
            )`);

        // Undo support: each time a semester ends, we save every affected student's
        // status + QR code, so a wrong end date can be undone during the break.
        await db.query(`
            CREATE TABLE IF NOT EXISTS semester_transitions (
                transition_id INT AUTO_INCREMENT PRIMARY KEY,
                semester_id INT NOT NULL,
                kind ENUM('end') NOT NULL DEFAULT 'end',
                affected_count INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                undone_at TIMESTAMP NULL DEFAULT NULL
            )`);
        await db.query(`
            CREATE TABLE IF NOT EXISTS semester_transition_students (
                transition_id INT NOT NULL,
                student_number VARCHAR(20) NOT NULL,
                prev_status VARCHAR(20) NOT NULL,
                prev_qr_code TEXT NULL,
                prev_status_reason VARCHAR(500) NULL,
                PRIMARY KEY (transition_id, student_number)
            )`);

        // students.status and registration_requests.approval_status need an "expired" value.
        for (const [table, column] of [['students', 'status'], ['registration_requests', 'approval_status']]) {
            const [cols] = await db.query(
                `SELECT COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [table, column]
            );
            if (cols.length === 0 || cols[0].COLUMN_TYPE.includes("'expired'")) continue;
            const newType = cols[0].COLUMN_TYPE.replace(/\)$/, ",'expired')");
            const nullable = cols[0].IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
            await db.query(`ALTER TABLE ${table} MODIFY ${column} ${newType} ${nullable} DEFAULT 'pending'`);
            console.log(`[semesters] Added 'expired' to ${table}.${column}`);
        }
    }

    let syncing = false;

    // Ends semesters whose end date has passed and starts the one whose start date has come.
    async function syncSemesters(reason = 'check') {
        if (syncing) return;
        syncing = true;
        const conn = await db.getConnection();
        try {
            const today = todayManila();
            const [rows] = await conn.query(`SELECT ${SEMESTER_COLUMNS} FROM semesters ORDER BY start_date`);

            // 1) END: the active semester's last day is over → approved passes expire.
            for (const sem of rows.filter((r) => r.status === 'active' && r.end_date < today)) {
                await conn.beginTransaction();
                // Save who is approved right now (and their QR codes) so this can be undone.
                const [snap] = await conn.query(
                    `INSERT INTO semester_transitions (semester_id, kind) VALUES (?, 'end')`,
                    [sem.semester_id]
                );
                await conn.query(
                    `INSERT INTO semester_transition_students (transition_id, student_number, prev_status, prev_qr_code, prev_status_reason)
                     SELECT ?, student_number, status, qr_code, status_reason FROM students WHERE status = 'approved'`,
                    [snap.insertId]
                );
                const [result] = await conn.query(
                    `UPDATE students SET status = 'expired', qr_code = NULL, status_reason = ? WHERE status = 'approved'`,
                    [`${sem.name} ended`]
                );
                await conn.query(`UPDATE semester_transitions SET affected_count = ? WHERE transition_id = ?`, [result.affectedRows, snap.insertId]);
                await conn.query(
                    `UPDATE registration_requests SET approval_status = 'expired' WHERE approval_status = 'approved' AND period = ?`,
                    [sem.name]
                );
                await conn.query(`UPDATE semesters SET status = 'ended' WHERE semester_id = ?`, [sem.semester_id]);
                await conn.commit();
                console.log(`[semesters] ${sem.name} ended (${reason}): ${result.affectedRows} pass(es) expired`);
            }

            // 2) Semesters entered for dates that are already over: just mark them ended.
            await conn.query(`UPDATE semesters SET status = 'ended' WHERE status = 'upcoming' AND end_date < ?`, [today]);

            // 3) START: today is inside an upcoming semester → make it the current period.
            const due = rows.find((r) => r.status === 'upcoming' && r.start_date <= today && r.end_date >= today);
            if (due) {
                await conn.beginTransaction();
                const [periodRows] = await conn.query("SELECT setting_value FROM settings WHERE setting_key = 'current_period'");
                const previousPeriod = periodRows[0]?.setting_value || null;
                await conn.query(`UPDATE settings SET setting_value = ? WHERE setting_key = 'current_period'`, [due.name]);

                // If this semester IS already the current period (e.g. the admin just added
                // the semester that's running now), nobody has to renew.
                const isSamePeriod = previousPeriod === due.name;

                // Students approved (or who registered) DURING the break were filed under the
                // old semester's name, because no new semester existed yet. Move them to this
                // semester so they aren't asked to renew right after being approved.
                if (!isSamePeriod) {
                    const [[gap]] = await conn.query(
                        `SELECT DATE_FORMAT(MAX(end_date), '%Y-%m-%d') AS last_end
                         FROM semesters WHERE status = 'ended' AND end_date < ?`,
                        [due.start_date]
                    );
                    if (gap && gap.last_end) {
                        const breakStart = `${gap.last_end} 23:59:59`; // end of the last semester's final day
                        // Approved during the break → count them for this semester.
                        await conn.query(
                            `UPDATE students s SET s.registered_period = ?
                             WHERE s.status = 'approved' AND EXISTS (
                                 SELECT 1 FROM registration_requests r
                                 WHERE r.student_number = s.student_number
                                   AND r.approval_status = 'approved' AND r.approved_at > ?)`,
                            [due.name, breakStart]
                        );
                        await conn.query(
                            `UPDATE registration_requests SET period = ? WHERE approval_status = 'approved' AND approved_at > ?`,
                            [due.name, breakStart]
                        );
                        // Sent during the break and still waiting for review → this semester's queue.
                        await conn.query(
                            `UPDATE registration_requests SET period = ? WHERE approval_status = 'pending' AND created_at > ?`,
                            [due.name, breakStart]
                        );
                        await conn.query(
                            `UPDATE students SET registered_period = ?
                             WHERE status = 'pending' AND student_number IN (
                                 SELECT student_number FROM registration_requests
                                 WHERE approval_status = 'pending' AND period = ?)`,
                            [due.name, due.name]
                        );
                    }
                }

                // Students from an earlier period (expired, or still approved if there was
                // no gap) now need to renew for this semester.
                const [toRenew] = isSamePeriod ? [[]] : await conn.query(
                    `SELECT * FROM students
                     WHERE status IN ('approved', 'expired') AND (registered_period IS NULL OR registered_period <> ?)`,
                    [due.name]
                );
                if (!isSamePeriod) {
                    await conn.query(
                        `UPDATE students SET status = 'pending', status_reason = NULL, qr_code = NULL
                         WHERE status IN ('approved', 'expired') AND (registered_period IS NULL OR registered_period <> ?)`,
                        [due.name]
                    );
                    // Their old approvals belong to an earlier semester now.
                    await conn.query(
                        `UPDATE registration_requests SET approval_status = 'expired' WHERE approval_status = 'approved' AND period <> ?`,
                        [due.name]
                    );
                }

                // A renewal request per student (academic info stays blank until they submit from the app).
                for (const s of toRenew) {
                    const [existing] = await conn.query(
                        `SELECT request_id FROM registration_requests WHERE student_number = ? AND period = ? AND approval_status = 'pending' LIMIT 1`,
                        [s.student_number, due.name]
                    );
                    if (existing.length > 0) continue;
                    await conn.query(
                        `INSERT INTO registration_requests (
                            full_name, surname, first_name, middle_name,
                            email, phone_number, address, sex,
                            student_number, college, program, year_level, period,
                            approval_status, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'pending', NOW())`,
                        [s.full_name, s.surname, s.first_name, s.middle_name,
                         s.email, s.phone_number, s.address, s.sex,
                         s.student_number, due.name]
                    );
                }

                await conn.query(`UPDATE semesters SET status = 'active' WHERE semester_id = ?`, [due.semester_id]);
                await conn.commit();
                console.log(`[semesters] ${due.name} started (${reason}): ${toRenew.length} student(s) can renew`);
            }
        } catch (err) {
            try { await conn.rollback(); } catch { /* nothing to undo */ }
            console.error('[semesters] sync failed:', err.message);
        } finally {
            conn.release();
            syncing = false;
        }
    }

    // Checks the dates the admin typed. Returns an error message, or null if OK.
    async function validateDates(start_date, end_date, ignoreId = 0) {
        if (!DATE_RE.test(start_date || '') || !DATE_RE.test(end_date || '')) return 'Please pick a start date and an end date.';
        if (end_date <= start_date) return 'The end date must be after the start date.';
        if (daysBetween(start_date, end_date) > 200) return 'A semester can be at most 200 days long.';
        const [overlap] = await db.query(
            `SELECT name FROM semesters WHERE semester_id <> ? AND start_date <= ? AND end_date >= ? LIMIT 1`,
            [ignoreId, end_date, start_date]
        );
        if (overlap.length > 0) return `These dates overlap with ${overlap[0].name}.`;
        return null;
    }

    // The semester-end that can still be undone, or null.
    // Allowed only during the break (no semester running), within 7 days, and only the latest one.
    async function findUndoableEnd() {
        const [active] = await db.query(`SELECT semester_id FROM semesters WHERE status = 'active' LIMIT 1`);
        if (active.length > 0) return null;
        const [rows] = await db.query(
            `SELECT t.transition_id, t.affected_count, t.created_at,
                    DATE_FORMAT(DATE_ADD(t.created_at, INTERVAL 7 DAY), '%Y-%m-%d') AS available_until,
                    s.semester_id, s.name, DATE_FORMAT(s.start_date, '%Y-%m-%d') AS start_date,
                    DATE_FORMAT(s.end_date, '%Y-%m-%d') AS end_date
             FROM semester_transitions t JOIN semesters s ON s.semester_id = t.semester_id
             WHERE t.kind = 'end' AND t.undone_at IS NULL AND s.status = 'ended'
               AND t.created_at >= NOW() - INTERVAL 7 DAY
             ORDER BY t.transition_id DESC LIMIT 1`
        );
        if (rows.length === 0) return null;
        // Only the most recent ended semester can be reopened.
        const [latest] = await db.query(`SELECT semester_id FROM semesters WHERE status = 'ended' ORDER BY end_date DESC LIMIT 1`);
        return latest[0]?.semester_id === rows[0].semester_id ? rows[0] : null;
    }

    // GET /api/admin/semesters → every semester + the current one + student counts.
    app.get('/api/admin/semesters', verifyToken, requireSuperAdmin, async (req, res) => {
        try {
            const [semesters] = await db.query(`SELECT ${SEMESTER_COLUMNS} FROM semesters ORDER BY start_date DESC`);
            const [[counts]] = await db.query(
                `SELECT COALESCE(SUM(status = 'approved'), 0) AS approved, COALESCE(SUM(status = 'expired'), 0) AS expired FROM students`
            );
            const [periodRows] = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'current_period'");
            res.json({
                today: todayManila(),
                current_period: periodRows[0]?.setting_value || null,
                active: semesters.find((s) => s.status === 'active') || null,
                next: [...semesters].reverse().find((s) => s.status === 'upcoming') || null,
                approved_count: Number(counts.approved),
                expired_count: Number(counts.expired),
                undo: await findUndoableEnd(),
                semesters,
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // GET /api/semesters → the academic calendar (read-only) for any signed-in admin.
    // Used by the Analytics "Semester" filter, so staff (not only the super admin) see real semester dates.
    app.get('/api/semesters', verifyToken, async (req, res) => {
        try {
            const [semesters] = await db.query(`SELECT ${SEMESTER_COLUMNS} FROM semesters ORDER BY start_date`);
            res.json(semesters);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // POST /api/admin/semesters → adds a semester { term, ay_start, start_date, end_date }.
    app.post('/api/admin/semesters', verifyToken, requireSuperAdmin, async (req, res) => {
        const { term, start_date, end_date } = req.body;
        const ayStart = parseInt(req.body.ay_start, 10);
        if (!TERM_NAMES[term]) return res.status(400).json({ message: 'Please choose 1st Semester, 2nd Semester or Midyear.' });
        if (!ayStart || ayStart < 2000 || ayStart > 2100) return res.status(400).json({ message: 'Please choose the academic year.' });

        try {
            const dateError = await validateDates(start_date, end_date);
            if (dateError) return res.status(400).json({ message: dateError });

            const name = buildName(term, ayStart);
            const [dupe] = await db.query('SELECT semester_id FROM semesters WHERE name = ?', [name]);
            if (dupe.length > 0) return res.status(400).json({ message: `${name} is already on the calendar.` });

            await db.query(
                'INSERT INTO semesters (term, ay_start, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
                [term, ayStart, name, start_date, end_date]
            );
            await syncSemesters('semester added');
            res.status(201).json({ message: `${name} was added to the calendar.` });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // PUT /api/admin/semesters/:id → changes the dates. Ended semesters can't change;
    // the current one can only move its end date.
    app.put('/api/admin/semesters/:id', verifyToken, requireSuperAdmin, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        try {
            const [rows] = await db.query(`SELECT ${SEMESTER_COLUMNS} FROM semesters WHERE semester_id = ?`, [id]);
            if (rows.length === 0) return res.status(404).json({ message: 'Semester not found.' });
            const sem = rows[0];
            if (sem.status === 'ended') return res.status(400).json({ message: 'This semester has already ended.' });

            const start_date = sem.status === 'active' ? sem.start_date : req.body.start_date;
            const end_date = req.body.end_date;
            if (sem.status === 'active' && end_date < todayManila()) {
                return res.status(400).json({ message: "The current semester's end date can't be in the past." });
            }
            const dateError = await validateDates(start_date, end_date, id);
            if (dateError) return res.status(400).json({ message: dateError });

            await db.query('UPDATE semesters SET start_date = ?, end_date = ? WHERE semester_id = ?', [start_date, end_date, id]);
            await syncSemesters('semester edited');
            res.json({ message: `${sem.name} dates were updated.` });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // POST /api/admin/semesters/undo-end { transition_id, end_date } → reopens the semester
    // that just ended (wrong end date): passes come back with the SAME QR codes, and the
    // corrected end date is saved so it doesn't end again tonight.
    app.post('/api/admin/semesters/undo-end', verifyToken, requireSuperAdmin, async (req, res) => {
        const { transition_id, end_date } = req.body;
        const undo = await findUndoableEnd().catch(() => null);
        if (!undo || undo.transition_id !== Number(transition_id)) {
            return res.status(400).json({ message: 'This can no longer be undone (the 7 days passed, or a new semester has started).' });
        }
        if (!DATE_RE.test(end_date || '') || end_date < todayManila()) {
            return res.status(400).json({ message: 'Please pick the correct end date (today or later).' });
        }
        const dateError = await validateDates(undo.start_date, end_date, undo.semester_id);
        if (dateError) return res.status(400).json({ message: dateError });

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            // Put back students who are still "expired" (skip anyone an admin changed since).
            const [restored] = await conn.query(
                `UPDATE students s JOIN semester_transition_students t
                   ON t.student_number = s.student_number AND t.transition_id = ?
                 SET s.status = t.prev_status, s.qr_code = t.prev_qr_code, s.status_reason = t.prev_status_reason
                 WHERE s.status = 'expired'`,
                [undo.transition_id]
            );
            await conn.query(
                `UPDATE registration_requests SET approval_status = 'approved' WHERE approval_status = 'expired' AND period = ?`,
                [undo.name]
            );
            await conn.query(`UPDATE semesters SET status = 'active', end_date = ? WHERE semester_id = ?`, [end_date, undo.semester_id]);
            await conn.query(`UPDATE semester_transitions SET undone_at = NOW() WHERE transition_id = ?`, [undo.transition_id]);
            await conn.commit();
            console.log(`[semesters] Undo: ${undo.name} reopened until ${end_date}, ${restored.affectedRows} pass(es) restored`);
            res.json({ message: `${undo.name} is open again until the new end date. ${restored.affectedRows} pass(es) work again.` });
        } catch (err) {
            try { await conn.rollback(); } catch { /* nothing to undo */ }
            res.status(500).json({ message: err.message });
        } finally {
            conn.release();
        }
    });

    // DELETE /api/admin/semesters/:id → removes a semester that hasn't started yet.
    app.delete('/api/admin/semesters/:id', verifyToken, requireSuperAdmin, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        try {
            const [rows] = await db.query('SELECT name, status FROM semesters WHERE semester_id = ?', [id]);
            if (rows.length === 0) return res.status(404).json({ message: 'Semester not found.' });
            if (rows[0].status !== 'upcoming') return res.status(400).json({ message: "Only semesters that haven't started can be removed." });
            await db.query('DELETE FROM semesters WHERE semester_id = ?', [id]);
            res.json({ message: `${rows[0].name} was removed.` });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Set up the table, catch up on any missed dates, then check every night at 12:01 AM.
    ensureSchema()
        .then(() => syncSemesters('server start'))
        .catch((err) => console.error('[semesters] setup failed:', err.message));
    cron.schedule('1 0 * * *', () => syncSemesters('scheduled 12:01 AM'), { timezone: 'Asia/Manila' });
};
