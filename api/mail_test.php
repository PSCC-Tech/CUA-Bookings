<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/mailer.php';

require_method(['GET', 'POST']);

$currentUser = require_admin_user();

$config = booking_mail_config();
$smtp = is_array($config['smtp'] ?? null) ? $config['smtp'] : [];
$api = is_array($config['api'] ?? null) ? $config['api'] : [];

function mail_test_config_summary(array $config, array $smtp, array $api): array
{
    return [
        'mail_config_file_exists' => is_file(__DIR__ . '/mail_config.php'),
        'openssl_loaded' => extension_loaded('openssl'),
        'curl_loaded' => function_exists('curl_init'),
        'allow_url_fopen' => filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN),
        'stream_socket_client_available' => function_exists('stream_socket_client'),
        'stream_socket_enable_crypto_available' => function_exists('stream_socket_enable_crypto'),
        'enabled' => (bool)($config['enabled'] ?? true),
        'transport' => strtolower((string)($config['transport'] ?? 'mail')),
        'from_email' => $config['from_email'] ?? '',
        'reply_to' => $config['reply_to'] ?? null,
        'smtp' => [
            'host' => $smtp['host'] ?? '',
            'port' => (int)($smtp['port'] ?? 0),
            'username' => $smtp['username'] ?? '',
            'password_set' => isset($smtp['password']) && $smtp['password'] !== '',
            'encryption' => $smtp['encryption'] ?? '',
            'timeout' => (int)($smtp['timeout'] ?? 0),
        ],
        'api' => [
            'provider' => $api['provider'] ?? '',
            'endpoint' => $api['endpoint'] ?? '',
            'api_key_set' => isset($api['api_key']) && $api['api_key'] !== '',
            'timeout' => (int)($api['timeout'] ?? 0),
        ],
    ];
}

function mail_test_smtp_probe(array $smtp): array
{
    $host = trim((string)($smtp['host'] ?? ''));
    $port = (int)($smtp['port'] ?? 587);
    $encryption = strtolower(trim((string)($smtp['encryption'] ?? 'tls')));
    $timeout = (int)($smtp['timeout'] ?? 20);
    $usesStartTls = in_array($encryption, ['tls', 'starttls'], true);

    if ($host === '') {
        return [
            'ok' => false,
            'stage' => 'config',
            'error' => 'SMTP host is not configured.',
        ];
    }

    $remote = $encryption === 'ssl' ? "ssl://{$host}:{$port}" : "{$host}:{$port}";
    $socket = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);

    if (!$socket) {
        return [
            'ok' => false,
            'stage' => 'connect',
            'error' => "Could not connect to SMTP server: {$errstr} ({$errno}).",
        ];
    }

    try {
        stream_set_timeout($socket, $timeout);
        booking_mail_smtp_expect($socket, [220]);
        booking_mail_smtp_command($socket, 'EHLO localhost', [250]);

        if ($usesStartTls) {
            booking_mail_smtp_command($socket, 'STARTTLS', [220]);
            $cryptoOk = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($cryptoOk !== true) {
                return [
                    'ok' => false,
                    'stage' => 'starttls',
                    'error' => 'Could not start TLS for SMTP connection.',
                ];
            }
            booking_mail_smtp_command($socket, 'EHLO localhost', [250]);
        }

        booking_mail_smtp_command($socket, 'QUIT', [221]);

        return [
            'ok' => true,
            'stage' => 'ready',
            'message' => 'SMTP server is reachable and TLS negotiation succeeded.',
        ];
    } catch (Throwable $error) {
        return [
            'ok' => false,
            'stage' => 'smtp',
            'error' => $error->getMessage(),
        ];
    } finally {
        fclose($socket);
    }
}

function mail_test_api_endpoint(array $config): string
{
    $transport = strtolower((string)($config['transport'] ?? ''));

    if (in_array($transport, ['brevo', 'brevo_api'], true)) {
        return booking_mail_api_endpoint($config, 'https://api.brevo.com/v3/smtp/email');
    }

    if (in_array($transport, ['resend', 'resend_api'], true)) {
        return booking_mail_api_endpoint($config, 'https://api.resend.com/emails');
    }

    return booking_mail_api_endpoint($config, '');
}

function mail_test_api_probe(array $config): array
{
    if (!function_exists('stream_socket_client')) {
        return [
            'ok' => false,
            'stage' => 'environment',
            'error' => 'stream_socket_client is not available.',
        ];
    }

    $endpoint = mail_test_api_endpoint($config);
    $parts = parse_url($endpoint);
    $scheme = strtolower((string)($parts['scheme'] ?? 'https'));
    $host = trim((string)($parts['host'] ?? ''));
    $port = (int)($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
    $timeout = booking_mail_api_timeout($config);

    if ($host === '') {
        return [
            'ok' => false,
            'stage' => 'config',
            'error' => 'Mail API endpoint is not configured.',
        ];
    }

    $remote = ($scheme === 'https' ? 'ssl://' : '') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);

    if (!$socket) {
        return [
            'ok' => false,
            'stage' => 'connect',
            'endpoint' => $endpoint,
            'error' => "Could not connect to mail API endpoint: {$errstr} ({$errno}).",
        ];
    }

    fclose($socket);

    return [
        'ok' => true,
        'stage' => 'ready',
        'endpoint' => $endpoint,
        'message' => 'Mail API endpoint is reachable over HTTPS.',
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $transport = strtolower((string)($config['transport'] ?? 'mail'));
    $payload = ['config' => mail_test_config_summary($config, $smtp, $api)];
    if (isset($_GET['probe'])) {
        $payload['probe'] = in_array($transport, ['brevo', 'brevo_api', 'resend', 'resend_api'], true)
            ? mail_test_api_probe($config)
            : mail_test_smtp_probe($smtp);
    }
    ok($payload);
}

$data = input_json();
$toEmail = normalize_email_address(
    $data['to_email'] ?? $data['to'] ?? ($currentUser['email'] ?? ''),
    'Test recipient email'
);
$toName = trim((string)($data['to_name'] ?? 'CUA Bookings Mail Test'));

$result = booking_mail_send([
    'to_email' => $toEmail,
    'to_name' => $toName,
    'subject' => 'CUA Bookings Mail Relay Test',
    'text' => "This is a test email from CUA Bookings.\n\nIf you received it, the configured mail relay is working.",
    'html' => '<p>This is a test email from CUA Bookings.</p>'
        . '<p>If you received it, the configured mail relay is working.</p>',
], $config);

ok([
    'mail' => $result,
    'config' => mail_test_config_summary($config, $smtp, $api),
]);
