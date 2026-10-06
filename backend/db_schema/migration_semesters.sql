-- Academic calendar (semesters with start/end dates).
-- You don't have to run this by hand: backend/semesters.js creates the table and
-- adds the 'expired' status automatically when the server starts.
-- It's here so the database schema is documented in one place.

CREATE TABLE IF NOT EXISTS semesters (
  semester_id INT AUTO_INCREMENT PRIMARY KEY,
  term ENUM('1st','2nd','Midyear') NOT NULL,
  ay_start SMALLINT NOT NULL,                 -- 2026 = A.Y. 2026-2027
  name VARCHAR(100) NOT NULL,                 -- e.g. "2nd Semester A.Y. 2026-2027"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('upcoming','active','ended') NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_semester_name (name)
);

-- 'expired' = the semester ended; the student renews when the next one starts.
ALTER TABLE students
  MODIFY status ENUM('pending','approved','rejected','deactivated','expired') DEFAULT 'pending';
ALTER TABLE registration_requests
  MODIFY approval_status ENUM('pending','approved','rejected','deactivated','expired') DEFAULT 'pending';

-- Undo support: a snapshot of every student whose pass expired when a semester
-- ended, so a wrong end date can be undone during the break (within 7 days).
CREATE TABLE IF NOT EXISTS semester_transitions (
  transition_id INT AUTO_INCREMENT PRIMARY KEY,
  semester_id INT NOT NULL,
  kind ENUM('end') NOT NULL DEFAULT 'end',
  affected_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  undone_at TIMESTAMP NULL DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS semester_transition_students (
  transition_id INT NOT NULL,
  student_number VARCHAR(20) NOT NULL,
  prev_status VARCHAR(20) NOT NULL,
  prev_qr_code TEXT NULL,
  prev_status_reason VARCHAR(500) NULL,
  PRIMARY KEY (transition_id, student_number)
);
