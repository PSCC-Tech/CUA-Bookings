<?php
include 'db.php';

$student_name = $_POST['student_name'];
$slot_id = $_POST['slot_id'];

// Check if still available
$check = $conn->query("SELECT * FROM availability WHERE id = $slot_id AND available = 1");

if ($check->num_rows > 0) {

    $slot = $check->fetch_assoc();
    $tutor_id = $slot['tutor_id'];
    $date = $slot['date'];
    $time = $slot['time'];

    // Insert booking
    $conn->query("INSERT INTO bookings (student_name, tutor_id, date, time)
                  VALUES ('$student_name', '$tutor_id', '$date', '$time')");

    // Mark as unavailable
    $conn->query("UPDATE availability SET available = 0 WHERE id = $slot_id");

    header("Location: success.php");
} else {
    echo "Sorry, this slot was just booked by someone else.";
}
?>