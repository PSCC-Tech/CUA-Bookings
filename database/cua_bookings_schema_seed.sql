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
  COUNT(bs.student_id) AS student_count,
  CASE WHEN COUNT(bs.student_id) > 1 THEN 'Grouped' ELSE 'Single' END AS session_type,
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
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Edgardo Perez', 'eperez@aguadilla.inter.edu', '$2y$10$0Ccszeo2sEnuKz7ZI1IsmOJ10fGo4shGx007syj8ayR2iFfhCokme'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Nicole Roman', 'nmroman@aguadilla.inter.edu', '$2y$10$kZqsq96Rb82QalmVcMSoRuO.D98Lmp4DGcR/erHy.5x3CzPdJkBlW'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Maribel Gonzalez', 'magonzal@aguadilla.inter.edu', '$2y$10$/Kfi9FdOR3hbYTlDsJekxuiVQIEGjisD7ZHAaX6R/6u5WwOHchY4O'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'Brenda Rios', 'blrios@aguadilla.inter.edu', '$2y$10$0k05oS4g6s82ztTpDttia.1Uul8ZNwOXFYLSTxUn2wNe4r4RNzh06'),
((SELECT role_id FROM roles WHERE role_name = 'Administrator'), 'CUA Coordinator', 'tutoriacua@aguadilla.inter.edu', '$2y$10$HalIL5nwYTCyEdvriyLQ8One/4yB0Rk4cp6DkKn0jVkhRWLI1NB3a'),
((SELECT role_id FROM roles WHERE role_name = 'Limited'), 'CUA Staff', 'staffcua@aguadilla.inter.edu', '$2y$10$R3hOHkgY1C1Ox4vPoOpMOuZ4NRgYnlHF.ePwLfVHuyBdCSFoIBzZO');

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
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  '2026-05-11 09:18:00',
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'nmroman@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  NULL,
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'magonzal@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  NULL,
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'blrios@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  NULL,
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'tutoriacua@aguadilla.inter.edu'),
  'CUA Program Coordinator',
  NULL,
  NULL,
  'Email',
  NULL,
  'Updated recently',
  1
),
(
  (SELECT user_id FROM users WHERE email = 'staffcua@aguadilla.inter.edu'),
  'CUA Staff',
  NULL,
  NULL,
  'Email',
  NULL,
  'Updated recently',
  1
);

INSERT INTO categories (category_name) VALUES
('Mathematics'),
('Sciences'),
('Spanish'),
('English'),
('Stadistics'),
('Accounting'),
('Finances'),
('Microeconomics'),
('Quantitative Methods'),
('Technology'),
('Others');

INSERT INTO course_subjects (subject_code, subject_name, category_id) VALUES
('MATH', 'Mathematics', (SELECT category_id FROM categories WHERE category_name = 'Mathematics')),
('BIOL', 'Biology', (SELECT category_id FROM categories WHERE category_name = 'Sciences')),
('BIO', 'Biology', (SELECT category_id FROM categories WHERE category_name = 'Sciences')),
('CHEM', 'Chemistry', (SELECT category_id FROM categories WHERE category_name = 'Sciences')),
('SPAN', 'Spanish', (SELECT category_id FROM categories WHERE category_name = 'Spanish')),
('ESPA', 'Spanish', (SELECT category_id FROM categories WHERE category_name = 'Spanish')),
('ENGL', 'English', (SELECT category_id FROM categories WHERE category_name = 'English')),
('STAT', 'Stadistics', (SELECT category_id FROM categories WHERE category_name = 'Stadistics')),
('STAD', 'Stadistics', (SELECT category_id FROM categories WHERE category_name = 'Stadistics')),
('ACCT', 'Accounting', (SELECT category_id FROM categories WHERE category_name = 'Accounting')),
('ACC', 'Accounting', (SELECT category_id FROM categories WHERE category_name = 'Accounting')),
('FIN', 'Finances', (SELECT category_id FROM categories WHERE category_name = 'Finances')),
('FINA', 'Finances', (SELECT category_id FROM categories WHERE category_name = 'Finances')),
('ECON', 'Microeconomics', (SELECT category_id FROM categories WHERE category_name = 'Microeconomics')),
('MICRO', 'Microeconomics', (SELECT category_id FROM categories WHERE category_name = 'Microeconomics')),
('QUME', 'Quantitative Methods', (SELECT category_id FROM categories WHERE category_name = 'Quantitative Methods')),
('QM', 'Quantitative Methods', (SELECT category_id FROM categories WHERE category_name = 'Quantitative Methods')),
('COMP', 'Computer Science', (SELECT category_id FROM categories WHERE category_name = 'Technology')),
('CS', 'Computer Science', (SELECT category_id FROM categories WHERE category_name = 'Technology')),
('TECH', 'Technology', (SELECT category_id FROM categories WHERE category_name = 'Technology')),
('BUS', 'Business', (SELECT category_id FROM categories WHERE category_name = 'Others')),
('BUSS', 'Business', (SELECT category_id FROM categories WHERE category_name = 'Others'));

INSERT INTO locations (location_name, location_type, address) VALUES
('CUA (Library 2nd Floor)', 'physical', 'Library 2nd Floor'),
('Online (Microsoft Teams)', 'online', NULL),
('PC & Mac Lab (C234-C235)', 'physical', 'C234-C235'),
('Grad. Department Office (Old)', 'physical', 'Old Graduate Department Office');

INSERT INTO professors (full_name, email) VALUES
('Dr. Elaine Parker', 'elaine.parker@cua.local'),
('Prof. Luis Medina', 'luis.medina@cua.local'),
('Dr. Carla Rivera', 'carla.rivera@cua.local'),
('Prof. Martin Blake', 'martin.blake@cua.local'),
('Dr. Sofia Reyes', 'sofia.reyes@cua.local'),
('Dr. Helen Moore', 'helen.moore@cua.local');

INSERT INTO courses (subject_id, course_number, course_name, description) VALUES
((SELECT subject_id FROM course_subjects WHERE subject_code = 'MATH'), '101', 'Calculus I', 'Limits, derivatives, and introductory applications.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'MATH'), '102', 'Calculus II', 'Integrals, series, and applications.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'MATH'), '201', 'Linear Algebra', 'Vectors, matrices, linear transformations, and systems.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'COMP'), '101', 'Intro to Computer Science', 'Programming fundamentals and computational thinking.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'COMP'), '201', 'Data Structures I', 'Lists, stacks, queues, trees, and algorithm analysis.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'COMP'), '301', 'Algorithms', 'Algorithm design techniques and complexity.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'BIOL'), '110', 'General Biology', 'Cell biology, genetics, and ecology fundamentals.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'BIO'), '215', 'Human Anatomy', 'Human body systems, organs, and structures.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'BIO'), '320', 'Microbiology', 'Microorganisms, lab methods, and immune response.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'BUS'), '101', 'Introduction to Business', 'Business functions, strategy, and organizations.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'BUS'), '210', 'Marketing Principles', 'Markets, customers, positioning, and campaigns.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'CHEM'), '110', 'General Chemistry', 'Atomic structure, bonding, reactions, and stoichiometry.'),
((SELECT subject_id FROM course_subjects WHERE subject_code = 'ENGL'), '210', 'Essay Writing', 'Argument structure, revision, and academic writing.');

INSERT INTO course_topics (course_id, topic_name, sort_order)
SELECT c.course_id, x.topic_name, x.sort_order
FROM v_courses_with_categories c
JOIN (
  SELECT 'MATH101' AS course_code, 'Limits' AS topic_name, 1 AS sort_order UNION ALL
  SELECT 'MATH101', 'Derivatives', 2 UNION ALL
  SELECT 'MATH102', 'Integrals', 1 UNION ALL
  SELECT 'MATH201', 'Matrices', 1 UNION ALL
  SELECT 'COMP101', 'Variables and Control Flow', 1 UNION ALL
  SELECT 'COMP201', 'Linked Lists', 1 UNION ALL
  SELECT 'COMP301', 'Graph Algorithms', 1 UNION ALL
  SELECT 'BIOL110', 'Cell Structure', 1 UNION ALL
  SELECT 'BIO215', 'Skeletal System', 1 UNION ALL
  SELECT 'BIO320', 'Bacteria and Viruses', 1 UNION ALL
  SELECT 'BUS101', 'Business Models', 1 UNION ALL
  SELECT 'BUS210', 'Market Segmentation', 1 UNION ALL
  SELECT 'CHEM110', 'Stoichiometry', 1 UNION ALL
  SELECT 'ENGL210', 'Thesis Statements', 1
) x ON x.course_code = c.course_code;

INSERT INTO course_professors (course_id, professor_id)
SELECT c.course_id, p.professor_id
FROM v_courses_with_categories c
JOIN professors p ON (
  (c.course_code IN ('MATH101', 'MATH102', 'MATH201') AND p.full_name = 'Dr. Elaine Parker')
  OR (c.course_code IN ('COMP101', 'COMP201', 'COMP301') AND p.full_name = 'Prof. Luis Medina')
  OR (c.course_code IN ('BIOL110', 'BIO215', 'BIO320') AND p.full_name = 'Dr. Carla Rivera')
  OR (c.course_code IN ('BUS101', 'BUS210') AND p.full_name = 'Prof. Martin Blake')
  OR (c.course_code = 'CHEM110' AND p.full_name = 'Dr. Sofia Reyes')
  OR (c.course_code = 'ENGL210' AND p.full_name = 'Dr. Helen Moore')
);

INSERT INTO mentors (mentor_number, full_name, email, phone) VALUES
('M1001', 'Alice Johnson', 'alice.johnson@cua.local', '555-0101'),
('M1002', 'Michael Chen', 'michael.chen@cua.local', '555-0102'),
('M1003', 'Sofia Martinez', 'sofia.martinez@cua.local', '555-0103'),
('M1004', 'Daniel Ruiz', 'daniel.ruiz@cua.local', '555-0104'),
('M1005', 'Priya Patel', 'priya.patel@cua.local', '555-0105'),
('M1006', 'Olivia Bennett', 'olivia.bennett@cua.local', '555-0106');

INSERT INTO mentor_courses (mentor_id, course_id, assigned_by_user_id)
SELECT m.mentor_id, c.course_id, u.user_id
FROM mentors m
JOIN v_courses_with_categories c ON (
  (m.mentor_number = 'M1001' AND c.course_code IN ('MATH101', 'MATH102', 'MATH201'))
  OR (m.mentor_number = 'M1002' AND c.course_code IN ('COMP101', 'COMP201', 'COMP301'))
  OR (m.mentor_number = 'M1003' AND c.course_code IN ('BIOL110', 'BIO215', 'BIO320'))
  OR (m.mentor_number = 'M1004' AND c.course_code IN ('BUS101', 'BUS210'))
  OR (m.mentor_number = 'M1005' AND c.course_code IN ('ENGL210', 'COMP101'))
  OR (m.mentor_number = 'M1006' AND c.course_code IN ('CHEM110', 'MATH101'))
)
JOIN users u ON u.email = 'eperez@aguadilla.inter.edu';

INSERT INTO mentor_weekly_availability (mentor_id, day_of_week, start_time, end_time, effective_from)
SELECT mentor_id, 1, '09:00:00', '12:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1001'
UNION ALL SELECT mentor_id, 3, '13:00:00', '16:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1001'
UNION ALL SELECT mentor_id, 2, '10:00:00', '12:30:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1002'
UNION ALL SELECT mentor_id, 4, '14:00:00', '17:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1002'
UNION ALL SELECT mentor_id, 1, '11:00:00', '14:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1003'
UNION ALL SELECT mentor_id, 3, '09:00:00', '12:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1003'
UNION ALL SELECT mentor_id, 2, '13:00:00', '16:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1004'
UNION ALL SELECT mentor_id, 5, '09:00:00', '12:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1004'
UNION ALL SELECT mentor_id, 3, '10:00:00', '13:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1005'
UNION ALL SELECT mentor_id, 5, '11:00:00', '15:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1005'
UNION ALL SELECT mentor_id, 1, '10:00:00', '12:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1006'
UNION ALL SELECT mentor_id, 3, '12:00:00', '15:00:00', '2026-01-01' FROM mentors WHERE mentor_number = 'M1006';

INSERT INTO mentor_schedule_exceptions (mentor_id, exception_date, start_time, end_time, is_full_day, exception_type, reason, created_by_user_id)
SELECT m.mentor_id, '2026-05-20', '12:00:00', '15:00:00', 0, 'unavailable', 'Approved absence', u.user_id
FROM mentors m JOIN users u ON u.email = 'eperez@aguadilla.inter.edu'
WHERE m.mentor_number = 'M1001'
UNION ALL
SELECT m.mentor_id, '2026-05-22', NULL, NULL, 1, 'unavailable', 'Full day absence', u.user_id
FROM mentors m JOIN users u ON u.email = 'eperez@aguadilla.inter.edu'
WHERE m.mentor_number = 'M1002';

INSERT INTO students (student_number, full_name, email, phone) VALUES
('S1001', 'John Doe', 'john.doe@student.cua.local', '555-1101'),
('S1002', 'Ana Torres', 'ana.torres@student.cua.local', '555-1102'),
('S1003', 'Carlos Vega', 'carlos.vega@student.cua.local', '555-1103'),
('S1004', 'Jane Rivera', 'jane.rivera@student.cua.local', '555-1104'),
('S1005', 'Miguel Ramos', 'miguel.ramos@student.cua.local', '555-1105'),
('S1006', 'Laura Ortiz', 'laura.ortiz@student.cua.local', '555-1106');

INSERT INTO bookings (
  booking_type,
  booking_status,
  mentor_id,
  course_id,
  professor_id,
  location_id,
  start_at,
  end_at,
  topics_notes,
  made_by_user_id
)
SELECT 'scheduled', 'scheduled', m.mentor_id, c.course_id, p.professor_id, l.location_id,
       '2026-05-13 09:30:00', '2026-05-13 10:00:00',
       'Limits and derivative rules', u.user_id
FROM mentors m
JOIN v_courses_with_categories c ON c.course_code = 'MATH101'
JOIN professors p ON p.full_name = 'Dr. Elaine Parker'
JOIN locations l ON l.location_name = 'CUA (Library 2nd Floor)'
JOIN users u ON u.email = 'staffcua@aguadilla.inter.edu'
WHERE m.mentor_number = 'M1001'
UNION ALL
SELECT 'scheduled', 'scheduled', m.mentor_id, c.course_id, p.professor_id, l.location_id,
       '2026-05-14 14:30:00', '2026-05-14 15:00:00',
       'Linked lists and stack practice', u.user_id
FROM mentors m
JOIN v_courses_with_categories c ON c.course_code = 'COMP201'
JOIN professors p ON p.full_name = 'Prof. Luis Medina'
JOIN locations l ON l.location_name = 'Online (Microsoft Teams)'
JOIN users u ON u.email = 'staffcua@aguadilla.inter.edu'
WHERE m.mentor_number = 'M1002'
UNION ALL
SELECT 'scheduled', 'active', m.mentor_id, c.course_id, p.professor_id, l.location_id,
       '2026-05-13 13:00:00', '2026-05-13 13:30:00',
       'Skeletal system review', u.user_id
FROM mentors m
JOIN v_courses_with_categories c ON c.course_code = 'BIO215'
JOIN professors p ON p.full_name = 'Dr. Carla Rivera'
JOIN locations l ON l.location_name = 'PC & Mac Lab (C234-C235)'
JOIN users u ON u.email = 'staffcua@aguadilla.inter.edu'
WHERE m.mentor_number = 'M1003'
UNION ALL
SELECT 'walk_in', 'completed', m.mentor_id, c.course_id, p.professor_id, l.location_id,
       '2026-05-13 10:15:00', '2026-05-13 10:45:00',
       'Business model worksheet', u.user_id
FROM mentors m
JOIN v_courses_with_categories c ON c.course_code = 'BUS101'
JOIN professors p ON p.full_name = 'Prof. Martin Blake'
JOIN locations l ON l.location_name = 'CUA (Library 2nd Floor)'
JOIN users u ON u.email = 'staffcua@aguadilla.inter.edu'
WHERE m.mentor_number = 'M1004'
UNION ALL
SELECT 'scheduled', 'scheduled', m.mentor_id, c.course_id, p.professor_id, l.location_id,
       '2026-05-16 11:00:00', '2026-05-16 11:30:00',
       'Essay outline and thesis statement', u.user_id
FROM mentors m
JOIN v_courses_with_categories c ON c.course_code = 'ENGL210'
JOIN professors p ON p.full_name = 'Dr. Helen Moore'
JOIN locations l ON l.location_name = 'Grad. Department Office (Old)'
JOIN users u ON u.email = 'staffcua@aguadilla.inter.edu'
WHERE m.mentor_number = 'M1005';

INSERT INTO booking_students (booking_id, student_id, student_order, is_primary)
SELECT b.booking_id, s.student_id, 1, 1
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN students s ON s.student_number = 'S1001'
WHERE bd.course_code = 'MATH101' AND b.start_at = '2026-05-13 09:30:00'
UNION ALL
SELECT b.booking_id, s.student_id, 1, 1
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN students s ON s.student_number = 'S1002'
WHERE bd.course_code = 'COMP201' AND b.start_at = '2026-05-14 14:30:00'
UNION ALL
SELECT b.booking_id, s.student_id, 2, 0
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN students s ON s.student_number = 'S1003'
WHERE bd.course_code = 'COMP201' AND b.start_at = '2026-05-14 14:30:00'
UNION ALL
SELECT b.booking_id, s.student_id, 1, 1
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN students s ON s.student_number = 'S1004'
WHERE bd.course_code = 'BIO215' AND b.start_at = '2026-05-13 13:00:00'
UNION ALL
SELECT b.booking_id, s.student_id, 1, 1
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN students s ON s.student_number = 'S1005'
WHERE bd.course_code = 'BUS101' AND b.start_at = '2026-05-13 10:15:00'
UNION ALL
SELECT b.booking_id, s.student_id, 1, 1
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN students s ON s.student_number = 'S1006'
WHERE bd.course_code = 'ENGL210' AND b.start_at = '2026-05-16 11:00:00';

INSERT INTO mentorship_sessions (booking_id, session_status, started_at, ended_at, started_by_user_id, ended_by_user_id)
SELECT b.booking_id, 'active', '2026-05-13 13:00:00', NULL, u.user_id, NULL
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN users u ON u.email = 'staffcua@aguadilla.inter.edu'
WHERE bd.course_code = 'BIO215' AND b.start_at = '2026-05-13 13:00:00'
UNION ALL
SELECT b.booking_id, 'completed', '2026-05-13 10:15:00', '2026-05-13 10:45:00', u.user_id, u.user_id
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
JOIN users u ON u.email = 'staffcua@aguadilla.inter.edu'
WHERE bd.course_code = 'BUS101' AND b.start_at = '2026-05-13 10:15:00';

INSERT INTO booking_online_meetings (booking_id, provider, external_event_id, join_url, organizer_email)
SELECT b.booking_id, 'teams', 'dummy-teams-event-comp201-20260514', 'https://teams.microsoft.com/l/meetup-join/dummy-comp201', 'staffcua@aguadilla.inter.edu'
FROM bookings b
JOIN v_booking_details bd ON bd.booking_id = b.booking_id
WHERE bd.course_code = 'COMP201' AND b.start_at = '2026-05-14 14:30:00';
