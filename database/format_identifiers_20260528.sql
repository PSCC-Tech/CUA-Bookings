USE cua_bookings;

UPDATE courses
SET course_number = LPAD(course_number, 4, '0')
WHERE course_number REGEXP '^[0-9]{1,3}$';

UPDATE courses c
JOIN course_subjects old_subject ON old_subject.subject_id = c.subject_id AND old_subject.subject_code = 'BIO'
JOIN course_subjects new_subject ON new_subject.subject_code = 'BIOL'
SET c.subject_id = new_subject.subject_id;

DELETE old_subject
FROM course_subjects old_subject
LEFT JOIN courses c ON c.subject_id = old_subject.subject_id
WHERE old_subject.subject_code = 'BIO'
  AND c.course_id IS NULL;

UPDATE course_subjects
SET subject_code = 'BUSI'
WHERE subject_code = 'BUS'
  AND NOT EXISTS (
      SELECT 1
      FROM (SELECT subject_code FROM course_subjects) existing_subjects
      WHERE existing_subjects.subject_code = 'BUSI'
  );

UPDATE mentors
SET mentor_number = CONCAT(
    LEFT(mentor_number, 1),
    '00',
    LPAD(CAST(SUBSTRING(mentor_number, 2) AS UNSIGNED), 6, '0')
)
WHERE mentor_number REGEXP '^[A-Z][0-9]{1,6}$'
  AND mentor_number NOT REGEXP '^[A-Z]00[0-9]{6}$';

UPDATE students
SET student_number = CONCAT(
    LEFT(student_number, 1),
    '00',
    LPAD(CAST(SUBSTRING(student_number, 2) AS UNSIGNED), 6, '0')
)
WHERE student_number REGEXP '^[A-Z][0-9]{1,6}$'
  AND student_number NOT REGEXP '^[A-Z]00[0-9]{6}$';
