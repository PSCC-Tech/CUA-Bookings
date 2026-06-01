<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET']);

$pdo = db();

$categories = $pdo->query("
    SELECT category_id, category_name
    FROM categories
    WHERE category_name IN (
        'Mathematics',
        'Science',
        'Spanish',
        'English',
        'Statistics',
        'Accounting',
        'Finance',
        'Microeconomics',
        'Quantitative Methods',
        'Technology',
        'Other'
    )
    ORDER BY FIELD(
        category_name,
        'Mathematics',
        'Science',
        'Spanish',
        'English',
        'Statistics',
        'Accounting',
        'Finance',
        'Microeconomics',
        'Quantitative Methods',
        'Technology',
        'Other'
    ), category_name
")
    ->fetchAll();

$locations = $pdo->query('
    SELECT location_id, location_name, location_type
    FROM locations
    WHERE is_active = 1
    ORDER BY location_name
')->fetchAll();

$professors = $pdo->query('
    SELECT professor_id, full_name, email
    FROM professors
    WHERE is_active = 1
    ORDER BY full_name
')->fetchAll();

$users = $pdo->query('
    SELECT u.user_id, u.full_name, u.email, r.role_name
    FROM users u
    JOIN roles r ON r.role_id = u.role_id
    WHERE u.status = "active"
    ORDER BY u.full_name
')->fetchAll();

ok([
    'categories' => array_map(static fn(array $row): array => [
        'category_id' => (int)$row['category_id'],
        'name' => $row['category_name'],
        'category_name' => $row['category_name'],
    ], $categories),
    'locations' => array_map(static fn(array $row): array => [
        'location_id' => (int)$row['location_id'],
        'name' => $row['location_name'],
        'location_name' => $row['location_name'],
        'type' => $row['location_type'],
    ], $locations),
    'professors' => array_map(static fn(array $row): array => [
        'professor_id' => (int)$row['professor_id'],
        'name' => $row['full_name'],
        'full_name' => $row['full_name'],
        'email' => $row['email'] ?? '',
    ], $professors),
    'users' => array_map(static fn(array $row): array => [
        'user_id' => (int)$row['user_id'],
        'name' => $row['full_name'],
        'full_name' => $row['full_name'],
        'email' => $row['email'],
        'role' => $row['role_name'],
    ], $users),
]);
