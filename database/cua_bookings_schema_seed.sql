CREATE DATABASE IF NOT EXISTS cua_bookings
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cua_bookings;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_booking_details;
DROP VIEW IF EXISTS v_mentor_categories;
DROP VIEW IF EXISTS v_courses_with_categories;

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS booking_online_meetings;
DROP TABLE IF EXISTS mentorship_sessions;
DROP TABLE IF EXISTS booking_students;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS mentor_schedule_exceptions;
DROP TABLE IF EXISTS mentor_weekly_availability;
DROP TABLE IF EXISTS mentor_courses;
DROP TABLE IF EXISTS course_professors;
DROP TABLE IF EXISTS course_topics;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS mentors;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS professors;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS admin_profiles;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS course_subjects;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS topics;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  role_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
) ENGINE=InnoDB;

CREATE TABLE app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_by_user_id INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_settings_updated_by
    FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE admin_profiles (
  profile_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  administrative_title VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  office VARCHAR(120) NULL,
  preferred_contact ENUM('Email', 'Phone', 'Microsoft Teams') NOT NULL DEFAULT 'Email',
  last_login_at DATETIME NULL,
  password_status VARCHAR(80) NOT NULL DEFAULT 'Updated recently',
  two_step_verification TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE categories (
  category_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE course_subjects (
  subject_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_code VARCHAR(12) NOT NULL UNIQUE,
  subject_name VARCHAR(100) NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_course_subjects_category
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
) ENGINE=InnoDB;

CREATE TABLE locations (
  location_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location_name VARCHAR(120) NOT NULL UNIQUE,
  location_type ENUM('physical', 'online') NOT NULL DEFAULT 'physical',
  address VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE professors (
  professor_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE courses (
  course_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id INT UNSIGNED NOT NULL,
  course_number VARCHAR(12) NOT NULL,
  course_suffix VARCHAR(8) NOT NULL DEFAULT '',
  course_name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_course_code_parts (subject_id, course_number, course_suffix),
  KEY idx_courses_name (course_name),
  CONSTRAINT fk_courses_subject
    FOREIGN KEY (subject_id) REFERENCES course_subjects(subject_id)
) ENGINE=InnoDB;

CREATE TABLE course_topics (
  topic_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  topic_name VARCHAR(120) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_course_topic (course_id, topic_name),
  CONSTRAINT fk_course_topics_course
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE course_professors (
  course_id INT UNSIGNED NOT NULL,
  professor_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (course_id, professor_id),
  CONSTRAINT fk_course_professors_course
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_course_professors_professor
    FOREIGN KEY (professor_id) REFERENCES professors(professor_id)
) ENGINE=InnoDB;

CREATE TABLE mentors (
  mentor_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_number VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL UNIQUE,
  phone VARCHAR(30) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE mentor_courses (
  mentor_id INT UNSIGNED NOT NULL,
  course_id INT UNSIGNED NOT NULL,
  assigned_by_user_id INT UNSIGNED NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (mentor_id, course_id),
  CONSTRAINT fk_mentor_courses_mentor
    FOREIGN KEY (mentor_id) REFERENCES mentors(mentor_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mentor_courses_course
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mentor_courses_assigned_by
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE mentor_weekly_availability (
  availability_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id INT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  effective_from DATE NULL,
  effective_to DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_availability_mentor_day (mentor_id, day_of_week),
  CONSTRAINT chk_availability_day CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_availability_time CHECK (start_time < end_time),
  CONSTRAINT fk_availability_mentor
    FOREIGN KEY (mentor_id) REFERENCES mentors(mentor_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE mentor_schedule_exceptions (
  exception_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id INT UNSIGNED NOT NULL,
  exception_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  is_full_day TINYINT(1) NOT NULL DEFAULT 0,
  exception_type ENUM('unavailable', 'extra_available') NOT NULL DEFAULT 'unavailable',
  reason VARCHAR(255) NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exception_mentor_date (mentor_id, exception_date),
  CONSTRAINT fk_exceptions_mentor
    FOREIGN KEY (mentor_id) REFERENCES mentors(mentor_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exceptions_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE students (
  student_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_number VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_students_name (full_name),
  KEY idx_students_email (email)
) ENGINE=InnoDB;

CREATE TABLE bookings (
  booking_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_type ENUM('scheduled', 'walk_in') NOT NULL DEFAULT 'scheduled',
  booking_status ENUM('scheduled', 'active', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'scheduled',
  group_size TINYINT UNSIGNED NOT NULL DEFAULT 1,
  mentor_id INT UNSIGNED NOT NULL,
  course_id INT UNSIGNED NOT NULL,
  professor_id INT UNSIGNED NULL,
  location_id INT UNSIGNED NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,
  topics_notes TEXT NULL,
  made_by_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  cancellation_reason VARCHAR(255) NULL,
  KEY idx_bookings_mentor_time (mentor_id, start_at),
  KEY idx_bookings_course (course_id),
  KEY idx_bookings_status (booking_status),
  KEY idx_bookings_start (start_at),
  CONSTRAINT fk_bookings_mentor
    FOREIGN KEY (mentor_id) REFERENCES mentors(mentor_id),
  CONSTRAINT fk_bookings_course
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
  CONSTRAINT fk_bookings_professor
    FOREIGN KEY (professor_id) REFERENCES professors(professor_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_bookings_location
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
  CONSTRAINT fk_bookings_made_by
    FOREIGN KEY (made_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE booking_students (
  booking_student_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  student_order TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_booking_student (booking_id, student_id),
  UNIQUE KEY uq_booking_student_order (booking_id, student_order),
  CONSTRAINT chk_student_order CHECK (student_order > 0),
  CONSTRAINT fk_booking_students_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_booking_students_student
    FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

CREATE TABLE mentorship_sessions (
  session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL UNIQUE,
  session_status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  started_by_user_id INT UNSIGNED NULL,
  ended_by_user_id INT UNSIGNED NULL,
  CONSTRAINT fk_sessions_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sessions_started_by
    FOREIGN KEY (started_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_sessions_ended_by
    FOREIGN KEY (ended_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE booking_online_meetings (
  meeting_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL UNIQUE,
  provider ENUM('teams') NOT NULL DEFAULT 'teams',
  external_event_id VARCHAR(255) NULL,
  join_url VARCHAR(1000) NULL,
  organizer_email VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_payload JSON NULL,
  CONSTRAINT fk_online_meetings_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(64) NOT NULL,
  record_id VARCHAR(64) NOT NULL,
  action_type ENUM('create', 'update', 'delete', 'status_change') NOT NULL,
  changed_by_user_id INT UNSIGNED NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  old_values JSON NULL,
  new_values JSON NULL,
  KEY idx_audit_record (table_name, record_id),
  CONSTRAINT fk_audit_changed_by
    FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE VIEW v_courses_with_categories AS
SELECT
  c.course_id,
  CONCAT(cs.subject_code, c.course_number, c.course_suffix) AS course_code,
  c.course_name,
  c.description,
  c.is_active,
  cs.subject_code,
  cs.subject_name,
  cat.category_id,
  cat.category_name
FROM courses c
JOIN course_subjects cs ON cs.subject_id = c.subject_id
JOIN categories cat ON cat.category_id = cs.category_id;

CREATE VIEW v_mentor_categories AS
SELECT
  m.mentor_id,
  m.mentor_number,
  m.full_name,
  GROUP_CONCAT(DISTINCT cat.category_name ORDER BY cat.category_name SEPARATOR ', ') AS categories
FROM mentors m
LEFT JOIN mentor_courses mc ON mc.mentor_id = m.mentor_id AND mc.is_active = 1
LEFT JOIN courses c ON c.course_id = mc.course_id
LEFT JOIN course_subjects cs ON cs.subject_id = c.subject_id
LEFT JOIN categories cat ON cat.category_id = cs.category_id
GROUP BY m.mentor_id, m.mentor_number, m.full_name;

CREATE VIEW v_booking_details AS
SELECT
  b.booking_id,
  b.booking_type,
  b.booking_status,
  b.start_at,
  b.end_at,
  m.mentor_number,
  m.full_name AS mentor_name,
  vc.course_code,
  vc.course_name,
  vc.category_name,
  p.full_name AS professor_name,
  l.location_name,
  l.location_type,
  b.topics_notes,
  u.full_name AS made_by,
  GREATEST(b.group_size, COUNT(bs.student_id)) AS student_count,
  CASE WHEN GREATEST(b.group_size, COUNT(bs.student_id)) > 1 THEN 'Grouped' ELSE 'Single' END AS session_type,
  GROUP_CONCAT(s.student_number ORDER BY bs.student_order SEPARATOR ', ') AS student_numbers,
  GROUP_CONCAT(s.full_name ORDER BY bs.student_order SEPARATOR ', ') AS student_names
FROM bookings b
JOIN mentors m ON m.mentor_id = b.mentor_id
JOIN v_courses_with_categories vc ON vc.course_id = b.course_id
LEFT JOIN professors p ON p.professor_id = b.professor_id
JOIN locations l ON l.location_id = b.location_id
JOIN users u ON u.user_id = b.made_by_user_id
LEFT JOIN booking_students bs ON bs.booking_id = b.booking_id
LEFT JOIN students s ON s.student_id = bs.student_id
GROUP BY
  b.booking_id,
  b.booking_type,
  b.booking_status,
  b.group_size,
  b.start_at,
  b.end_at,
  m.mentor_number,
  m.full_name,
  vc.course_code,
  vc.course_name,
  vc.category_name,
  p.full_name,
  l.location_name,
  l.location_type,
  b.topics_notes,
  u.full_name;

INSERT INTO roles (role_name, description) VALUES
('Administrator', 'Can manage bookings, mentors, courses, schedules, and reference data.'),
('Limited', 'Can create bookings and manage daily booking activity.');

INSERT INTO users (role_id, full_name, email, password_hash) VALUES
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Edgardo Perez', 'eperez@aguadilla.inter.edu', '$2y$10$PKHhX3y9FmZErgwUz4iDuu7rMPtmY/G3Z3mXp/VudJ/eDzakDhIm6'),
((SELECT role_id FROM roles WHERE role_name = 'Limited'), 'CUA Staff', 'staffcua@aguadilla.inter.edu', '$2y$10$IYbLnp7vYkNvLECjxI/RROe.ZFP1TUrKgZNY8c2LSgbqrt7eXtIqS'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'CUA Coordinator', 'tutoriacua@aguadilla.inter.edu', '$2y$10$LWtNG9M2evHIcroPky74IuJTgtHVI7Wa/1wLViMcYZNeFGNXYRNp6'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Nicole Roman', 'nmroman@aguadilla.inter.edu', '$2y$10$6aUQESPjlaEaWwfU3wEFDODRHEWdakmTS36HSHU/AKzlRRiHzrrdC'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Maribel Gonzalez', 'magonzal@aguadilla.inter.edu', '$2y$10$sFD0imWzIN24onpSZIJeKu4HlGyalhzvMKYERs8ch/5AJKa1KLBse'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Brenda Rios', 'blrios@aguadilla.inter.edu', '$2y$10$oqqLeIycvdTJaXEZNgDGrO67nskxHlSl7q62NDrY9u4w61Y1tj3sW');

INSERT INTO app_settings (setting_key, setting_value, updated_by_user_id) VALUES
('teams_meeting_link', 'https://teams.microsoft.com/meet/270017024739113?p=goEFdCJi6Fcmy1jYNA', NULL);

INSERT INTO admin_profiles (
  user_id,
  administrative_title,
  phone,
  office,
  preferred_contact,
  last_login_at,
  password_status,
  two_step_verification
) VALUES
(
  (SELECT user_id FROM users WHERE email = 'eperez@aguadilla.inter.edu'),
  'CS Specialist',
  '787-891-0927',
  'PC & Mac Lab',
  'Email',
  '2026-06-01 08:07:56',
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'tutoriacua@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  '2026-05-27 08:58:14',
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'staffcua@aguadilla.inter.edu'),
  'CUA Staff',
  NULL,
  NULL,
  'Email',
  '2026-05-28 10:28:37',
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'nmroman@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  '2026-05-28 10:27:55',
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'magonzal@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  '2026-05-27 08:58:14',
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'blrios@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  '2026-05-27 08:58:14',
  'Updated recently',
  1
);

INSERT INTO categories (category_name) VALUES
('Mathematics'),
('Science'),
('Spanish'),
('English'),
('Statistics'),
('Accounting'),
('Finance'),
('Microeconomics'),
('Quantitative Methods'),
('Technology'),
('Other');

INSERT INTO course_subjects (subject_code, subject_name, category_id) VALUES
('GEMA', 'GEMA', (SELECT category_id FROM categories WHERE category_name = 'Mathematics')),
('PHYS', 'PHYS', (SELECT category_id FROM categories WHERE category_name = 'Science'));

INSERT INTO locations (location_name, location_type, address) VALUES
('CUA (Library 2nd Floor)', 'physical', 'Library 2nd Floor'),
('Online (Microsoft Teams)', 'online', NULL);

INSERT INTO professors (full_name, email) VALUES
('Israel Mendez', NULL),
('Braulio Cortes', NULL),
('Rosana Ortiz', NULL);

INSERT INTO courses (subject_id, course_number, course_name, description) VALUES
((SELECT subject_id FROM course_subjects WHERE subject_code = 'GEMA'), '1000', 'Quantitative Reasoning', 'Study of the set of real numbers, measuring systems, geometry (length, area and volume), equation solving for linear variables that include ratios, proportions, mathematical financial formulas and literal equations. Basic concepts of statistics: frequency distribution, graphs, measures of central tendency, dispersion and probability principles. Requires additional hours of virtual open laboratory.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'GEMA'), '1200', 'Fundamentals of Algebra', 'Application of algebra to problem solving, including graphic and symbolic representations. Study of algebraic expressions with whole and rational exponents; and of polynomials, operations, and factoring. Solution of first and second degrees equations, of equations with rational and radical expressions, and of linear inequations. Requires additional hours of virtual open laboratory.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'PHYS'), '3001', 'General Physics I', 'Logical and unified presentation of physics at the introductory level, emphasizing the basic ideas constituting its foundations: laws of motion and the conservation and interaction between particles and fields. Students are exposed to different experiences in the fields of mechanics and heat in the teaching-learning process. Emphasis on the integration and application of concepts throughout the experimentation. Requires 45 hours of lecture and 45 hours of lab.');

INSERT INTO course_topics (course_id, topic_name, sort_order)
SELECT c.course_id, x.topic_name, x.sort_order
FROM v_courses_with_categories c
JOIN (
  SELECT 'GEMA1000' AS course_code, 'Geometry' AS topic_name, 1 AS sort_order UNION ALL
  SELECT 'GEMA1000', 'Frequency distribution', 2 UNION ALL
  SELECT 'GEMA1200', 'Algebraic expressions', 1 UNION ALL
  SELECT 'GEMA1200', 'Linear inequations', 2 UNION ALL
  SELECT 'PHYS3001', 'Vectors', 1 UNION ALL
  SELECT 'PHYS3001', 'Laws of motion', 2
) x ON x.course_code = c.course_code;

INSERT INTO course_professors (course_id, professor_id)
SELECT c.course_id, p.professor_id
FROM v_courses_with_categories c
JOIN professors p ON (
  (c.course_code IN ('GEMA1000', 'GEMA1200') AND p.full_name IN ('Israel Mendez', 'Braulio Cortes'))
  OR (c.course_code = 'PHYS3001' AND p.full_name = 'Rosana Ortiz')
);

INSERT INTO mentors (mentor_number, full_name, email, phone) VALUES
('A00631877', 'Clarian Perez', 'clpe1877@agu.inter.edu', NULL),
('A00635439', 'Gynelis Lamberty', 'gyla5439@agu.inter.edu', NULL);

INSERT INTO mentor_courses (mentor_id, course_id, assigned_by_user_id)
SELECT m.mentor_id, c.course_id, u.user_id
FROM mentors m
JOIN v_courses_with_categories c ON (
  (m.mentor_number = 'A00631877' AND c.course_code IN ('GEMA1000', 'GEMA1200', 'PHYS3001'))
  OR (m.mentor_number = 'A00635439' AND c.course_code IN ('GEMA1000', 'GEMA1200'))
)
JOIN users u ON u.email = 'eperez@aguadilla.inter.edu';

INSERT INTO mentor_weekly_availability (mentor_id, day_of_week, start_time, end_time, effective_from, effective_to)
SELECT mentor_id, 1, '13:00:00', '17:00:00', '2026-06-01', '2026-06-30' FROM mentors WHERE mentor_number = 'A00631877'
UNION ALL SELECT mentor_id, 2, '13:00:00', '17:00:00', '2026-06-01', '2026-06-30' FROM mentors WHERE mentor_number = 'A00631877'
UNION ALL SELECT mentor_id, 3, '13:00:00', '17:00:00', '2026-06-01', '2026-06-30' FROM mentors WHERE mentor_number = 'A00631877'
UNION ALL SELECT mentor_id, 4, '13:00:00', '17:00:00', '2026-06-01', '2026-06-30' FROM mentors WHERE mentor_number = 'A00631877'
UNION ALL SELECT mentor_id, 5, '13:00:00', '17:00:00', '2026-06-01', '2026-06-30' FROM mentors WHERE mentor_number = 'A00631877'
UNION ALL SELECT mentor_id, 1, '08:00:00', '12:00:00', '2026-05-28', NULL FROM mentors WHERE mentor_number = 'A00635439'
UNION ALL SELECT mentor_id, 2, '08:00:00', '12:00:00', '2026-05-28', NULL FROM mentors WHERE mentor_number = 'A00635439'
UNION ALL SELECT mentor_id, 3, '08:00:00', '12:00:00', '2026-05-28', NULL FROM mentors WHERE mentor_number = 'A00635439'
UNION ALL SELECT mentor_id, 4, '08:00:00', '12:00:00', '2026-05-28', NULL FROM mentors WHERE mentor_number = 'A00635439'
UNION ALL SELECT mentor_id, 5, '08:00:00', '12:00:00', '2026-05-28', NULL FROM mentors WHERE mentor_number = 'A00635439';
