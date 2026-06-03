# CUA Bookings User Manual

Last updated: June 1, 2026

## Purpose

CUA Bookings is used by the Centro Universitario de Aprendizaje to create, view, and manage mentorship bookings. It keeps course, mentor, student, schedule, absence, session, and reporting information in one system.

## Opening the System

Open the application through the web server, not directly from the file system.

For a local XAMPP installation, use:

```text
http://localhost/CUA-Bookings/index.html
```

Apache and MySQL must be running. If the app is opened as a local file, the PHP APIs cannot run and the system will show connection or JSON errors.

## Signing In and Out

1. Open the app.
2. Enter your assigned email and password on the sign-in page.
3. After sign-in, the system opens the Bookings page or the page you were trying to access.
4. Use the Logout control in the sidebar when finished.

If your session expires, the app redirects you to `login.html`.

## User Roles

### Administrator

Administrators can:

- Create and manage bookings.
- Start, stop, edit, and cancel booking sessions.
- Add, edit, and delete courses.
- Add, edit, and delete mentors.
- Record mentor absences.
- View and export reports.
- Edit account profile settings and the Microsoft Teams meeting link.

### Limited or Staff

Limited and Staff users can:

- Create bookings.
- Manage daily bookings and active sessions.
- View courses, mentors, schedules, and details.

Administrative actions are hidden or blocked for these users. If a non-administrator opens an administrator-only page, the system redirects them back to an allowed page.

## Required Formats

Use these formats when entering data:

- Student ID or Mentor ID: `A00123456`
- Course code: `MATH 1500`
- Phone number: `787-555-5555`
- Email: a valid email address, such as `student@example.edu`

The system formats many fields automatically as you type, but invalid values still prevent saving.

## Sidebar Navigation

The main sidebar includes:

- Bookings: create new bookings.
- Courses: browse and manage courses.
- Mentors: browse and manage mentors.
- Account: view and edit your profile.
- Logout: sign out of the system.

Some pages also show top navigation options:

- `absence.html`: record mentor absences.
- `view.html`: view upcoming bookings and active sessions.
- `data.html`: view and export reports.

## Creating a Booking

Use the Bookings page to create scheduled appointments or walk-in sessions.

1. Choose a course category or keep Show All.
2. Search by course code or course name.
3. Select the course from the suggestions.
4. Select a mentor. The mentor list is limited to mentors assigned to that course.
5. Choose the booking type:
   - Scheduled: select a future date and time from the calendar.
   - Walk-in: the system uses the current date and time and starts the session immediately.
6. Enter the primary student information.
7. Choose Single or Grouped.
8. For grouped sessions, set the group size. The system supports 2 to 6 students.
9. Enter a location.
10. Enter topics or select a recommendation.
11. Enter the professor or select a recommendation.
12. Submit the booking.

For scheduled bookings, the selected slot must be in the future, inside the mentor's availability, outside any mentor absence, and not overlap another scheduled or active booking.

After a booking is created, email notifications are attempted if mail is configured. A booking can still be saved even if email delivery fails.

## Booking Calendar

The calendar shows mentor availability, existing bookings, and absences.

- Use the previous and next buttons to move between months.
- Use Today to return to the current month.
- Select a day to view available slots.
- Select a slot and confirm the date and time.

If no slot appears, check that the course and mentor are selected, that the mentor has an active schedule for that date, and that the date is not blocked by an absence or another booking.

## Viewing and Managing Bookings

Open `view.html` to see upcoming bookings and active sessions.

The Upcoming Bookings section shows scheduled future bookings and active bookings. Use the filters to narrow the list by:

- Mentor
- Student
- Category
- Hour
- Search text

Click a booking card to open its details.

From the details modal, you can:

- Start Session: changes a scheduled booking to active.
- Stop Session: completes an active booking.
- Cancel Session: cancels a scheduled or active booking.
- Edit: update a scheduled booking.

Only scheduled bookings can be edited. Make necessary corrections before starting a session.

## Editing a Booking

Only scheduled bookings can be edited.

1. Open the booking details.
2. Click Edit.
3. Update the needed fields, such as mentor, date and time, location, course, topics, professor, made-by user, student details, or session type.
4. For grouped sessions, use the student controls to move between students, add a student, or remove a student.
5. Click Save.

If the course or mentor changes, choose a fresh date and time because the previous slot may no longer be valid.

## Courses

Open the Courses page to browse available courses by category.

You can:

- Search courses.
- Filter by mentor.
- Filter by category.
- Change rows per page.
- Open course details.
- View full professor or mentor lists from table cells.

### Adding a Course

Administrators can add courses from the Add button on the Courses page.

1. Enter the course code.
2. Enter the course name.
3. Choose a category.
4. Enter professors separated by commas.
5. Optionally select assigned mentors.
6. Add topics.
7. Enter a description.
8. Click Add Course.

If the course prefix is new, the selected category is used to create the subject/category relationship.

### Editing a Course

Administrators can edit a course from the course details page.

Editable fields include:

- Course code
- Course name
- Professors
- Topics
- Description
- Assigned mentors

Click Confirm to save or Cancel to discard changes.

### Deleting Courses

Administrators can select courses from the Courses page and confirm deletion from the delete panel. Deleted courses are marked inactive and removed from active mentor assignments.

## Mentors

Open the Mentors page to browse available mentors.

You can:

- Search mentors.
- Filter mentors by course category.
- Open mentor details.

### Adding a Mentor

Administrators can add mentors from the Add button on the Mentors page.

1. Enter the mentor ID.
2. Enter the mentor name.
3. Enter an email or phone number.
4. Set the schedule start date.
5. Optionally set a schedule end date.
6. Add weekly availability shifts for Monday through Friday.
7. Optionally assign courses.
8. Click Add Mentor.

Leave the end date blank if the weekly schedule should stay active until changed.

### Editing Mentor Details

Administrators can edit a mentor from the mentor details page.

Editable fields include:

- Mentor ID
- Mentor name
- Contact
- Schedule start and end dates
- Weekly availability shifts

The Courses tab on the mentor details page also lets administrators add or remove assigned courses.

### Deleting Mentors

Administrators can select mentors from the Mentors page and confirm deletion from the delete panel. Deleted mentors are marked inactive, and their active course and availability assignments are deactivated.

## Mentor Absences

Administrators use `absence.html` to record when a mentor is unavailable.

1. Select the mentor.
2. Choose the absence date.
3. Select Full Day or Specific Time.
4. For a specific-time absence, choose the start and end time.
5. Submit the absence.

Absences block future bookings during the unavailable period and appear in schedule data and reports.

## Reports and CSV Export

Administrators use `data.html` to view reports.

Available report tabs:

- Bookings
- Mentors
- Courses
- Students
- Absences

Use filters such as date range, status, booking type, category, mentor, course, student, professor, location, made by, active status, and search text. The visible filters change based on the selected report.

Click Refresh to reload the current report, Reset to clear filters, and Download CSV to export the current rows.

## Account Page

The Account page shows your profile, account details, permissions, and account status.

Click Edit to update editable profile fields:

- Full name
- Administrative title
- Email
- Phone
- Office
- Preferred contact method
- Microsoft Teams meeting link, for administrators only

The Teams meeting link is included in email notifications when the booking location is online or Microsoft Teams.

## Email Notifications

When a new booking is created, the system attempts to notify:

- Students with valid email addresses.
- The assigned mentor, if the mentor has an email address.
- The CUA coordinator.
- Additional supervisors for selected categories, such as Technology or English.

If the location is Microsoft Teams or online, the configured Teams meeting link is included.

If notifications fail, review the mail configuration on the server. The booking itself may still be created successfully.

## Common Problems

### The app says the PHP API did not return JSON

Open the project through XAMPP/Apache using `http://localhost/CUA-Bookings/`. Do not open the HTML files directly from Finder.

### I cannot access a page

The page may require administrator access. Sign in with an administrator account or use the allowed pages for your role.

### No mentors appear after selecting a course

The course may not have assigned mentors. An administrator can assign mentors from the course details page or mentor details page.

### No available time slots appear

Check the mentor's weekly schedule, schedule date range, absences, and existing bookings.

### The booking will not save

Check required fields and formats:

- Course selected from the list.
- Mentor selected.
- Future date and time for scheduled bookings.
- Location entered.
- Every student has a valid ID and name.
- Email and phone values are valid when provided.

### The booking saved but email was not sent

The mail server may not be configured or reachable. The booking can still exist even when notifications fail.

## Recommended Operating Practices

- Keep mentor schedules current before creating bookings.
- Record mentor absences as soon as they are known.
- Assign mentors to courses before front desk staff begin booking those courses.
- Confirm student ID and contact details before submitting.
- Use cancellation instead of deleting booking records.
- Export CSV reports regularly when operational records are needed outside the system.
