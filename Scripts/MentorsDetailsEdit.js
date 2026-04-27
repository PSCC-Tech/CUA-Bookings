document.addEventListener("DOMContentLoaded", () => {

    const editBtn = document.querySelector(".edit-btn");
    const editControls = document.querySelector(".edit-controls");
    const editActions = document.querySelector(".edit-actions");

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

    function showEditUI() {
        editControls.classList.add("editing");
        editActions.style.display = "flex";
        editBtn.style.display = "none";
    }

    function hideEditUI() {
        editControls.classList.remove("editing");
        editActions.style.display = "none";
        editBtn.style.display = "inline-block";
    }

    function enterEditMode() {
        // Always re-query current elements (they get replaced)
        const idSpan = document.getElementById("mentor-id");
        const nameSpan = document.getElementById("mentor-name");
        const contactSpan = document.getElementById("mentor-contact");
        const scheduleList = document.getElementById("schedule-list");

        // Save original data
        originalData = {
            id: idSpan.textContent,
            name: nameSpan.textContent,
            contact: contactSpan.textContent,
            scheduleList: [...scheduleList.querySelectorAll("li")].map(li => {
                const savedShifts = [...li.querySelectorAll(".schedule-shift")];
                if (savedShifts.length > 0) {
                    return {
                        day: li.querySelector("strong").textContent.trim(),
                        shifts: savedShifts.map(shift => ({
                            start: shift.querySelector(".schedule-start").textContent.trim(),
                            end: shift.querySelector(".schedule-end").textContent.trim(),
                        })),
                    };
                }

                const startSpan = li.querySelector(".schedule-start");
                const endSpan = li.querySelector(".schedule-end");
                return {
                    day: li.querySelector("strong").textContent.trim(),
                    shifts: startSpan && endSpan ? [{
                        start: startSpan.textContent.trim(),
                        end: endSpan.textContent.trim(),
                    }] : [],
                };
            }),
        };

        // Replace id + name with inputs
        idSpan.outerHTML = `<input id="edit-id" value="${originalData.id}">`;
        nameSpan.outerHTML = `<input id="edit-name" value="${originalData.name}">`;
        contactSpan.outerHTML = `<input id="edit-contact" value="${originalData.contact}">`;

        // Replace schedule with editable list
        scheduleList.innerHTML = originalData.scheduleList
            .map(item => `<li><strong>${item.day}</strong><div class="shift-list">${item.shifts.map(shift => buildScheduleRow(shift.start, shift.end, true)).join("")}</div><button type="button" class="add-schedule-day">+ Add Schedule</button></li>`)
            .join("");

        showEditUI();

        attachDynamicButtons();
    }

    function exitEditMode(save) {
        const scheduleList = document.getElementById("schedule-list");

        try {
            if (save) {
                const newID = document.getElementById("edit-id").value;
                const newName = document.getElementById("edit-name").value;
                const newContact = document.getElementById("edit-contact").value;

                const newSchedule = [...scheduleList.querySelectorAll("li")]
                    .map((li, idx) => ({
                        day: originalData.scheduleList[idx]?.day || `Day ${idx + 1}:`,
                        shifts: [...li.querySelectorAll(".shift-row")].map(row => ({
                            start: row.querySelector(".schedule-start-select").value.trim(),
                            end: row.querySelector(".schedule-end-select").value.trim(),
                        })),
                    }))
                    .map(item => ({
                        day: item.day,
                        shifts: item.shifts.filter(shift => shift.start.length > 0 && shift.end.length > 0),
                    }));

                document.getElementById("edit-id").outerHTML = `<span id="mentor-id">${newID}</span>`;
                document.getElementById("edit-name").outerHTML = `<span id="mentor-name">${newName}</span>`;
                document.getElementById("edit-contact").outerHTML = `<span id="mentor-contact">${newContact}</span>`;

                scheduleList.innerHTML = newSchedule
                    .map(item => `<li><strong>${item.day}</strong>${item.shifts.map(shift => `<div class="schedule-shift"><span class="schedule-start">${shift.start}</span> - <span class="schedule-end">${shift.end}</span></div>`).join("")}</li>`)
                    .join("");
            } else {
                document.getElementById("edit-id").outerHTML = `<span id="mentor-id">${originalData.id}</span>`;
                document.getElementById("edit-name").outerHTML = `<span id="mentor-name">${originalData.name}</span>`;
                document.getElementById("edit-contact").outerHTML = `<span id="mentor-contact">${originalData.contact}</span>`;

                scheduleList.innerHTML = originalData.scheduleList
                    .map(item => `<li><strong>${item.day}</strong>${item.shifts.map(shift => `<div class="schedule-shift"><span class="schedule-start">${shift.start}</span> - <span class="schedule-end">${shift.end}</span></div>`).join("")}</li>`)
                    .join("");
            }
        } finally {
            editControls.classList.remove("editing");
            editActions.style.display = "none";
            editBtn.style.display = "inline-block";
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
    document.querySelector(".confirm-btn").addEventListener("click", () => {
        hideEditUI();
        exitEditMode(true);
    });
    document.querySelector(".cancel-btn").addEventListener("click", () => {
        hideEditUI();
        exitEditMode(false);
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

    let mentorCourses = [
        { id: 'MATH101', name: 'Calculus I' },
        { id: 'COMP201', name: 'Data Structures I' }
    ];

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

    function openNewCourseForm() {
        newCourseForm.classList.remove('hidden');
        courseAddButton.disabled = true;
        newCourseId.focus();
    }

    function closeNewCourseForm() {
        newCourseForm.classList.add('hidden');
        courseAddButton.disabled = false;
        newCourseId.value = '';
        newCourseName.value = '';
    }

    function saveNewCourse() {
        const id = newCourseId.value.trim();
        const name = newCourseName.value.trim();

        if (!id || !name) {
            alert('Please enter both a course ID and course name.');
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