<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET', 'POST']);

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $search = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
    $category = trim((string)($_GET['category'] ?? ''));
    $mentor = trim((string)($_GET['mentor'] ?? ''));
    $courseId = isset($_GET['id']) && ctype_digit((string)$_GET['id']) ? (int)$_GET['id'] : null;
    $courseCode = trim((string)($_GET['course_code'] ?? ''));

    $sql = "
        SELECT
            vc.course_id,
            vc.course_code,
            vc.course_name,
            vc.description,
            vc.category_name,
            GROUP_CONCAT(DISTINCT p.full_name ORDER BY p.full_name SEPARATOR ', ') AS professors,
            GROUP_CONCAT(DISTINCT m.full_name ORDER BY m.full_name SEPARATOR ', ') AS mentors,
            GROUP_CONCAT(DISTINCT m.mentor_number ORDER BY m.full_name SEPARATOR ', ') AS mentor_numbers,
            GROUP_CONCAT(DISTINCT ct.topic_name ORDER BY ct.sort_order, ct.topic_name SEPARATOR ', ') AS topics
        FROM v_courses_with_categories vc
        LEFT JOIN course_professors cp ON cp.course_id = vc.course_id
        LEFT JOIN professors p ON p.professor_id = cp.professor_id
        LEFT JOIN mentor_courses mc ON mc.course_id = vc.course_id AND mc.is_active = 1
        LEFT JOIN mentors m ON m.mentor_id = mc.mentor_id AND m.is_active = 1
        LEFT JOIN course_topics ct ON ct.course_id = vc.course_id
        WHERE vc.is_active = 1
    ";

    $params = [];

    if ($courseId) {
        $sql .= ' AND vc.course_id = ?';
        $params[] = $courseId;
    }

    if ($courseCode !== '') {
        $sql .= ' AND vc.course_code = ?';
        $params[] = normalize_course_code($courseCode);
    }

    if ($category !== '' && strtolower($category) !== 'all' && strtolower($category) !== 'show all') {
        $sql .= ' AND vc.category_name = ?';
        $params[] = $category;
    }

    if ($search !== '') {
        $sql .= ' AND (vc.course_code LIKE ? OR vc.course_name LIKE ? OR vc.category_name LIKE ?)';
        $like = '%' . $search . '%';
        array_push($params, $like, $like, $like);
    }

    if ($mentor !== '' && strtolower($mentor) !== 'all') {
        $sql .= ' AND EXISTS (
            SELECT 1
            FROM mentor_courses mc_filter
            JOIN mentors m_filter ON m_filter.mentor_id = mc_filter.mentor_id
            WHERE mc_filter.course_id = vc.course_id
              AND mc_filter.is_active = 1
              AND (m_filter.full_name = ? OR m_filter.mentor_number = ?)
        )';
        array_push($params, $mentor, $mentor);
    }

    $sql .= '
        GROUP BY vc.course_id, vc.course_code, vc.course_name, vc.description, vc.category_name
        ORDER BY vc.category_name, vc.course_code
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $courses = array_map(static function (array $row): array {
        return [
            'course_id' => (int)$row['course_id'],
            'id' => $row['course_code'],
            'code' => $row['course_code'],
            'name' => $row['course_name'],
            'category' => $row['category_name'],
            'description' => $row['description'] ?? '',
            'professors' => $row['professors'] ? split_csv_names($row['professors']) : [],
            'mentors' => $row['mentors'] ? split_csv_names($row['mentors']) : [],
            'mentor_numbers' => $row['mentor_numbers'] ? split_csv_names($row['mentor_numbers']) : [],
            'topics' => $row['topics'] ? split_csv_names($row['topics']) : [],
        ];
    }, $stmt->fetchAll());

    ok(['courses' => $courses]);
}

$data = input_json();
$parsed = parse_course_code((string)($data['course_code'] ?? $data['code'] ?? ''));

$courseName = trim((string)($data['course_name'] ?? $data['name'] ?? ''));
if ($courseName === '') {
    fail('Course name is required.');
}

$description = trim((string)($data['description'] ?? ''));
$professorNames = is_array($data['professors'] ?? null)
    ? array_values(array_filter(array_map('trim', $data['professors'])))
    : split_csv_names((string)($data['professors'] ?? ''));
$topics = is_array($data['topics'] ?? null)
    ? array_values(array_filter(array_map('trim', $data['topics'])))
    : [];
$mentorNumbers = is_array($data['mentor_numbers'] ?? null)
    ? array_values(array_filter(array_map('trim', $data['mentor_numbers'])))
    : [];

$pdo->beginTransaction();

try {
    $subjectStmt = $pdo->prepare('SELECT subject_id FROM course_subjects WHERE subject_code = ? LIMIT 1');
    $subjectStmt->execute([$parsed['subject_code']]);
    $subjectId = $subjectStmt->fetchColumn();

    if (!$subjectId) {
        throw new RuntimeException('Unknown course subject prefix: ' . $parsed['subject_code']);
    }

    $existingStmt = $pdo->prepare('
        SELECT course_id
        FROM courses
        WHERE subject_id = ? AND course_number = ? AND course_suffix = ?
        LIMIT 1
    ');
    $existingStmt->execute([(int)$subjectId, $parsed['course_number'], $parsed['course_suffix']]);
    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $courseId = (int)$existingId;
        $update = $pdo->prepare('UPDATE courses SET course_name = ?, description = ?, is_active = 1 WHERE course_id = ?');
        $update->execute([$courseName, $description ?: null, $courseId]);
    } else {
        $insert = $pdo->prepare('
            INSERT INTO courses (subject_id, course_number, course_suffix, course_name, description)
            VALUES (?, ?, ?, ?, ?)
        ');
        $insert->execute([(int)$subjectId, $parsed['course_number'], $parsed['course_suffix'], $courseName, $description ?: null]);
        $courseId = (int)$pdo->lastInsertId();
    }

    $pdo->prepare('DELETE FROM course_professors WHERE course_id = ?')->execute([$courseId]);
    foreach ($professorNames as $professorName) {
        $professorId = find_or_create_professor($pdo, $professorName);
        if ($professorId) {
            $pdo->prepare('INSERT IGNORE INTO course_professors (course_id, professor_id) VALUES (?, ?)')
                ->execute([$courseId, $professorId]);
        }
    }

    $pdo->prepare('DELETE FROM course_topics WHERE course_id = ?')->execute([$courseId]);
    foreach ($topics as $index => $topic) {
        $pdo->prepare('INSERT INTO course_topics (course_id, topic_name, sort_order) VALUES (?, ?, ?)')
            ->execute([$courseId, $topic, $index + 1]);
    }

    $pdo->prepare('DELETE FROM mentor_courses WHERE course_id = ?')->execute([$courseId]);
    if ($mentorNumbers) {
        $mentorStmt = $pdo->prepare('SELECT mentor_id FROM mentors WHERE mentor_number = ? OR full_name = ? LIMIT 1');
        $assign = $pdo->prepare('INSERT IGNORE INTO mentor_courses (mentor_id, course_id, assigned_by_user_id) VALUES (?, ?, ?)');
        $userId = find_or_create_user($pdo, (string)($data['made_by'] ?? 'Front Desk Staff'));

        foreach ($mentorNumbers as $mentorNumber) {
            $mentorStmt->execute([$mentorNumber, $mentorNumber]);
            $mentorId = $mentorStmt->fetchColumn();
            if ($mentorId) {
                $assign->execute([(int)$mentorId, $courseId, $userId]);
            }
        }
    }

    $pdo->commit();
    ok(['course_id' => $courseId, 'course_code' => $parsed['normalized']]);
} catch (Throwable $error) {
    $pdo->rollBack();
    fail($error->getMessage(), 400);
}
