// Confirmation Script
function openConfirmation(dateStr, timeStr, endTimeStr = "") {
    const confirmModal = document.getElementById("confirm-selection");
    const confirmText = document.getElementById("confirm-text");

    confirmText.textContent = endTimeStr
        ? `Confirm booking on ${dateStr} from ${timeStr} to ${endTimeStr}?`
        : `Confirm booking on ${dateStr} at ${timeStr}?`;
    confirmModal.classList.remove("hidden");

    document.getElementById("confirm-yes").onclick = () => {
        setSelectedDateTime(dateStr, timeStr, endTimeStr);
        confirmModal.classList.add("hidden");
    };

    document.getElementById("confirm-no").onclick = () => {
        confirmModal.classList.add("hidden");
    };
}

function setSelectedDateTime(dateString, timeString, endTimeString = "") {
    const btn = document.getElementById("open-calendar-btn");
    const hidden = document.getElementById("selected-datetime");

    hidden.value = `${dateString} ${timeString}`;
    hidden.dataset.date = dateString;
    hidden.dataset.time = timeString;
    hidden.dataset.endTime = endTimeString;
    btn.textContent = endTimeString
        ? `${dateString} - ${timeString} to ${endTimeString}`
        : `${dateString} - ${timeString}`;
    btn.classList.add("has-selection");

    const calendarModal = document.getElementById("calendar-modal");
    if (calendarModal) calendarModal.style.display = "none";
    const confirmModal = document.getElementById("confirm-selection");
    if (confirmModal) confirmModal.classList.add("hidden");
}

document.addEventListener("click", (event) => {
    const closeCalendarBtn = event.target.closest("#close-calendar");
    if (!closeCalendarBtn) return;

    const calendarModal = closeCalendarBtn.closest(".modal");
    if (calendarModal) {
        calendarModal.style.display = "none";
    }

    const confirmModal = document.getElementById("confirm-selection");
    if (confirmModal) {
        confirmModal.classList.add("hidden");
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    if (window.Autocomplete) {
        await window.Autocomplete.loadCourseData().catch(() => null);
    }

    if (window.MentorScheduleStore) {
        await window.MentorScheduleStore.loadFromApi().catch(() => null);
    }

    const calendarModal = document.getElementById("calendar-modal");
    const closeCalendarBtn = document.getElementById("close-calendar");
    const confirmModal = document.getElementById("confirm-selection");

    function hideCalendarModal() {
        if (calendarModal) {
            calendarModal.style.display = "none";
        }
        if (confirmModal) {
            confirmModal.classList.add("hidden");
        }
    }

    if (closeCalendarBtn && calendarModal) {
        closeCalendarBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            hideCalendarModal();
        });

        document.addEventListener("click", (event) => {
            if (event.target === calendarModal) {
                hideCalendarModal();
            }
        });
    }

    // -------------------------
    // GROUP COUNTER + STUDENTS
    // -------------------------

    const groupSizeEl = document.getElementById("group-size");
    const extraStudentsContainer = document.getElementById("extra-students");

    function fillStudentFields(student, fields) {
        if (!student || !fields) return;

        if (fields.id) fields.id.value = student.studentId || student.student_number || "";
        if (fields.name) fields.name.value = student.name || student.full_name || "";
        if (fields.email) fields.email.value = student.email || "";
        if (fields.phone) fields.phone.value = student.phone || "";
    }

    async function fillExactStudentMatch(idInput, fields) {
        const studentNumber = idInput?.value.trim();
        if (!studentNumber || !window.CUAApi) return;

        try {
            const students = await window.CUAApi.searchStudents(studentNumber);
            const exact = students.find(student =>
                String(student.studentId || student.student_number || "").toLowerCase() === studentNumber.toLowerCase()
            );

            if (exact) {
                fillStudentFields(exact, fields);
            }
        } catch (error) {
            console.warn("Could not search students:", error);
        }
    }

    function setupStudentIdAutocomplete(idInput, fields) {
        if (!idInput || !window.Autocomplete || idInput.autocompleteData) return;

        window.Autocomplete.init(idInput, "studentsByID", {
            minChars: 1,
            maxResults: 8,
            debounceMs: 250,
            noResultsText: "No matching students found",
            onSelect: (student) => fillStudentFields(student, fields)
        });

        idInput.addEventListener("blur", () => {
            fillExactStudentMatch(idInput, fields);
        });
    }

    function restoreStudent1() {
        const block = document.getElementById("student-1-block");

        block.querySelectorAll("label").forEach(label => {
            label.style.display = "";
        });

        const title = document.getElementById("student-1-title");
        if (title) title.remove();
    }

    function convertStudent1ToGrouped() {
        const block = document.getElementById("student-1-block");

        block.querySelectorAll("label").forEach(label => {
            label.style.display = "none";
        });

        if (!document.getElementById("student-1-title")) {
            const title = document.createElement("h4");
            title.id = "student-1-title";
            title.textContent = "Student 1";
            block.prepend(title);
        }
    }

    function updateExtraStudents() {
        const size = parseInt(groupSizeEl.textContent, 10);

        if (size === 1) {
            restoreStudent1();
            extraStudentsContainer.innerHTML = "";
            return;
        }

        convertStudent1ToGrouped();
        extraStudentsContainer.innerHTML = "";

        for (let i = 2; i <= size; i++) {

            const label = document.createElement("h4");
            label.textContent = `Student ${i} (optional)`;
            extraStudentsContainer.appendChild(label);

            const row1 = document.createElement("div");
            row1.classList.add("extra-student-row");
            row1.innerHTML = `
                <div class="student-field">
                    <input type="text" name="student_${i}_name" placeholder="Name">
                </div>
                <div class="student-field">
                    <input type="text" name="student_${i}_id" placeholder="A00123456">
                </div>
            `;
            extraStudentsContainer.appendChild(row1);

            const row2 = document.createElement("div");
            row2.classList.add("extra-student-row");
            row2.innerHTML = `
                <div class="student-field">
                    <input type="email" name="student_${i}_email" placeholder="student@example.edu">
                </div>
                <div class="student-field">
                    <input type="tel" name="student_${i}_phone" placeholder="787-555-5555">
                </div>
            `;
            extraStudentsContainer.appendChild(row2);

            setupStudentIdAutocomplete(row1.querySelector(`[name="student_${i}_id"]`), {
                id: row1.querySelector(`[name="student_${i}_id"]`),
                name: row1.querySelector(`[name="student_${i}_name"]`),
                email: row2.querySelector(`[name="student_${i}_email"]`),
                phone: row2.querySelector(`[name="student_${i}_phone"]`)
            });
        }
    }

    // Show/hide group size selector
    const groupContainer = document.getElementById("group-size-container");
    document.querySelectorAll("input[name='session-type']").forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.value === "group") {
                groupContainer.classList.remove("hidden");
                updateExtraStudents();
            } else {
                groupContainer.classList.add("hidden");
                extraStudentsContainer.innerHTML = "";
                restoreStudent1();
            }
        });
    });

    // Counter logic
    const decreaseBtn = document.getElementById("group-decrease");
    const increaseBtn = document.getElementById("group-increase");

    decreaseBtn.addEventListener("click", () => {
        let size = parseInt(groupSizeEl.textContent);
        if (size > 2) {
            groupSizeEl.textContent = size - 1;
            updateExtraStudents();
        }
    });

    increaseBtn.addEventListener("click", () => {
        let size = parseInt(groupSizeEl.textContent);
        if (size < 6) {
            groupSizeEl.textContent = size + 1;
            updateExtraStudents();
        }
    });

    // -------------------------
    // MENTOR DATA
    // -------------------------
    const mentorsData = window.MentorScheduleStore
        ? window.MentorScheduleStore.listMentors().map(mentor => ({
            name: mentor.name,
            mentorNumber: mentor.mentor_number || mentor.id || "",
            categories: mentor.categories
        }))
        : [];

    // -------------------------
    // CATEGORY DROPDOWN + FILTERING
    // -------------------------
    const categoryBtn = document.getElementById("category-btn");
    const categoryDropdown = document.getElementById("category-dropdown");
    const mentorSelect = document.getElementById("mentor-select");
    const courseCodeInput = document.getElementById("course-code");
    const courseNameInput = document.getElementById("course-name") || document.querySelector('input[placeholder="Course Name"]');
    const dateTimeButton = document.getElementById("open-calendar-btn");
    const selectedDateTimeInput = document.getElementById("selected-datetime");
    const mentorshipDurationSelect = document.getElementById("mentorship-duration");
    const bookingTypeValue = document.getElementById("booking-type-value");
    const bookingTypeInputs = document.querySelectorAll("input[name='booking-type']");
    const bookingForm = document.querySelector(".form-container form");
    const locationInput = document.getElementById("location-input");
    const topicsInput = document.getElementById("topics-input");
    const professorInput = document.getElementById("professor-input");
    const madeByInput = document.getElementById("made-by-input");
    const submitButton = bookingForm?.querySelector("button[type='submit']");

    let selectedCategory = 'Show All';
    let selectedCourse = null;
    let bookingType = "scheduled";
    let isSubmitting = false;

    function currentUserName() {
        return window.CUAAuth?.user?.fullName || window.CUAAuth?.user?.full_name || "";
    }

    function getSelectedMentorshipDurationMinutes() {
        const value = Number(mentorshipDurationSelect?.value || 60);
        return value === 30 ? 30 : 60;
    }

    function updateCalendarSlotDuration() {
        const minutes = getSelectedMentorshipDurationMinutes();
        window.CUACalendarSlotDurationMinutes = minutes;

        if (window.CUACalendar && typeof window.CUACalendar.refresh === "function") {
            window.CUACalendar.refresh();
        }
    }

    window.CUACalendarSlotDurationMinutes = getSelectedMentorshipDurationMinutes();

    dateTimeButton?.addEventListener("click", (event) => {
        if (event.currentTarget.disabled) return;

        updateCalendarSlotDuration();
        document.dispatchEvent(new CustomEvent("cua-calendar-before-open"));
        document.getElementById("calendar-modal").style.display = "flex";
    });

    mentorshipDurationSelect?.addEventListener("change", () => {
        updateCalendarSlotDuration();
    });

    function notifyError(message) {
        window.CUANotify?.error(message) || alert(message);
    }

    function notifySuccess(message) {
        window.CUANotify?.success(message) || alert(message);
    }

    function setBookingSubmitting(isBusy) {
        isSubmitting = isBusy;

        if (!submitButton) return;

        submitButton.disabled = isBusy;
        submitButton.classList.toggle("is-submitting", isBusy);
        submitButton.textContent = isBusy ? "Submitting..." : "Submit";
        submitButton.setAttribute("aria-busy", isBusy ? "true" : "false");
    }

    if (madeByInput) {
        madeByInput.value = currentUserName();
        document.addEventListener("cua-auth-ready", event => {
            madeByInput.value = event.detail?.fullName || event.detail?.full_name || "";
        });
    }

    function getCourseMentors(course) {
        if (course && window.MentorScheduleStore) {
            return window.MentorScheduleStore.getMentorsForCourse(course.id)
                .map(mentor => ({
                    name: mentor.name,
                    mentorNumber: mentor.mentor_number || mentor.id || "",
                    categories: mentor.categories
                }));
        }

        if (selectedCategory && selectedCategory !== "Show All" && selectedCategory !== "all") {
            return mentorsData.filter(mentor => mentor.categories.includes(selectedCategory));
        }

        return mentorsData;
    }

    function updateMentorOptions(mentors, disabled = false) {
        if (!mentorSelect) return;

        mentorSelect.value = '';
        mentorSelect.disabled = disabled;

        const options = mentorSelect.querySelectorAll('option');
        options.forEach((option, index) => {
            if (index > 0) option.remove();
        });

        mentors.forEach(mentor => {
            const option = document.createElement('option');
            option.value = mentor.name;
            option.textContent = mentor.name;
            option.dataset.mentorNumber = mentor.mentorNumber || "";
            mentorSelect.appendChild(option);
        });
    }

    function clearSelectedDateTime() {
        selectedDateTimeInput.value = "";
        selectedDateTimeInput.dataset.date = "";
        selectedDateTimeInput.dataset.time = "";
        dateTimeButton.classList.remove("has-selection");
    }

    function updateDateTimeButtonState() {
        if (bookingType === "walk-in") {
            dateTimeButton.disabled = true;
            dateTimeButton.textContent = "Uses Current Date & Time";
            dateTimeButton.classList.add("walk-in-mode");
            dateTimeButton.classList.remove("has-selection");
            return;
        }

        dateTimeButton.classList.remove("walk-in-mode");

        if (!selectedCourse) {
            dateTimeButton.disabled = true;
            dateTimeButton.textContent = "Select a Course First";
            clearSelectedDateTime();
            return;
        }

        dateTimeButton.disabled = false;
        dateTimeButton.textContent = "Choose Date & Time";
    }

    function syncCalendarCourse(onlySelectedMentor = false) {
        if (!window.CUACalendar || !selectedCourse) return;

        window.CUACalendar.setCourse(
            selectedCourse.id,
            mentorSelect.value,
            onlySelectedMentor && Boolean(mentorSelect.value)
        );
    }

    function prepareCalendarForOpen() {
        if (!selectedCourse) return;

        const hasSelectedMentor = Boolean(mentorSelect.value);
        syncCalendarCourse(hasSelectedMentor);

        if (hasSelectedMentor && window.CUACalendar) {
            window.CUACalendar.setMentor(mentorSelect.value);
        }
    }

    function selectCourse(course) {
        selectedCourse = course;
        courseCodeInput.value = course.id;
        selectedCategory = course.category;
        categoryBtn.textContent = selectedCategory;

        if (courseNameInput) {
            courseNameInput.value = course.name;
        }

        const categoryOption = categoryDropdown.querySelector(`[data-category="${selectedCategory}"]`);
        if (categoryOption) {
            setSelectedOption(categoryOption);
        }

        updateAutocompleteCategory(courseCodeInput, selectedCategory, false);
        updateAutocompleteCategory(courseNameInput, selectedCategory, false);

        updateMentorOptions(getCourseMentors(course), false);
        updateDateTimeButtonState();
        syncCalendarCourse(false);
        refreshRecommendationInputs();
    }

    function updateAutocompleteCategory(input, category, refresh = true) {
        if (!input?.autocompleteData || !window.Autocomplete) return;

        input.autocompleteData.config.categoryFilter = category;
        if (refresh) {
            window.Autocomplete.setCategory(input, category);
        } else {
            window.Autocomplete._clearSuggestions(input);
        }
    }

    function clearAutocompleteSuggestions(input) {
        if (input?.autocompleteData && window.Autocomplete) {
            window.Autocomplete._clearSuggestions(input);
        }
    }

    function refreshRecommendationInputs() {
        clearAutocompleteSuggestions(professorInput);
        clearAutocompleteSuggestions(topicsInput);
    }

    function clearSelectedCourse() {
        selectedCourse = null;

        if (mentorSelect) {
            updateMentorOptions(getCourseMentors(null), true);
        }

        if (window.CUACalendar) {
            window.CUACalendar.setCourse("");
        }

        updateDateTimeButtonState();
        refreshRecommendationInputs();
    }

    function findExactCourse(value) {
        if (!window.Autocomplete || !window.Autocomplete.getStaticCourseData) return null;

        const query = value.trim().toLowerCase();
        return window.Autocomplete.getStaticCourseData().find(course =>
            course.id.toLowerCase() === query ||
            course.name.toLowerCase() === query
        ) || null;
    }

    function formatWalkInDateTime(date = new Date()) {
        const dateString = date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
        const timeString = date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        });

        return {
            dateString,
            timeString,
            value: `${dateString} ${timeString}`
        };
    }

    function stampWalkInDateTime() {
        const now = formatWalkInDateTime();
        selectedDateTimeInput.value = now.value;
        selectedDateTimeInput.dataset.date = now.dateString;
        selectedDateTimeInput.dataset.time = now.timeString;
        dateTimeButton.textContent = `${now.dateString} - ${now.timeString}`;
        dateTimeButton.classList.add("has-selection");
        return now;
    }

    function setBookingType(type) {
        bookingType = type === "walk-in" ? "walk-in" : "scheduled";
        if (bookingTypeValue) {
            bookingTypeValue.value = bookingType;
        }

        document.querySelectorAll(".booking-type-option").forEach(option => {
            const input = option.querySelector("input");
            option.classList.toggle("active", input?.value === bookingType);
        });

        clearSelectedDateTime();
        updateDateTimeButtonState();
    }

    function ensureCourseSelected() {
        if (selectedCourse) return true;

        const matchingCourse = findExactCourse(courseCodeInput.value || "");
        if (matchingCourse) {
            selectCourse(matchingCourse);
            return true;
        }

        return false;
    }

    function toISODate(dateLabel = "") {
        const cleaned = String(dateLabel).replace(/^[A-Za-z]+,\s*/, "").trim();
        const parsed = new Date(cleaned);
        if (Number.isNaN(parsed.getTime())) return "";

        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function collectStudents() {
        const students = [{
            student_number: document.getElementById("student-id")?.value.trim() || "",
            full_name: document.getElementById("student-name")?.value.trim() || "",
            email: document.getElementById("student-email")?.value.trim() || "",
            phone: document.getElementById("student-phone")?.value.trim() || ""
        }];

        const isGroup = document.querySelector("input[name='session-type']:checked")?.value === "group";
        if (!isGroup) return students;

        const size = parseInt(groupSizeEl.textContent, 10);
        for (let i = 2; i <= size; i++) {
            const student = {
                student_number: document.querySelector(`[name="student_${i}_id"]`)?.value.trim() || "",
                full_name: document.querySelector(`[name="student_${i}_name"]`)?.value.trim() || "",
                email: document.querySelector(`[name="student_${i}_email"]`)?.value.trim() || "",
                phone: document.querySelector(`[name="student_${i}_phone"]`)?.value.trim() || ""
            };

            if (studentHasAnyValue(student)) {
                students.push(student);
            }
        }

        return students;
    }

    function collectGroupSize() {
        const isGroup = document.querySelector("input[name='session-type']:checked")?.value === "group";
        if (!isGroup) return 1;

        const size = parseInt(groupSizeEl.textContent, 10);
        return Number.isFinite(size) ? Math.max(2, size) : 2;
    }

    function studentHasAnyValue(student) {
        return Boolean(student.student_number || student.full_name || student.email || student.phone);
    }

    function validateStudents(students) {
        return students.every(student =>
            /^[A-Z]00\d{6}$/.test(student.student_number)
            && student.full_name
            && (!student.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email))
            && (!student.phone || /^\d{3}-\d{3}-\d{4}$/.test(student.phone))
        );
    }

    function buildBookingPayload() {
        const selectedMentorOption = mentorSelect.options[mentorSelect.selectedIndex];
        const dateLabel = selectedDateTimeInput.dataset.date || "";
        const timeLabel = selectedDateTimeInput.dataset.time || "";
        const groupSize = collectGroupSize();

        return {
            booking_type: bookingType === "walk-in" ? "walk_in" : "scheduled",
            course_code: selectedCourse.id,
            mentor: mentorSelect.value,
            mentor_number: selectedMentorOption?.dataset.mentorNumber || "",
            location: locationInput?.value.trim() || "",
            professor: professorInput?.value.trim() || "",
            made_by: madeByInput?.value.trim() || currentUserName(),
            topics: topicsInput?.value.trim() || "",
            date: toISODate(dateLabel),
            time: timeLabel,
            duration_minutes: getSelectedMentorshipDurationMinutes(),
            session_type: groupSize > 1 ? "group" : "single",
            group_size: groupSize,
            students: collectStudents()
        };
    }

    async function loadLookups() {
        if (!window.CUAApi) return;

        try {
            const lookups = await window.CUAApi.getLookups();
            const locationList = document.getElementById("location");
            if (locationList && Array.isArray(lookups.locations)) {
                locationList.innerHTML = "";
                lookups.locations.forEach(location => {
                    const option = document.createElement("option");
                    option.value = location.name || location.location_name || "";
                    if (option.value) {
                        locationList.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.warn("Could not load form lookups:", error);
        }
    }

    function getLocationOptions() {
        const locationList = document.getElementById("location");
        if (!locationList) return [];

        return Array.from(locationList.options || [])
            .map(option => ({
                name: option.value || option.textContent || "",
                source: "Location"
            }))
            .filter(location => location.name);
    }

    async function handleBookingSubmit(event) {
        event.preventDefault();

        if (isSubmitting) return;

        if (!ensureCourseSelected()) {
            notifyError("Please select a course before creating the booking.");
            courseCodeInput.focus();
            return;
        }

        if (!mentorSelect.value) {
            notifyError("Please select a mentor before creating the booking.");
            mentorSelect.focus();
            return;
        }

        if (bookingType === "walk-in") {
            stampWalkInDateTime();
        } else if (!selectedDateTimeInput.value) {
            notifyError("Please choose a date and time before creating the booking.");
            dateTimeButton.focus();
            return;
        }

        const payload = buildBookingPayload();

        if (!payload.location) {
            notifyError("Please enter a location.");
            locationInput?.focus();
            return;
        }

        if (!validateStudents(payload.students)) {
            notifyError("Student 1 needs a valid ID and name. Extra students can be left blank, but any extra student entered needs a valid ID, name, phone, and email.");
            return;
        }

        setBookingSubmitting(true);

        try {
            if (!window.CUAApi) throw new Error("Backend API is not loaded.");
            const result = await window.CUAApi.createBooking(payload);
            await window.MentorScheduleStore?.loadFromApi(true);
            notifySuccess(getBookingSuccessMessage(result));
            bookingForm.reset();
            if (madeByInput) madeByInput.value = currentUserName();
            selectedCourse = null;
            clearSelectedDateTime();
            updateMentorOptions(getCourseMentors(null), true);
            setBookingType("scheduled");
            extraStudentsContainer.innerHTML = "";
            restoreStudent1();
        } catch (error) {
            notifyError(error.message || "Could not create booking.");
        } finally {
            setBookingSubmitting(false);
        }
    }

    function getBookingSuccessMessage(result) {
        const notifications = result?.email_notifications;
        if (!notifications) {
            return "Booking created successfully.";
        }

        const sent = Array.isArray(notifications.sent) ? notifications.sent.length : 0;
        const failed = Array.isArray(notifications.failed) ? notifications.failed.length : 0;
        const skipped = Array.isArray(notifications.skipped) ? notifications.skipped : [];

        if (failed > 0) {
            console.warn("Email notification failures:", notifications.failed);
            const firstError = String(notifications.failed.find(item => item?.error)?.error || "").trim();
            const errorDetails = firstError ? ` First error: ${firstError}` : " Check the mail configuration.";
            return `Booking created successfully, but ${failed} email notification${failed === 1 ? "" : "s"} could not be sent. ${sent} sent.${errorDetails}`;
        }

        if (sent > 0) {
            return `Booking created successfully. ${sent} email notification${sent === 1 ? "" : "s"} sent.`;
        }

        if (skipped.length > 0) {
            return `Booking created successfully. Email notifications were not sent: ${skipped[0]}`;
        }

        return "Booking created successfully. No email notifications were sent.";
    }

    // Open/close dropdown
    categoryBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        categoryDropdown.classList.toggle("hidden");
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".dropdown-wrapper")) {
            categoryDropdown.classList.add("hidden");
        }
    });

    // Function to set selected option with checkmark
    function setSelectedOption(option) {
        categoryDropdown.querySelectorAll("div").forEach(o => o.classList.remove("selected"));
        option.classList.add("selected");
    }

    // When selecting a category
    categoryDropdown.querySelectorAll("div").forEach(item => {
        item.addEventListener("click", () => {
            setSelectedOption(item);

            selectedCategory = item.textContent.trim();
            categoryBtn.textContent = selectedCategory;
            categoryDropdown.classList.add("hidden");

            // Clear course code and course name inputs
            if (courseCodeInput) {
                courseCodeInput.value = '';
            }
            if (courseNameInput) {
                courseNameInput.value = '';
            }
            clearSelectedCourse();

            // Update autocomplete filter
            updateAutocompleteCategory(courseCodeInput, selectedCategory, false);
            updateAutocompleteCategory(courseNameInput, selectedCategory, false);
        });
    });

    // Initialize autocomplete for course code
    if (courseCodeInput && window.Autocomplete) {
        window.Autocomplete.init(courseCodeInput, 'courses', {
            minChars: 1,
            maxResults: 8,
            debounceMs: 300,
            categoryFilter: selectedCategory,
            onSelect: (suggestion) => {
                selectCourse(suggestion);
            }
        });
    }

    // Reuse the course autocomplete data source for name-based course selection.
    if (courseNameInput && window.Autocomplete) {
        window.Autocomplete.init(courseNameInput, 'coursesByName', {
            minChars: 1,
            maxResults: 8,
            debounceMs: 300,
            categoryFilter: selectedCategory,
            onSelect: (suggestion) => {
                selectCourse(suggestion);
                courseNameInput.value = suggestion.name;
            }
        });
    }

    if (locationInput && window.Autocomplete) {
        window.Autocomplete.init(locationInput, "locations", {
            minChars: 0,
            maxResults: 8,
            debounceMs: 180,
            showNoResultsOnEmpty: false,
            getLocationOptions
        });
    }

    if (topicsInput && window.Autocomplete) {
        window.Autocomplete.init(topicsInput, "topics", {
            minChars: 0,
            maxResults: 8,
            debounceMs: 180,
            showNoResultsOnEmpty: false,
            getSelectedCourse: () => selectedCourse
        });
    }

    if (professorInput && window.Autocomplete) {
        window.Autocomplete.init(professorInput, "professors", {
            minChars: 0,
            maxResults: 8,
            debounceMs: 180,
            showNoResultsOnEmpty: false,
            getSelectedCourse: () => selectedCourse
        });
    }

    setupStudentIdAutocomplete(document.getElementById("student-id"), {
        id: document.getElementById("student-id"),
        name: document.getElementById("student-name"),
        email: document.getElementById("student-email"),
        phone: document.getElementById("student-phone")
    });

    courseCodeInput.addEventListener("input", () => {
        if (!courseCodeInput.value.trim()) {
            if (courseNameInput) {
                courseNameInput.value = "";
            }
            clearSelectedCourse();
            return;
        }

        if (selectedCourse && courseCodeInput.value.trim() !== selectedCourse.id) {
            clearSelectedCourse();
        }
    });

    courseCodeInput.addEventListener("blur", () => {
        if (selectedCourse || !courseCodeInput.value.trim()) return;

        const matchingCourse = findExactCourse(courseCodeInput.value);
        if (matchingCourse) {
            selectCourse(matchingCourse);
        }
    });

    courseNameInput?.addEventListener("input", () => {
        if (!courseNameInput.value.trim()) {
            courseCodeInput.value = "";
            clearSelectedCourse();
            return;
        }

        if (selectedCourse && courseNameInput.value.trim() !== selectedCourse.name) {
            clearSelectedCourse();
        }
    });

    courseNameInput?.addEventListener("blur", () => {
        if (selectedCourse || !courseNameInput.value.trim()) return;

        const matchingCourse = findExactCourse(courseNameInput.value);
        if (matchingCourse) {
            selectCourse(matchingCourse);
        }
    });

    mentorSelect.addEventListener("change", () => {
        clearSelectedDateTime();

        if (!selectedCourse) return;

        if (mentorSelect.value && window.CUACalendar) {
            window.CUACalendar.setCourse(selectedCourse.id, mentorSelect.value, true);
            window.CUACalendar.setMentor(mentorSelect.value);
        } else {
            syncCalendarCourse(false);
        }

        updateDateTimeButtonState();
    });

    bookingTypeInputs.forEach(input => {
        input.addEventListener("change", () => {
            setBookingType(input.value);
        });
    });

    if (bookingForm) {
        bookingForm.addEventListener("submit", handleBookingSubmit);
    }

    document.addEventListener("cua-calendar-before-open", prepareCalendarForOpen);

    // Initialize mentor list - start disabled
    updateMentorOptions(getCourseMentors(null), true);
    setBookingType("scheduled");
    updateDateTimeButtonState();
    loadLookups();

});
