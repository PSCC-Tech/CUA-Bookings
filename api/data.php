<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET']);

$pdo = db();
require_admin_user();

function data_param(string $key, string $default = ''): string
{
    return trim((string)($_GET[$key] ?? $default));
}

function data_like(string $value): string
{
    return '%' . $value . '%';
}

function data_date_param(string $key): string
{
    $value = data_param($key);
    if ($value === '') {
        return '';
    }

    $timestamp = strtotime($value);
    return $timestamp ? date('Y-m-d', $timestamp) : '';
}

function data_columns(array $pairs): array
{
    return array_map(static fn(array $pair): array => [
        'key' => $pair[0],
        'label' => $pair[1],
    ], $pairs);
}

function data_format_datetime(?string $value): string
{
    if (!$value) {
        return '';
    }

    $timestamp = strtotime($value);
    return $timestamp ? date('Y-m-d g:i A', $timestamp) : $value;
}

function data_yes_no(int|string|null $value): string
{
    return (int)$value === 1 ? 'Yes' : 'No';
}

function data_fetch_bookings(PDO $pdo): array
{
    $columns = data_columns([
        ['date', 'Date'],
        ['start_time', 'Start Time'],
        ['end_time', 'End Time'],
        ['status', 'Status'],
        ['booking_type', 'Booking Type'],
        ['mentor_number', 'Mentor ID'],
        ['mentor_name', 'Mentor'],
        ['course_code', 'Course Code'],
        ['course_name', 'Course'],
        ['category', 'Category'],
        ['student_numbers', 'Student IDs'],
        ['student_names', 'Students'],
        ['student_count', 'Student Count'],
        ['professor', 'Professor'],
        ['location', 'Location'],
        ['topics', 'Topics'],
        ['made_by', 'Made By'],
        ['created_at', 'Created At'],
        ['cancelled_at', 'Cancelled At'],
        ['cancellation_reason', 'Cancellation Reason'],
    ]);

    $sql = "
        SELECT
            b.booking_id,
            b.booking_type,
            b.booking_status,
            b.start_at,
            b.end_at,
            b.topics_notes,
            b.created_at,
            b.cancelled_at,
            b.cancellation_reason,
            m.mentor_number,
            m.full_name AS mentor_name,
            vc.course_code,
            vc.course_name,
            vc.category_name,
            p.full_name AS professor_name,
            l.location_name,
            u.full_name AS made_by,
            COUNT(DISTINCT bs.student_id) AS student_count,
            GROUP_CONCAT(DISTINCT s.student_number ORDER BY bs.student_order SEPARATOR ', ') AS student_numbers,
            GROUP_CONCAT(DISTINCT s.full_name ORDER BY bs.student_order SEPARATOR ', ') AS student_names
        FROM bookings b
        JOIN mentors m ON m.mentor_id = b.mentor_id
        JOIN v_courses_with_categories vc ON vc.course_id = b.course_id
        LEFT JOIN professors p ON p.professor_id = b.professor_id
        JOIN locations l ON l.location_id = b.location_id
        JOIN users u ON u.user_id = b.made_by_user_id
        LEFT JOIN booking_students bs ON bs.booking_id = b.booking_id
        LEFT JOIN students s ON s.student_id = bs.student_id
        WHERE 1 = 1
    ";

    $params = [];
    $dateFrom = data_date_param('date_from');
    $dateTo = data_date_param('date_to');
    $status = data_param('status');
    $bookingType = data_param('booking_type');
    $category = data_param('category');
    $mentor = data_param('mentor');
    $courseValues = course_code_lookup_values(data_param('course'));
    $student = data_param('student');
    $professor = data_param('professor');
    $location = data_param('location');
    $madeBy = data_param('made_by');
    $query = data_param('q');

    if ($dateFrom !== '') {
        $sql .= ' AND DATE(b.start_at) >= ?';
        $params[] = $dateFrom;
    }

    if ($dateTo !== '') {
        $sql .= ' AND DATE(b.start_at) <= ?';
        $params[] = $dateTo;
    }

    if ($status !== '' && strtolower($status) !== 'all') {
        $sql .= ' AND b.booking_status = ?';
        $params[] = $status;
    }

    if ($bookingType !== '' && strtolower($bookingType) !== 'all') {
        $sql .= ' AND b.booking_type = ?';
        $params[] = str_replace('-', '_', $bookingType);
    }

    if ($category !== '' && strtolower($category) !== 'all') {
        $sql .= ' AND vc.category_name = ?';
        $params[] = $category;
    }

    if ($mentor !== '' && strtolower($mentor) !== 'all') {
        $mentorValues = [];
        try {
            $mentorValues = person_identifier_lookup_values($mentor, 'Mentor ID');
        } catch (Throwable $error) {
            $mentorValues = [];
        }
        $sql .= ' AND (m.full_name = ?' . ($mentorValues ? ' OR m.mentor_number IN (' . implode(',', array_fill(0, count($mentorValues), '?')) . ')' : '') . ')';
        array_push($params, $mentor, ...$mentorValues);
    }

    if ($courseValues) {
        $sql .= ' AND vc.course_code IN (' . implode(',', array_fill(0, count($courseValues), '?')) . ')';
        array_push($params, ...$courseValues);
    }

    if ($professor !== '' && strtolower($professor) !== 'all') {
        $sql .= ' AND p.full_name = ?';
        $params[] = $professor;
    }

    if ($location !== '' && strtolower($location) !== 'all') {
        $sql .= ' AND l.location_name = ?';
        $params[] = $location;
    }

    if ($madeBy !== '' && strtolower($madeBy) !== 'all') {
        $sql .= ' AND u.full_name = ?';
        $params[] = $madeBy;
    }

    if ($student !== '') {
        $sql .= ' AND EXISTS (
            SELECT 1
            FROM booking_students bs_filter
            JOIN students s_filter ON s_filter.student_id = bs_filter.student_id
            WHERE bs_filter.booking_id = b.booking_id
              AND (s_filter.student_number LIKE ? OR s_filter.full_name LIKE ? OR s_filter.email LIKE ?)
        )';
        $like = data_like($student);
        array_push($params, $like, $like, $like);
    }

    if ($query !== '') {
        $like = data_like($query);
        $sql .= ' AND (
            CAST(b.booking_id AS CHAR) LIKE ?
            OR m.mentor_number LIKE ?
            OR m.full_name LIKE ?
            OR vc.course_code LIKE ?
            OR vc.course_name LIKE ?
            OR vc.category_name LIKE ?
            OR p.full_name LIKE ?
            OR l.location_name LIKE ?
            OR u.full_name LIKE ?
            OR EXISTS (
                SELECT 1
                FROM booking_students bs_q
                JOIN students s_q ON s_q.student_id = bs_q.student_id
                WHERE bs_q.booking_id = b.booking_id
                  AND (s_q.student_number LIKE ? OR s_q.full_name LIKE ? OR s_q.email LIKE ?)
            )
        )';
        array_push($params, $like, $like, $like, $like, $like, $like, $like, $like, $like, $like, $like, $like);
    }

    $sql .= '
        GROUP BY
            b.booking_id,
            b.booking_type,
            b.booking_status,
            b.start_at,
            b.end_at,
            b.topics_notes,
            b.created_at,
            b.cancelled_at,
            b.cancellation_reason,
            m.mentor_number,
            m.full_name,
            vc.course_code,
            vc.course_name,
            vc.category_name,
            p.full_name,
            l.location_name,
            u.full_name
        ORDER BY b.start_at DESC, b.booking_id DESC
        LIMIT 5000
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $rows = array_map(static function (array $row): array {
        $start = strtotime($row['start_at']);
        $end = $row['end_at'] ? strtotime($row['end_at']) : ($start ? strtotime($row['start_at'] . ' +60 minutes') : null);

        return [
            'date' => $start ? date('Y-m-d', $start) : '',
            'start_time' => $start ? date('g:i A', $start) : '',
            'end_time' => $end ? date('g:i A', $end) : '',
            'status' => $row['booking_status'],
            'booking_type' => str_replace('_', '-', $row['booking_type']),
            'mentor_number' => format_person_identifier($row['mentor_number']),
            'mentor_name' => $row['mentor_name'],
            'course_code' => format_course_code($row['course_code']),
            'course_name' => $row['course_name'],
            'category' => $row['category_name'],
            'student_numbers' => $row['student_numbers'] ? implode(', ', array_map('format_person_identifier', split_csv_names($row['student_numbers']))) : '',
            'student_names' => $row['student_names'] ?? '',
            'student_count' => (int)$row['student_count'],
            'professor' => $row['professor_name'] ?? '',
            'location' => $row['location_name'],
            'topics' => $row['topics_notes'] ?? '',
            'made_by' => $row['made_by'],
            'created_at' => data_format_datetime($row['created_at'] ?? ''),
            'cancelled_at' => data_format_datetime($row['cancelled_at'] ?? ''),
            'cancellation_reason' => $row['cancellation_reason'] ?? '',
        ];
    }, $stmt->fetchAll());

    return ['columns' => $columns, 'rows' => $rows];
}

function data_fetch_mentors(PDO $pdo): array
{
    $columns = data_columns([
        ['mentor_number', 'Mentor ID'],
        ['mentor_name', 'Mentor'],
        ['email', 'Email'],
        ['phone', 'Phone'],
        ['active', 'Active'],
        ['categories', 'Categories'],
        ['course_codes', 'Course Codes'],
        ['courses', 'Courses'],
        ['weekly_schedule', 'Weekly Schedule'],
        ['created_at', 'Created At'],
    ]);

    $sql = "
        SELECT
            m.mentor_id,
            m.mentor_number,
            m.full_name,
            m.email,
            m.phone,
            m.is_active,
            m.created_at,
            GROUP_CONCAT(DISTINCT vc.category_name ORDER BY vc.category_name SEPARATOR ', ') AS categories,
            GROUP_CONCAT(DISTINCT vc.course_code ORDER BY vc.course_code SEPARATOR ', ') AS course_codes,
            GROUP_CONCAT(DISTINCT CONCAT(vc.course_code, ' - ', vc.course_name) ORDER BY vc.course_code SEPARATOR '; ') AS courses,
            GROUP_CONCAT(
                DISTINCT CONCAT(
                    CASE mwa.day_of_week
                        WHEN 1 THEN 'Monday'
                        WHEN 2 THEN 'Tuesday'
                        WHEN 3 THEN 'Wednesday'
                        WHEN 4 THEN 'Thursday'
                        WHEN 5 THEN 'Friday'
                        WHEN 6 THEN 'Saturday'
                        WHEN 7 THEN 'Sunday'
                    END,
                    ' ',
                    TIME_FORMAT(mwa.start_time, '%l:%i %p'),
                    ' - ',
                    TIME_FORMAT(mwa.end_time, '%l:%i %p')
                )
                ORDER BY mwa.day_of_week, mwa.start_time
                SEPARATOR '; '
            ) AS weekly_schedule
        FROM mentors m
        LEFT JOIN mentor_courses mc ON mc.mentor_id = m.mentor_id AND mc.is_active = 1
        LEFT JOIN v_courses_with_categories vc ON vc.course_id = mc.course_id
        LEFT JOIN mentor_weekly_availability mwa ON mwa.mentor_id = m.mentor_id AND mwa.is_active = 1
        WHERE 1 = 1
    ";

    $params = [];
    $query = data_param('q');
    $category = data_param('category');
    $courseValues = course_code_lookup_values(data_param('course'));
    $active = data_param('active');

    if ($active !== '' && strtolower($active) !== 'all') {
        $sql .= ' AND m.is_active = ?';
        $params[] = $active === '1' || strtolower($active) === 'active' ? 1 : 0;
    }

    if ($category !== '' && strtolower($category) !== 'all') {
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

    if ($courseValues) {
        $sql .= ' AND EXISTS (
            SELECT 1
            FROM mentor_courses mc_course
            JOIN v_courses_with_categories vc_course ON vc_course.course_id = mc_course.course_id
            WHERE mc_course.mentor_id = m.mentor_id
              AND mc_course.is_active = 1
              AND vc_course.course_code IN (' . implode(',', array_fill(0, count($courseValues), '?')) . ')
        )';
        array_push($params, ...$courseValues);
    }

    if ($query !== '') {
        $like = data_like($query);
        $sql .= ' AND (m.mentor_number LIKE ? OR m.full_name LIKE ? OR m.email LIKE ? OR m.phone LIKE ?)';
        array_push($params, $like, $like, $like, $like);
    }

    $sql .= '
        GROUP BY m.mentor_id, m.mentor_number, m.full_name, m.email, m.phone, m.is_active, m.created_at
        ORDER BY m.full_name
        LIMIT 5000
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $rows = array_map(static fn(array $row): array => [
        'mentor_number' => format_person_identifier($row['mentor_number']),
        'mentor_name' => $row['full_name'],
        'email' => $row['email'] ?? '',
        'phone' => $row['phone'] ?? '',
        'active' => data_yes_no($row['is_active']),
        'categories' => $row['categories'] ?? '',
        'course_codes' => $row['course_codes'] ? implode(', ', array_map('format_course_code', split_csv_names($row['course_codes']))) : '',
        'courses' => $row['courses'] ? preg_replace_callback('/\\b[A-Z]{2,4}\\d{1,4}\\b/', static fn(array $match): string => format_course_code($match[0]), $row['courses']) : '',
        'weekly_schedule' => $row['weekly_schedule'] ?? '',
        'created_at' => data_format_datetime($row['created_at'] ?? ''),
    ], $stmt->fetchAll());

    return ['columns' => $columns, 'rows' => $rows];
}

function data_fetch_courses(PDO $pdo): array
{
    $columns = data_columns([
        ['course_code', 'Course Code'],
        ['course_name', 'Course'],
        ['category', 'Category'],
        ['subject', 'Subject'],
        ['active', 'Active'],
        ['professors', 'Professors'],
        ['mentors', 'Mentors'],
        ['topics', 'Topics'],
        ['description', 'Description'],
    ]);

    $sql = "
        SELECT
            vc.course_id,
            vc.course_code,
            vc.course_name,
            vc.category_name,
            vc.subject_name,
            vc.is_active,
            vc.description,
            GROUP_CONCAT(DISTINCT p.full_name ORDER BY p.full_name SEPARATOR ', ') AS professors,
            GROUP_CONCAT(DISTINCT m.full_name ORDER BY m.full_name SEPARATOR ', ') AS mentors,
            GROUP_CONCAT(DISTINCT ct.topic_name ORDER BY ct.sort_order, ct.topic_name SEPARATOR ', ') AS topics
        FROM v_courses_with_categories vc
        LEFT JOIN course_professors cp ON cp.course_id = vc.course_id
        LEFT JOIN professors p ON p.professor_id = cp.professor_id
        LEFT JOIN mentor_courses mc ON mc.course_id = vc.course_id AND mc.is_active = 1
        LEFT JOIN mentors m ON m.mentor_id = mc.mentor_id
        LEFT JOIN course_topics ct ON ct.course_id = vc.course_id
        WHERE 1 = 1
    ";

    $params = [];
    $query = data_param('q');
    $category = data_param('category');
    $mentor = data_param('mentor');
    $professor = data_param('professor');
    $active = data_param('active');

    if ($active !== '' && strtolower($active) !== 'all') {
        $sql .= ' AND vc.is_active = ?';
        $params[] = $active === '1' || strtolower($active) === 'active' ? 1 : 0;
    }

    if ($category !== '' && strtolower($category) !== 'all') {
        $sql .= ' AND vc.category_name = ?';
        $params[] = $category;
    }

    if ($mentor !== '' && strtolower($mentor) !== 'all') {
        $sql .= ' AND EXISTS (
            SELECT 1
            FROM mentor_courses mc_filter
            JOIN mentors m_filter ON m_filter.mentor_id = mc_filter.mentor_id
            WHERE mc_filter.course_id = vc.course_id
              AND mc_filter.is_active = 1
              AND (m_filter.mentor_number = ? OR m_filter.full_name = ?)
        )';
        array_push($params, $mentor, $mentor);
    }

    if ($professor !== '' && strtolower($professor) !== 'all') {
        $sql .= ' AND EXISTS (
            SELECT 1
            FROM course_professors cp_filter
            JOIN professors p_filter ON p_filter.professor_id = cp_filter.professor_id
            WHERE cp_filter.course_id = vc.course_id
              AND p_filter.full_name = ?
        )';
        $params[] = $professor;
    }

    if ($query !== '') {
        $like = data_like($query);
        $sql .= ' AND (vc.course_code LIKE ? OR vc.course_name LIKE ? OR vc.category_name LIKE ? OR vc.subject_name LIKE ? OR vc.description LIKE ?)';
        array_push($params, $like, $like, $like, $like, $like);
    }

    $sql .= '
        GROUP BY vc.course_id, vc.course_code, vc.course_name, vc.category_name, vc.subject_name, vc.is_active, vc.description
        ORDER BY vc.category_name, vc.course_code
        LIMIT 5000
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $rows = array_map(static fn(array $row): array => [
        'course_code' => format_course_code($row['course_code']),
        'course_name' => $row['course_name'],
        'category' => $row['category_name'],
        'subject' => $row['subject_name'],
        'active' => data_yes_no($row['is_active']),
        'professors' => $row['professors'] ?? '',
        'mentors' => $row['mentors'] ?? '',
        'topics' => $row['topics'] ?? '',
        'description' => $row['description'] ?? '',
    ], $stmt->fetchAll());

    return ['columns' => $columns, 'rows' => $rows];
}

function data_fetch_students(PDO $pdo): array
{
    $columns = data_columns([
        ['student_number', 'Student ID'],
        ['student_name', 'Student'],
        ['email', 'Email'],
        ['phone', 'Phone'],
        ['total_bookings', 'Total Bookings'],
        ['last_booking_at', 'Last Booking'],
        ['courses', 'Courses'],
        ['mentors', 'Mentors'],
    ]);

    $sql = "
        SELECT
            s.student_id,
            s.student_number,
            s.full_name,
            s.email,
            s.phone,
            COUNT(DISTINCT b.booking_id) AS total_bookings,
            MAX(b.start_at) AS last_booking_at,
            GROUP_CONCAT(DISTINCT vc.course_code ORDER BY vc.course_code SEPARATOR ', ') AS courses,
            GROUP_CONCAT(DISTINCT m.full_name ORDER BY m.full_name SEPARATOR ', ') AS mentors
        FROM students s
        LEFT JOIN booking_students bs ON bs.student_id = s.student_id
        LEFT JOIN bookings b ON b.booking_id = bs.booking_id
        LEFT JOIN mentors m ON m.mentor_id = b.mentor_id
        LEFT JOIN v_courses_with_categories vc ON vc.course_id = b.course_id
        WHERE 1 = 1
    ";

    $params = [];
    $query = data_param('q');
    $dateFrom = data_date_param('date_from');
    $dateTo = data_date_param('date_to');
    $mentor = data_param('mentor');
    $courseValues = course_code_lookup_values(data_param('course'));

    if ($dateFrom !== '') {
        $sql .= ' AND DATE(b.start_at) >= ?';
        $params[] = $dateFrom;
    }

    if ($dateTo !== '') {
        $sql .= ' AND DATE(b.start_at) <= ?';
        $params[] = $dateTo;
    }

    if ($mentor !== '' && strtolower($mentor) !== 'all') {
        $mentorValues = [];
        try {
            $mentorValues = person_identifier_lookup_values($mentor, 'Mentor ID');
        } catch (Throwable $error) {
            $mentorValues = [];
        }
        $sql .= ' AND (m.full_name = ?' . ($mentorValues ? ' OR m.mentor_number IN (' . implode(',', array_fill(0, count($mentorValues), '?')) . ')' : '') . ')';
        array_push($params, $mentor, ...$mentorValues);
    }

    if ($courseValues) {
        $sql .= ' AND vc.course_code IN (' . implode(',', array_fill(0, count($courseValues), '?')) . ')';
        array_push($params, ...$courseValues);
    }

    if ($query !== '') {
        $like = data_like($query);
        $sql .= ' AND (s.student_number LIKE ? OR s.full_name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)';
        array_push($params, $like, $like, $like, $like);
    }

    $sql .= '
        GROUP BY s.student_id, s.student_number, s.full_name, s.email, s.phone
        ORDER BY s.student_number
        LIMIT 5000
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $rows = array_map(static fn(array $row): array => [
        'student_number' => format_person_identifier($row['student_number']),
        'student_name' => $row['full_name'],
        'email' => $row['email'] ?? '',
        'phone' => $row['phone'] ?? '',
        'total_bookings' => (int)$row['total_bookings'],
        'last_booking_at' => data_format_datetime($row['last_booking_at'] ?? ''),
        'courses' => $row['courses'] ? implode(', ', array_map('format_course_code', split_csv_names($row['courses']))) : '',
        'mentors' => $row['mentors'] ?? '',
    ], $stmt->fetchAll());

    return ['columns' => $columns, 'rows' => $rows];
}

function data_fetch_absences(PDO $pdo): array
{
    $columns = data_columns([
        ['date', 'Date'],
        ['mentor_number', 'Mentor ID'],
        ['mentor_name', 'Mentor'],
        ['absence_type', 'Absence Type'],
        ['start_time', 'Start Time'],
        ['end_time', 'End Time'],
        ['reason', 'Reason'],
        ['made_by', 'Made By'],
        ['created_at', 'Created At'],
    ]);

    $sql = "
        SELECT
            e.exception_id,
            e.exception_date,
            e.start_time,
            e.end_time,
            e.is_full_day,
            e.reason,
            e.created_at,
            m.mentor_number,
            m.full_name AS mentor_name,
            u.full_name AS made_by
        FROM mentor_schedule_exceptions e
        JOIN mentors m ON m.mentor_id = e.mentor_id
        LEFT JOIN users u ON u.user_id = e.created_by_user_id
        WHERE e.exception_type = 'unavailable'
    ";

    $params = [];
    $dateFrom = data_date_param('date_from');
    $dateTo = data_date_param('date_to');
    $mentor = data_param('mentor');
    $query = data_param('q');

    if ($dateFrom !== '') {
        $sql .= ' AND e.exception_date >= ?';
        $params[] = $dateFrom;
    }

    if ($dateTo !== '') {
        $sql .= ' AND e.exception_date <= ?';
        $params[] = $dateTo;
    }

    if ($mentor !== '' && strtolower($mentor) !== 'all') {
        $mentorValues = [];
        try {
            $mentorValues = person_identifier_lookup_values($mentor, 'Mentor ID');
        } catch (Throwable $error) {
            $mentorValues = [];
        }
        $sql .= ' AND (m.full_name = ?' . ($mentorValues ? ' OR m.mentor_number IN (' . implode(',', array_fill(0, count($mentorValues), '?')) . ')' : '') . ')';
        array_push($params, $mentor, ...$mentorValues);
    }

    if ($query !== '') {
        $like = data_like($query);
        $sql .= ' AND (m.mentor_number LIKE ? OR m.full_name LIKE ? OR e.reason LIKE ? OR u.full_name LIKE ?)';
        array_push($params, $like, $like, $like, $like);
    }

    $sql .= ' ORDER BY e.exception_date DESC, m.full_name LIMIT 5000';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $rows = array_map(static fn(array $row): array => [
        'date' => $row['exception_date'],
        'mentor_number' => format_person_identifier($row['mentor_number']),
        'mentor_name' => $row['mentor_name'],
        'absence_type' => (int)$row['is_full_day'] === 1 ? 'Full day' : 'Specific time',
        'start_time' => (int)$row['is_full_day'] === 1 ? 'All day' : format_time_12($row['start_time']),
        'end_time' => (int)$row['is_full_day'] === 1 ? '' : format_time_12($row['end_time']),
        'reason' => $row['reason'] ?? '',
        'made_by' => $row['made_by'] ?? '',
        'created_at' => data_format_datetime($row['created_at'] ?? ''),
    ], $stmt->fetchAll());

    return ['columns' => $columns, 'rows' => $rows];
}

$report = strtolower(data_param('report', 'bookings'));
$allowedReports = ['bookings', 'mentors', 'courses', 'students', 'absences'];

if (!in_array($report, $allowedReports, true)) {
    fail('Unknown data report.', 400, ['allowed' => $allowedReports]);
}

$result = match ($report) {
    'mentors' => data_fetch_mentors($pdo),
    'courses' => data_fetch_courses($pdo),
    'students' => data_fetch_students($pdo),
    'absences' => data_fetch_absences($pdo),
    default => data_fetch_bookings($pdo),
};

ok([
    'report' => $report,
    'columns' => $result['columns'],
    'rows' => $result['rows'],
    'count' => count($result['rows']),
    'generated_at' => date('Y-m-d H:i:s'),
]);
