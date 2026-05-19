INSERT IGNORE INTO categories (category_name) VALUES
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

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Mathematics')
WHERE subject_code IN ('MATH');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Sciences')
WHERE subject_code IN ('BIOL', 'BIO', 'CHEM', 'SCI');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Spanish')
WHERE subject_code IN ('SPAN', 'ESPA');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'English')
WHERE subject_code IN ('ENGL');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Stadistics')
WHERE subject_code IN ('STAT', 'STAD');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Accounting')
WHERE subject_code IN ('ACCT', 'ACC');

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Finances')
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
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Others')
WHERE subject_code IN ('BUS', 'BUSS');

INSERT IGNORE INTO course_subjects (subject_code, subject_name, category_id) VALUES
('SPAN', 'Spanish', (SELECT category_id FROM categories WHERE category_name = 'Spanish')),
('ESPA', 'Spanish', (SELECT category_id FROM categories WHERE category_name = 'Spanish')),
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
('TECH', 'Technology', (SELECT category_id FROM categories WHERE category_name = 'Technology'));

UPDATE course_subjects
SET category_id = (SELECT category_id FROM categories WHERE category_name = 'Others')
WHERE category_id IN (
    SELECT category_id
    FROM categories
    WHERE category_name NOT IN (
        'Mathematics',
        'Sciences',
        'Spanish',
        'English',
        'Stadistics',
        'Accounting',
        'Finances',
        'Microeconomics',
        'Quantitative Methods',
        'Technology',
        'Others'
    )
);

DELETE FROM categories
WHERE category_name NOT IN (
    'Mathematics',
    'Sciences',
    'Spanish',
    'English',
    'Stadistics',
    'Accounting',
    'Finances',
    'Microeconomics',
    'Quantitative Methods',
    'Technology',
    'Others'
);
