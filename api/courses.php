<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET', 'POST', 'PUT', 'DELETE']);

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'GET') {
    require_admin_user();
}

function fetch_courses(PDO $pdo): array
{
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
        $values = course_code_lookup_values($courseCode);
        $sql .= ' AND vc.course_code IN (' . implode(',', array_fill(0, max(1, count($values)), '?')) . ')';
        array_push($params, ...($values ?: ['']));
    }

    if ($category !== '' && strtolower($category) !== 'all' && strtolower($category) !== 'show all') {
        $sql .= ' AND vc.category_name = ?';
        $params[] = $category;
    }

    if ($search !== '') {
        $normalizedSearch = normalize_course_code($search);
        $sql .= ' AND (vc.course_code LIKE ? OR vc.course_code LIKE ? OR vc.course_name LIKE ? OR vc.category_name LIKE ?)';
        $like = '%' . $search . '%';
        $normalizedLike = '%' . $normalizedSearch . '%';
        array_push($params, $like, $normalizedLike, $like, $like);
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

    return array_map(static function (array $row): array {
        return [
            'course_id' => (int)$row['course_id'],
            'id' => course_display_code($row),
            'code' => course_display_code($row),
            'course_code_normalized' => $row['course_code'],
            'name' => $row['course_name'],
            'category' => $row['category_name'],
            'description' => $row['description'] ?? '',
            'professors' => $row['professors'] ? split_csv_names($row['professors']) : [],
            'mentors' => $row['mentors'] ? split_csv_names($row['mentors']) : [],
            'mentor_numbers' => $row['mentor_numbers'] ? split_csv_names($row['mentor_numbers']) : [],
            'topics' => $row['topics'] ? split_csv_names($row['topics']) : [],
        ];
    }, $stmt->fetchAll());
}

function course_category_name_from_payload(array $data): string
{
    $category = trim((string)($data['category_name'] ?? $data['category'] ?? ''));
    if ($category === '' || strtolower($category) === 'all' || strtolower($category) === 'show all') {
        return 'Others';
    }

    return $category;
}

function course_category_id(PDO $pdo, string $categoryName): int
{
    $stmt = $pdo->prepare('SELECT category_id FROM categories WHERE category_name = ? LIMIT 1');
    $stmt->execute([$categoryName]);
    $categoryId = $stmt->fetchColumn();

    if ($categoryId) {
        return (int)$categoryId;
    }

    $fallback = $pdo->prepare("SELECT category_id FROM categories WHERE category_name = 'Others' LIMIT 1");
    $fallback->execute();
    $fallbackId = $fallback->fetchColumn();

    if (!$fallbackId) {
        throw new RuntimeException('Course category was not found.');
    }

    return (int)$fallbackId;
}

function course_subject_id(PDO $pdo, string $subjectCode, string $categoryName): int
{
    $subjectCode = strtoupper(trim($subjectCode));
    $subjectStmt = $pdo->prepare('SELECT subject_id FROM course_subjects WHERE subject_code = ? LIMIT 1');
    $subjectStmt->execute([$subjectCode]);
    $subjectId = $subjectStmt->fetchColumn();

    if ($subjectId) {
        return (int)$subjectId;
    }

    $categoryId = course_category_id($pdo, $categoryName);
    $insert = $pdo->prepare('
        INSERT INTO course_subjects (subject_code, subject_name, category_id)
        VALUES (?, ?, ?)
    ');
    $insert->execute([$subjectCode, $subjectCode, $categoryId]);

    return (int)$pdo->lastInsertId();
}

function course_id_from_code(PDO $pdo, string $courseCode): ?int
{
    $values = course_code_lookup_values($courseCode);
    $stmt = $pdo->prepare('SELECT course_id FROM v_courses_with_categories WHERE course_code IN (' . implode(',', array_fill(0, max(1, count($values)), '?')) . ') LIMIT 1');
    $stmt->execute($values ?: ['']);
    $id = $stmt->fetchColumn();

    return $id ? (int)$id : null;
}

function read_course_target_id(PDO $pdo, array $data): ?int
{
    $id = read_id();
    if ($id) {
        return $id;
    }

    foreach (['course_id', 'id'] as $key) {
        if (isset($data[$key]) && ctype_digit((string)$data[$key])) {
            return (int)$data[$key];
        }
    }

    $code = trim((string)($data['course_code'] ?? $data['code'] ?? $_GET['course_code'] ?? ''));
    return $code !== '' ? course_id_from_code($pdo, $code) : null;
}

function sync_course_relations(PDO $pdo, int $courseId, array $data, bool $syncMentors): void
{
    $professorNames = is_array($data['professors'] ?? null)
        ? array_values(array_filter(array_map('trim', $data['professors'])))
        : split_csv_names((string)($data['professors'] ?? ''));
    $topics = is_array($data['topics'] ?? null)
        ? array_values(array_filter(array_map('trim', $data['topics'])))
        : [];
    $mentorNumbers = is_array($data['mentor_numbers'] ?? null)
        ? array_values(array_filter(array_map('trim', $data['mentor_numbers'])))
        : [];

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

    if (!$syncMentors) {
        return;
    }

    $pdo->prepare('DELETE FROM mentor_courses WHERE course_id = ?')->execute([$courseId]);
    if (!$mentorNumbers) {
        return;
    }

    $assign = $pdo->prepare('
        INSERT INTO mentor_courses (mentor_id, course_id, assigned_by_user_id, is_active)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE assigned_by_user_id = VALUES(assigned_by_user_id), is_active = 1
    ');
    $userId = find_or_create_user($pdo, (string)($data['made_by'] ?? 'Front Desk Staff'));

    foreach ($mentorNumbers as $mentorNumber) {
        $mentorValues = [];
        try {
            $mentorValues = person_identifier_lookup_values($mentorNumber, 'Mentor ID');
        } catch (Throwable $error) {
            $mentorValues = [];
        }

        $mentorStmt = $pdo->prepare('SELECT mentor_id FROM mentors WHERE full_name = ?' . ($mentorValues ? ' OR mentor_number IN (' . implode(',', array_fill(0, count($mentorValues), '?')) . ')' : '') . ' LIMIT 1');
        $mentorStmt->execute([$mentorNumber, ...$mentorValues]);
        $mentorId = $mentorStmt->fetchColumn();
        if ($mentorId) {
            $assign->execute([(int)$mentorId, $courseId, $userId]);
        }
    }
}

function save_course(PDO $pdo, array $data, ?int $targetCourseId = null): array
{
    $parsed = parse_course_code((string)($data['course_code'] ?? $data['code'] ?? ''));
    $courseName = trim((string)($data['course_name'] ?? $data['name'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));

    if ($courseName === '') {
        fail('Course name is required.');
    }

    $subjectId = course_subject_id($pdo, $parsed['subject_code'], course_category_name_from_payload($data));
    $courseNumberValues = array_values(array_unique([
        $parsed['course_number'],
        ltrim($parsed['course_number'], '0') ?: '0',
    ]));
    $existingStmt = $pdo->prepare('
        SELECT course_id
        FROM courses
        WHERE subject_id = ? AND course_number IN (' . implode(',', array_fill(0, count($courseNumberValues), '?')) . ') AND course_suffix = ?
        LIMIT 1
    ');
    $existingStmt->execute([$subjectId, ...$courseNumberValues, $parsed['course_suffix']]);
    $existingId = $existingStmt->fetchColumn();

    if ($targetCourseId) {
        $existsStmt = $pdo->prepare('SELECT course_id FROM courses WHERE course_id = ? LIMIT 1');
        $existsStmt->execute([$targetCourseId]);
        if (!$existsStmt->fetchColumn()) {
            fail('Course was not found.', 404);
        }

        if ($existingId && (int)$existingId !== $targetCourseId) {
            throw new RuntimeException('Another course already uses that course code.');
        }

        $courseId = $targetCourseId;
        $update = $pdo->prepare('
            UPDATE courses
            SET subject_id = ?, course_number = ?, course_suffix = ?, course_name = ?, description = ?, is_active = 1
            WHERE course_id = ?
        ');
        $update->execute([$subjectId, $parsed['course_number'], $parsed['course_suffix'], $courseName, $description ?: null, $courseId]);
    } elseif ($existingId) {
        $courseId = (int)$existingId;
        $update = $pdo->prepare('UPDATE courses SET course_name = ?, description = ?, is_active = 1 WHERE course_id = ?');
        $update->execute([$courseName, $description ?: null, $courseId]);
    } else {
        $insert = $pdo->prepare('
            INSERT INTO courses (subject_id, course_number, course_suffix, course_name, description)
            VALUES (?, ?, ?, ?, ?)
        ');
        $insert->execute([$subjectId, $parsed['course_number'], $parsed['course_suffix'], $courseName, $description ?: null]);
        $courseId = (int)$pdo->lastInsertId();
    }

    $syncMentors = !$targetCourseId || array_key_exists('mentor_numbers', $data);
    sync_course_relations($pdo, $courseId, $data, $syncMentors);

    return ['course_id' => $courseId, 'course_code' => format_course_code($parsed['normalized'])];
}

function course_delete_ids(PDO $pdo, array $data): array
{
    $ids = [];
    $rawIds = $data['ids'] ?? $data['course_ids'] ?? null;

    if (is_array($rawIds)) {
        foreach ($rawIds as $id) {
            if (ctype_digit((string)$id)) {
                $ids[] = (int)$id;
            }
        }
    }

    $singleId = read_course_target_id($pdo, $data);
    if ($singleId) {
        $ids[] = $singleId;
    }

    return array_values(array_unique(array_filter($ids)));
}

if ($method === 'GET') {
    ok(['courses' => fetch_courses($pdo)]);
}

$data = input_json();

if ($method === 'DELETE') {
    $ids = course_delete_ids($pdo, $data);
    if (!$ids) {
        fail('Select at least one course to delete.');
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $pdo->beginTransaction();

    try {
        $pdo->prepare("UPDATE courses SET is_active = 0 WHERE course_id IN ($placeholders)")->execute($ids);
        $pdo->prepare("UPDATE mentor_courses SET is_active = 0 WHERE course_id IN ($placeholders)")->execute($ids);
        $pdo->commit();
        ok(['deleted' => count($ids), 'courses' => fetch_courses($pdo)]);
    } catch (Throwable $error) {
        $pdo->rollBack();
        fail($error->getMessage(), 400);
    }
}

$targetCourseId = $method === 'PUT' ? read_course_target_id($pdo, $data) : null;
if ($method === 'PUT' && !$targetCourseId) {
    fail('Course ID is required.', 400);
}

$pdo->beginTransaction();

try {
    $saved = save_course($pdo, $data, $targetCourseId);
    $pdo->commit();
    ok($saved);
} catch (Throwable $error) {
    $pdo->rollBack();
    fail($error->getMessage(), 400);
}
