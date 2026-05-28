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

    function todayIso() {
        return new Date().toISOString().slice(0, 10);
    }

    function formatDateText(value) {
        const [year, month, day] = String(value || "").split("-");
        if (!year || !month || !day) return value || "";

        const date = new Date(Number(year), Number(month) - 1, Number(day));
        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }

    function deriveScheduleRange(schedule = []) {
        const starts = schedule
            .map(block => block.effectiveFrom || block.effective_from || "")
            .filter(Boolean)
            .sort();
        const ends = schedule
            .map(block => block.effectiveTo || block.effective_to || "")
            .filter(Boolean)
            .sort();

        return {
            from: starts[0] || todayIso(),
            to: ends.length ? ends[ends.length - 1] : ""
        };
    }

    function renderScheduleRangeText(range) {
        if (range.from && range.to) {
            return `Schedule active from ${formatDateText(range.from)} to ${formatDateText(range.to)}.`;
        }

        if (range.from) {
            return `Schedule active from ${formatDateText(range.from)} until changed.`;
        }

        if (range.to) {
            return `Schedule active until ${formatDateText(range.to)}.`;
        }

        return "Schedule active until changed.";
    }

    function replaceScheduleRangeWithText(range) {
        const rangeEl = document.getElementById("schedule-range");
        if (!rangeEl) return;

        const text = document.createElement("p");
        text.id = "schedule-range";
        text.className = "schedule-range";
        text.textContent = renderScheduleRangeText(range);
        rangeEl.replaceWith(text);
    }

    function getEditedScheduleRange() {
        return {
            from: document.getElementById("edit-schedule-effective-from")?.value || "",
            to: document.getElementById("edit-schedule-effective-to")?.value || ""
        };
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

    function getSchedulePayload(scheduleItems, range) {
        return scheduleItems.flatMap(item =>
            item.shifts
                .map(shift => ({
                    day_of_week: item.dayOfWeek,
                    start_time: parseTimeForApi(shift.start),
                    end_time: parseTimeForApi(shift.end),
                    effective_from: range.from,
                    effective_to: range.to,
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

    async function persistMentorEdits({ newID, newName, newContact, scheduleRange, schedulePayload }) {
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
            schedule_effective_from: scheduleRange.from,
            schedule_effective_to: scheduleRange.to,
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
            phone,
            scheduleEffectiveFrom: scheduleRange.from,
            scheduleEffectiveTo: scheduleRange.to,
            schedule: schedulePayload.map(block => ({
                ...block,
                effectiveFrom: scheduleRange.from,
                effectiveTo: scheduleRange.to
            }))
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
            scheduleRange: deriveScheduleRange(window.CUACurrentMentor?.schedule || []),
            scheduleList: readScheduleList(scheduleList),
        };

        // Replace id + name with inputs
        idSpan.outerHTML = `<input id="edit-id" data-format="person-id" value="${escapeAttribute(originalData.id)}">`;
        nameSpan.outerHTML = `<input id="edit-name" value="${escapeAttribute(originalData.name)}">`;
        contactSpan.outerHTML = `<input id="edit-contact" data-format="contact" value="${escapeAttribute(originalData.contact)}">`;

        const scheduleRangeEl = document.getElementById("schedule-range");
        if (scheduleRangeEl) {
            scheduleRangeEl.outerHTML = `
                <div id="schedule-range" class="schedule-range-edit">
                    <label>Starts
                        <input type="date" id="edit-schedule-effective-from" value="${escapeAttribute(originalData.scheduleRange.from)}">
                    </label>
                    <label>Ends
                        <input type="date" id="edit-schedule-effective-to" value="${escapeAttribute(originalData.scheduleRange.to)}">
                    </label>
                </div>
            `;
        }

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
                const scheduleRange = getEditedScheduleRange();
                const newSchedule = getEditedSchedule(scheduleList);
                const schedulePayload = getSchedulePayload(newSchedule, scheduleRange);

                if (!newID || !newName || !newContact) {
                    window.CUANotify?.error("Mentor number, name, and contact are required.") || alert("Mentor number, name, and contact are required.");
                    return;
                }

                if (scheduleRange.from && scheduleRange.to && scheduleRange.to < scheduleRange.from) {
                    window.CUANotify?.error("Schedule end date must be on or after the start date.") || alert("Schedule end date must be on or after the start date.");
                    return;
                }

                await persistMentorEdits({ newID, newName, newContact, scheduleRange, schedulePayload });

                replaceInputWithSpan("edit-id", "mentor-id", newID);
                replaceInputWithSpan("edit-name", "mentor-name", newName);
                replaceInputWithSpan("edit-contact", "mentor-contact", newContact);
                replaceScheduleRangeWithText(scheduleRange);

                scheduleList.innerHTML = renderScheduleItems(newSchedule);
            } else {
                replaceInputWithSpan("edit-id", "mentor-id", originalData.id);
                replaceInputWithSpan("edit-name", "mentor-name", originalData.name);
                replaceInputWithSpan("edit-contact", "mentor-contact", originalData.contact);
                replaceScheduleRangeWithText(originalData.scheduleRange);

                scheduleList.innerHTML = renderScheduleItems(originalData.scheduleList);
            }
        } catch (error) {
            window.CUANotify?.error(error.message || "Could not save mentor changes.") || alert(error.message || "Could not save mentor changes.");
            return;
        }

        hideEditUI();
        if (save) {
            window.CUANotify?.success("Mentor changes saved.");
        }
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

    let mentorCourses = window.CUAMentorCourses || [];

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

    async function persistMentorCourses(nextCourses) {
        if (!window.CUAApi?.updateMentor) {
            throw new Error("Backend API is not loaded.");
        }

        const currentMentor = window.CUACurrentMentor || {};
        const identifier = currentMentor.mentor_id || currentMentor.id || currentMentor.mentor_number;
        const contact = currentMentor.contact || currentMentor.email || currentMentor.phone || "";

        await window.CUAApi.updateMentor(identifier, {
            mentor_id: currentMentor.mentor_id || currentMentor.id,
            current_mentor_number: currentMentor.mentor_number || currentMentor.number,
            mentor_number: currentMentor.mentor_number || currentMentor.number,
            full_name: currentMentor.full_name || currentMentor.name,
            contact,
            email: currentMentor.email || (contact.includes("@") ? contact : ""),
            phone: currentMentor.phone || (contact.includes("@") ? "" : contact),
            course_codes: nextCourses.map(course => course.id)
        });

        window.CUAMentorCourses = nextCourses.map(course => ({ ...course }));
        document.dispatchEvent(new CustomEvent("cua-mentor-courses-loaded", {
            detail: { courses: window.CUAMentorCourses }
        }));
        await window.MentorScheduleStore?.loadFromApi?.(true).catch(() => null);
    }

    function attachCourseRemoveListeners() {
        document.querySelectorAll('.remove-course-btn').forEach(button => {
            button.onclick = async () => {
                const courseItem = button.closest('.course-item');
                const courseId = courseItem?.dataset.courseId;
                const courseName = courseItem?.querySelector('.course-item-text')?.textContent?.trim() || courseId;
                if (!courseId) return;

                const confirmed = window.CUAConfirm
                    ? await window.CUAConfirm(`Remove ${courseName} from this mentor?`, {
                        title: "Remove course",
                        confirmText: "Remove",
                        danger: true
                    })
                    : confirm(`Remove ${courseName} from this mentor?`);
                if (!confirmed) return;

                const previousCourses = mentorCourses.map(course => ({ ...course }));
                mentorCourses = mentorCourses.filter(course => course.id !== courseId);

                try {
                    await persistMentorCourses(mentorCourses);
                    renderMentorCourses();
                } catch (error) {
                    mentorCourses = previousCourses;
                    window.CUANotify?.error(error.message || 'Could not update mentor courses.') || alert(error.message || 'Could not update mentor courses.');
                    renderMentorCourses();
                }
            };
        });
    }

    /**
     * Initialize autocomplete for both course ID and course name fields.
     * Course suggestions come from the PHP-backed Autocomplete course cache.
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

    async function saveNewCourse() {
        const id = newCourseId.value.trim();
        const name = newCourseName.value.trim();

        if (!id || !name) {
            window.CUANotify?.error('Please enter both a course ID and course name.') || alert('Please enter both a course ID and course name.');
            return;
        }

        // Check for duplicates
        if (mentorCourses.some(course => course.id === id)) {
            window.CUANotify?.error(`Course ${id} is already assigned to this mentor.`) || alert(`Course ${id} is already assigned to this mentor.`);
            return;
        }

        const previousCourses = mentorCourses.map(course => ({ ...course }));
        mentorCourses.push({ id, name});

        try {
            await persistMentorCourses(mentorCourses);
            renderMentorCourses();
            closeNewCourseForm();
        } catch (error) {
            mentorCourses = previousCourses;
            window.CUANotify?.error(error.message || 'Could not update mentor courses.') || alert(error.message || 'Could not update mentor courses.');
            renderMentorCourses();
        }
    }

    courseAddButton.addEventListener('click', openNewCourseForm);
    saveCourseButton.addEventListener('click', saveNewCourse);
    cancelCourseButton.addEventListener('click', closeNewCourseForm);
});
