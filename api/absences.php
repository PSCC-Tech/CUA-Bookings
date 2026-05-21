<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET', 'POST']);

$pdo = db();
require_admin_user();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $stmt = $pdo->query("
        SELECT
            e.exception_id,
            e.exception_date,
            e.start_time,
            e.end_time,
            e.is_full_day,
            e.reason,
            m.mentor_number,
            m.full_name AS mentor_name,
            u.full_name AS made_by
        FROM mentor_schedule_exceptions e
        JOIN mentors m ON m.mentor_id = e.mentor_id
        LEFT JOIN users u ON u.user_id = e.created_by_user_id
        WHERE e.exception_type = 'unavailable'
        ORDER BY e.exception_date DESC, m.full_name
    ");

    ok(['absences' => $stmt->fetchAll()]);
}

$data = input_json();
$mentorId = resolve_mentor_id($pdo, $data);
$date = trim((string)($data['date'] ?? $data['absence_date'] ?? ''));
$type = trim((string)($data['unavailable_type'] ?? 'full-day'));
$isFullDay = $type !== 'specific-time';
$startTime = trim((string)($data['start_time'] ?? ''));
$endTime = trim((string)($data['end_time'] ?? ''));
$reason = trim((string)($data['reason'] ?? ''));
$createdBy = find_or_create_user($pdo, (string)($data['made_by'] ?? $data['madeBy'] ?? 'Front Desk Staff'));

if ($date === '' || !strtotime($date)) {
    fail('A valid absence date is required.');
}

if (!$isFullDay && ($startTime === '' || $endTime === '')) {
    fail('Start and end times are required for a specific-time absence.');
}

$startTimestamp = !$isFullDay ? strtotime($startTime) : false;
$endTimestamp = !$isFullDay ? strtotime($endTime) : false;

if (!$isFullDay && (!$startTimestamp || !$endTimestamp || $startTimestamp >= $endTimestamp)) {
    fail('Please select a valid start and end time for the absence.');
}

$stmt = $pdo->prepare('
    INSERT INTO mentor_schedule_exceptions (
        mentor_id, exception_date, start_time, end_time, is_full_day,
        exception_type, reason, created_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, "unavailable", ?, ?)
');

$stmt->execute([
    $mentorId,
    date('Y-m-d', strtotime($date)),
    $isFullDay ? null : date('H:i:s', $startTimestamp),
    $isFullDay ? null : date('H:i:s', $endTimestamp),
    $isFullDay ? 1 : 0,
    $reason ?: null,
    $createdBy,
]);

ok(['exception_id' => (int)$pdo->lastInsertId()]);
