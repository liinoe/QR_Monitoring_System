
DROP SCHEMA IF EXISTS `qr_library` ;
CREATE SCHEMA IF NOT EXISTS `qr_library`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci ;
USE `qr_library` ;

-- ---------------------------------------------------------------------
-- Table: colleges
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `colleges` (
  `college_id`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(20)  NOT NULL,
  `name`         VARCHAR(150) NOT NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`college_id`),
  UNIQUE KEY `uq_colleges_code` (`code`),
  UNIQUE KEY `uq_colleges_name` (`name`)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table: programs   (e.g. BS Information Technology, BS Agriculture)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `programs` (
  `program_id`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `college_id`   INT UNSIGNED NOT NULL,
  `code`         VARCHAR(20)  NOT NULL,
  `name`         VARCHAR(150) NOT NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`program_id`),
  UNIQUE KEY `uq_programs_code` (`code`),
  INDEX `idx_programs_college` (`college_id`),
  CONSTRAINT `fk_programs_college`
    FOREIGN KEY (`college_id`) REFERENCES `colleges` (`college_id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table: users   (admins / librarians / staff who can log in)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `user_id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`       VARCHAR(50)  NOT NULL,
  `email`          VARCHAR(150) NOT NULL,
  `password_hash`  VARCHAR(255) NOT NULL,
  `full_name`      VARCHAR(150) NOT NULL,
  `role`           ENUM('admin','librarian','staff') NOT NULL DEFAULT 'librarian',
  `is_active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `last_login_at`  DATETIME     NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table: students   (registered library users with QR codes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `students` (
  `student_id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_no`     VARCHAR(30)  NOT NULL,           -- school-issued ID
  `qr_code`        VARCHAR(100) NOT NULL,           -- payload encoded in QR
  `first_name`     VARCHAR(80)  NOT NULL,
  `middle_name`    VARCHAR(80)  NULL,
  `last_name`      VARCHAR(80)  NOT NULL,
  `gender`         ENUM('male','female','other') NULL,
  `birthdate`      DATE         NULL,
  `email`          VARCHAR(150) NULL,
  `contact_no`     VARCHAR(30)  NULL,
  `address`        VARCHAR(255) NULL,
  `college_id`     INT UNSIGNED NOT NULL,
  `program_id`     INT UNSIGNED NOT NULL,
  `year_level`     TINYINT UNSIGNED NOT NULL,
  `section`        VARCHAR(20)  NULL,
  `photo_url`      VARCHAR(255) NULL,
  `status`         ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  `registered_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `uq_students_student_no` (`student_no`),
  UNIQUE KEY `uq_students_qr_code`    (`qr_code`),
  INDEX `idx_students_college` (`college_id`),
  INDEX `idx_students_program` (`program_id`),
  INDEX `idx_students_lastname` (`last_name`),
  CONSTRAINT `fk_students_college`
    FOREIGN KEY (`college_id`) REFERENCES `colleges` (`college_id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_students_program`
    FOREIGN KEY (`program_id`) REFERENCES `programs` (`program_id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table: visit_logs   (every QR scan = one row; time_out filled on exit)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `visit_logs` (
  `visit_id`     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`   INT UNSIGNED NOT NULL,
  `time_in`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `time_out`     DATETIME     NULL,
  `purpose`      ENUM('study','research','borrow','return','internet','other')
                              NOT NULL DEFAULT 'study',
  `remarks`      VARCHAR(255) NULL,
  `scanned_by`   INT UNSIGNED NULL,         -- staff who handled the scan
  PRIMARY KEY (`visit_id`),
  INDEX `idx_visits_student` (`student_id`),
  INDEX `idx_visits_time_in` (`time_in`),
  INDEX `idx_visits_open`    (`student_id`, `time_out`),
  CONSTRAINT `fk_visits_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_visits_user`
    FOREIGN KEY (`scanned_by`) REFERENCES `users` (`user_id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table: books   (library catalog)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `books` (
  `book_id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `accession_no`    VARCHAR(30)  NOT NULL,
  `isbn`            VARCHAR(20)  NULL,
  `title`           VARCHAR(255) NOT NULL,
  `author`          VARCHAR(255) NULL,
  `publisher`       VARCHAR(150) NULL,
  `year_published`  YEAR         NULL,
  `category`        VARCHAR(80)  NULL,
  `total_copies`    INT UNSIGNED NOT NULL DEFAULT 1,
  `available_copies` INT UNSIGNED NOT NULL DEFAULT 1,
  `shelf_location`  VARCHAR(50)  NULL,
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`book_id`),
  UNIQUE KEY `uq_books_accession` (`accession_no`),
  INDEX `idx_books_title`  (`title`),
  INDEX `idx_books_author` (`author`)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table: borrow_transactions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `borrow_transactions` (
  `transaction_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`     INT UNSIGNED NOT NULL,
  `book_id`        INT UNSIGNED NOT NULL,
  `borrowed_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_at`         DATETIME    NOT NULL,
  `returned_at`    DATETIME    NULL,
  `status`         ENUM('borrowed','returned','overdue','lost') NOT NULL DEFAULT 'borrowed',
  `fine_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `issued_by`      INT UNSIGNED NULL,
  `received_by`    INT UNSIGNED NULL,
  PRIMARY KEY (`transaction_id`),
  INDEX `idx_borrow_student` (`student_id`),
  INDEX `idx_borrow_book`    (`book_id`),
  INDEX `idx_borrow_status`  (`status`),
  CONSTRAINT `fk_borrow_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_borrow_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`book_id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_borrow_issuer`
    FOREIGN KEY (`issued_by`) REFERENCES `users` (`user_id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_borrow_receiver`
    FOREIGN KEY (`received_by`) REFERENCES `users` (`user_id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table: activity_logs   (audit trail for admin actions)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `log_id`      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NULL,
  `action`      VARCHAR(100) NOT NULL,
  `entity`      VARCHAR(50)  NULL,
  `entity_id`   VARCHAR(50)  NULL,
  `description` VARCHAR(255) NULL,
  `ip_address`  VARCHAR(45)  NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  INDEX `idx_activity_user` (`user_id`),
  INDEX `idx_activity_date` (`created_at`),
  CONSTRAINT `fk_activity_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

-- =====================================================================
-- Seed data
-- =====================================================================
INSERT INTO `colleges` (`code`,`name`) VALUES
  ('CICT','College of Information and Communications Technology'),
  ('COE', 'College of Engineering'),
  ('CAG', 'College of Agriculture');

INSERT INTO `programs` (`college_id`,`code`,`name`) VALUES
  (1,'BSIT','BS Information Technology'),
  (1,'BSCS','BS Computer Science'),
  (2,'BSCpE','BS Computer Engineering'),
  (2,'BSCE','BS Civil Engineering'),
  (2,'BSIE','BS Industrial Engineering'),
  (2,'BSEE','BS Electrical Engineering'),
  (3,'BSA', 'BS Agriculture');

-- =====================================================================
-- Helpful views
-- =====================================================================
CREATE OR REPLACE VIEW `vw_current_occupancy` AS
SELECT COUNT(*) AS inside_count
FROM `visit_logs`
WHERE `time_out` IS NULL;

CREATE OR REPLACE VIEW `vw_daily_visits` AS
SELECT DATE(`time_in`) AS visit_date, COUNT(*) AS total_visits
FROM `visit_logs`
GROUP BY DATE(`time_in`);
