USE cua_bookings;

START TRANSACTION;

INSERT IGNORE INTO categories (category_name) VALUES
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

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Mathematics')
WHERE subject_code IN ('MATH', 'GEMA');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Science')
WHERE subject_code IN ('BIOL', 'BIO', 'CHEM', 'SCI', 'PHYS');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Spanish')
WHERE subject_code IN ('SPAN', 'ESPA');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'English')
WHERE subject_code IN ('ENGL');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Statistics')
WHERE subject_code IN ('STAT', 'STAD');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Accounting')
WHERE subject_code IN ('ACCT', 'ACC');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Finance')
WHERE subject_code IN ('FIN', 'FINA');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Microeconomics')
WHERE subject_code IN ('ECON', 'MICRO');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Quantitative Methods')
WHERE subject_code IN ('QUME', 'QM');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Technology')
WHERE subject_code IN ('COMP', 'CS', 'TECH');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Other')
WHERE subject_code IN ('BUS', 'BUSS', 'BUSI');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Other')
WHERE category_id IN (
  SELECT category_id
  FROM categories
  WHERE category_name NOT IN (
    'Mathematics',
    'Science',
    'Spanish',
    'English',
    'Statistics',
    'Accounting',
    'Finance',
    'Microeconomics',
    'Quantitative Methods',
    'Technology',
    'Other'
  )
);

UPDATE course_subjects
SET subject_name = 'Statistics'
WHERE subject_code IN ('STAT', 'STAD');

UPDATE course_subjects
SET subject_name = 'Finance'
WHERE subject_code IN ('FIN', 'FINA');

DELETE FROM categories
WHERE category_name NOT IN (
  'Mathematics',
  'Science',
  'Spanish',
  'English',
  'Statistics',
  'Accounting',
  'Finance',
  'Microeconomics',
  'Quantitative Methods',
  'Technology',
  'Other'
);

CREATE TEMPORARY TABLE retained_mentors (
  mentor_id INT UNSIGNED PRIMARY KEY
) ENGINE=MEMORY;

INSERT INTO retained_mentors
SELECT mentor_id
FROM mentors
WHERE mentor_number IN ('A00631877', 'A00635439');

CREATE TEMPORARY TABLE retained_courses (
  course_id INT UNSIGNED PRIMARY KEY
) ENGINE=MEMORY;

INSERT INTO retained_courses
SELECT course_id
FROM v_courses_with_categories
WHERE course_code IN ('GEMA1000', 'GEMA1200', 'PHYS3001');

DELETE FROM booking_online_meetings;
DELETE FROM mentorship_sessions;
DELETE FROM booking_students;
DELETE FROM bookings;
DELETE FROM mentor_schedule_exceptions;
DELETE FROM students;
DELETE FROM audit_log;

DELETE FROM mentor_weekly_availability
WHERE mentor_id NOT IN (SELECT mentor_id FROM retained_mentors);

DELETE FROM mentor_courses
WHERE mentor_id NOT IN (SELECT mentor_id FROM retained_mentors)
   OR course_id NOT IN (SELECT course_id FROM retained_courses);

DELETE FROM mentors
WHERE mentor_id NOT IN (SELECT mentor_id FROM retained_mentors);

DELETE FROM course_topics
WHERE course_id NOT IN (SELECT course_id FROM retained_courses);

DELETE FROM course_professors
WHERE course_id NOT IN (SELECT course_id FROM retained_courses);

DELETE FROM courses
WHERE course_id NOT IN (SELECT course_id FROM retained_courses);

DELETE p
FROM professors p
LEFT JOIN course_professors cp ON cp.professor_id = p.professor_id
WHERE cp.professor_id IS NULL;

DELETE cs
FROM course_subjects cs
LEFT JOIN courses c ON c.subject_id = cs.subject_id
WHERE c.course_id IS NULL;

DELETE FROM locations
WHERE location_name NOT IN ('CUA (Library 2nd Floor)', 'Online (Microsoft Teams)');

DROP TEMPORARY TABLE retained_courses;
DROP TEMPORARY TABLE retained_mentors;

COMMIT;
