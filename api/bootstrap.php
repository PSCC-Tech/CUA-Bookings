<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/La_Paz');

const DB_HOST = '127.0.0.1';
const DB_NAME = 'cua_bookings';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ok(array $payload = []): void
{
    json_response(['ok' => true] + $payload);
}

function fail(string $message, int $status = 400, array $details = []): void
{
    json_response(['ok' => false, 'error' => $message, 'details' => $details], $status);
}

function input_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail('Invalid JSON payload.', 400);
    }

    return $data;
}

function require_method(array $allowed): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $allowed, true)) {
        fail('Method not allowed.', 405, ['allowed' => $allowed]);
    }
}

function auth_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('CUA_BOOKINGS_SESSION');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function auth_user_payload(array $row): array
{
    return [
        'user_id' => (int)$row['user_id'],
        'fullName' => $row['full_name'],
        'full_name' => $row['full_name'],
        'email' => $row['email'],
        'role' => $row['role_name'],
    ];
}

function current_user(?PDO $pdo = null): ?array
{
    auth_session_start();

    $userId = (int)($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        return null;
    }

    $pdo = $pdo ?: db();
    $stmt = $pdo->prepare('
        SELECT u.user_id, u.full_name, u.email, r.role_name
        FROM users u
        JOIN roles r ON r.role_id = u.role_id
        WHERE u.user_id = ? AND u.status = "active"
        LIMIT 1
    ');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        $_SESSION = [];
        return null;
    }

    return auth_user_payload($user);
}

function auth_endpoint_is_public(): bool
{
    $scriptName = basename((string)($_SERVER['SCRIPT_NAME'] ?? ''));
    return in_array($scriptName, ['auth.php', 'logout.php'], true);
}

function require_authenticated_user(): array
{
    $user = current_user();
    if (!$user) {
        fail('Authentication required.', 401, ['redirect' => 'login.html']);
    }

    return $user;
}

function normalize_course_code(string $value): string
{
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim($value)) ?? '');
}

function parse_course_code(string $value): array
{
    $normalized = normalize_course_code($value);
    if (!preg_match('/^([A-Z]+)([0-9]+)([A-Z]*)$/', $normalized, $matches)) {
        fail('Course code must include a subject prefix and number, like MATH101.');
    }

    return [
        'normalized' => $normalized,
        'subject_code' => $matches[1],
        'course_number' => $matches[2],
        'course_suffix' => $matches[3] ?? '',
    ];
}

function course_display_code(array $course): string
{
    return ($course['course_code'] ?? '') ?: normalize_course_code(($course['subject_code'] ?? '') . ($course['course_number'] ?? '') . ($course['course_suffix'] ?? ''));
}

function format_time_12(?string $time): string
{
    if (!$time) {
        return '';
    }

    $timestamp = strtotime($time);
    return $timestamp ? date('g:i A', $timestamp) : $time;
}

function format_date_label(string $date): string
{
    $timestamp = strtotime($date);
    return $timestamp ? date('l, F j, Y', $timestamp) : $date;
}

function make_local_email(string $name, string $domain = 'cua.local'): string
{
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '.', $name) ?? '', '.'));
    if ($slug === '') {
        $slug = 'user';
    }

    return $slug . '+' . substr(sha1($name . microtime(true)), 0, 8) . '@' . $domain;
}

function find_or_create_user(PDO $pdo, ?string $fullName): int
{
    $name = trim((string)$fullName);
    if ($name === '') {
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = 'frontdesk@cua.local' LIMIT 1");
        $stmt->execute();
        $id = $stmt->fetchColumn();
        if ($id) {
            return (int)$id;
        }
        $name = 'Front Desk Staff';
    }

    $stmt = $pdo->prepare('SELECT user_id FROM users WHERE full_name = ? LIMIT 1');
    $stmt->execute([$name]);
    $existing = $stmt->fetchColumn();
    if ($existing) {
        return (int)$existing;
    }

    $roleStmt = $pdo->prepare("SELECT role_id FROM roles WHERE role_name = 'Staff' LIMIT 1");
    $roleStmt->execute();
    $roleId = (int)$roleStmt->fetchColumn();

    $insert = $pdo->prepare('INSERT INTO users (role_id, full_name, email) VALUES (?, ?, ?)');
    $insert->execute([$roleId, $name, make_local_email($name)]);
    return (int)$pdo->lastInsertId();
}

function find_or_create_professor(PDO $pdo, ?string $fullName): ?int
{
    $name = trim((string)$fullName);
    if ($name === '') {
        return null;
    }

    $stmt = $pdo->prepare('SELECT professor_id FROM professors WHERE full_name = ? LIMIT 1');
    $stmt->execute([$name]);
    $existing = $stmt->fetchColumn();
    if ($existing) {
        return (int)$existing;
    }

    $insert = $pdo->prepare('INSERT INTO professors (full_name) VALUES (?)');
    $insert->execute([$name]);
    return (int)$pdo->lastInsertId();
}

function find_or_create_location(PDO $pdo, string $locationName): int
{
    $name = trim($locationName);
    if ($name === '') {
        fail('Location is required.');
    }

    $stmt = $pdo->prepare('SELECT location_id FROM locations WHERE location_name = ? LIMIT 1');
    $stmt->execute([$name]);
    $existing = $stmt->fetchColumn();
    if ($existing) {
        return (int)$existing;
    }

    $type = stripos($name, 'online') !== false || stripos($name, 'teams') !== false ? 'online' : 'physical';
    $insert = $pdo->prepare('INSERT INTO locations (location_name, location_type) VALUES (?, ?)');
    $insert->execute([$name, $type]);
    return (int)$pdo->lastInsertId();
}

function resolve_course_id(PDO $pdo, string $courseCode): int
{
    $displayParts = preg_split('/\s+-\s+/', $courseCode, 2);
    $normalized = normalize_course_code($displayParts[0] ?? $courseCode);
    $stmt = $pdo->prepare('SELECT course_id FROM v_courses_with_categories WHERE course_code = ? LIMIT 1');
    $stmt->execute([$normalized]);
    $id = $stmt->fetchColumn();
    if (!$id) {
        fail('Course was not found.', 404, ['course_code' => $courseCode]);
    }

    return (int)$id;
}

function resolve_mentor_id(PDO $pdo, array $data): int
{
    $mentorNumber = trim((string)($data['mentor_number'] ?? ''));
    $mentorName = trim((string)($data['mentor_name'] ?? $data['mentor'] ?? ''));

    if ($mentorNumber !== '') {
        $stmt = $pdo->prepare('SELECT mentor_id FROM mentors WHERE mentor_number = ? LIMIT 1');
        $stmt->execute([$mentorNumber]);
    } else {
        $stmt = $pdo->prepare('SELECT mentor_id FROM mentors WHERE full_name = ? LIMIT 1');
        $stmt->execute([$mentorName]);
    }

    $id = $stmt->fetchColumn();
    if (!$id) {
        fail('Mentor was not found.', 404, ['mentor_number' => $mentorNumber, 'mentor_name' => $mentorName]);
    }

    return (int)$id;
}

function mentor_teaches_course(PDO $pdo, int $mentorId, int $courseId): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM mentor_courses WHERE mentor_id = ? AND course_id = ? AND is_active = 1 LIMIT 1');
    $stmt->execute([$mentorId, $courseId]);
    return (bool)$stmt->fetchColumn();
}

function find_or_create_student(PDO $pdo, array $student): int
{
    $studentNumber = trim((string)($student['student_number'] ?? $student['studentId'] ?? ''));
    $name = trim((string)($student['full_name'] ?? $student['name'] ?? ''));

    if ($studentNumber === '' || $name === '') {
        fail('Every student needs a student ID and name.');
    }

    $stmt = $pdo->prepare('SELECT student_id FROM students WHERE student_number = ? LIMIT 1');
    $stmt->execute([$studentNumber]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
        $update = $pdo->prepare('UPDATE students SET full_name = ?, email = ?, phone = ? WHERE student_id = ?');
        $update->execute([
            $name,
            trim((string)($student['email'] ?? '')) ?: null,
            trim((string)($student['phone'] ?? '')) ?: null,
            (int)$existing,
        ]);
        return (int)$existing;
    }

    $insert = $pdo->prepare('INSERT INTO students (student_number, full_name, email, phone) VALUES (?, ?, ?, ?)');
    $insert->execute([
        $studentNumber,
        $name,
        trim((string)($student['email'] ?? '')) ?: null,
        trim((string)($student['phone'] ?? '')) ?: null,
    ]);

    return (int)$pdo->lastInsertId();
}

function split_csv_names(string $value): array
{
    return array_values(array_filter(array_map(static fn($item) => trim($item), explode(',', $value))));
}

function read_id(): ?int
{
    if (isset($_GET['id']) && ctype_digit((string)$_GET['id'])) {
        return (int)$_GET['id'];
    }

    return null;
}

if (PHP_SAPI !== 'cli' && !auth_endpoint_is_public()) {
    require_authenticated_user();
}
