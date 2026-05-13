<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET', 'PUT']);

$pdo = db();

function fetch_admin_account(PDO $pdo): array
{
    $stmt = $pdo->prepare("
        SELECT
            u.user_id,
            u.full_name,
            u.email,
            r.role_name,
            p.administrative_title,
            p.phone,
            p.office,
            p.preferred_contact,
            p.last_login_at,
            p.password_status,
            p.two_step_verification
        FROM users u
        JOIN roles r ON r.role_id = u.role_id
        LEFT JOIN admin_profiles p ON p.user_id = u.user_id
        WHERE r.role_name = 'Administrator'
        ORDER BY u.user_id
        LIMIT 1
    ");
    $stmt->execute();
    $row = $stmt->fetch();

    if (!$row) {
        fail('Administrator account was not found.', 404);
    }

    return [
        'user_id' => (int)$row['user_id'],
        'fullName' => $row['full_name'],
        'email' => $row['email'],
        'title' => $row['administrative_title'] ?: 'CUA Program Coordinator',
        'phone' => $row['phone'] ?: '',
        'office' => $row['office'] ?: '',
        'preferredContact' => $row['preferred_contact'] ?: 'Email',
        'role' => $row['role_name'],
        'accessLevel' => 'Full management',
        'lastLogin' => $row['last_login_at'] ? date('F j, Y, g:i A', strtotime($row['last_login_at'])) : 'Not recorded',
        'passwordStatus' => $row['password_status'] ?: 'Updated recently',
        'twoStepVerification' => (int)($row['two_step_verification'] ?? 1) === 1 ? 'Enabled' : 'Disabled',
        'permissions' => ['Bookings', 'Mentors', 'Courses', 'Absences', 'Reports', 'User Access'],
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    ok(['account' => fetch_admin_account($pdo)]);
}

$data = input_json();
$account = fetch_admin_account($pdo);
$userId = (int)$account['user_id'];

$fullName = trim((string)($data['fullName'] ?? $data['full_name'] ?? $account['fullName']));
$email = trim((string)($data['email'] ?? $account['email']));
$title = trim((string)($data['title'] ?? $account['title']));
$phone = trim((string)($data['phone'] ?? $account['phone']));
$office = trim((string)($data['office'] ?? $account['office']));
$preferred = trim((string)($data['preferredContact'] ?? $account['preferredContact']));

if ($fullName === '' || $email === '') {
    fail('Full name and email are required.');
}

if (!in_array($preferred, ['Email', 'Phone', 'Microsoft Teams'], true)) {
    $preferred = 'Email';
}

$pdo->beginTransaction();

try {
    $pdo->prepare('UPDATE users SET full_name = ?, email = ? WHERE user_id = ?')
        ->execute([$fullName, $email, $userId]);

    $pdo->prepare('
        INSERT INTO admin_profiles (user_id, administrative_title, phone, office, preferred_contact)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            administrative_title = VALUES(administrative_title),
            phone = VALUES(phone),
            office = VALUES(office),
            preferred_contact = VALUES(preferred_contact)
    ')->execute([$userId, $title ?: null, $phone ?: null, $office ?: null, $preferred]);

    $pdo->commit();
    ok(['account' => fetch_admin_account($pdo)]);
} catch (Throwable $error) {
    $pdo->rollBack();
    fail($error->getMessage(), 400);
}
