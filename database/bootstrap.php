<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Puerto_Rico');

set_exception_handler(static function (Throwable $error): void {
    error_log($error);

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }

    echo json_encode([
        'ok' => false,
        'error' => 'A server error occurred while processing the request.',
        'details' => [
            'message' => $error->getMessage(),
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
});

register_shutdown_function(static function (): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'] ?? 0, [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }

    error_log(sprintf(
        'Fatal PHP error: %s in %s on line %s',
        $error['message'] ?? 'Unknown fatal error',
        $error['file'] ?? 'unknown file',
        $error['line'] ?? 'unknown line'
    ));

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }

    echo json_encode([
        'ok' => false,
        'error' => 'A server error occurred while processing the request.',
        'details' => [
            'message' => $error['message'] ?? 'Unknown fatal error',
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
});

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

function require_role(array $allowedRoles): array
{
    $user = require_authenticated_user();
    if (!in_array((string)$user['role'], $allowedRoles, true)) {
        fail('You do not have permission to perform this action.', 403, ['allowed_roles' => $allowedRoles]);
    }

    return $user;
}

function require_admin_user(): array
{
    return require_role(['Administrator']);
}

function normalize_course_code(string $value): string
{
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim($value)) ?? '');
}

function course_code_lookup_values(string $value): array
{
    $normalized = normalize_course_code($value);
    $values = $normalized !== '' ? [$normalized] : [];

    if (preg_match('/^([A-Z]{4})0+([0-9]{1,3})$/', $normalized, $matches)) {
        $values[] = $matches[1] . $matches[2];
    }

    return array_values(array_unique($values));
}

function format_course_code(string $value): string
{
    $normalized = normalize_course_code($value);

    if (preg_match('/^([A-Z]{4})([0-9]{1,4})$/', $normalized, $matches)) {
        return $matches[1] . ' ' . str_pad($matches[2], 4, '0', STR_PAD_LEFT);
    }

    return $value;
}

function parse_course_code(string $value): array
{
    $normalized = normalize_course_code($value);
    if (!preg_match('/^([A-Z]{4})([0-9]{4})$/', $normalized, $matches)) {
        fail('Course code must use four letters, a space, and four numbers, like MATH 1500.');
    }

    return [
        'normalized' => $normalized,
        'subject_code' => $matches[1],
        'course_number' => $matches[2],
        'course_suffix' => '',
    ];
}

function course_display_code(array $course): string
{
    $code = ($course['course_code'] ?? '') ?: normalize_course_code(($course['subject_code'] ?? '') . ($course['course_number'] ?? '') . ($course['course_suffix'] ?? ''));
    return format_course_code($code);
}

function normalize_person_identifier(string $value, string $label): string
{
    $clean = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim($value)) ?? '');

    if (preg_match('/^([A-Z])00([0-9]{6})$/', $clean, $matches)) {
        return $matches[1] . '00' . $matches[2];
    }

    if (preg_match('/^([A-Z])([0-9]{1,6})$/', $clean, $matches)) {
        return $matches[1] . '00' . str_pad($matches[2], 6, '0', STR_PAD_LEFT);
    }

    fail($label . ' must use one uppercase letter, two zeros, and six numbers, like A00123456.');
}

function person_identifier_lookup_values(string $value, string $label): array
{
    $normalized = normalize_person_identifier($value, $label);
    $values = [$normalized];

    if (preg_match('/^([A-Z])00([0-9]{6})$/', $normalized, $matches)) {
        $legacy = $matches[1] . (string)(int)$matches[2];
        if ($legacy !== $matches[1] . '0') {
            $values[] = $legacy;
        }
    }

    return array_values(array_unique($values));
}

function format_person_identifier(?string $value): string
{
    $clean = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim((string)$value)) ?? '');
    if (preg_match('/^([A-Z])00([0-9]{6})$/', $clean, $matches)) {
        return $matches[1] . '00' . $matches[2];
    }

    if (preg_match('/^([A-Z])([0-9]{1,6})$/', $clean, $matches)) {
        return $matches[1] . '00' . str_pad($matches[2], 6, '0', STR_PAD_LEFT);
    }

    return (string)$value;
}

function normalize_phone_number(?string $value, string $label = 'Phone number'): string
{
    $digits = preg_replace('/\D/', '', trim((string)$value)) ?? '';

    if ($digits === '') {
        return '';
    }

    if (strlen($digits) !== 10) {
        fail($label . ' must use the format 787-555-5555.');
    }

    return substr($digits, 0, 3) . '-' . substr($digits, 3, 3) . '-' . substr($digits, 6, 4);
}

function normalize_email_address(?string $value, string $label = 'Email'): string
{
    $email = strtolower(trim((string)$value));

    if ($email === '') {
        return '';
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail($label . ' must be a valid email address.');
    }

    return $email;
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
    $currentUser = current_user($pdo);
    if ($currentUser) {
        return (int)$currentUser['user_id'];
    }

    $name = trim((string)$fullName);
    if ($name === '') {
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = 'staffcua@aguadilla.inter.edu' LIMIT 1");
        $stmt->execute();
        $id = $stmt->fetchColumn();
        if ($id) {
            return (int)$id;
        }
        $name = 'Staff CUA';
    }

    $stmt = $pdo->prepare('SELECT user_id FROM users WHERE full_name = ? LIMIT 1');
    $stmt->execute([$name]);
    $existing = $stmt->fetchColumn();
    if ($existing) {
        return (int)$existing;
    }

    $roleStmt = $pdo->prepare("SELECT role_id FROM roles WHERE role_name IN ('Limited', 'Staff') ORDER BY FIELD(role_name, 'Limited', 'Staff') LIMIT 1");
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
    $values = course_code_lookup_values($displayParts[0] ?? $courseCode);
    $placeholders = implode(',', array_fill(0, max(1, count($values)), '?'));
    $stmt = $pdo->prepare("SELECT course_id FROM v_courses_with_categories WHERE course_code IN ($placeholders) LIMIT 1");
    $stmt->execute($values ?: ['']);
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
        $values = person_identifier_lookup_values($mentorNumber, 'Mentor ID');
        $stmt = $pdo->prepare('SELECT mentor_id FROM mentors WHERE mentor_number IN (' . implode(',', array_fill(0, count($values), '?')) . ') LIMIT 1');
        $stmt->execute($values);
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
    $email = normalize_email_address($student['email'] ?? '', 'Student email');
    $phone = normalize_phone_number($student['phone'] ?? '', 'Student phone number');

    if ($studentNumber === '' || $name === '') {
        fail('Every student needs a student ID and name.');
    }
    $studentNumber = normalize_person_identifier($studentNumber, 'Student ID');
    $studentNumberValues = person_identifier_lookup_values($studentNumber, 'Student ID');

    $stmt = $pdo->prepare('SELECT student_id FROM students WHERE student_number IN (' . implode(',', array_fill(0, count($studentNumberValues), '?')) . ') LIMIT 1');
    $stmt->execute($studentNumberValues);
    $existing = $stmt->fetchColumn();

    if ($existing) {
        $update = $pdo->prepare('UPDATE students SET full_name = ?, email = ?, phone = ? WHERE student_id = ?');
        $update->execute([
            $name,
            $email ?: null,
            $phone ?: null,
            (int)$existing,
        ]);
        return (int)$existing;
    }

    $insert = $pdo->prepare('INSERT INTO students (student_number, full_name, email, phone) VALUES (?, ?, ?, ?)');
    $insert->execute([
        $studentNumber,
        $name,
        $email ?: null,
        $phone ?: null,
    ]);

    return (int)$pdo->lastInsertId();
}

function split_csv_names(string $value): array
{
    return array_values(array_filter(array_map(static fn($item) => trim($item), explode(',', $value))));
}

function ensure_booking_group_size_column(PDO $pdo): void
{
    static $checked = false;

    if ($checked) {
        return;
    }

    $stmt = $pdo->query("
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'bookings'
          AND COLUMN_NAME = 'group_size'
    ");

    if ((int)$stmt->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN group_size TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER booking_status');
    }

    $checked = true;
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
