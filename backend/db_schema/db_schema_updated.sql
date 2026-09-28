-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: librapass_db
-- ------------------------------------------------------
-- Server version	8.0.45

--
-- Table structure for table `admin_login_requests`
--

DROP TABLE IF EXISTS `admin_login_requests`;

CREATE TABLE `admin_login_requests` (
  `request_id` char(36) NOT NULL,
  `admin_id` int NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `status` enum('pending','approved','denied','cancelled','expired','completed') NOT NULL DEFAULT 'pending',
  `decided_by_session` char(36) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `decided_at` datetime DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `idx_login_requests_admin` (`admin_id`,`status`),
  CONSTRAINT `admin_login_requests_admin_fk` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `admin_sessions`
--

DROP TABLE IF EXISTS `admin_sessions`;

CREATE TABLE `admin_sessions` (
  `session_id` char(36) NOT NULL,
  `admin_id` int NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  KEY `idx_admin_sessions_admin` (`admin_id`,`last_seen_at`),
  CONSTRAINT `admin_sessions_admin_fk` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;

CREATE TABLE `admins` (
  `admin_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `session_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `guest_logs`
--

DROP TABLE IF EXISTS `guest_logs`;

CREATE TABLE `guest_logs` (
  `guest_log_id` int NOT NULL AUTO_INCREMENT,
  `guest_id` int NOT NULL,
  `time_in` datetime DEFAULT NULL,
  `time_out` datetime DEFAULT NULL,
  `visit_date` date DEFAULT NULL,
  `status` enum('inside','exited') DEFAULT 'inside',
  `forced_exit` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`guest_log_id`),
  KEY `guest_id` (`guest_id`),
  CONSTRAINT `guest_logs_ibfk_1` FOREIGN KEY (`guest_id`) REFERENCES `guests` (`guest_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `guests`
--

DROP TABLE IF EXISTS `guests`;

CREATE TABLE `guests` (
  `guest_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) NOT NULL,
  `guest_type` varchar(20) NOT NULL DEFAULT 'other',
  `affiliation` varchar(150) DEFAULT NULL,
  `purpose` varchar(255) DEFAULT NULL,
  `other_purpose` varchar(255) DEFAULT NULL,
  `contact` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`guest_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;

CREATE TABLE `password_reset_tokens` (
  `token_id` int NOT NULL AUTO_INCREMENT,
  `student_number` varchar(50) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token_id`),
  KEY `student_number` (`student_number`),
  KEY `idx_password_reset_token_hash` (`token_hash`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`student_number`) REFERENCES `students` (`student_number`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `registration_requests`
--

DROP TABLE IF EXISTS `registration_requests`;

CREATE TABLE `registration_requests` (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) NOT NULL,
  `surname` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `student_number` varchar(50) DEFAULT NULL,
  `college` varchar(100) DEFAULT NULL,
  `program` varchar(100) DEFAULT NULL,
  `year_level` varchar(20) DEFAULT NULL,
  `period` varchar(50) DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected','deactivated') DEFAULT 'pending',
  `reason` varchar(500) DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `address` varchar(255) DEFAULT NULL,
  `sex` enum('male','female','prefer_not_to_say') DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `registration_requests_ibfk_1` FOREIGN KEY (`approved_by`) REFERENCES `admins` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;

CREATE TABLE `settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `student_edit_logs`
--

DROP TABLE IF EXISTS `student_edit_logs`;

CREATE TABLE `student_edit_logs` (
  `edit_id` int NOT NULL AUTO_INCREMENT,
  `student_number` varchar(50) NOT NULL,
  `admin_id` int NOT NULL,
  `changes` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`edit_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `student_edit_logs_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `student_logs`
--

DROP TABLE IF EXISTS `student_logs`;

CREATE TABLE `student_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `qr_code` varchar(255) DEFAULT NULL,
  `time_in` datetime DEFAULT NULL,
  `time_out` datetime DEFAULT NULL,
  `visit_date` date DEFAULT NULL,
  `status` enum('inside','exited') DEFAULT 'inside',
  `forced_exit` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`log_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `student_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `students` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;

CREATE TABLE `students` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) NOT NULL,
  `surname` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `sex` enum('male','female','prefer_not_to_say') DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `student_number` varchar(50) NOT NULL,
  `college` varchar(100) NOT NULL,
  `program` varchar(100) NOT NULL,
  `year_level` varchar(20) NOT NULL,
  `qr_code` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected','deactivated') DEFAULT 'pending',
  `status_reason` varchar(500) DEFAULT NULL,
  `registered_period` varchar(50) DEFAULT NULL,
  `valid_until` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `student_number` (`student_number`),
  UNIQUE KEY `qr_code` (`qr_code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dump completed on 2026-09-28 22:07:02
