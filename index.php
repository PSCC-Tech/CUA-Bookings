<?php include 'db.php'; ?>

<!DOCTYPE html>
<html>
<head>
    <title>Book a Session</title>
</head>
<body>

<h2>Available Sessions</h2>

<form action="book.php" method="POST">
    <label>Your Name:</label>
    <input type="text" name="student_name" required><br><br>

    <label>Select Slot:</label>
    <select name="slot_id" required>
        <?php
        $result = $conn->query("SELECT availability.id, tutors.name, date, time 
                                FROM availability 
                                JOIN tutors ON availability.tutor_id = tutors.id 
                                WHERE available = 1");

        while($row = $result->fetch_assoc()) {
            echo "<option value='{$row['id']}'>
                    {$row['name']} - {$row['date']} at {$row['time']}
                  </option>";
        }
        ?>
    </select>

    <br><br>
    <button type="submit">Book</button>
</form>

</body>
</html>