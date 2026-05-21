<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method(['POST']);

$pdo = db();
$data = input_json();
require_role(['Administrator', 'Staff']);

$bookingId = (int)($data['booking_id'] ?? 0);
$action = trim((string)($data['action'] ?? ''));
$userId = find_or_create_user($pdo, (string)($data['made_by'] ?? $data['madeBy'] ?? 'Front Desk Staff'));

if ($bookingId <= 0) {
    fail('Booking ID is required.');
}

if (!in_array($action, ['start', 'stop', 'cancel'], true)) {
    fail('Session action must be start, stop, or cancel.');
}

$pdo->beginTransaction();

try {
    $bookingStmt = $pdo->prepare('SELECT booking_status FROM bookings WHERE booking_id = ? FOR UPDATE');
    $bookingStmt->execute([$bookingId]);
    $status = $bookingStmt->fetchColumn();

    if (!$status) {
        throw new RuntimeException('Booking was not found.');
    }

    if ($action === 'start') {
        if ($status !== 'scheduled') {
            throw new RuntimeException('Only scheduled bookings can be started.');
        }

        $sessionStmt = $pdo->prepare('SELECT session_id FROM mentorship_sessions WHERE booking_id = ? LIMIT 1');
        $sessionStmt->execute([$bookingId]);
        $sessionId = $sessionStmt->fetchColumn();

        if ($sessionId) {
            $pdo->prepare('
                UPDATE mentorship_sessions
                SET session_status = "active", ended_at = NULL, ended_by_user_id = NULL
                WHERE session_id = ?
            ')->execute([(int)$sessionId]);
        } else {
            $pdo->prepare('
                INSERT INTO mentorship_sessions (booking_id, session_status, started_at, started_by_user_id)
                VALUES (?, "active", NOW(), ?)
            ')->execute([$bookingId, $userId]);
        }

        $pdo->prepare('UPDATE bookings SET booking_status = "active" WHERE booking_id = ?')
            ->execute([$bookingId]);
    }

    if ($action === 'stop') {
        if ($status !== 'active') {
            throw new RuntimeException('Only active bookings can be stopped.');
        }

        $stopStmt = $pdo->prepare('
            UPDATE mentorship_sessions
            SET session_status = "completed", ended_at = NOW(), ended_by_user_id = ?
            WHERE booking_id = ? AND session_status = "active"
        ');
        $stopStmt->execute([$userId, $bookingId]);

        if ($stopStmt->rowCount() === 0) {
            throw new RuntimeException('Active session record was not found.');
        }

        $pdo->prepare('UPDATE bookings SET booking_status = "completed" WHERE booking_id = ?')
            ->execute([$bookingId]);
    }

    if ($action === 'cancel') {
        if (!in_array($status, ['scheduled', 'active'], true)) {
            throw new RuntimeException('Only scheduled or active bookings can be cancelled.');
        }

        $reason = trim((string)($data['reason'] ?? 'Cancelled from booking details.'));
        $pdo->prepare('
            UPDATE bookings
            SET booking_status = "cancelled", cancelled_at = NOW(), cancellation_reason = ?
            WHERE booking_id = ?
        ')->execute([$reason, $bookingId]);

        $pdo->prepare('
            UPDATE mentorship_sessions
            SET session_status = "cancelled", ended_at = COALESCE(ended_at, NOW()), ended_by_user_id = ?
            WHERE booking_id = ?
        ')->execute([$userId, $bookingId]);
    }

    $pdo->commit();
    ok(['booking_id' => $bookingId, 'action' => $action]);
} catch (Throwable $error) {
    $pdo->rollBack();
    fail($error->getMessage(), 400);
}
