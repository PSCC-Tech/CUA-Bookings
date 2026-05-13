<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['GET']);

$pdo = db();
$query = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));

$sql = '
    SELECT student_id, student_number, full_name, email, phone
    FROM students
';
$params = [];

if ($query !== '') {
    $sql .= '
        WHERE student_number LIKE ?
           OR full_name LIKE ?
           OR email LIKE ?
    ';
    $like = '%' . $query . '%';
    $params = [$like, $like, $like];
}

$sql .= ' ORDER BY student_number LIMIT 12';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$students = array_map(static function (array $row): array {
    return [
        'student_id' => (int)$row['student_id'],
        'studentId' => $row['student_number'],
        'student_number' => $row['student_number'],
        'name' => $row['full_name'],
        'full_name' => $row['full_name'],
        'email' => $row['email'] ?? '',
        'phone' => $row['phone'] ?? '',
    ];
}, $stmt->fetchAll());

ok(['students' => $students]);
