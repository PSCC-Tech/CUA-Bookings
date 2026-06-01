<?php
declare(strict_types=1);

return [
    'enabled' => true,
    'transport' => 'smtp',

    'from_email' => 'tutoriacua@aguadilla.inter.edu',
    'from_name' => 'CUA Bookings',
    'reply_to' => 'tutoriacua@aguadilla.inter.edu',

    'smtp' => [
        'host' => 'smtp.office365.com',
        'port' => 587,
        'username' => 'uiagu@aguadilla.inter.edu',
        'password' => 'replace-with-the-mailbox-password-or-app-password',
        'encryption' => 'tls',
        'timeout' => 20,
    ],
];
