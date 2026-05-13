<?php
declare(strict_types=1);

return [
    'enabled' => true,

    // Use "smtp" for real outgoing email. Use "mail" only if XAMPP/PHP mail()
    // has already been configured on this computer.
    'transport' => 'smtp',

    'from_email' => 'your-sender-email@example.com',
    'from_name' => 'CUA Bookings',
    'reply_to' => 'your-admin-email@example.com',

    'smtp' => [
        'host' => 'smtp.example.com',
        'port' => 587,
        'username' => 'your-sender-email@example.com',
        'password' => 'your-smtp-password-or-app-password',
        'encryption' => 'tls', // tls, ssl, or none
        'timeout' => 20,
    ],
];
