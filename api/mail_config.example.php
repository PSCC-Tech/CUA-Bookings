<?php
declare(strict_types=1);

return [
    'enabled' => true,

    // Use "smtp" for real outgoing email. Use "mail" only if XAMPP/PHP mail()
    // has already been configured on this computer.
    'transport' => 'smtp',

    'from_email' => 'tutoriacua@aguadilla.inter.edu',
    'from_name' => 'CUA Bookings',
    'reply_to' => 'tutoriacua@aguadilla.inter.edu',

    'smtp' => [
        'host' => 'smtp.office365.com',
        'port' => 587,
        'username' => 'tutoriacua@aguadilla.inter.edu',
        'password' => 'replace-with-the-mailbox-password-or-app-password',
        'encryption' => 'tls', // tls, ssl, or none
        'timeout' => 20,
    ],
];
