<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET']);

$pdo = db();
ensure_booking_group_size_column($pdo);

$mentorsStmt = $pdo->query("
    SELECT
        m.mentor_id,
        m.mentor_number,
        m.full_name,
        GROUP_CONCAT(DISTINCT cat.category_name ORDER BY cat.category_name SEPARATOR ', ') AS categories
    FROM mentors m
    LEFT JOIN mentor_courses mc ON mc.mentor_id = m.mentor_id AND mc.is_active = 1
    LEFT JOIN v_courses_with_categories vc ON vc.course_id = mc.course_id
    LEFT JOIN categories cat ON cat.category_id = vc.category_id
    WHERE m.is_active = 1
    GROUP BY m.mentor_id, m.mentor_number, m.full_name
    ORDER BY m.full_name
");

$mentors = [];
$dayNames = [
    1 => 'Monday',
    2 => 'Tuesday',
    3 => 'Wednesday',
    4 => 'Thursday',
    5 => 'Friday',
    6 => 'Saturday',
    7 => 'Sunday',
];

foreach ($mentorsStmt->fetchAll() as $row) {
    $mentors[(int)$row['mentor_id']] = [
        'id' => format_person_identifier($row['mentor_number']),
        'mentor_id' => (int)$row['mentor_id'],
        'mentor_number' => format_person_identifier($row['mentor_number']),
        'name' => $row['full_name'],
        'categories' => $row['categories'] ? split_csv_names($row['categories']) : [],
        'weeklyAvailability' => [],
        'bookings' => [],
        'absences' => [],
        'courseCodes' => [],
    ];
}

$availabilityStmt = $pdo->query("
    SELECT mentor_id, day_of_week, start_time, end_time, effective_from, effective_to
    FROM mentor_weekly_availability
    WHERE is_active = 1
    ORDER BY mentor_id, day_of_week, start_time
");

foreach ($availabilityStmt->fetchAll() as $row) {
    $mentorId = (int)$row['mentor_id'];
    if (!isset($mentors[$mentorId])) {
        continue;
    }

    $day = $dayNames[(int)$row['day_of_week']] ?? null;
    if (!$day) {
        continue;
    }

    $mentors[$mentorId]['weeklyAvailability'][$day][] = [
        'start' => format_time_12($row['start_time']),
        'end' => format_time_12($row['end_time']),
        'effectiveFrom' => $row['effective_from'] ?? '',
        'effectiveTo' => $row['effective_to'] ?? '',
    ];
}

$coursesStmt = $pdo->query("
    SELECT mc.mentor_id, vc.course_code
    FROM mentor_courses mc
    JOIN v_courses_with_categories vc ON vc.course_id = mc.course_id
    WHERE mc.is_active = 1
    ORDER BY mc.mentor_id, vc.course_code
");

foreach ($coursesStmt->fetchAll() as $row) {
    $mentorId = (int)$row['mentor_id'];
    if (isset($mentors[$mentorId])) {
        $mentors[$mentorId]['courseCodes'][] = format_course_code($row['course_code']);
    }
}

$bookingsStmt = $pdo->query("
    SELECT
        b.mentor_id,
        DATE(b.start_at) AS booking_date,
        TIME(b.start_at) AS start_time,
        TIME(COALESCE(b.end_at, DATE_ADD(b.start_at, INTERVAL 60 MINUTE))) AS end_time,
        vc.course_code,
        vc.course_name,
        l.location_name,
        GREATEST(b.group_size, COUNT(bs.student_id)) AS student_count,
        GROUP_CONCAT(s.full_name ORDER BY bs.student_order SEPARATOR ', ') AS students
    FROM bookings b
    JOIN v_courses_with_categories vc ON vc.course_id = b.course_id
    JOIN locations l ON l.location_id = b.location_id
    LEFT JOIN booking_students bs ON bs.booking_id = b.booking_id
    LEFT JOIN students s ON s.student_id = bs.student_id
    WHERE b.booking_status IN ('scheduled', 'active')
    GROUP BY b.booking_id, b.mentor_id, b.group_size, b.start_at, b.end_at, vc.course_code, vc.course_name, l.location_name
    ORDER BY b.start_at
");

foreach ($bookingsStmt->fetchAll() as $row) {
    $mentorId = (int)$row['mentor_id'];
    if (!isset($mentors[$mentorId])) {
        continue;
    }

    $studentNames = split_csv_names((string)($row['students'] ?? ''));
    $studentLabel = $studentNames[0] ?? 'No students';
    if ((int)$row['student_count'] > 1) {
        $studentLabel .= ' +' . ((int)$row['student_count'] - 1);
    }

    $mentors[$mentorId]['bookings'][] = [
        'date' => $row['booking_date'],
        'start' => format_time_12($row['start_time']),
        'end' => format_time_12($row['end_time']),
        'student' => $studentLabel,
        'course' => format_course_code($row['course_code']) . ' - ' . $row['course_name'],
        'location' => $row['location_name'],
    ];
}

$exceptionsStmt = $pdo->query("
    SELECT mentor_id, exception_date, start_time, end_time, is_full_day, reason
    FROM mentor_schedule_exceptions
    WHERE exception_type = 'unavailable'
    ORDER BY exception_date, start_time
");

foreach ($exceptionsStmt->fetchAll() as $row) {
    $mentorId = (int)$row['mentor_id'];
    if (!isset($mentors[$mentorId])) {
        continue;
    }

    $mentors[$mentorId]['absences'][] = [
        'date' => $row['exception_date'],
        'start' => (int)$row['is_full_day'] === 1 ? 'All day' : format_time_12($row['start_time']),
        'end' => (int)$row['is_full_day'] === 1 ? '' : format_time_12($row['end_time']),
        'reason' => $row['reason'] ?: 'Unavailable',
    ];
}

ok(['mentors' => array_values($mentors)]);
