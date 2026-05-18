<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET', 'POST']);

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $user = current_user($pdo);
    ok([
        'authenticated' => $user !== null,
        'user' => $user,
    ]);
}

$data = input_json();
$email = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');

if ($email === '' || $password === '') {
    fail('Email and password are required.', 422);
}

$stmt = $pdo->prepare('
    SELECT u.user_id, u.full_name, u.email, u.password_hash, r.role_name
    FROM users u
    JOIN roles r ON r.role_id = u.role_id
    WHERE LOWER(u.email) = ? AND u.status = "active"
    LIMIT 1
');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !is_string($user['password_hash']) || $user['password_hash'] === '' || !password_verify($password, $user['password_hash'])) {
    fail('Invalid email or password.', 401);
}

if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
    $rehash = $pdo->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?');
    $rehash->execute([password_hash($password, PASSWORD_DEFAULT), (int)$user['user_id']]);
}

auth_session_start();
session_regenerate_id(true);
$_SESSION['user_id'] = (int)$user['user_id'];
$_SESSION['authenticated_at'] = time();

$lastLogin = $pdo->prepare('UPDATE admin_profiles SET last_login_at = NOW() WHERE user_id = ?');
$lastLogin->execute([(int)$user['user_id']]);

ok([
    'authenticated' => true,
    'user' => auth_user_payload($user),
]);
