// Confirmation Script
function openConfirmation(dateStr, timeStr) {
    const confirmModal = document.getElementById("confirm-selection");
    const confirmText = document.getElementById("confirm-text");

    confirmText.textContent = `Confirm booking on ${dateStr} at ${timeStr}?`;
    confirmModal.classList.remove("hidden");

    document.getElementById("confirm-yes").onclick = () => {
        setSelectedDateTime(dateStr, timeStr);
        confirmModal.classList.add("hidden");
    };

    document.getElementById("confirm-no").onclick = () => {
        confirmModal.classList.add("hidden");
    };
}

document.getElementById("open-calendar-btn").addEventListener("click", (event) => {
    if (event.currentTarget.disabled) return;

    document.dispatchEvent(new CustomEvent("cua-calendar-before-open"));
    document.getElementById("calendar-modal").style.display = "flex";
});

document.getElementById("close-calendar").addEventListener("click", () => {
    document.getElementById("calendar-modal").style.display = "none";
});

function setSelectedDateTime(dateString, timeString) {
    const btn = document.getElementById("open-calendar-btn");
    const hidden = document.getElementById("selected-datetime");

    hidden.value = `${dateString} ${timeString}`;
    btn.textContent = `${dateString} - ${timeString}`;
    btn.classList.add("has-selection");

    document.getElementById("calendar-modal").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {

    // -------------------------
    // GROUP COUNTER + STUDENTS
    // -------------------------

    const groupSizeEl = document.getElementById("group-size");
    const extraStudentsContainer = document.getElementById("extra-students");

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
            label.textContent = `Student ${i}`;
            extraStudentsContainer.appendChild(label);

            const row1 = document.createElement("div");
            row1.classList.add("extra-student-row");
            row1.innerHTML = `
                <div class="student-field">
                    <input type="text" name="student_${i}_name" placeholder="Name">
                </div>
                <div class="student-field">
                    <input type="text" name="student_${i}_id" placeholder="Student ID">
                </div>
            `;
            extraStudentsContainer.appendChild(row1);

            const row2 = document.createElement("div");
            row2.classList.add("extra-student-row");
            row2.innerHTML = `
                <div class="student-field">
                    <input type="email" name="student_${i}_email" placeholder="Email">
                </div>
                <div class="student-field">
                    <input type="text" name="student_${i}_phone" placeholder="Phone Number">
                </div>
            `;
            extraStudentsContainer.appendChild(row2);
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
            categories: mentor.categories
        }))
        : [
            { name: "John Smith", categories: ["Math", "Computer Science"] },
            { name: "John Doe", categories: ["Business", "Biology"] },
            { name: "Jane Smith", categories: ["Math", "Biology"] },
            { name: "Jane Doe", categories: ["Biology", "Math"] },
            { name: "Dr. Wilson", categories: ["Computer Science", "Math"] },
            { name: "Dr. Adams", categories: ["Business"] }
        ];

    // -------------------------
    // CATEGORY DROPDOWN + FILTERING
    // -------------------------
    const categoryBtn = document.getElementById("category-btn");
    const categoryDropdown = document.getElementById("category-dropdown");
    const mentorSelect = document.getElementById("mentor-select");
    const courseCodeInput = document.getElementById("course-code");
    const courseNameInput = document.querySelector('input[placeholder="Course Name"]');
    const dateTimeButton = document.getElementById("open-calendar-btn");
    const selectedDateTimeInput = document.getElementById("selected-datetime");
    const bookingTypeValue = document.getElementById("booking-type-value");
    const bookingTypeInputs = document.querySelectorAll("input[name='booking-type']");
    const bookingForm = document.querySelector(".form-container form");

    let selectedCategory = 'Show All';
    let selectedCourse = null;
    let bookingType = "scheduled";

    function getCourseMentors(course) {
        if (course && window.MentorScheduleStore) {
            return window.MentorScheduleStore.getMentorsForCourse(course.id)
                .map(mentor => ({
                    name: mentor.name,
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
            mentorSelect.appendChild(option);
        });
    }

    function clearSelectedDateTime() {
        selectedDateTimeInput.value = "";
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

        if (courseCodeInput.autocompleteData && window.Autocomplete) {
            window.Autocomplete.setCategory(courseCodeInput, selectedCategory);
        }

        updateMentorOptions(getCourseMentors(course), false);
        updateDateTimeButtonState();
        syncCalendarCourse(false);
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

    function handleBookingSubmit(event) {
        if (!ensureCourseSelected()) {
            event.preventDefault();
            alert("Please select a course before creating the booking.");
            courseCodeInput.focus();
            return;
        }

        if (!mentorSelect.value) {
            event.preventDefault();
            alert("Please select a mentor before creating the booking.");
            mentorSelect.focus();
            return;
        }

        if (bookingType === "walk-in") {
            event.preventDefault();
            const now = stampWalkInDateTime();
            alert(`Walk-in booking ready for ${now.dateString} at ${now.timeString}.`);
            return;
        }

        if (!selectedDateTimeInput.value) {
            event.preventDefault();
            alert("Please choose a date and time before creating the booking.");
            dateTimeButton.focus();
        }
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
            if (courseCodeInput && courseCodeInput.autocompleteData && Autocomplete) {
                Autocomplete.setCategory(courseCodeInput, selectedCategory);
            }
        });
    });

    // Initialize autocomplete for course code
    if (courseCodeInput && Autocomplete) {
        Autocomplete.init(courseCodeInput, 'courses', {
            minChars: 1,
            maxResults: 8,
            debounceMs: 300,
            categoryFilter: selectedCategory,
            onSelect: (suggestion) => {
                selectCourse(suggestion);
            }
        });
    }

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

});
