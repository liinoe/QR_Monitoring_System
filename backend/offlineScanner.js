// OFFLINE MODE FOR THE ENTRANCE SCANNER
//
// When the internet (or this server) is down, the scanner page keeps working on
// its own and saves the scans on the library PC. This file has the two routes
// it needs:
//
//   GET  /api/scanner/offline-pack  → what the PC saves while online (every 5 minutes):
//        approved students (QR codes only as SHA-256 hashes), who is inside now,
//        and who was already auto-logged-out today.
//   POST /api/scanner/sync          → the scans made while offline, sent when the
//        connection is back. Saved with their REAL scan time, oldest first.
//
// Both need the secret scanner key (SCANNER_KEY in Render / .env), sent by the
// scanner PC in the "x-scanner-key" header, so nobody else can download the list
// or send fake scans.
//
// Each offline scan has a random offline_scan_id. It's stored in offline_scans,
// so if the PC sends the same scan twice (e.g. the connection dropped mid-sync),
// the second copy is skipped — nothing is ever recorded twice.
//
// Use in index.js:   require('./offlineScanner')(app, { db });

const crypto = require('crypto');

const ENTRY_CUTOFF = '17:30:00';   // no new entries from 5:30 PM (same as online)
const CLOSING_TIME = '17:31:00';   // auto logout time (same as online)
const MAX_SCANS_PER_SYNC = 2000;

module.exports = function registerOfflineScannerRoutes(app, { db }) {
    // Creates the offline_scans table if it doesn't exist yet.
    db.query(`
        CREATE TABLE IF NOT EXISTS offline_scans (
            offline_scan_id CHAR(36) NOT NULL PRIMARY KEY,
            user_id INT NULL,
            scanned_at DATETIME NOT NULL,
            result VARCHAR(20) NOT NULL,
            synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`).catch((err) => console.error('offline_scans table error:', err.message));

    // Only the library's scanner PC (which has the secret key) may use these routes.
    const requireScannerKey = (req, res, next) => {
        const key = process.env.SCANNER_KEY;
        if (!key) return res.status(503).json({ message: 'Offline mode is not set up (SCANNER_KEY is missing).' });
        const sent = String(req.headers['x-scanner-key'] || '');
        const ok = sent.length === key.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(key));
        if (!ok) return res.status(401).json({ message: 'Invalid scanner key.' });
        next();
    };

    // ---------- 1) The offline pack ----------
    app.get('/api/scanner/offline-pack', requireScannerKey, async (req, res) => {
        try {
            // Approved students: [hash of QR, student number, program, college].
            // SHA2() makes the hash in MySQL, so real QR codes never leave the server.
            const [students] = await db.query(
                `SELECT SHA2(qr_code, 256) AS h, student_number, program, college
                 FROM students WHERE status = 'approved' AND qr_code IS NOT NULL`
            );
            // Who is inside right now (hashes).
            const [inside] = await db.query(
                `SELECT SHA2(s.qr_code, 256) AS h FROM student_logs sl JOIN students s ON s.user_id = sl.user_id
                 WHERE sl.status = 'inside' AND s.qr_code IS NOT NULL`
            );
            // Who the system already logged out today (5:31 PM / Force Exit) → "Already logged out".
            const [forced] = await db.query(
                `SELECT SHA2(s.qr_code, 256) AS h, DATE_FORMAT(MAX(sl.time_out), '%l:%i %p') AS t
                 FROM student_logs sl JOIN students s ON s.user_id = sl.user_id
                 WHERE sl.visit_date = CURDATE() AND sl.forced_exit = 1 AND s.qr_code IS NOT NULL
                 GROUP BY s.user_id`
            );
            const [[{ guests }]] = await db.query('SELECT COUNT(*) AS guests FROM guest_logs WHERE status = "inside"');

            res.json({
                server_time: new Date().toISOString(), // lets the PC check its own clock
                students: students.map((s) => [s.h, s.student_number, s.program, s.college]),
                inside: inside.map((r) => r.h),
                forced_today: Object.fromEntries(forced.map((r) => [r.h, (r.t || '').trim()])),
                guests_inside: Number(guests),
            });
        } catch (err) {
            console.error('Offline pack error:', err.message);
            res.status(500).json({ message: 'Could not build the offline pack.' });
        }
    });

    // ---------- 2) Syncing the offline scans ----------
    // The server decides entry/exit again from its own records (the PC's guess is
    // only for the screen), processing the scans in the order they happened.
    app.post('/api/scanner/sync', requireScannerKey, async (req, res) => {
        const scans = Array.isArray(req.body.scans) ? req.body.scans.slice(0, MAX_SCANS_PER_SYNC) : [];
        const now = Date.now();

        // Oldest first, so entry → exit pairs are applied in the right order.
        const ordered = scans
            .map((s) => ({ ...s, time: new Date(s.scanned_at) }))
            .filter((s) => typeof s.offline_scan_id === 'string' && s.offline_scan_id.length <= 36 && typeof s.qr_hash === 'string' && !isNaN(s.time))
            .sort((a, b) => a.time - b.time);

        const results = [];
        for (const scan of ordered) {
            // A scan "from the future" (wrong PC clock) is treated as happening now.
            const scannedAt = scan.time.getTime() > now + 5 * 60 * 1000 ? new Date(now) : scan.time;
            try {
                const [[student]] = await db.query(
                    'SELECT user_id FROM students WHERE SHA2(qr_code, 256) = ? AND qr_code IS NOT NULL LIMIT 1',
                    [scan.qr_hash]
                );

                // Remember this scan ID first; if it's already there, it was synced before.
                const [ins] = await db.query(
                    'INSERT IGNORE INTO offline_scans (offline_scan_id, user_id, scanned_at, result) VALUES (?, ?, ?, "pending")',
                    [scan.offline_scan_id, student ? student.user_id : null, scannedAt]
                );
                if (ins.affectedRows === 0) {
                    results.push({ offline_scan_id: scan.offline_scan_id, result: 'duplicate' });
                    continue;
                }

                let result;
                if (!student) {
                    result = 'unknown_qr'; // QR changed since the pack (e.g. deactivated) — not recorded
                } else {
                    const [open] = await db.query(
                        'SELECT log_id, time_in FROM student_logs WHERE user_id = ? AND status = "inside" ORDER BY time_in DESC LIMIT 1',
                        [student.user_id]
                    );
                    if (open.length > 0 && new Date(open[0].time_in) <= scannedAt) {
                        // Inside → this scan was the exit.
                        await db.query('UPDATE student_logs SET time_out = ?, status = "exited" WHERE log_id = ?', [scannedAt, open[0].log_id]);
                        result = 'exit';
                    } else {
                        // Not inside → entry, unless it was after the 5:30 PM cut-off that day,
                        // or they already have a visit covering that moment (e.g. auto-logged-out).
                        const [[{ afterCutoff }]] = await db.query('SELECT TIME(?) >= ? AS afterCutoff', [scannedAt, ENTRY_CUTOFF]);
                        const [[{ covered }]] = await db.query(
                            'SELECT COUNT(*) AS covered FROM student_logs WHERE user_id = ? AND time_in <= ? AND time_out >= ?',
                            [student.user_id, scannedAt, scannedAt]
                        );
                        if (afterCutoff) {
                            result = 'skipped_closed';
                        } else if (covered > 0) {
                            result = 'skipped_already_out';
                        } else {
                            await db.query(
                                'INSERT INTO student_logs (user_id, time_in, visit_date, status) VALUES (?, ?, DATE(?), "inside")',
                                [student.user_id, scannedAt, scannedAt]
                            );
                            result = 'entry';
                        }
                    }
                }
                await db.query('UPDATE offline_scans SET result = ? WHERE offline_scan_id = ?', [result, scan.offline_scan_id]);
                results.push({ offline_scan_id: scan.offline_scan_id, result });
            } catch (err) {
                console.error('Offline sync error for', scan.offline_scan_id, err.message);
                // Not saved → let the PC try this one again next time.
                await db.query('DELETE FROM offline_scans WHERE offline_scan_id = ? AND result = "pending"', [scan.offline_scan_id]).catch(() => {});
                results.push({ offline_scan_id: scan.offline_scan_id, result: 'error' });
            }
        }

        // Offline entries from a day that's already past closing time are closed
        // like the 5:31 PM auto logout would have (flagged as forced exits).
        try {
            await db.query(
                `UPDATE student_logs
                 SET time_out = GREATEST(time_in, TIMESTAMP(visit_date, ?)), status = "exited", forced_exit = 1
                 WHERE status = "inside" AND NOW() >= TIMESTAMP(visit_date, ?)`,
                [CLOSING_TIME, CLOSING_TIME]
            );
        } catch (err) {
            console.error('Offline sync close-out error:', err.message);
        }

        const saved = results.filter((r) => r.result === 'entry' || r.result === 'exit').length;
        console.log(`[Offline sync] ${results.length} scan(s) received, ${saved} saved.`);
        res.json({ results });
    });
};
