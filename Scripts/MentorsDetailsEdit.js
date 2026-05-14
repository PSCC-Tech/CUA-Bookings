document.addEventListener("DOMContentLoaded", () => {

    const editBtn = document.querySelector(".edit-btn");
    const editControls = document.querySelector(".edit-controls");
    const editActions = document.querySelector(".edit-actions");

    if (!editBtn || !editControls || !editActions) return;

    let mentorDetailsReady = Boolean(window.CUACurrentMentor);
    editBtn.disabled = !mentorDetailsReady;
    editBtn.classList.toggle("is-disabled", !mentorDetailsReady);

    document.addEventListener("cua-mentor-details-loaded", () => {
        mentorDetailsReady = true;
        editBtn.disabled = false;
        editBtn.classList.remove("is-disabled");
    });

    const scheduleStartOptions = [
        "---",
        "8:00 AM",
        "8:30 AM",
        "9:00 AM",
        "9:30 AM",
        "10:00 AM",
        "10:30 AM",
        "11:00 AM",
        "11:30 AM",
        "12:00 PM",
        "12:30 PM",
        "1:00 PM",
        "1:30 PM",
        "2:00 PM",
        "2:30 PM",
        "3:00 PM",
        "3:30 PM",
        "4:00 PM",
        "4:30 PM",
        "5:00 PM"
    ];

    const scheduleEndOptions = [
        "---",
        "8:00 AM",
        "8:30 AM",
        "9:00 AM",
        "9:30 AM",
        "10:00 AM",
        "10:30 AM",
        "11:00 AM",
        "11:30 AM",
        "12:00 PM",
        "12:30 PM",
        "1:00 PM",
        "1:30 PM",
        "2:00 PM",
        "2:30 PM",
        "3:00 PM",
        "3:30 PM",
        "4:00 PM",
        "4:30 PM",
        "5:00 PM"
    ];

    function buildScheduleSelect(className, value, options) {
        return `
            <select class="${className}">
                ${options.map(opt => `<option value="${opt}"${opt === value ? " selected" : ""}>${opt}</option>`).join("")}
            </select>`;
    }

    function buildScheduleRow(start, end, removable = false) {
        return `
            <div class="shift-row">
                ${buildScheduleSelect("schedule-start-select", start, scheduleStartOptions)}
                -
                ${buildScheduleSelect("schedule-end-select", end, scheduleEndOptions)}
                ${removable ? `<button type="button" class="remove-schedule">✖</button>` : ""}
            </div>
        `;
    }

    let originalData = {};
    let isEditing = false;

    function escapeAttribute(value) {
        const div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML.replace(/"/g, "&quot;");
    }

    function readScheduleList(scheduleList) {
        return [...scheduleList.querySelectorAll("li")].map((li, index) => {
            const day = li.querySelector("strong")?.textContent.trim() || `Day ${index + 1}:`;
            const shifts = [...li.querySelectorAll(".schedule-shift")]
                // Unavailable rows do not have start/end spans, so skip them instead of crashing edit mode.
                .map(shift => ({
                    start: shift.querySelector(".schedule-start")?.textContent.trim() || "",
                    end: shift.querySelector(".schedule-end")?.textContent.trim() || "",
                }))
                .filter(shift => shift.start && shift.end);

            return { day, shifts };
        });
    }

    function renderScheduleItems(scheduleItems) {
        return scheduleItems.map(item => {
            const shiftHtml = item.shifts.length
                ? item.shifts.map(shift => `<div class="schedule-shift"><span class="schedule-start">${shift.start}</span> - <span class="schedule-end">${shift.end}</span></div>`).join("")
                : `<div class="schedule-shift unavailable">Unavailable</div>`;

            return `<li><strong>${item.day}</strong>${shiftHtml}</li>`;
        }).join("");
    }

    function parseTimeForApi(value) {
        if (!value || value === "---") return "";

        const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return "";

        let hours = Number(match[1]);
        const minutes = match[2];
        const period = match[3].toUpperCase();

        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;

        return `${String(hours).padStart(2, "0")}:${minutes}:00`;
    }

    function getEditedSchedule(scheduleList) {
        return [...scheduleList.querySelectorAll("li")]
            .map((li, idx) => ({
                day: originalData.scheduleList[idx]?.day || `Day ${idx + 1}:`,
                dayOfWeek: idx + 1,
                shifts: [...li.querySelectorAll(".shift-row")]
                    .map(row => ({
                        start: row.querySelector(".schedule-start-select")?.value.trim() || "",
                        end: row.querySelector(".schedule-end-select")?.value.trim() || "",
                    }))
                    .filter(shift => shift.start !== "---" && shift.end !== "---"),
            }));
    }

    function getSchedulePayload(scheduleItems) {
        return scheduleItems.flatMap(item =>
            item.shifts
                .map(shift => ({
                    day_of_week: item.dayOfWeek,
                    start_time: parseTimeForApi(shift.start),
                    end_time: parseTimeForApi(shift.end),
                }))
                .filter(shift => shift.start_time && shift.end_time)
        );
    }

    function replaceInputWithSpan(inputId, spanId, value) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const span = document.createElement("span");
        span.id = spanId;
        span.textContent = value || "";
        input.replaceWith(span);
    }

    async function persistMentorEdits({ newID, newName, newContact, schedulePayload }) {
        if (!window.CUAApi?.updateMentor) return;

        const identifier = originalData.mentorDbId || originalData.id;
        const currentMentor = window.CUACurrentMentor || {};
        const contactIsEmail = newContact.includes("@");
        const email = contactIsEmail ? newContact : (currentMentor.email || "");
        const phone = contactIsEmail ? (currentMentor.phone || "") : newContact;

        await window.CUAApi.updateMentor(identifier, {
            mentor_id: originalData.mentorDbId,
            current_mentor_number: originalData.id,
            mentor_number: newID,
            full_name: newName,
            contact: newContact,
            email,
            phone,
            schedule: schedulePayload
        });

        window.CUACurrentMentor = {
            ...(window.CUACurrentMentor || {}),
            mentor_id: originalData.mentorDbId,
            mentor_number: newID,
            name: newName,
            full_name: newName,
            contact: newContact,
            email,
            phone
        };
    }

    function showEditUI() {
        isEditing = true;
        editControls.classList.add("editing");
        editActions.style.display = "flex";
        editBtn.style.display = "none";
    }

    function hideEditUI() {
        isEditing = false;
        editControls.classList.remove("editing");
        editActions.style.display = "none";
        editBtn.style.display = "inline-block";
    }

    function enterEditMode() {
        if (isEditing) return;
        if (!mentorDetailsReady) return;

        // Always re-query current elements (they get replaced)
        const idSpan = document.getElementById("mentor-id");
        const nameSpan = document.getElementById("mentor-name");
        const contactSpan = document.getElementById("mentor-contact");
        const scheduleList = document.getElementById("schedule-list");

        if (!idSpan || !nameSpan || !contactSpan || !scheduleList) return;
        if ([idSpan, nameSpan, contactSpan].some(span => span.textContent.trim() === "Loading...")) return;

        // Save original data
        originalData = {
            mentorDbId: window.CUACurrentMentor?.mentor_id || window.CUACurrentMentor?.id || "",
            id: idSpan.textContent,
            name: nameSpan.textContent,
            contact: contactSpan.textContent,
            scheduleList: readScheduleList(scheduleList),
        };

        // Replace id + name with inputs
        idSpan.outerHTML = `<input id="edit-id" value="${escapeAttribute(originalData.id)}">`;
        nameSpan.outerHTML = `<input id="edit-name" value="${escapeAttribute(originalData.name)}">`;
        contactSpan.outerHTML = `<input id="edit-contact" value="${escapeAttribute(originalData.contact)}">`;

        // Replace schedule with editable list
        scheduleList.innerHTML = originalData.scheduleList
            .map(item => `<li><strong>${item.day}</strong><div class="shift-list">${item.shifts.map(shift => buildScheduleRow(shift.start, shift.end, true)).join("")}</div><button type="button" class="add-schedule-day">+ Add Schedule</button></li>`)
            .join("");

        showEditUI();

        attachDynamicButtons();
    }

    async function exitEditMode(save) {
        const scheduleList = document.getElementById("schedule-list");

        try {
            if (save) {
                const newID = document.getElementById("edit-id").value.trim();
                const newName = document.getElementById("edit-name").value.trim();
                const newContact = document.getElementById("edit-contact").value.trim();
                const newSchedule = getEditedSchedule(scheduleList);
                const schedulePayload = getSchedulePayload(newSchedule);

                if (!newID || !newName || !newContact) {
                    alert("Mentor number, name, and contact are required.");
                    return;
                }

                await persistMentorEdits({ newID, newName, newContact, schedulePayload });

                replaceInputWithSpan("edit-id", "mentor-id", newID);
                replaceInputWithSpan("edit-name", "mentor-name", newName);
                replaceInputWithSpan("edit-contact", "mentor-contact", newContact);

                scheduleList.innerHTML = renderScheduleItems(newSchedule);
            } else {
                replaceInputWithSpan("edit-id", "mentor-id", originalData.id);
                replaceInputWithSpan("edit-name", "mentor-name", originalData.name);
                replaceInputWithSpan("edit-contact", "mentor-contact", originalData.contact);

                scheduleList.innerHTML = renderScheduleItems(originalData.scheduleList);
            }
        } catch (error) {
            alert(error.message || "Could not save mentor changes.");
            return;
        }

        hideEditUI();
    }

    function attachDynamicButtons() {
        const scheduleList = document.getElementById("schedule-list");

        // Add schedule to a specific day
        document.querySelectorAll(".add-schedule-day").forEach(btn => {
            btn.onclick = () => {
                const dayItem = btn.closest("li");
                const shiftsContainer = dayItem.querySelector(".shift-list");
                shiftsContainer.insertAdjacentHTML(
                    "beforeend",
                    buildScheduleRow(scheduleStartOptions[0], scheduleEndOptions[0], true)
                );
                btn.disabled = true;
                attachDynamicButtons();
            };
        });

        // Remove schedule row
        document.querySelectorAll(".remove-schedule").forEach(btn => {
            btn.onclick = () => {
                const shiftRow = btn.closest(".shift-row");
                const dayItem = btn.closest("li");
                shiftRow.remove();
                const addBtn = dayItem.querySelector(".add-schedule-day");
                if (addBtn) {
                    addBtn.disabled = false;
                }
            };
        });
    }


    editBtn.addEventListener("click", enterEditMode);
    document.querySelector(".confirm-btn").addEventListener("click", async () => {
        await exitEditMode(true);
    });
    document.querySelector(".cancel-btn").addEventListener("click", async () => {
        await exitEditMode(false);
    });

    // Tab switching functionality
    const mentorTabs = document.querySelectorAll('.mentor-tab');
    mentorTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            mentorTabs.forEach(t => t.classList.remove('active'));
            // Add active to clicked tab
            tab.classList.add('active');
            const mentor = tab.dataset.mentor;
            const calendarContainer = document.querySelector('.calendar-container');
            const eventPanel = document.getElementById('event-panel');
            const coursesPanel = document.getElementById('courses-panel');
            if (mentor === '1') {
                // Show bookings
                calendarContainer.style.display = 'block';
                eventPanel.style.display = 'block';
                coursesPanel.style.display = 'none';
            } else if (mentor === '2') {
                // Show courses
                calendarContainer.style.display = 'none';
                eventPanel.style.display = 'none';
                coursesPanel.style.display = 'block';
                // Populate courses
                renderMentorCourses();
            }
        });
    });

    let mentorCourses = window.CUAMentorCourses || [
        { id: 'MATH101', name: 'Calculus I' },
        { id: 'COMP201', name: 'Data Structures I' }
    ];

    document.addEventListener("cua-mentor-courses-loaded", (event) => {
        mentorCourses = event.detail.courses || [];
        if (document.getElementById('courses-panel')?.style.display === 'block') {
            renderMentorCourses();
        }
    });

    const courseAddButton = document.getElementById('add-course-btn');
    const saveCourseButton = document.getElementById('save-course-btn');
    const cancelCourseButton = document.getElementById('cancel-course-btn');
    const newCourseForm = document.getElementById('new-course-form');
    const newCourseId = document.getElementById('new-course-id');
    const newCourseName = document.getElementById('new-course-name');

    function renderMentorCourses() {
        const coursesList = document.getElementById('courses-list');
        if (mentorCourses.length > 0) {
            coursesList.innerHTML = mentorCourses.map(course => `
                <div class="course-item" data-course-id="${course.id}">
                    <div class="course-item-text">
                        <strong>${course.id}</strong>: ${course.name}
                    </div>
                    <button type="button" class="remove-course-btn">Remove</button>
                </div>
            `).join('');
        } else {
            coursesList.innerHTML = '<div class="no-courses">No courses assigned to this mentor</div>';
        }
        attachCourseRemoveListeners();
    }

    function attachCourseRemoveListeners() {
        document.querySelectorAll('.remove-course-btn').forEach(button => {
            button.onclick = () => {
                const courseItem = button.closest('.course-item');
                const courseId = courseItem?.dataset.courseId;
                const courseName = courseItem?.querySelector('.course-item-text')?.textContent?.trim() || courseId;
                if (!courseId) return;

                const confirmed = confirm(`Delete course ${courseName}? This cannot be undone.`);
                if (!confirmed) return;

                mentorCourses = mentorCourses.filter(course => course.id !== courseId);
                renderMentorCourses();
            };
        });
    }

    /**
     * Initialize autocomplete for both course ID and course name fields
     * FUTURE: When backend is ready, update Autocomplete.js dataSources.coursesByID/coursesByName
     * to call API endpoint instead of getStaticCourseData()
     */
    function initializeAutocomplete() {
        // Initialize Course ID field autocomplete
        if (!newCourseId.autocompleteData) {
            Autocomplete.init(newCourseId, 'coursesByID', {
                minChars: 1,
                maxResults: 8,
                debounceMs: 300,
                onSelect: (suggestion) => handleCourseIdSelection(suggestion)
            });
        }

        // Initialize Course Name field autocomplete
        if (!newCourseName.autocompleteData) {
            Autocomplete.init(newCourseName, 'coursesByName', {
                minChars: 1,
                maxResults: 8,
                debounceMs: 300,
                onSelect: (suggestion) => handleCourseNameSelection(suggestion)
            });
        }
    }

    /**
     * Handle when user selects a course from Course ID field
     * Automatically fills in the course name field
     */
    function handleCourseIdSelection(suggestion) {
        newCourseId.value = suggestion.id;      // Ensure ID field has the ID
        newCourseName.value = suggestion.name;  // Fill name field with course name
        newCourseName.focus();
    }

    /**
     * Handle when user selects a course from Course Name field
     * Automatically fills in the course ID field
     */
    function handleCourseNameSelection(suggestion) {
        newCourseName.value = suggestion.name;  // Ensure name field has the name
        newCourseId.value = suggestion.id;      // Fill ID field with course ID
        newCourseId.focus();
    }

    function openNewCourseForm() {
        newCourseForm.classList.remove('hidden');
        courseAddButton.disabled = true;
        initializeAutocomplete();
        newCourseId.focus();
    }

    function closeNewCourseForm() {
        newCourseForm.classList.add('hidden');
        courseAddButton.disabled = false;
        newCourseId.value = '';
        newCourseName.value = '';
        // Clear autocomplete suggestions when closing form
        if (newCourseId.autocompleteData) {
            Autocomplete._clearSuggestions(newCourseId);
        }
        if (newCourseName.autocompleteData) {
            Autocomplete._clearSuggestions(newCourseName);
        }
    }

    function saveNewCourse() {
        const id = newCourseId.value.trim();
        const name = newCourseName.value.trim();

        if (!id || !name) {
            alert('Please enter both a course ID and course name.');
            return;
        }

        // Check for duplicates
        if (mentorCourses.some(course => course.id === id)) {
            alert(`Course ${id} is already assigned to this mentor.`);
            return;
        }

        mentorCourses.push({ id, name});
        renderMentorCourses();
        closeNewCourseForm();
    }

    courseAddButton.addEventListener('click', openNewCourseForm);
    saveCourseButton.addEventListener('click', saveNewCourse);
    cancelCourseButton.addEventListener('click', closeNewCourseForm);
});
