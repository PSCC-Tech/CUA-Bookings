<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/mailer.php';

require_method(['GET', 'POST', 'PUT']);

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
require_role(['Administrator', 'Staff']);

function fetch_bookings(PDO $pdo): array
{
    $stmt = $pdo->query("
        SELECT
            b.booking_id,
            b.booking_type,
            b.booking_status,
            b.start_at,
            b.end_at,
            b.topics_notes,
            m.mentor_number,
            m.full_name AS mentor_name,
            vc.course_code,
            vc.course_name,
            vc.category_name,
            p.full_name AS professor_name,
            l.location_name,
            u.full_name AS made_by
        FROM bookings b
        JOIN mentors m ON m.mentor_id = b.mentor_id
        JOIN v_courses_with_categories vc ON vc.course_id = b.course_id
        LEFT JOIN professors p ON p.professor_id = b.professor_id
        JOIN locations l ON l.location_id = b.location_id
        JOIN users u ON u.user_id = b.made_by_user_id
        WHERE b.booking_status = 'active'
           OR (b.booking_status = 'scheduled' AND b.start_at >= NOW())
        ORDER BY b.start_at, b.booking_id
    ");

    $bookings = [];
    $bookingIds = [];

    foreach ($stmt->fetchAll() as $row) {
        $bookingId = (int)$row['booking_id'];
        $bookingIds[] = $bookingId;
        $startTimestamp = strtotime($row['start_at']);
        $endTimestamp = $row['end_at'] ? strtotime($row['end_at']) : strtotime($row['start_at'] . ' +30 minutes');

        $bookings[$bookingId] = [
            'id' => $bookingId,
            'booking_id' => $bookingId,
            'bookingType' => $row['booking_type'],
            'status' => $row['booking_status'],
            'active' => $row['booking_status'] === 'active',
            'date' => date('Y-m-d', $startTimestamp),
            'dateLabel' => format_date_label(date('Y-m-d', $startTimestamp)),
            'time' => date('g:i A', $startTimestamp),
            'endTime' => date('g:i A', $endTimestamp),
            'mentor' => $row['mentor_name'],
            'mentorNumber' => $row['mentor_number'],
            'course' => $row['course_code'] . ' - ' . $row['course_name'],
            'courseCode' => $row['course_code'],
            'category' => $row['category_name'],
            'location' => $row['location_name'],
            'topics' => $row['topics_notes'] ?? '',
            'professor' => $row['professor_name'] ?? '',
            'madeBy' => $row['made_by'],
            'students' => [],
            'sessionType' => 'Single',
            'groupSize' => 1,
            'studentId' => '',
            'name' => '',
            'email' => '',
            'phone' => '',
        ];
    }

    if (!$bookingIds) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($bookingIds), '?'));
    $studentStmt = $pdo->prepare("
        SELECT
            bs.booking_id,
            s.student_number,
            s.full_name,
            s.email,
            s.phone
        FROM booking_students bs
        JOIN students s ON s.student_id = bs.student_id
        WHERE bs.booking_id IN ($placeholders)
        ORDER BY bs.booking_id, bs.student_order
    ");
    $studentStmt->execute($bookingIds);

    foreach ($studentStmt->fetchAll() as $student) {
        $bookingId = (int)$student['booking_id'];
        $bookings[$bookingId]['students'][] = [
            'studentId' => $student['student_number'],
            'student_number' => $student['student_number'],
            'name' => $student['full_name'],
            'full_name' => $student['full_name'],
            'email' => $student['email'] ?? '',
            'phone' => $student['phone'] ?? '',
        ];
    }

    foreach ($bookings as &$booking) {
        if ($booking['students']) {
            $primary = $booking['students'][0];
            $booking['studentId'] = $primary['studentId'];
            $booking['name'] = $primary['name'];
            $booking['email'] = $primary['email'];
            $booking['phone'] = $primary['phone'];
            $booking['groupSize'] = count($booking['students']);
            $booking['sessionType'] = count($booking['students']) > 1 ? 'Grouped' : 'Single';
        }
    }
    unset($booking);

    return array_values($bookings);
}

function parse_start_at(array $data, bool $isWalkIn): string
{
    if ($isWalkIn) {
        return date('Y-m-d H:i:s');
    }

    $startAt = trim((string)($data['start_at'] ?? ''));
    if ($startAt !== '') {
        $timestamp = strtotime($startAt);
        if ($timestamp) {
            return date('Y-m-d H:i:s', $timestamp);
        }
    }

    $date = trim((string)($data['date'] ?? ''));
    $time = trim((string)($data['time'] ?? ''));
    $timestamp = strtotime($date . ' ' . $time);
    if (!$timestamp) {
        fail('A valid booking date and time is required.');
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function save_booking_students(PDO $pdo, int $bookingId, array $students): void
{
    if (!$students) {
        fail('At least one student is required.');
    }

    $pdo->prepare('DELETE FROM booking_students WHERE booking_id = ?')->execute([$bookingId]);
    $insert = $pdo->prepare('
        INSERT INTO booking_students (booking_id, student_id, student_order, is_primary)
        VALUES (?, ?, ?, ?)
    ');

    foreach ($students as $index => $student) {
        $studentId = find_or_create_student($pdo, $student);
        $insert->execute([$bookingId, $studentId, $index + 1, $index === 0 ? 1 : 0]);
    }
}

function assert_booking_can_be_edited(PDO $pdo, int $bookingId): void
{
    $stmt = $pdo->prepare('SELECT booking_status FROM bookings WHERE booking_id = ? FOR UPDATE');
    $stmt->execute([$bookingId]);
    $status = $stmt->fetchColumn();

    if (!$status) {
        throw new RuntimeException('Booking was not found.');
    }

    if ($status !== 'scheduled') {
        throw new RuntimeException('Only scheduled bookings can be edited.');
    }
}

function assert_booking_slot_is_available(PDO $pdo, int $mentorId, string $startAt, string $endAt, ?int $excludeBookingId = null): void
{
    $startTimestamp = strtotime($startAt);
    $endTimestamp = strtotime($endAt);

    if (!$startTimestamp || !$endTimestamp || $startTimestamp >= $endTimestamp) {
        throw new RuntimeException('A valid booking start and end time is required.');
    }

    $date = date('Y-m-d', $startTimestamp);
    if ($date !== date('Y-m-d', $endTimestamp)) {
        throw new RuntimeException('Bookings must start and end on the same day.');
    }

    $dayOfWeek = (int)date('N', $startTimestamp);
    $startTime = date('H:i:s', $startTimestamp);
    $endTime = date('H:i:s', $endTimestamp);

    $availability = $pdo->prepare('
        SELECT 1
        FROM mentor_weekly_availability
        WHERE mentor_id = ?
          AND day_of_week = ?
          AND is_active = 1
          AND start_time <= ?
          AND end_time >= ?
          AND (effective_from IS NULL OR effective_from <= ?)
          AND (effective_to IS NULL OR effective_to >= ?)
        LIMIT 1
    ');
    $availability->execute([$mentorId, $dayOfWeek, $startTime, $endTime, $date, $date]);

    if (!$availability->fetchColumn()) {
        throw new RuntimeException('Selected mentor is not available during that time.');
    }

    $absence = $pdo->prepare('
        SELECT 1
        FROM mentor_schedule_exceptions
        WHERE mentor_id = ?
          AND exception_type = "unavailable"
          AND exception_date = ?
          AND (
              is_full_day = 1
              OR (start_time < ? AND end_time > ?)
          )
        LIMIT 1
    ');
    $absence->execute([$mentorId, $date, $endTime, $startTime]);

    if ($absence->fetchColumn()) {
        throw new RuntimeException('Selected mentor has an absence during that time.');
    }

    $overlapSql = '
        SELECT booking_id
        FROM bookings
        WHERE mentor_id = ?
          AND booking_status IN ("scheduled", "active")
          AND start_at < ?
          AND COALESCE(end_at, DATE_ADD(start_at, INTERVAL 30 MINUTE)) > ?
    ';
    $params = [$mentorId, $endAt, $startAt];

    if ($excludeBookingId) {
        $overlapSql .= ' AND booking_id <> ?';
        $params[] = $excludeBookingId;
    }

    $overlapSql .= ' LIMIT 1 FOR UPDATE';
    $overlap = $pdo->prepare($overlapSql);
    $overlap->execute($params);

    if ($overlap->fetchColumn()) {
        throw new RuntimeException('Selected mentor already has a booking during that time.');
    }
}

if ($method === 'GET') {
    ok(['bookings' => fetch_bookings($pdo)]);
}

$data = input_json();
$bookingId = read_id();

if ($method === 'PUT') {
    if (!$bookingId) {
        $bookingId = isset($data['booking_id']) ? (int)$data['booking_id'] : 0;
    }
    if (!$bookingId) {
        fail('Booking ID is required.');
    }
}

$bookingType = ($data['booking_type'] ?? $data['bookingType'] ?? 'scheduled') === 'walk_in' || ($data['booking_type'] ?? $data['bookingType'] ?? '') === 'walk-in'
    ? 'walk_in'
    : 'scheduled';
$isWalkIn = $bookingType === 'walk_in';

$courseId = resolve_course_id($pdo, (string)($data['course_code'] ?? $data['courseCode'] ?? $data['course'] ?? ''));
$mentorId = resolve_mentor_id($pdo, $data);

if (!mentor_teaches_course($pdo, $mentorId, $courseId)) {
    fail('Selected mentor does not teach the selected course.');
}

$startAt = parse_start_at($data, $isWalkIn && $method === 'POST');

if (!$isWalkIn && strtotime($startAt) <= time()) {
    fail('Scheduled bookings must use a future date and time.');
}

$professorId = find_or_create_professor($pdo, (string)($data['professor_name'] ?? $data['professor'] ?? ''));
$locationId = find_or_create_location($pdo, (string)($data['location_name'] ?? $data['location'] ?? ''));
$madeById = find_or_create_user($pdo, (string)($data['made_by'] ?? $data['madeBy'] ?? 'Front Desk Staff'));
$durationMinutes = max(15, min(180, (int)($data['duration_minutes'] ?? 30)));
$endAt = date('Y-m-d H:i:s', strtotime($startAt . " +$durationMinutes minutes"));
$students = is_array($data['students'] ?? null) ? $data['students'] : [];
$topics = trim((string)($data['topics_notes'] ?? $data['topics'] ?? ''));

$pdo->beginTransaction();

try {
    if ($method === 'PUT') {
        assert_booking_can_be_edited($pdo, $bookingId);
    }

    assert_booking_slot_is_available($pdo, $mentorId, $startAt, $endAt, $method === 'PUT' ? $bookingId : null);

    if ($method === 'POST') {
        $status = $isWalkIn ? 'active' : 'scheduled';
        $stmt = $pdo->prepare('
            INSERT INTO bookings (
                booking_type, booking_status, mentor_id, course_id, professor_id,
                location_id, start_at, end_at, topics_notes, made_by_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $bookingType,
            $status,
            $mentorId,
            $courseId,
            $professorId,
            $locationId,
            $startAt,
            $endAt,
            $topics ?: null,
            $madeById,
        ]);
        $bookingId = (int)$pdo->lastInsertId();

        if ($isWalkIn) {
            $session = $pdo->prepare('
                INSERT INTO mentorship_sessions (booking_id, session_status, started_at, started_by_user_id)
                VALUES (?, "active", ?, ?)
            ');
            $session->execute([$bookingId, $startAt, $madeById]);
        }
    } else {
        $stmt = $pdo->prepare('
            UPDATE bookings
            SET mentor_id = ?,
                course_id = ?,
                professor_id = ?,
                location_id = ?,
                start_at = ?,
                end_at = ?,
                topics_notes = ?,
                made_by_user_id = ?
            WHERE booking_id = ?
        ');
        $stmt->execute([
            $mentorId,
            $courseId,
            $professorId,
            $locationId,
            $startAt,
            $endAt,
            $topics ?: null,
            $madeById,
            $bookingId,
        ]);
    }

    save_booking_students($pdo, $bookingId, $students);

    $pdo->commit();

    $notifications = null;
    if ($method === 'POST') {
        try {
            $notifications = send_booking_email_notifications($pdo, $bookingId);
        } catch (Throwable $notificationError) {
            $notifications = [
                'enabled' => true,
                'transport' => 'unknown',
                'sent' => [],
                'failed' => [[
                    'email' => '',
                    'name' => 'Email notifications',
                    'role' => 'system',
                    'error' => $notificationError->getMessage(),
                ]],
                'skipped' => [],
            ];
        }
    }

    ok([
        'booking_id' => $bookingId,
        'bookings' => fetch_bookings($pdo),
        'email_notifications' => $notifications,
    ]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fail($error->getMessage(), 400);
}
