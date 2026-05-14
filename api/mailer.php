<?php
declare(strict_types=1);

function booking_mail_default_config(): array
{
    return [
        'enabled' => true,
        'transport' => 'mail',
        'from_email' => 'no-reply@cua-bookings.local',
        'from_name' => 'CUA Bookings',
        'reply_to' => null,
        'smtp' => [
            'host' => '',
            'port' => 587,
            'username' => '',
            'password' => '',
            'encryption' => 'tls',
            'timeout' => 20,
        ],
    ];
}

function booking_mail_array_merge_recursive_distinct(array $base, array $override): array
{
    foreach ($override as $key => $value) {
        if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
            $base[$key] = booking_mail_array_merge_recursive_distinct($base[$key], $value);
            continue;
        }

        $base[$key] = $value;
    }

    return $base;
}

function booking_mail_config(): array
{
    $config = booking_mail_default_config();
    $localConfig = __DIR__ . '/mail_config.php';

    if (is_file($localConfig)) {
        $loaded = require $localConfig;
        if (is_array($loaded)) {
            $config = booking_mail_array_merge_recursive_distinct($config, $loaded);
        }
    }

    return $config;
}

function booking_mail_clean_header(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function booking_mail_is_valid_email(?string $email): bool
{
    return is_string($email) && filter_var(trim($email), FILTER_VALIDATE_EMAIL) !== false;
}

function booking_mail_format_address(string $email, string $name = ''): string
{
    $email = booking_mail_clean_header($email);
    $name = booking_mail_clean_header($name);

    if ($name === '') {
        return $email;
    }

    $escapedName = addcslashes($name, '\\"');
    return sprintf('"%s" <%s>', $escapedName, $email);
}

function booking_mail_encode_subject(string $subject): string
{
    return '=?UTF-8?B?' . base64_encode(booking_mail_clean_header($subject)) . '?=';
}

function booking_mail_normalize_body(string $body): string
{
    $body = str_replace(["\r\n", "\r"], "\n", $body);
    $body = str_replace("\n", "\r\n", $body);
    return preg_replace('/^\./m', '..', $body) ?? $body;
}

function booking_mail_send(array $message, array $config): array
{
    $toEmail = trim((string)($message['to_email'] ?? ''));
    $toName = trim((string)($message['to_name'] ?? ''));

    if (!booking_mail_is_valid_email($toEmail)) {
        return [
            'ok' => false,
            'to' => $toEmail,
            'name' => $toName,
            'error' => 'Recipient email is missing or invalid.',
        ];
    }

    $transport = strtolower((string)($config['transport'] ?? 'mail'));

    try {
        if ($transport === 'smtp') {
            booking_mail_send_smtp($message, $config);
        } else {
            booking_mail_send_native($message, $config);
        }

        return [
            'ok' => true,
            'to' => $toEmail,
            'name' => $toName,
            'transport' => $transport,
        ];
    } catch (Throwable $error) {
        return [
            'ok' => false,
            'to' => $toEmail,
            'name' => $toName,
            'transport' => $transport,
            'error' => $error->getMessage(),
        ];
    }
}

function booking_mail_build_mime_message(array $message, array $config, bool $includeToHeader = true): string
{
    $fromEmail = (string)($config['from_email'] ?? '');
    $fromName = (string)($config['from_name'] ?? 'CUA Bookings');
    $replyTo = trim((string)($config['reply_to'] ?? ''));
    $toEmail = (string)($message['to_email'] ?? '');
    $toName = (string)($message['to_name'] ?? '');
    $subject = (string)($message['subject'] ?? 'CUA Booking Details');
    $textBody = (string)($message['text'] ?? '');
    $htmlBody = (string)($message['html'] ?? '');
    $boundary = 'cua-booking-' . bin2hex(random_bytes(12));

    if (!booking_mail_is_valid_email($fromEmail)) {
        throw new RuntimeException('Mail sender address is not configured.');
    }

    $headers = [
        'From: ' . booking_mail_format_address($fromEmail, $fromName),
        'Subject: ' . booking_mail_encode_subject($subject),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'X-Mailer: CUA Bookings PHP Mailer',
    ];

    if ($includeToHeader) {
        array_splice($headers, 1, 0, ['To: ' . booking_mail_format_address($toEmail, $toName)]);
    }

    if (booking_mail_is_valid_email($replyTo)) {
        $headers[] = 'Reply-To: ' . booking_mail_clean_header($replyTo);
    }

    $body = [];
    $body[] = '--' . $boundary;
    $body[] = 'Content-Type: text/plain; charset=UTF-8';
    $body[] = 'Content-Transfer-Encoding: 8bit';
    $body[] = '';
    $body[] = $textBody;
    $body[] = '--' . $boundary;
    $body[] = 'Content-Type: text/html; charset=UTF-8';
    $body[] = 'Content-Transfer-Encoding: 8bit';
    $body[] = '';
    $body[] = $htmlBody;
    $body[] = '--' . $boundary . '--';
    $body[] = '';

    return implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $body);
}

function booking_mail_send_native(array $message, array $config): void
{
    $to = booking_mail_format_address((string)$message['to_email'], (string)($message['to_name'] ?? ''));
    $subject = booking_mail_encode_subject((string)$message['subject']);
    $mime = booking_mail_build_mime_message($message, $config, false);
    [$headers, $body] = explode("\r\n\r\n", $mime, 2);
    $headers = preg_replace('/^Subject: .*(\r\n)?/m', '', $headers) ?? $headers;

    $sent = @mail($to, $subject, $body, $headers);
    if (!$sent) {
        throw new RuntimeException('PHP mail() returned false. Configure XAMPP sendmail or use SMTP in api/mail_config.php.');
    }
}

function booking_mail_smtp_expect($socket, array $allowedCodes): string
{
    $response = '';

    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }

    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $allowedCodes, true)) {
        throw new RuntimeException('SMTP error: ' . trim($response));
    }

    return $response;
}

function booking_mail_smtp_command($socket, string $command, array $allowedCodes): string
{
    fwrite($socket, $command . "\r\n");
    return booking_mail_smtp_expect($socket, $allowedCodes);
}

function booking_mail_send_smtp(array $message, array $config): void
{
    $smtp = is_array($config['smtp'] ?? null) ? $config['smtp'] : [];
    $host = trim((string)($smtp['host'] ?? ''));
    $port = (int)($smtp['port'] ?? 587);
    $username = trim((string)($smtp['username'] ?? ''));
    $password = (string)($smtp['password'] ?? '');
    $encryption = strtolower(trim((string)($smtp['encryption'] ?? 'tls')));
    $timeout = (int)($smtp['timeout'] ?? 20);
    $fromEmail = trim((string)($config['from_email'] ?? ''));
    $toEmail = trim((string)($message['to_email'] ?? ''));

    if ($host === '') {
        throw new RuntimeException('SMTP host is not configured.');
    }
    if (!booking_mail_is_valid_email($fromEmail)) {
        throw new RuntimeException('SMTP sender address is not configured.');
    }

    $remote = $encryption === 'ssl' ? "ssl://{$host}:{$port}" : "{$host}:{$port}";
    $socket = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);

    if (!$socket) {
        throw new RuntimeException("Could not connect to SMTP server: {$errstr} ({$errno}).");
    }

    try {
        stream_set_timeout($socket, $timeout);
        booking_mail_smtp_expect($socket, [220]);
        booking_mail_smtp_command($socket, 'EHLO localhost', [250]);

        if ($encryption === 'tls') {
            booking_mail_smtp_command($socket, 'STARTTLS', [220]);
            $cryptoOk = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($cryptoOk !== true) {
                throw new RuntimeException('Could not start TLS for SMTP connection.');
            }
            booking_mail_smtp_command($socket, 'EHLO localhost', [250]);
        }

        if ($username !== '' || $password !== '') {
            booking_mail_smtp_command($socket, 'AUTH LOGIN', [334]);
            booking_mail_smtp_command($socket, base64_encode($username), [334]);
            booking_mail_smtp_command($socket, base64_encode($password), [235]);
        }

        booking_mail_smtp_command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        booking_mail_smtp_command($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
        booking_mail_smtp_command($socket, 'DATA', [354]);

        $mime = booking_mail_normalize_body(booking_mail_build_mime_message($message, $config, true));
        fwrite($socket, $mime . "\r\n.\r\n");
        booking_mail_smtp_expect($socket, [250]);
        booking_mail_smtp_command($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

function booking_notification_details(PDO $pdo, int $bookingId): array
{
    $stmt = $pdo->prepare('
        SELECT
            b.booking_id,
            b.booking_type,
            b.booking_status,
            b.start_at,
            b.end_at,
            b.topics_notes,
            m.full_name AS mentor_name,
            m.email AS mentor_email,
            vc.course_code,
            vc.course_name,
            p.full_name AS professor_name,
            l.location_name,
            u.full_name AS made_by_name,
            u.email AS made_by_email
        FROM bookings b
        JOIN mentors m ON m.mentor_id = b.mentor_id
        JOIN v_courses_with_categories vc ON vc.course_id = b.course_id
        LEFT JOIN professors p ON p.professor_id = b.professor_id
        JOIN locations l ON l.location_id = b.location_id
        JOIN users u ON u.user_id = b.made_by_user_id
        WHERE b.booking_id = ?
        LIMIT 1
    ');
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();

    if (!$booking) {
        throw new RuntimeException('Booking details were not found for email notification.');
    }

    $studentStmt = $pdo->prepare('
        SELECT s.student_number, s.full_name, s.email, s.phone
        FROM booking_students bs
        JOIN students s ON s.student_id = bs.student_id
        WHERE bs.booking_id = ?
        ORDER BY bs.student_order
    ');
    $studentStmt->execute([$bookingId]);

    $adminStmt = $pdo->query("
        SELECT u.full_name, u.email
        FROM users u
        JOIN roles r ON r.role_id = u.role_id
        WHERE r.role_name = 'Administrator'
          AND u.status = 'active'
        ORDER BY u.full_name
    ");

    return [
        'booking' => $booking,
        'students' => $studentStmt->fetchAll(),
        'admins' => $adminStmt->fetchAll(),
    ];
}

function booking_notification_recipients(array $details): array
{
    $recipients = [];

    foreach ($details['students'] as $student) {
        $email = trim((string)($student['email'] ?? ''));
        if (booking_mail_is_valid_email($email)) {
            $recipients[strtolower($email)] = [
                'email' => $email,
                'name' => (string)$student['full_name'],
                'role' => 'student',
            ];
        }
    }

    $mentorEmail = trim((string)($details['booking']['mentor_email'] ?? ''));
    if (booking_mail_is_valid_email($mentorEmail)) {
        $recipients[strtolower($mentorEmail)] = [
            'email' => $mentorEmail,
            'name' => (string)$details['booking']['mentor_name'],
            'role' => 'mentor',
        ];
    }

    foreach ($details['admins'] as $admin) {
        $email = trim((string)($admin['email'] ?? ''));
        if (booking_mail_is_valid_email($email)) {
            $key = strtolower($email);
            if (isset($recipients[$key])) {
                $recipients[$key]['role'] .= ', administrator';
            } else {
                $recipients[$key] = [
                    'email' => $email,
                    'name' => (string)$admin['full_name'],
                    'role' => 'administrator',
                ];
            }
        }
    }

    return array_values($recipients);
}

function booking_notification_format_datetime(array $booking): array
{
    $start = strtotime((string)$booking['start_at']);
    $end = !empty($booking['end_at']) ? strtotime((string)$booking['end_at']) : false;

    return [
        'date' => $start ? date('l, F j, Y', $start) : (string)$booking['start_at'],
        'time' => $start ? date('g:i A', $start) : (string)$booking['start_at'],
        'end_time' => $end ? date('g:i A', $end) : '',
    ];
}

function booking_notification_build_message(array $details, array $recipient): array
{
    $booking = $details['booking'];
    $dateTime = booking_notification_format_datetime($booking);
    $course = trim((string)$booking['course_code'] . ' - ' . (string)$booking['course_name']);
    $sessionType = count($details['students']) > 1 ? 'Grouped (' . count($details['students']) . ' students)' : 'Single';
    $timeLine = $dateTime['end_time'] !== ''
        ? $dateTime['time'] . ' - ' . $dateTime['end_time']
        : $dateTime['time'];

    $studentLines = array_map(static function (array $student): string {
        $parts = [
            trim((string)$student['full_name']),
            trim((string)$student['student_number']),
        ];
        $line = implode(' - ', array_filter($parts));
        $email = trim((string)($student['email'] ?? ''));
        $phone = trim((string)($student['phone'] ?? ''));
        if ($email !== '') {
            $line .= ' | ' . $email;
        }
        if ($phone !== '') {
            $line .= ' | ' . $phone;
        }
        return $line;
    }, $details['students']);

    $subject = sprintf(
        'CUA Booking #%s: %s on %s at %s',
        $booking['booking_id'],
        $booking['course_code'],
        $dateTime['date'],
        $dateTime['time']
    );

    $rows = [
        'Booking ID' => '#' . $booking['booking_id'],
        'Type' => $booking['booking_type'] === 'walk_in' ? 'Walk-in' : 'Scheduled',
        'Status' => ucfirst((string)$booking['booking_status']),
        'Mentor' => (string)$booking['mentor_name'],
        'Date' => $dateTime['date'],
        'Time' => $timeLine,
        'Location' => (string)$booking['location_name'],
        'Course' => $course,
        'Topics' => (string)($booking['topics_notes'] ?? ''),
        'Professor' => (string)($booking['professor_name'] ?? ''),
        'Made by' => (string)$booking['made_by_name'],
        'Session' => $sessionType,
    ];

    $text = "Hello " . ($recipient['name'] ?: 'there') . ",\n\n";
    $text .= "A mentorship booking has been created with these details:\n\n";
    foreach ($rows as $label => $value) {
        $text .= $label . ': ' . ($value !== '' ? $value : 'N/A') . "\n";
    }
    $text .= "\nStudents:\n";
    foreach ($studentLines as $line) {
        $text .= '- ' . $line . "\n";
    }
    $text .= "\nThis is an automated message from the CUA Bookings system.";

    $htmlRows = '';
    foreach ($rows as $label => $value) {
        $htmlRows .= '<tr><th align="left" style="padding:8px;border:1px solid #d9dee7;background:#f6f8fb;">'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
            . '</th><td style="padding:8px;border:1px solid #d9dee7;">'
            . htmlspecialchars($value !== '' ? $value : 'N/A', ENT_QUOTES, 'UTF-8')
            . '</td></tr>';
    }

    $htmlStudents = '';
    foreach ($studentLines as $line) {
        $htmlStudents .= '<li>' . htmlspecialchars($line, ENT_QUOTES, 'UTF-8') . '</li>';
    }

    $html = '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;">'
        . '<p>Hello ' . htmlspecialchars($recipient['name'] ?: 'there', ENT_QUOTES, 'UTF-8') . ',</p>'
        . '<p>A mentorship booking has been created with these details:</p>'
        . '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:720px;">'
        . $htmlRows
        . '</table>'
        . '<h3 style="margin-top:20px;">Students</h3>'
        . '<ul>' . $htmlStudents . '</ul>'
        . '<p style="color:#5f6b7a;">This is an automated message from the CUA Bookings system.</p>'
        . '</body></html>';

    return [
        'to_email' => $recipient['email'],
        'to_name' => $recipient['name'],
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
    ];
}

function send_booking_email_notifications(PDO $pdo, int $bookingId): array
{
    $config = booking_mail_config();

    $summary = [
        'enabled' => (bool)($config['enabled'] ?? true),
        'transport' => strtolower((string)($config['transport'] ?? 'mail')),
        'sent' => [],
        'failed' => [],
        'skipped' => [],
    ];

    if (!$summary['enabled']) {
        $summary['skipped'][] = (string)($config['disabled_reason'] ?? 'Email notifications are disabled in api/mail_config.php.');
        return $summary;
    }

    $details = booking_notification_details($pdo, $bookingId);
    $recipients = booking_notification_recipients($details);

    if (!$recipients) {
        $summary['skipped'][] = 'No valid student, mentor, or administrator email addresses were found.';
        return $summary;
    }

    foreach ($recipients as $recipient) {
        $message = booking_notification_build_message($details, $recipient);
        $result = booking_mail_send($message, $config);
        $entry = [
            'email' => $recipient['email'],
            'name' => $recipient['name'],
            'role' => $recipient['role'],
        ];

        if ($result['ok']) {
            $summary['sent'][] = $entry;
        } else {
            $entry['error'] = $result['error'] ?? 'Unknown mail error.';
            $summary['failed'][] = $entry;
        }
    }

    return $summary;
}
