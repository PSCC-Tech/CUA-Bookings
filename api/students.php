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
    $identifierValues = [];
    if (preg_match('/^[A-Za-z][A-Za-z0-9-]*$/', $query)) {
        try {
            $identifierValues = person_identifier_lookup_values($query, 'Student ID');
        } catch (Throwable $error) {
            $identifierValues = [];
        }
    }

    $sql .= '
        WHERE student_number LIKE ?
           OR full_name LIKE ?
           OR email LIKE ?
    ';
    $like = '%' . $query . '%';
    $params = [$like, $like, $like];

    if ($identifierValues) {
        $sql .= ' OR student_number IN (' . implode(',', array_fill(0, count($identifierValues), '?')) . ')';
        array_push($params, ...$identifierValues);
    }
}

$sql .= ' ORDER BY student_number LIMIT 12';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$students = array_map(static function (array $row): array {
    return [
        'student_id' => (int)$row['student_id'],
        'studentId' => format_person_identifier($row['student_number']),
        'student_number' => format_person_identifier($row['student_number']),
        'name' => $row['full_name'],
        'full_name' => $row['full_name'],
        'email' => $row['email'] ?? '',
        'phone' => $row['phone'] ?? '',
    ];
}, $stmt->fetchAll());

ok(['students' => $students]);
