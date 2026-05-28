<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET', 'POST', 'PUT', 'DELETE']);

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'GET') {
    require_admin_user();
}

if ($method === 'GET') {
    $courseCode = trim((string)($_GET['course_code'] ?? ''));
    $search = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
    $category = trim((string)($_GET['category'] ?? ''));
    $mentorId = isset($_GET['id']) && ctype_digit((string)$_GET['id']) ? (int)$_GET['id'] : null;
    $mentorNumber = trim((string)($_GET['mentor_number'] ?? ''));

    $sql = "
        SELECT
            m.mentor_id,
            m.mentor_number,
            m.full_name,
            m.email,
            m.phone,
            GROUP_CONCAT(DISTINCT cat.category_name ORDER BY cat.category_name SEPARATOR ', ') AS categories,
            GROUP_CONCAT(DISTINCT vc.course_code ORDER BY vc.course_code SEPARATOR ', ') AS course_codes,
            GROUP_CONCAT(DISTINCT CONCAT(vc.course_code, ' - ', vc.course_name) ORDER BY vc.course_code SEPARATOR '||') AS courses
        FROM mentors m
        LEFT JOIN mentor_courses mc ON mc.mentor_id = m.mentor_id AND mc.is_active = 1
        LEFT JOIN v_courses_with_categories vc ON vc.course_id = mc.course_id
        LEFT JOIN categories cat ON cat.category_id = vc.category_id
        WHERE m.is_active = 1
    ";
    $params = [];

    if ($mentorId) {
        $sql .= ' AND m.mentor_id = ?';
        $params[] = $mentorId;
    }

    if ($mentorNumber !== '') {
        $sql .= ' AND m.mentor_number = ?';
        $params[] = $mentorNumber;
    }

    if ($courseCode !== '') {
        $sql .= ' AND EXISTS (
            SELECT 1
            FROM mentor_courses mc_filter
            JOIN v_courses_with_categories vc_filter ON vc_filter.course_id = mc_filter.course_id
            WHERE mc_filter.mentor_id = m.mentor_id
              AND mc_filter.is_active = 1
              AND vc_filter.course_code = ?
        )';
        $params[] = normalize_course_code($courseCode);
    }

    if ($category !== '' && strtolower($category) !== 'all' && strtolower($category) !== 'show all') {
        $sql .= ' AND EXISTS (
            SELECT 1
            FROM mentor_courses mc_cat
            JOIN v_courses_with_categories vc_cat ON vc_cat.course_id = mc_cat.course_id
            WHERE mc_cat.mentor_id = m.mentor_id
              AND mc_cat.is_active = 1
              AND vc_cat.category_name = ?
        )';
        $params[] = $category;
    }

    if ($search !== '') {
        $sql .= ' AND (m.mentor_number LIKE ? OR m.full_name LIKE ? OR m.email LIKE ?)';
        $like = '%' . $search . '%';
        array_push($params, $like, $like, $like);
    }

    $sql .= '
        GROUP BY m.mentor_id, m.mentor_number, m.full_name, m.email, m.phone
        ORDER BY m.full_name
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $mentorIds = array_map(static fn(array $row): int => (int)$row['mentor_id'], $rows);
    $scheduleByMentor = [];

    if ($mentorIds) {
        $placeholders = implode(',', array_fill(0, count($mentorIds), '?'));
        $scheduleStmt = $pdo->prepare("
            SELECT mentor_id, day_of_week, start_time, end_time
            FROM mentor_weekly_availability
            WHERE is_active = 1 AND mentor_id IN ($placeholders)
            ORDER BY mentor_id, day_of_week, start_time
        ");
        $scheduleStmt->execute($mentorIds);

        foreach ($scheduleStmt->fetchAll() as $schedule) {
            $scheduleByMentor[(int)$schedule['mentor_id']][] = [
                'day_of_week' => (int)$schedule['day_of_week'],
                'start_time' => $schedule['start_time'],
                'end_time' => $schedule['end_time'],
                'start' => format_time_12($schedule['start_time']),
                'end' => format_time_12($schedule['end_time']),
            ];
        }
    }

    $mentors = array_map(static function (array $row) use ($scheduleByMentor): array {
        $courses = $row['courses'] ? explode('||', $row['courses']) : [];

        return [
            'mentor_id' => (int)$row['mentor_id'],
            'id' => (int)$row['mentor_id'],
            'mentor_number' => $row['mentor_number'],
            'number' => $row['mentor_number'],
            'name' => $row['full_name'],
            'full_name' => $row['full_name'],
            'email' => $row['email'] ?? '',
            'phone' => $row['phone'] ?? '',
            'contact' => $row['email'] ?: ($row['phone'] ?? ''),
            'categories' => $row['categories'] ? split_csv_names($row['categories']) : [],
            'course_codes' => $row['course_codes'] ? split_csv_names($row['course_codes']) : [],
            'courses' => array_map(static function (string $course): array {
                $parts = explode(' - ', $course, 2);
                return [
                    'id' => $parts[0] ?? $course,
                    'code' => $parts[0] ?? $course,
                    'name' => $parts[1] ?? '',
                ];
            }, $courses),
            'schedule' => $scheduleByMentor[(int)$row['mentor_id']] ?? [],
        ];
    }, $rows);

    ok(['mentors' => $mentors]);
}

function mentor_id_from_number(PDO $pdo, string $mentorNumber): ?int
{
    $stmt = $pdo->prepare('SELECT mentor_id FROM mentors WHERE mentor_number = ? LIMIT 1');
    $stmt->execute([$mentorNumber]);
    $id = $stmt->fetchColumn();

    return $id ? (int)$id : null;
}

function mentor_delete_ids(PDO $pdo, array $data): array
{
    $ids = [];
    $rawIds = $data['ids'] ?? $data['mentor_ids'] ?? null;

    if (is_array($rawIds)) {
        foreach ($rawIds as $id) {
            if (ctype_digit((string)$id)) {
                $ids[] = (int)$id;
            }
        }
    }

    $rawNumbers = $data['mentor_numbers'] ?? null;
    if (is_array($rawNumbers)) {
        foreach ($rawNumbers as $number) {
            $id = mentor_id_from_number($pdo, trim((string)$number));
            if ($id) {
                $ids[] = $id;
            }
        }
    }

    $queryId = read_id();
    if ($queryId) {
        $ids[] = $queryId;
    }

    foreach (['mentor_id', 'id'] as $key) {
        if (isset($data[$key]) && ctype_digit((string)$data[$key])) {
            $ids[] = (int)$data[$key];
        }
    }

    $mentorNumber = trim((string)($data['mentor_number'] ?? $_GET['mentor_number'] ?? ''));
    if ($mentorNumber !== '') {
        $id = mentor_id_from_number($pdo, $mentorNumber);
        if ($id) {
            $ids[] = $id;
        }
    }

    return array_values(array_unique(array_filter($ids)));
}

$data = input_json();

if ($method === 'DELETE') {
    $ids = mentor_delete_ids($pdo, $data);
    if (!$ids) {
        fail('Select at least one mentor to delete.');
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $pdo->beginTransaction();

    try {
        $pdo->prepare("UPDATE mentors SET is_active = 0 WHERE mentor_id IN ($placeholders)")->execute($ids);
        $pdo->prepare("UPDATE mentor_courses SET is_active = 0 WHERE mentor_id IN ($placeholders)")->execute($ids);
        $pdo->prepare("UPDATE mentor_weekly_availability SET is_active = 0 WHERE mentor_id IN ($placeholders)")->execute($ids);
        $pdo->commit();
        ok(['deleted' => count($ids)]);
    } catch (Throwable $error) {
        $pdo->rollBack();
        fail($error->getMessage(), 400);
    }
}

if ($method === 'PUT') {
    $mentorId = read_id();
    $currentMentorNumber = trim((string)($_GET['mentor_number'] ?? $data['current_mentor_number'] ?? $data['original_mentor_number'] ?? ''));

    if (!$mentorId && $currentMentorNumber !== '') {
        $stmt = $pdo->prepare('SELECT mentor_id FROM mentors WHERE mentor_number = ? LIMIT 1');
        $stmt->execute([$currentMentorNumber]);
        $mentorId = (int)$stmt->fetchColumn();
    }

    if (!$mentorId) {
        $mentorId = isset($data['mentor_id']) ? (int)$data['mentor_id'] : 0;
    }

    if (!$mentorId) {
        fail('Mentor ID is required.', 400);
    }

    $mentorNumber = trim((string)($data['mentor_number'] ?? $data['mentor_id_number'] ?? ''));
    $fullName = trim((string)($data['full_name'] ?? $data['name'] ?? ''));
    $contact = trim((string)($data['contact'] ?? ''));
    $email = trim((string)($data['email'] ?? ''));
    $phone = trim((string)($data['phone'] ?? ''));
    $courseCodesProvided = array_key_exists('course_codes', $data);
    $courseCodes = is_array($data['course_codes'] ?? null)
        ? array_values(array_filter(array_map('trim', $data['course_codes'])))
        : [];
    $scheduleProvided = array_key_exists('schedule', $data);
    $schedule = is_array($data['schedule'] ?? null) ? $data['schedule'] : [];

    if ($contact !== '' && $email === '' && $phone === '') {
        if (filter_var($contact, FILTER_VALIDATE_EMAIL)) {
            $email = $contact;
        } else {
            $phone = $contact;
        }
    }

    if ($mentorNumber === '' || $fullName === '') {
        fail('Mentor number and mentor name are required.');
    }

    $pdo->beginTransaction();

    try {
        $duplicate = $pdo->prepare('SELECT mentor_id FROM mentors WHERE mentor_number = ? AND mentor_id <> ? LIMIT 1');
        $duplicate->execute([$mentorNumber, $mentorId]);
        if ($duplicate->fetchColumn()) {
            throw new RuntimeException('Another mentor already uses that mentor number.');
        }

        $update = $pdo->prepare('
            UPDATE mentors
            SET mentor_number = ?,
                full_name = ?,
                email = ?,
                phone = ?,
                is_active = 1
            WHERE mentor_id = ?
        ');
        $update->execute([$mentorNumber, $fullName, $email ?: null, $phone ?: null, $mentorId]);

        if ($courseCodesProvided) {
            $pdo->prepare('DELETE FROM mentor_courses WHERE mentor_id = ?')->execute([$mentorId]);
            $userId = find_or_create_user($pdo, (string)($data['made_by'] ?? 'Front Desk Staff'));
            $assign = $pdo->prepare('INSERT IGNORE INTO mentor_courses (mentor_id, course_id, assigned_by_user_id) VALUES (?, ?, ?)');

            foreach ($courseCodes as $courseCode) {
                $courseId = resolve_course_id($pdo, $courseCode);
                $assign->execute([$mentorId, $courseId, $userId]);
            }
        }

        if ($scheduleProvided) {
            $pdo->prepare('DELETE FROM mentor_weekly_availability WHERE mentor_id = ?')->execute([$mentorId]);
            $availabilityInsert = $pdo->prepare('
                INSERT INTO mentor_weekly_availability (mentor_id, day_of_week, start_time, end_time, effective_from)
                VALUES (?, ?, ?, ?, CURDATE())
            ');

            foreach ($schedule as $block) {
                $day = (int)($block['day_of_week'] ?? 0);
                $start = trim((string)($block['start_time'] ?? ''));
                $end = trim((string)($block['end_time'] ?? ''));

                if ($day < 1 || $day > 7 || $start === '' || $end === '') {
                    continue;
                }

                $availabilityInsert->execute([$mentorId, $day, $start, $end]);
            }
        }

        $pdo->commit();
        ok(['mentor_id' => $mentorId, 'mentor_number' => $mentorNumber]);
    } catch (Throwable $error) {
        $pdo->rollBack();
        fail($error->getMessage(), 400);
    }
}

$mentorNumber = trim((string)($data['mentor_number'] ?? $data['mentor_id'] ?? ''));
$fullName = trim((string)($data['full_name'] ?? $data['name'] ?? ''));
$email = trim((string)($data['email'] ?? $data['contact'] ?? ''));
$phone = trim((string)($data['phone'] ?? ''));
$courseCodes = is_array($data['course_codes'] ?? null)
    ? array_values(array_filter(array_map('trim', $data['course_codes'])))
    : [];
$schedule = is_array($data['schedule'] ?? null) ? $data['schedule'] : [];

if ($mentorNumber === '' || $fullName === '') {
    fail('Mentor ID and mentor name are required.');
}

$pdo->beginTransaction();

try {
    $existing = $pdo->prepare('SELECT mentor_id FROM mentors WHERE mentor_number = ? LIMIT 1');
    $existing->execute([$mentorNumber]);
    $mentorId = $existing->fetchColumn();

    if ($mentorId) {
        $mentorId = (int)$mentorId;
        $pdo->prepare('UPDATE mentors SET full_name = ?, email = ?, phone = ?, is_active = 1 WHERE mentor_id = ?')
            ->execute([$fullName, $email ?: null, $phone ?: null, $mentorId]);
    } else {
        $pdo->prepare('INSERT INTO mentors (mentor_number, full_name, email, phone) VALUES (?, ?, ?, ?)')
            ->execute([$mentorNumber, $fullName, $email ?: null, $phone ?: null]);
        $mentorId = (int)$pdo->lastInsertId();
    }

    $pdo->prepare('DELETE FROM mentor_courses WHERE mentor_id = ?')->execute([$mentorId]);
    $userId = find_or_create_user($pdo, (string)($data['made_by'] ?? 'Front Desk Staff'));

    foreach ($courseCodes as $courseCode) {
        $courseId = resolve_course_id($pdo, $courseCode);
        $pdo->prepare('INSERT IGNORE INTO mentor_courses (mentor_id, course_id, assigned_by_user_id) VALUES (?, ?, ?)')
            ->execute([$mentorId, $courseId, $userId]);
    }

    $pdo->prepare('DELETE FROM mentor_weekly_availability WHERE mentor_id = ?')->execute([$mentorId]);
    $availabilityInsert = $pdo->prepare('
        INSERT INTO mentor_weekly_availability (mentor_id, day_of_week, start_time, end_time, effective_from)
        VALUES (?, ?, ?, ?, CURDATE())
    ');

    foreach ($schedule as $block) {
        $day = (int)($block['day_of_week'] ?? 0);
        $start = trim((string)($block['start_time'] ?? ''));
        $end = trim((string)($block['end_time'] ?? ''));

        if ($day < 1 || $day > 7 || $start === '' || $end === '') {
            continue;
        }

        $availabilityInsert->execute([$mentorId, $day, $start, $end]);
    }

    $pdo->commit();
    ok(['mentor_id' => $mentorId, 'mentor_number' => $mentorNumber]);
} catch (Throwable $error) {
    $pdo->rollBack();
    fail($error->getMessage(), 400);
}
