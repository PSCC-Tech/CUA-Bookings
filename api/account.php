<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET', 'PUT']);

$pdo = db();
$currentUser = require_role(['Administrator', 'Limited', 'Staff']);

function account_permissions_for_role(string $role): array
{
    if ($role === 'Administrator') {
        return ['Bookings', 'Mentors', 'Courses', 'Absences', 'Reports', 'User Access'];
    }

    return ['Create Bookings', 'Manage Daily Bookings', 'Active Sessions', 'Schedules'];
}

function account_get_setting(PDO $pdo, string $key): string
{
    $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $value = $stmt->fetchColumn();

    return is_string($value) ? $value : '';
}

function account_save_setting(PDO $pdo, string $key, string $value, int $userId): void
{
    $stmt = $pdo->prepare('
        INSERT INTO app_settings (setting_key, setting_value, updated_by_user_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            setting_value = VALUES(setting_value),
            updated_by_user_id = VALUES(updated_by_user_id)
    ');
    $stmt->execute([$key, $value !== '' ? $value : null, $userId]);
}

function fetch_current_account(PDO $pdo, array $currentUser): array
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
        WHERE u.user_id = ?
        LIMIT 1
    ");
    $stmt->execute([(int)$currentUser['user_id']]);
    $row = $stmt->fetch();

    if (!$row) {
        fail('Account was not found.', 404);
    }

    $role = (string)$row['role_name'];

    return [
        'user_id' => (int)$row['user_id'],
        'fullName' => $row['full_name'],
        'email' => $row['email'],
        'title' => $row['administrative_title'] ?: ($role === 'Administrator' ? 'CUA Program Coordinator' : 'CUA Staff'),
        'phone' => $row['phone'] ?: '',
        'office' => $row['office'] ?: '',
        'preferredContact' => $row['preferred_contact'] ?: 'Email',
        'role' => $role,
        'accessLevel' => $role === 'Administrator' ? 'Full management' : 'Limited booking management',
        'lastLogin' => $row['last_login_at'] ? date('F j, Y, g:i A', strtotime($row['last_login_at'])) : 'Not recorded',
        'passwordStatus' => $row['password_status'] ?: 'Updated recently',
        'twoStepVerification' => (int)($row['two_step_verification'] ?? 1) === 1 ? 'Enabled' : 'Disabled',
        'permissions' => account_permissions_for_role($role),
        'teamsMeetingLink' => account_get_setting($pdo, 'teams_meeting_link'),
        'canManageOnlineMeetingLink' => $role === 'Administrator',
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    ok(['account' => fetch_current_account($pdo, $currentUser)]);
}

$data = input_json();
$account = fetch_current_account($pdo, $currentUser);
$userId = (int)$account['user_id'];

$fullName = trim((string)($data['fullName'] ?? $data['full_name'] ?? $account['fullName']));
$email = normalize_email_address($data['email'] ?? $account['email'], 'Account email');
$title = trim((string)($data['title'] ?? $account['title']));
$phone = normalize_phone_number($data['phone'] ?? $account['phone'], 'Account phone number');
$office = trim((string)($data['office'] ?? $account['office']));
$preferred = trim((string)($data['preferredContact'] ?? $account['preferredContact']));
$teamsMeetingLink = trim((string)($data['teamsMeetingLink'] ?? $account['teamsMeetingLink'] ?? ''));
$canManageTeamsMeetingLink = ($account['role'] ?? '') === 'Administrator';

if ($fullName === '' || $email === '') {
    fail('Full name and email are required.');
}

if (!in_array($preferred, ['Email', 'Phone', 'Microsoft Teams'], true)) {
    $preferred = 'Email';
}

if ($canManageTeamsMeetingLink && $teamsMeetingLink !== '' && filter_var($teamsMeetingLink, FILTER_VALIDATE_URL) === false) {
    fail('The Microsoft Teams meeting link must be a valid URL.');
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

    if ($canManageTeamsMeetingLink) {
        account_save_setting($pdo, 'teams_meeting_link', $teamsMeetingLink, $userId);
    }

    $pdo->commit();
    ok(['account' => fetch_current_account($pdo, $currentUser)]);
} catch (Throwable $error) {
    $pdo->rollBack();
    fail($error->getMessage(), 400);
}
