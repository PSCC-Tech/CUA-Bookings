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

function booking_mail_prepare_inline_images(array $message): array
{
    $images = is_array($message['inline_images'] ?? null) ? $message['inline_images'] : [];
    $prepared = [];

    foreach ($images as $image) {
        if (!is_array($image)) {
            continue;
        }

        $path = (string)($image['path'] ?? '');
        $contentId = booking_mail_clean_header((string)($image['content_id'] ?? ''));
        if ($path === '' || $contentId === '' || !is_file($path) || !is_readable($path)) {
            continue;
        }

        $content = file_get_contents($path);
        if ($content === false) {
            continue;
        }

        $prepared[] = [
            'content' => $content,
            'content_id' => $contentId,
            'filename' => booking_mail_clean_header((string)($image['filename'] ?? basename($path))),
            'mime_type' => booking_mail_clean_header((string)($image['mime_type'] ?? 'application/octet-stream')),
        ];
    }

    return $prepared;
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
    $inlineImages = booking_mail_prepare_inline_images($message);
    $alternativeBoundary = 'cua-booking-alt-' . bin2hex(random_bytes(12));
    $relatedBoundary = 'cua-booking-related-' . bin2hex(random_bytes(12));
    $topBoundary = $inlineImages ? $relatedBoundary : $alternativeBoundary;
    $contentType = $inlineImages
        ? 'multipart/related; boundary="' . $topBoundary . '"'
        : 'multipart/alternative; boundary="' . $topBoundary . '"';

    if (!booking_mail_is_valid_email($fromEmail)) {
        throw new RuntimeException('Mail sender address is not configured.');
    }

    $headers = [
        'From: ' . booking_mail_format_address($fromEmail, $fromName),
        'Subject: ' . booking_mail_encode_subject($subject),
        'MIME-Version: 1.0',
        'Content-Type: ' . $contentType,
        'X-Mailer: CUA Bookings PHP Mailer',
    ];

    if ($includeToHeader) {
        array_splice($headers, 1, 0, ['To: ' . booking_mail_format_address($toEmail, $toName)]);
    }

    if (booking_mail_is_valid_email($replyTo)) {
        $headers[] = 'Reply-To: ' . booking_mail_clean_header($replyTo);
    }

    $body = [];

    if ($inlineImages) {
        $body[] = '--' . $relatedBoundary;
        $body[] = 'Content-Type: multipart/alternative; boundary="' . $alternativeBoundary . '"';
        $body[] = '';
    }

    $body[] = '--' . $alternativeBoundary;
    $body[] = 'Content-Type: text/plain; charset=UTF-8';
    $body[] = 'Content-Transfer-Encoding: 8bit';
    $body[] = '';
    $body[] = $textBody;
    $body[] = '--' . $alternativeBoundary;
    $body[] = 'Content-Type: text/html; charset=UTF-8';
    $body[] = 'Content-Transfer-Encoding: 8bit';
    $body[] = '';
    $body[] = $htmlBody;
    $body[] = '--' . $alternativeBoundary . '--';

    foreach ($inlineImages as $image) {
        $body[] = '--' . $relatedBoundary;
        $body[] = 'Content-Type: ' . $image['mime_type'] . '; name="' . $image['filename'] . '"';
        $body[] = 'Content-Transfer-Encoding: base64';
        $body[] = 'Content-ID: <' . $image['content_id'] . '>';
        $body[] = 'Content-Disposition: inline; filename="' . $image['filename'] . '"';
        $body[] = '';
        $body[] = rtrim(chunk_split(base64_encode($image['content']), 76, "\r\n"));
    }

    if ($inlineImages) {
        $body[] = '--' . $relatedBoundary . '--';
    }

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
            vc.category_name,
            p.full_name AS professor_name,
            l.location_name,
            l.location_type,
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

    $settingStmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
    $settingStmt->execute(['teams_meeting_link']);
    $teamsMeetingLink = $settingStmt->fetchColumn();

    return [
        'booking' => $booking,
        'students' => $studentStmt->fetchAll(),
        'settings' => [
            'teams_meeting_link' => is_string($teamsMeetingLink) ? $teamsMeetingLink : '',
        ],
    ];
}

function booking_notification_is_teams_location(array $booking): bool
{
    $locationName = strtolower((string)($booking['location_name'] ?? ''));
    $locationType = strtolower((string)($booking['location_type'] ?? ''));

    return strpos($locationName, 'microsoft teams') !== false
        || strpos($locationName, 'teams') !== false
        || ($locationType === 'online' && strpos($locationName, 'online') !== false);
}

function booking_notification_blocked_email(string $email): bool
{
    return strtolower(trim($email)) === 'staffcua@aguadilla.inter.edu';
}

function booking_notification_add_recipient(array &$recipients, string $email, string $name, string $role): void
{
    $email = trim($email);
    if (!booking_mail_is_valid_email($email) || booking_notification_blocked_email($email)) {
        return;
    }

    $key = strtolower($email);
    if (isset($recipients[$key])) {
        $existingRoles = array_map('trim', explode(',', (string)$recipients[$key]['role']));
        if (!in_array($role, $existingRoles, true)) {
            $recipients[$key]['role'] .= ', ' . $role;
        }
        return;
    }

    $recipients[$key] = [
        'email' => $email,
        'name' => $name,
        'role' => $role,
    ];
}

function booking_notification_supervisor_routes(string $categoryName): array
{
    $category = strtolower(trim($categoryName));
    $routes = [
        [
            'email' => 'tutoriacua@aguadilla.inter.edu',
            'name' => 'CUA Coordinator',
            'role' => 'main administrator',
        ],
    ];

    if ($category === 'technology') {
        $routes[] = [
            'email' => 'eperez@aguadilla.inter.edu',
            'name' => 'Edgardo Perez',
            'role' => 'technology supervisor',
        ];
    }

    if ($category === 'english') {
        $routes[] = [
            'email' => 'nmroman@aguadilla.inter.edu',
            'name' => 'Nicole Roman',
            'role' => 'english supervisor',
        ];
    }

    return $routes;
}

function booking_notification_recipients(array $details): array
{
    $recipients = [];

    foreach ($details['students'] as $student) {
        booking_notification_add_recipient(
            $recipients,
            (string)($student['email'] ?? ''),
            (string)($student['full_name'] ?? ''),
            'student'
        );
    }

    booking_notification_add_recipient(
        $recipients,
        (string)($details['booking']['mentor_email'] ?? ''),
        (string)($details['booking']['mentor_name'] ?? ''),
        'mentor'
    );

    $categoryName = (string)($details['booking']['category_name'] ?? '');
    foreach (booking_notification_supervisor_routes($categoryName) as $route) {
        booking_notification_add_recipient(
            $recipients,
            (string)$route['email'],
            (string)$route['name'],
            (string)$route['role']
        );
    }

    foreach (array_keys($recipients) as $key) {
        if (booking_notification_blocked_email($key)) {
            unset($recipients[$key]);
        }
    }

    return array_values($recipients);
}

function booking_notification_format_datetime(array $booking): array
{
    $start = strtotime((string)$booking['start_at']);
    $end = !empty($booking['end_at'])
        ? strtotime((string)$booking['end_at'])
        : ($start ? strtotime((string)$booking['start_at'] . ' +60 minutes') : false);

    return [
        'date' => $start ? date('l, F j, Y', $start) : (string)$booking['start_at'],
        'subject_date' => $start ? date('F j, Y', $start) : (string)$booking['start_at'],
        'time' => $start ? date('g:i A', $start) : (string)$booking['start_at'],
        'end_time' => $end ? date('g:i A', $end) : '',
    ];
}

function booking_notification_role_key(array $recipient): string
{
    $role = strtolower((string)($recipient['role'] ?? ''));

    if (strpos($role, 'mentor') !== false) {
        return 'mentor';
    }
    if (strpos($role, 'administrator') !== false || strpos($role, 'supervisor') !== false) {
        return 'administrator';
    }
    if (strpos($role, 'student') !== false) {
        return 'student';
    }

    return 'recipient';
}

function booking_notification_role_copy(string $roleKey): array
{
    if ($roleKey === 'student') {
        return [
            'headline' => 'Your mentorship session has been scheduled',
            'preheader' => 'Your CUA mentorship session details are ready for review.',
            'paragraphs' => [
                'Your mentorship session has been scheduled through the Centro Universitario de Aprendizaje.',
                'Please review the session details below and arrive on time. If any change is necessary, please contact the CUA Mentorship Coordinator at (787) 931-0729.',
            ],
        ];
    }

    if ($roleKey === 'mentor') {
        return [
            'headline' => 'A mentorship session has been assigned to you',
            'preheader' => 'A CUA mentorship session has been assigned for your review.',
            'paragraphs' => [
                'A mentorship session has been assigned to you through CUA Bookings.',
                'Please review the session details below and prepare for the scheduled time. Student information is included for coordination purposes.',
            ],
        ];
    }

    if ($roleKey === 'administrator') {
        return [
            'headline' => 'A new mentorship booking has been created',
            'preheader' => 'A new CUA mentorship booking is available for administrative review.',
            'paragraphs' => [
                'A new mentorship booking has been created in CUA Bookings.',
                'Please review the session details below for administrative follow-up and coordination.',
            ],
        ];
    }

    return [
        'headline' => 'Mentorship booking details',
        'preheader' => 'CUA mentorship booking details are available for review.',
        'paragraphs' => [
            'A mentorship booking has been created through the Centro Universitario de Aprendizaje.',
            'Please review the session details below.',
        ],
    ];
}

function booking_notification_contact_info(): array
{
    return [
        'intro' => 'For more information or to schedule your appointment, please contact',
        'main_label' => 'Centro Universitario de Aprendizaje',
        'main_phone' => '787-891-0925',
        'lines' => [
            [
                'contact' => 'Ext. 2256 or (787) 931-0729',
                'label' => 'CUA Mentorship Coordinator',
            ],
            [
                'contact' => 'Ext. 2259 or (787) 931-0730',
                'label' => 'Mathematics, Spanish, and Sciences Laboratory',
            ],
            [
                'contact' => 'Ext. 2261 or (787) 931-0732',
                'label' => 'English Laboratory',
            ],
            [
                'contact' => 'Ext. 2182 or (787) 931-0629',
                'label' => 'CUA Administrative Assistant',
            ],
        ],
    ];
}

function booking_notification_contact_text(): string
{
    $info = booking_notification_contact_info();
    $lines = [
        $info['intro'],
        $info['main_label'] . ': ' . $info['main_phone'],
    ];

    foreach ($info['lines'] as $line) {
        $lines[] = $line['contact'] . ' - ' . $line['label'];
    }

    return implode("\n", $lines);
}

function booking_notification_contact_html(): string
{
    $info = booking_notification_contact_info();
    $html = '<div style="margin:14px 0 0;padding:14px 16px;background:#ffffff;border:1px solid #dfe6dc;">'
        . '<p style="margin:0 0 8px;color:#173f35;font-size:12px;line-height:1.5;">'
        . htmlspecialchars($info['intro'], ENT_QUOTES, 'UTF-8')
        . '</p>'
        . '<p style="margin:0 0 10px;color:#173f35;font-size:13px;line-height:1.5;">'
        . '<strong>' . htmlspecialchars($info['main_label'], ENT_QUOTES, 'UTF-8') . ':</strong> '
        . htmlspecialchars($info['main_phone'], ENT_QUOTES, 'UTF-8')
        . '</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;">';

    foreach ($info['lines'] as $line) {
        $html .= '<tr>'
            . '<td style="padding:4px 10px 4px 0;color:#173f35;font-size:12px;line-height:1.4;font-weight:700;vertical-align:top;">'
            . htmlspecialchars($line['contact'], ENT_QUOTES, 'UTF-8')
            . '</td>'
            . '<td style="padding:4px 0;color:#5f6d67;font-size:12px;line-height:1.4;vertical-align:top;">'
            . htmlspecialchars($line['label'], ENT_QUOTES, 'UTF-8')
            . '</td>'
            . '</tr>';
    }

    return $html . '</table></div>';
}

function booking_notification_build_message(array $details, array $recipient): array
{
    $booking = $details['booking'];
    $dateTime = booking_notification_format_datetime($booking);
    $roleKey = booking_notification_role_key($recipient);
    $copy = booking_notification_role_copy($roleKey);
    $recipientName = trim((string)($recipient['name'] ?? ''));
    $greetingName = $recipientName !== '' ? $recipientName : 'recipient';
    $course = trim(format_course_code((string)$booking['course_code']) . ' - ' . (string)$booking['course_name']);
    $sessionType = count($details['students']) > 1 ? 'Grouped (' . count($details['students']) . ' students)' : 'Single';
    $contactText = booking_notification_contact_text();
    $contactHtml = booking_notification_contact_html();
    $timeLine = $dateTime['end_time'] !== ''
        ? $dateTime['time'] . ' - ' . $dateTime['end_time']
        : $dateTime['time'];
    $logoPath = dirname(__DIR__) . '/Images/MentoriasLogo.png';
    $logoContentId = 'cua-mentorias-logo';
    $inlineImages = [];
    $logoHtml = '';

    if (is_file($logoPath) && is_readable($logoPath)) {
        $inlineImages[] = [
            'path' => $logoPath,
            'content_id' => $logoContentId,
            'filename' => 'MentoriasLogo.png',
            'mime_type' => 'image/png',
        ];
        $logoHtml = '<img src="cid:' . $logoContentId . '" width="112" alt="Mentorias CUA" '
            . 'style="display:block;width:112px;max-width:112px;height:auto;margin:0 auto 14px;">';
    }

    $studentLines = array_map(static function (array $student): string {
        $parts = [
            trim((string)$student['full_name']),
            format_person_identifier($student['student_number'] ?? ''),
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
        'CUA Mentorship: %s | %s at %s',
        format_course_code((string)$booking['course_code']),
        $dateTime['subject_date'],
        $dateTime['time']
    );

    $teamsMeetingLink = trim((string)($details['settings']['teams_meeting_link'] ?? ''));
    $includeTeamsMeetingLink = $teamsMeetingLink !== '' && booking_notification_is_teams_location($booking);

    $rows = [
        'Type' => $booking['booking_type'] === 'walk_in' ? 'Walk-in' : 'Scheduled',
        'Mentor' => (string)$booking['mentor_name'],
        'Date' => $dateTime['date'],
        'Time' => $timeLine,
        'Location' => (string)$booking['location_name'],
    ];

    if ($includeTeamsMeetingLink) {
        $rows['Teams meeting'] = $teamsMeetingLink;
    }

    $rows += [
        'Course' => $course,
        'Topics' => (string)($booking['topics_notes'] ?? ''),
        'Professor' => (string)($booking['professor_name'] ?? ''),
        'Created by' => (string)$booking['made_by_name'],
        'Session' => $sessionType,
    ];

    $text = 'Dear ' . $greetingName . ",\n\n";
    $text .= implode("\n\n", $copy['paragraphs']) . "\n\n";
    $text .= "Session details:\n\n";
    foreach ($rows as $label => $value) {
        $text .= $label . ': ' . ($value !== '' ? $value : 'N/A') . "\n";
    }
    $text .= "\nStudents:\n";
    foreach ($studentLines as $line) {
        $text .= '- ' . $line . "\n";
    }
    $text .= "\nCentro Universitario de Aprendizaje\n";
    $text .= "Universidad Interamericana de Puerto Rico, Recinto de Aguadilla\n\n";
    $text .= $contactText . "\n\n";
    $text .= "This is an automated message from CUA Bookings.";

    $htmlRows = '';
    foreach ($rows as $label => $value) {
        $displayValue = $value !== '' ? $value : 'N/A';
        $isTeamsMeetingLink = $label === 'Teams meeting' && filter_var($displayValue, FILTER_VALIDATE_URL) !== false;
        $htmlValue = $isTeamsMeetingLink
            ? '<a href="' . htmlspecialchars($displayValue, ENT_QUOTES, 'UTF-8') . '" style="color:#007a5e;font-weight:700;text-decoration:underline;">Join Microsoft Teams meeting</a>'
                . '<div style="margin-top:6px;color:#5f6d67;font-size:12px;line-height:1.4;word-break:break-word;">'
                . htmlspecialchars($displayValue, ENT_QUOTES, 'UTF-8')
                . '</div>'
            : htmlspecialchars($displayValue, ENT_QUOTES, 'UTF-8');

        $htmlRows .= '<tr><th align="left" style="width:34%;padding:12px 14px;border-bottom:1px solid #dfe6dc;'
            . 'background:#f5f7f2;color:#173f35;font-size:14px;line-height:1.4;">'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
            . '</th><td style="padding:12px 14px;border-bottom:1px solid #dfe6dc;color:#173f35;'
            . 'font-size:14px;line-height:1.4;">'
            . $htmlValue
            . '</td></tr>';
    }

    $htmlStudents = '';
    foreach ($studentLines as $line) {
        $htmlStudents .= '<li style="margin:0 0 8px;line-height:1.5;">'
            . htmlspecialchars($line, ENT_QUOTES, 'UTF-8')
            . '</li>';
    }

    $htmlParagraphs = '';
    foreach ($copy['paragraphs'] as $paragraph) {
        $htmlParagraphs .= '<p style="margin:0 0 14px;color:#173f35;font-size:15px;line-height:1.6;">'
            . htmlspecialchars($paragraph, ENT_QUOTES, 'UTF-8')
            . '</p>';
    }

    $html = '<!doctype html><html><body style="margin:0;padding:0;background:#f5f7f2;'
        . 'font-family:Arial,Helvetica,sans-serif;color:#173f35;">'
        . '<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;'
        . 'overflow:hidden;mso-hide:all;">'
        . htmlspecialchars($copy['preheader'], ENT_QUOTES, 'UTF-8')
        . '</span>'
        . '<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;'
        . 'background:#f5f7f2;margin:0;padding:0;"><tr><td align="center" style="padding:24px 12px;">'
        . '<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;'
        . 'width:100%;max-width:720px;background:#ffffff;border:1px solid #dfe6dc;">'
        . '<tr><td style="background:#004b38;padding:26px 24px;text-align:center;">'
        . $logoHtml
        . '<div style="color:#fed141;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">'
        . 'Centro Universitario de Aprendizaje</div>'
        . '<h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;font-weight:700;">'
        . htmlspecialchars($copy['headline'], ENT_QUOTES, 'UTF-8')
        . '</h1></td></tr>'
        . '<tr><td style="padding:28px 24px 8px;">'
        . '<p style="margin:0 0 14px;color:#173f35;font-size:16px;line-height:1.6;">Dear '
        . htmlspecialchars($greetingName, ENT_QUOTES, 'UTF-8')
        . ',</p>'
        . $htmlParagraphs
        . '</td></tr>'
        . '<tr><td style="padding:8px 24px 24px;">'
        . '<h2 style="margin:0 0 12px;color:#007a5e;font-size:18px;line-height:1.3;">Session Details</h2>'
        . '<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;'
        . 'width:100%;border:1px solid #dfe6dc;">'
        . $htmlRows
        . '</table>'
        . '<h2 style="margin:24px 0 10px;color:#007a5e;font-size:18px;line-height:1.3;">Students</h2>'
        . '<ul style="margin:0;padding-left:20px;color:#173f35;font-size:14px;">' . $htmlStudents . '</ul>'
        . '</td></tr>'
        . '<tr><td style="background:#f5f7f2;border-top:4px solid #fed141;padding:20px 24px;">'
        . '<p style="margin:0 0 6px;color:#173f35;font-size:14px;font-weight:700;line-height:1.5;">'
        . 'Centro Universitario de Aprendizaje</p>'
        . '<p style="margin:0 0 12px;color:#5f6d67;font-size:13px;line-height:1.5;">'
        . 'Universidad Interamericana de Puerto Rico, Recinto de Aguadilla</p>'
        . $contactHtml
        . '<p style="margin:12px 0 0;color:#5f6d67;font-size:12px;line-height:1.5;">'
        . 'This is an automated message from CUA Bookings.'
        . '</p></td></tr>'
        . '</table></td></tr></table></body></html>';

    return [
        'to_email' => $recipient['email'],
        'to_name' => $recipient['name'],
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
        'inline_images' => $inlineImages,
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
        $summary['skipped'][] = 'No valid student or required administrative notification email addresses were found.';
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
