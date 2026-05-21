const ViewUI = {

    activeCard: null,
    originalValues: {},
    originalStudents: [],
    modalStudents: [],
    editStudents: [],
    currentStudentIndex: 0,
    isEditMode: false,
    selectedSearch: "",

    init() {
        this.cacheElements();
        this.setupCardClickHandlers();
        this.setupInlineEditHandlers();
        this.setupStudentNavigationHandlers();
        this.setupSessionHandlers();
        this.setupFilterHandlers();
        this.setupSearchListener();
        this.setupCalendarCloseHandler();
        this.hydrateActiveSessions();
        this.applyFilters();
    },

    notifyError(message) {
        window.CUANotify?.error(message) || alert(message);
    },

    notifySuccess(message) {
        window.CUANotify?.success(message) || alert(message);
    },

    confirm(message, options = {}) {
        return window.CUAConfirm ? window.CUAConfirm(message, options) : Promise.resolve(confirm(message));
    },

    cacheElements() {
        this.modal = document.getElementById("booking-modal");
        this.closeBtn = document.querySelector(".modal-close");

        this.startBtn = document.getElementById("start-session-btn");
        this.activeSessionsSection = document.getElementById("active-sessions");
        this.activeSessionsContainer = document.querySelector(".active-session-cards");
        this.cancelSessionBtn = document.getElementById("cancel-session-btn");

        this.editBtn = document.getElementById("edit-booking-btn");
        this.saveInlineBtn = document.getElementById("save-inline-edit");
        this.cancelInlineBtn = document.getElementById("cancel-inline-edit");

        this.studentControls = document.getElementById("student-session-controls");
        this.studentPosition = document.getElementById("student-position");
        this.prevStudentBtn = document.getElementById("prev-student-btn");
        this.nextStudentBtn = document.getElementById("next-student-btn");
        this.addStudentBtn = document.getElementById("add-student-btn");
        this.deleteStudentBtn = document.getElementById("delete-student-btn");
        this.groupSizeBadge = document.getElementById("group-size-badge");

        this.mentorBtn = document.getElementById("mentor-btn");
        this.studentBtn = document.getElementById("student-btn");
        this.categoryBtn = document.getElementById("category-btn");
        this.hourBtn = document.getElementById("hour-btn");
        this.mentorDropdown = document.getElementById("mentor-dropdown");
        this.studentDropdown = document.getElementById("student-dropdown");
        this.categoryDropdown = document.getElementById("category-dropdown");
        this.hourDropdown = document.getElementById("hour-dropdown");
        this.searchInput = document.getElementById("booking-search");
    },

    setupCalendarCloseHandler() {
        const closeCalendarBtn = document.getElementById("close-calendar");
        if (closeCalendarBtn) {
            closeCalendarBtn.addEventListener("click", () => {
                document.getElementById("calendar-modal").style.display = "none";
                window.viewEditDateCallback = null;
            });
        }
    },

    setupCardClickHandlers() {
        document.addEventListener("click", (e) => {
            const card = e.target.closest(".booking-card");
            if (!card || this.isEditMode) return;

            this.activeCard = card;
            this.populateModal(card);
            this.modal.style.display = "flex";
        });

        this.closeBtn.addEventListener("click", () => {
            this.closeModal();
        });

        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    },

    closeModal() {
        if (this.isEditMode) return;
        this.modal.style.display = "none";
    },

    populateModal(card) {
        this.modalStudents = this.getStudentsFromCard(card);
        this.currentStudentIndex = 0;

        this.setFieldText("mentor", card.dataset.mentor);
        this.setFieldText("dateTime", this.formatDateTimeDisplay(card.dataset.date, card.dataset.time));
        this.setFieldText("location", card.dataset.location);
        this.setFieldText("course", card.dataset.course);
        this.setFieldText("topics", card.dataset.topics);
        this.setFieldText("professor", card.dataset.professor);
        this.setFieldText("madeBy", card.dataset.madeBy);
        this.setSessionTypeText(this.getCardSessionType(card), this.modalStudents);
        this.renderCurrentStudentDetails();
        this.updateStudentControls();

        if (card.dataset.active === "true") {
            this.startBtn.textContent = "Stop Session";
            this.startBtn.dataset.active = "true";
            this.startBtn.classList.add("stop-session-btn");
            this.startBtn.classList.remove("start-session-btn");
            this.editBtn.disabled = true;
            this.editBtn.style.opacity = "0.5";
            this.editBtn.style.cursor = "not-allowed";
        } else {
            this.startBtn.textContent = "Start Session";
            this.startBtn.dataset.active = "false";
            this.startBtn.classList.remove("stop-session-btn");
            this.startBtn.classList.add("start-session-btn");
            this.editBtn.disabled = false;
            this.editBtn.style.opacity = "1";
            this.editBtn.style.cursor = "pointer";
        }

        document.querySelector(".modal-actions").style.display = "flex";
        document.querySelector(".edit-actions-inline").classList.add("hidden");
        this.modal.classList.remove("is-editing");
    },

    setupInlineEditHandlers() {
        this.editBtn.addEventListener("click", async () => {
            if (this.editBtn.disabled) {
                this.notifyError("Cannot edit booking while session is active. Stop the session first.");
                return;
            }
            if (window.MentorScheduleStore) {
                await window.MentorScheduleStore.loadFromApi().catch(() => null);
            }
            this.enableEditMode();
        });

        this.saveInlineBtn.addEventListener("click", () => {
            this.saveInlineEdits();
        });

        this.cancelInlineBtn.addEventListener("click", () => {
            this.cancelInlineEdits();
        });
    },

    setupStudentNavigationHandlers() {
        this.prevStudentBtn?.addEventListener("click", () => {
            this.goToStudent(-1);
        });

        this.nextStudentBtn?.addEventListener("click", () => {
            this.goToStudent(1);
        });

        this.addStudentBtn?.addEventListener("click", () => {
            this.addStudentToEdit();
        });

        this.deleteStudentBtn?.addEventListener("click", () => {
            this.deleteCurrentStudentFromEdit();
        });
    },

    goToStudent(direction) {
        const students = this.getWorkingStudents();
        if (students.length < 2) return;

        if (this.isEditMode) {
            this.saveCurrentStudentDraft();
        }

        this.currentStudentIndex = (this.currentStudentIndex + direction + students.length) % students.length;
        this.renderCurrentStudentDetails();
        this.updateStudentControls();
    },

    addStudentToEdit() {
        if (!this.isEditMode) return;

        this.saveCurrentStudentDraft();
        this.setSessionTypeControl("Grouped");
        if (!this.editStudents.length) {
            this.editStudents.push(this.createBlankStudent());
        }
        this.editStudents.push(this.createBlankStudent());
        this.currentStudentIndex = this.editStudents.length - 1;

        this.renderCurrentStudentDetails();
        this.updateStudentControls();
        this.getFieldControl("name")?.focus();
    },

    deleteCurrentStudentFromEdit() {
        if (!this.isEditMode) return;

        this.saveCurrentStudentDraft();

        if (this.editStudents.length <= 1) {
            return;
        }

        this.editStudents.splice(this.currentStudentIndex, 1);

        if (this.editStudents.length === 1) {
            this.setSessionTypeControl("Single");
            this.currentStudentIndex = 0;
        } else if (this.currentStudentIndex >= this.editStudents.length) {
            this.currentStudentIndex = this.editStudents.length - 1;
        }

        this.renderCurrentStudentDetails();
        this.updateStudentControls();
        this.getFieldControl("name")?.focus();
    },

    setupFilterHandlers() {
        this.filterDropdowns = {
            mentor: this.mentorDropdown,
            student: this.studentDropdown,
            category: this.categoryDropdown,
            hour: this.hourDropdown
        };

        this.filterButtons = {
            mentor: this.mentorBtn,
            student: this.studentBtn,
            category: this.categoryBtn,
            hour: this.hourBtn
        };

        Object.entries(this.filterDropdowns).forEach(([type, dropdown]) => {
            if (!dropdown) return;

            const allOption = dropdown.querySelector('[data-value="all"]');
            if (allOption) allOption.classList.add("selected");

            dropdown.addEventListener("click", (e) => {
                if (!e.target.dataset.value) return;

                this.updateSelected(type, e.target);
                this.applyFilters();
                dropdown.classList.add("hidden");
            });
        });

        Object.entries(this.filterButtons).forEach(([type, button]) => {
            if (!button) return;

            button.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleFilterDropdown(type);
            });
        });

        document.addEventListener("click", (e) => {
            if (e.target.closest(".booking-header .dropdown-wrapper")) return;
            this.closeAllFilterDropdowns();
        });
    },

    toggleFilterDropdown(type) {
        const dropdown = this.filterDropdowns[type];
        if (!dropdown) return;

        const shouldOpen = dropdown.classList.contains("hidden");
        this.closeAllFilterDropdowns();

        if (shouldOpen) {
            dropdown.classList.remove("hidden");
        }
    },

    closeAllFilterDropdowns() {
        Object.values(this.filterDropdowns || {}).forEach(dropdown => {
            if (dropdown) dropdown.classList.add("hidden");
        });
    },

    setupSearchListener() {
        this.searchInput.addEventListener("input", () => {
            this.selectedSearch = this.searchInput.value.trim().toLowerCase();
            this.applyFilters();
        });
    },

    applyFilters() {
        let anyVisible = false;
        const sections = document.querySelectorAll(".booking-date-group");

        sections.forEach(section => {
            const cards = section.querySelectorAll(".booking-card");
            let visibleCount = 0;

            cards.forEach(card => {
                const isVisible = this.isCardVisible(card);
                card.style.display = isVisible ? "block" : "none";

                if (isVisible) {
                    visibleCount += 1;
                    this.highlightCard(card);
                } else {
                    this.resetCardHighlight(card);
                }
            });

            section.style.display = visibleCount > 0 ? "block" : "none";
            if (visibleCount > 0) anyVisible = true;
        });

        const globalMsg = document.getElementById("global-no-results");
        if (!anyVisible) {
            globalMsg.classList.remove("hidden");
        } else {
            globalMsg.classList.add("hidden");
        }
    },

    isCardVisible(card) {
        const mentorFilter = this.getSelectedValue("mentor");
        const studentFilter = this.getSelectedValue("student");
        const categoryFilter = this.getSelectedValue("category");
        const hourFilter = this.getSelectedValue("hour");

        if (mentorFilter !== "all") {
            const mentorText = card.dataset.mentor || card.querySelector(".mentor").textContent;
            if (!mentorText.toLowerCase().includes(mentorFilter.toLowerCase())) {
                return false;
            }
        }

        if (studentFilter !== "all") {
            if (!this.getStudentSearchText(card).includes(studentFilter.toLowerCase())) {
                return false;
            }
        }

        if (categoryFilter !== "all" && card.dataset.category !== categoryFilter) {
            return false;
        }

        if (hourFilter !== "all" && card.dataset.time !== hourFilter) {
            return false;
        }

        if (this.selectedSearch) {
            const cardText = this.getCardSearchText(card);
            if (!cardText.includes(this.selectedSearch)) {
                return false;
            }
        }

        return true;
    },

    getStudentSearchText(card) {
        const students = this.getStudentsFromCard(card);
        return [
            card.dataset.name,
            card.querySelector(".student")?.textContent,
            ...students.flatMap(student => [student.studentId, student.name, student.email, student.phone])
        ].join(" ").toLowerCase();
    },

    hydrateActiveSessions() {
        document.querySelectorAll(".booking-grid .booking-card[data-active='true']").forEach(card => {
            this.addToActiveSessions(card);
        });
    },

    getCardSearchText(card) {
        return [
            card.innerText,
            ...Object.values(card.dataset),
            this.getStudentSearchText(card)
        ].join(" ").toLowerCase();
    },

    resetCardHighlight(card) {
        if (card.dataset.originalHtml) {
            card.innerHTML = card.dataset.originalHtml;
        }
    },

    highlightCard(card) {
        if (!card.dataset.originalHtml) {
            card.dataset.originalHtml = card.innerHTML;
        }

        if (!this.selectedSearch) {
            card.innerHTML = card.dataset.originalHtml;
            return;
        }

        card.innerHTML = card.dataset.originalHtml;
        const regex = new RegExp(this.escapeRegex(this.selectedSearch), "gi");
        this.highlightTextNodes(card, regex);
    },

    highlightTextNodes(node, regex) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue;
            if (!text || !regex.test(text)) {
                regex.lastIndex = 0;
                return;
            }

            const parent = node.parentNode;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            regex.lastIndex = 0;
            let match;

            while ((match = regex.exec(text)) !== null) {
                const before = text.slice(lastIndex, match.index);
                if (before) {
                    fragment.appendChild(document.createTextNode(before));
                }

                const mark = document.createElement("mark");
                mark.textContent = match[0];
                fragment.appendChild(mark);
                lastIndex = match.index + match[0].length;
            }

            const after = text.slice(lastIndex);
            if (after) {
                fragment.appendChild(document.createTextNode(after));
            }

            parent.replaceChild(fragment, node);
            regex.lastIndex = 0;
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "MARK") {
            const children = Array.from(node.childNodes);
            children.forEach(child => this.highlightTextNodes(child, regex));
        }
    },

    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    },

    getSelectedValue(type) {
        const dropdown = document.getElementById(`${type}-dropdown`);
        const selectedOption = dropdown.querySelector(".selected");
        return selectedOption ? selectedOption.dataset.value : "all";
    },

    updateSelected(type, optionDiv) {
        const dropdown = document.getElementById(`${type}-dropdown`);

        dropdown.querySelectorAll("div").forEach(div => {
            div.classList.remove("selected");
        });

        optionDiv.classList.add("selected");
    },

    enableEditMode() {
        this.isEditMode = true;
        this.originalValues = {};
        this.originalValues.date = this.activeCard?.dataset.date || "";
        this.originalValues.time = this.activeCard?.dataset.time || "";
        this.originalStudents = this.modalStudents.map(student => ({ ...student }));
        this.editStudents = this.modalStudents.map(student => ({ ...student }));

        document.querySelectorAll(".editable-field").forEach(row => {
            const field = row.dataset.field;
            const span = row.querySelector(".field-value");
            const value = this.getEditableDisplayValue(field, span);

            this.originalValues[field] = value;

            const input = this.createEditorForField(field, value);
            span.replaceWith(input);
        });

        this.renderCurrentStudentDetails();
        this.updateStudentControls();

        document.querySelector(".modal-actions").style.display = "none";
        document.querySelector(".edit-actions-inline").classList.remove("hidden");
        this.editBtn.disabled = true;
        this.editBtn.style.opacity = "0.5";
        this.editBtn.style.cursor = "not-allowed";
        this.modal.classList.add("is-editing");
    },

    getEditableDisplayValue(field, span) {
        if (field === "studentId" || field === "name" || field === "email" || field === "phone") {
            const student = this.getWorkingStudents()[this.currentStudentIndex] || this.createBlankStudent();
            return student[field] || "";
        }

        if (field === "dateTime") {
            return this.formatDateTimeDisplay(
                this.activeCard?.dataset.date,
                this.activeCard?.dataset.time
            );
        }

        if (field === "sessionType") {
            return this.getCardSessionType(this.activeCard);
        }

        return span.textContent.trim();
    },

    createEditorForField(field, value) {
        let input;

        if (field === "mentor") {
            input = this.createMentorEditor(value);
        } else if (field === "dateTime") {
            input = this.createDateTimeEditor(value);
        } else if (field === "topics") {
            input = document.createElement("textarea");
            input.rows = 4;
            input.value = value;
        } else if (field === "sessionType") {
            input = document.createElement("select");
            ["Single", "Grouped"].forEach(opt => {
                const option = document.createElement("option");
                option.value = opt;
                option.textContent = opt;
                if (opt === this.normalizeSessionType(value)) option.selected = true;
                input.appendChild(option);
            });
            input.addEventListener("change", () => this.handleSessionTypeChange());
        } else if (field === "location") {
            input = document.createElement("select");
            const locationOptions = [
                "CUA (Library 2nd Floor)",
                "Online (Microsoft Teams)",
                "PC & Mac Lab (C234-C235)",
                "Grad. Department Office (Old)"
            ];

            if (value && !locationOptions.includes(value)) {
                locationOptions.push(value);
            }

            locationOptions.forEach(opt => {
                const option = document.createElement("option");
                option.textContent = opt;
                if (opt === value) option.selected = true;
                input.appendChild(option);
            });
        } else if (field === "course") {
            input = document.createElement("input");
            input.type = "text";
            input.value = value;
            input.addEventListener("change", () => this.refreshMentorEditorForCourse(input.value));
            input.addEventListener("blur", () => this.refreshMentorEditorForCourse(input.value));
        } else {
            input = document.createElement("input");
            input.type = field === "email" ? "email" : field === "phone" ? "tel" : "text";
            input.value = value;
        }

        input.dataset.field = field;
        return input;
    },

    createMentorEditor(value) {
        const select = document.createElement("select");
        select.className = "mentor-edit-select";
        select.dataset.field = "mentor";
        select.setAttribute("aria-label", "Mentor");
        select.title = "Select a mentor for this booking";
        this.populateMentorSelect(select, value, this.activeCard?.dataset.course || "");

        select.addEventListener("change", () => {
            this.handleMentorEditorChange(select);
        });

        return select;
    },

    populateMentorSelect(select, selectedValue, courseValue) {
        const mentors = this.getMentorsForCourseValue(courseValue);
        select.innerHTML = "";

        if (!mentors.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No mentors available";
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        select.disabled = false;
        mentors.forEach(mentor => {
            const option = document.createElement("option");
            option.value = mentor.name;
            option.textContent = mentor.name;
            option.dataset.mentorNumber = mentor.mentor_number || mentor.id || "";
            option.selected = mentor.name === selectedValue;
            select.appendChild(option);
        });

        if (selectedValue && ![...select.options].some(option => option.value === selectedValue)) {
            select.value = mentors[0].name;
        }
    },

    getMentorsForCourseValue(courseValue = "") {
        if (!window.MentorScheduleStore) return [];

        const courseCode = this.extractCourseCode(courseValue || this.activeCard?.dataset.course || "");
        return courseCode
            ? window.MentorScheduleStore.getMentorsForCourse(courseCode)
            : window.MentorScheduleStore.listMentors();
    },

    refreshMentorEditorForCourse(courseValue) {
        const mentorControl = this.getFieldControl("mentor");
        if (!mentorControl || mentorControl.tagName !== "SELECT") return;

        const previousValue = mentorControl.value;
        this.populateMentorSelect(mentorControl, previousValue, courseValue);

        // Course or mentor changes can invalidate the old slot, so force a fresh selection.
        this.clearDateTimeEditor("Choose Date & Time");
        this.syncCalendarForEditSelection();
    },

    handleMentorEditorChange() {
        this.clearDateTimeEditor("Choose Date & Time");
        this.syncCalendarForEditSelection();
    },

    syncCalendarForEditSelection() {
        if (!window.CUACalendar) return;

        const mentor = this.getFieldControl("mentor")?.value || "";
        const course = this.getFieldControl("course")?.value || this.activeCard?.dataset.course || "";
        const courseCode = this.extractCourseCode(course);

        window.CUACalendar.setCourse(courseCode, mentor, Boolean(mentor));
        if (mentor) {
            window.CUACalendar.setMentor(mentor);
        }
    },

    clearDateTimeEditor(label = "Choose Date & Time") {
        const editor = document.querySelector(".date-time-editor");
        const hidden = editor?.querySelector('[data-field-control="dateTime"]');
        const text = editor?.querySelector(".date-time-button-text");

        if (hidden) {
            hidden.dataset.date = "";
            hidden.dataset.time = "";
            hidden.value = "";
        }

        if (text) {
            text.textContent = label;
        }
    },

    createDateTimeEditor(value) {
        const wrapper = document.createElement("div");
        wrapper.className = "date-time-editor";
        wrapper.dataset.field = "dateTime";

        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.dataset.fieldControl = "dateTime";
        hidden.dataset.date = this.activeCard?.dataset.date || "";
        hidden.dataset.time = this.activeCard?.dataset.time || "";
        hidden.value = value || this.formatDateTimeDisplay(hidden.dataset.date, hidden.dataset.time);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "date-time-select-btn";
        const icon = document.createElement("i");
        icon.className = "fas fa-calendar-alt";
        const text = document.createElement("span");
        text.className = "date-time-button-text";
        text.textContent = hidden.value || "Choose Date & Time";
        button.appendChild(icon);
        button.appendChild(text);
        button.addEventListener("click", () => this.openDateTimePicker(wrapper));

        wrapper.appendChild(button);
        wrapper.appendChild(hidden);

        return wrapper;
    },

    openDateTimePicker(editor) {
        const calendarModal = document.getElementById("calendar-modal");
        if (!calendarModal) return;

        const mentor = this.getFieldControl("mentor")?.value || this.activeCard?.dataset.mentor || "";
        const course = this.getFieldControl("course")?.value || this.activeCard?.dataset.course || "";

        if (!mentor) {
            this.notifyError("Please select a mentor before choosing a date and time.");
            this.getFieldControl("mentor")?.focus();
            return;
        }

        window.viewEditDateCallback = (dateStr, timeStr) => {
            this.setDateTimeEditorValue(editor, dateStr, timeStr);
            calendarModal.style.display = "none";
            window.viewEditDateCallback = null;
        };

        if (window.CUACalendar) {
            const courseCode = this.extractCourseCode(course);
            window.CUACalendar.setCourse(courseCode, mentor, Boolean(mentor));
            if (mentor) window.CUACalendar.setMentor(mentor);
        }

        calendarModal.style.display = "flex";
    },

    setDateTimeEditorValue(editor, dateStr, timeStr) {
        const hidden = editor?.querySelector('[data-field-control="dateTime"]');
        const text = editor?.querySelector(".date-time-button-text");
        const displayValue = this.formatDateTimeDisplay(dateStr, timeStr);

        if (hidden) {
            hidden.dataset.date = dateStr;
            hidden.dataset.time = timeStr;
            hidden.value = displayValue;
        }

        if (text) {
            text.textContent = displayValue;
        }
    },

    handleSessionTypeChange() {
        if (!this.isEditMode) return;

        this.saveCurrentStudentDraft();

        if (this.getCurrentSessionType() === "Grouped") {
            this.ensureGroupedStudentCount();
        } else {
            const primary = this.editStudents[0] || this.createBlankStudent();
            this.editStudents = [{ ...primary }];
            this.currentStudentIndex = 0;
        }

        this.renderCurrentStudentDetails();
        this.updateStudentControls();
    },

    async saveInlineEdits() {
        this.saveCurrentStudentDraft();

        let sessionType = this.getCurrentSessionType();
        if (sessionType === "Grouped") {
            this.ensureGroupedStudentCount();
        } else {
            const primary = this.editStudents[0] || this.createBlankStudent();
            this.editStudents = [{ ...primary }];
            this.currentStudentIndex = 0;
        }

        const students = this.editStudents.map(student => this.sanitizeStudent(student));
        const savedValues = {};
        const fieldUpdates = [];

        document.querySelectorAll(".editable-field").forEach(row => {
            const field = row.dataset.field;
            const input = this.getRowControl(row);

            if (field === "studentId" || field === "name" || field === "email" || field === "phone") {
                savedValues[field] = students[0][field] || "";
            } else if (field === "dateTime") {
                savedValues.date = input?.dataset.date || "";
                savedValues.time = input?.dataset.time || "";
                savedValues[field] = this.formatDateTimeDisplay(savedValues.date, savedValues.time);
            } else if (field === "sessionType") {
                savedValues[field] = this.getSessionTypeDisplay(sessionType, students);
            } else {
                savedValues[field] = input?.value || "";
            }

            fieldUpdates.push({ row, input, field, value: savedValues[field] });
        });

        const mentorControl = this.getFieldControl("mentor");
        savedValues.mentorNumber = mentorControl?.selectedOptions?.[0]?.dataset.mentorNumber || this.activeCard?.dataset.mentorNumber || "";

        if (!savedValues.mentor) {
            this.notifyError("Please select a mentor.");
            this.getFieldControl("mentor")?.focus();
            return;
        }

        if (!savedValues.date || !savedValues.time) {
            this.notifyError("Please choose a valid date and time for the selected mentor.");
            return;
        }

        try {
            await this.persistInlineEdits(savedValues, students);
        } catch (error) {
            this.notifyError(error.message || "Could not save booking changes.");
            return;
        }

        fieldUpdates.forEach(({ row, input, field, value }) => {
            const span = document.createElement("span");
            span.classList.add("field-value");
            span.id = `modal-${field}`;
            span.textContent = value;
            this.replaceEditorWithSpan(row, input, span);
        });

        this.isEditMode = false;
        this.modalStudents = students;
        this.currentStudentIndex = 0;
        this.writeCardData(savedValues, sessionType, students);
        this.renderCurrentStudentDetails();
        this.updateStudentControls();
        this.exitEditMode();

        delete this.activeCard.dataset.originalHtml;
        this.syncFilterOptionsFromCards();
        this.applyFilters();
    },

    async persistInlineEdits(values, students) {
        if (!window.CUAApi || !this.activeCard?.dataset.id) return;

        await window.CUAApi.updateBooking(this.activeCard.dataset.id, {
            booking_type: this.activeCard.dataset.bookingType || "scheduled",
            mentor: values.mentor,
            mentor_number: values.mentorNumber,
            course: values.course,
            course_code: this.extractCourseCode(values.course),
            location: values.location,
            professor: values.professor,
            made_by: values.madeBy,
            date: values.date || this.activeCard.dataset.date,
            time: values.time || this.activeCard.dataset.time,
            topics: values.topics,
            students: students.map(student => ({
                student_number: student.studentId,
                full_name: student.name,
                email: student.email,
                phone: student.phone
            }))
        });

        await this.refreshBackendCaches();
    },

    async refreshBackendCaches() {
        if (window.CUAApi) {
            await window.CUAApi.getSchedule(true).catch(() => null);
            if (window.MentorScheduleStore) {
                await window.MentorScheduleStore.loadFromApi(true).catch(() => null);
            }
            if (window.CUACalendar) {
                window.CUACalendar.refresh();
            }
        }
    },

    cancelInlineEdits() {
        document.querySelectorAll(".editable-field").forEach(row => {
            const field = row.dataset.field;
            const input = this.getRowControl(row);
            if (!input) return;

            const span = document.createElement("span");
            span.classList.add("field-value");
            span.id = `modal-${field}`;
            span.textContent = this.getOriginalDisplayValue(field);
            this.replaceEditorWithSpan(row, input, span);
        });

        this.isEditMode = false;
        this.modalStudents = this.originalStudents.map(student => ({ ...student }));
        this.currentStudentIndex = 0;
        this.renderCurrentStudentDetails();
        this.setSessionTypeText(this.getCardSessionType(this.activeCard), this.modalStudents);
        this.updateStudentControls();
        this.exitEditMode();
    },

    getOriginalDisplayValue(field) {
        if (field === "studentId" || field === "name" || field === "email" || field === "phone") {
            return this.originalStudents[0]?.[field] || "";
        }

        if (field === "dateTime") {
            return this.formatDateTimeDisplay(this.originalValues.date, this.originalValues.time);
        }

        if (field === "sessionType") {
            return this.getSessionTypeDisplay(
                this.getCardSessionType(this.activeCard),
                this.originalStudents
            );
        }

        return this.originalValues[field] || "";
    },

    exitEditMode() {
        document.querySelector(".modal-actions").style.display = "flex";
        document.querySelector(".edit-actions-inline").classList.add("hidden");
        this.editBtn.disabled = false;
        this.editBtn.style.opacity = "1";
        this.editBtn.style.cursor = "pointer";
        this.modal.classList.remove("is-editing");
        this.updateStudentControls();
    },

    getRowControl(row) {
        return row.querySelector('[data-field-control], input, select, textarea');
    },

    replaceEditorWithSpan(row, control, span) {
        const editor = row.querySelector(".date-time-editor") || control;
        if (editor) editor.replaceWith(span);
    },

    saveCurrentStudentDraft() {
        if (!this.isEditMode) return;

        const student = this.editStudents[this.currentStudentIndex] || this.createBlankStudent();
        student.studentId = this.getFieldControl("studentId")?.value || "";
        student.name = this.getFieldControl("name")?.value || "";
        student.email = this.getFieldControl("email")?.value || "";
        student.phone = this.getFieldControl("phone")?.value || "";
        this.editStudents[this.currentStudentIndex] = student;
    },

    renderCurrentStudentDetails() {
        const students = this.getWorkingStudents();
        const student = students[this.currentStudentIndex] || this.createBlankStudent();

        if (this.isEditMode) {
            this.setFieldControlValue("studentId", student.studentId);
            this.setFieldControlValue("name", student.name);
            this.setFieldControlValue("email", student.email);
            this.setFieldControlValue("phone", student.phone);
            return;
        }

        this.setFieldText("studentId", student.studentId);
        this.setFieldText("name", student.name);
        this.setFieldText("email", student.email);
        this.setFieldText("phone", student.phone);
    },

    updateStudentControls() {
        const students = this.getWorkingStudents();
        const sessionType = this.getCurrentSessionType();
        const isGrouped = sessionType === "Grouped";
        const showControls = isGrouped || students.length > 1 || this.isEditMode;

        this.studentControls?.classList.toggle("hidden", !showControls);
        this.addStudentBtn?.classList.toggle("hidden", !this.isEditMode);
        this.deleteStudentBtn?.classList.toggle("hidden", !(this.isEditMode && students.length > 1));

        if (this.studentPosition) {
            this.studentPosition.textContent = `Student ${this.currentStudentIndex + 1} of ${Math.max(students.length, 1)}`;
        }

        const disableCycle = students.length < 2;
        if (this.prevStudentBtn) this.prevStudentBtn.disabled = disableCycle;
        if (this.nextStudentBtn) this.nextStudentBtn.disabled = disableCycle;

        if (this.groupSizeBadge) {
            this.groupSizeBadge.textContent = String(Math.max(students.length, isGrouped ? 2 : 1));
            this.groupSizeBadge.classList.add("hidden");
        }
    },

    getWorkingStudents() {
        return this.isEditMode ? this.editStudents : this.modalStudents;
    },

    getFieldControl(field) {
        return document.querySelector(`.editable-field[data-field="${field}"] input, .editable-field[data-field="${field}"] select, .editable-field[data-field="${field}"] textarea`);
    },

    setFieldControlValue(field, value) {
        const control = this.getFieldControl(field);
        if (control) control.value = value || "";
    },

    setFieldText(field, value) {
        const span = document.getElementById(`modal-${field}`);
        if (span) span.textContent = value || "";
    },

    setSessionTypeText(sessionType, students) {
        this.setFieldText("sessionType", this.getSessionTypeDisplay(sessionType, students));
    },

    setSessionTypeControl(value) {
        const control = this.getFieldControl("sessionType");
        if (control) control.value = this.normalizeSessionType(value);
    },

    getCurrentSessionType() {
        if (this.isEditMode) {
            return this.normalizeSessionType(this.getFieldControl("sessionType")?.value || "Single");
        }

        return this.getCardSessionType(this.activeCard);
    },

    getCardSessionType(card) {
        return this.normalizeSessionType(card?.dataset.sessionType || "Single");
    },

    normalizeSessionType(value) {
        return /group/i.test(value || "") ? "Grouped" : "Single";
    },

    getSessionTypeDisplay(sessionType, students) {
        return this.normalizeSessionType(sessionType) === "Grouped"
            ? `Grouped ${Math.max(students.length, 2)}`
            : "Single";
    },

    ensureGroupedStudentCount() {
        while (this.editStudents.length < 2) {
            this.editStudents.push(this.createBlankStudent());
        }
    },

    getStudentsFromCard(card) {
        let students = [];

        if (card?.dataset.students) {
            try {
                const parsed = JSON.parse(card.dataset.students);
                if (Array.isArray(parsed)) {
                    students = parsed.map(student => this.sanitizeStudent(student));
                }
            } catch (error) {
                students = [];
            }
        }

        if (!students.length) {
            students = [this.sanitizeStudent({
                studentId: card?.dataset.studentId,
                name: card?.dataset.name,
                email: card?.dataset.email,
                phone: card?.dataset.phone
            })];
        }

        if (this.getCardSessionType(card) === "Grouped" && students.length < 2) {
            students.push(this.createBlankStudent());
        }

        return students;
    },

    sanitizeStudent(student = {}) {
        return {
            studentId: student.studentId || "",
            name: student.name || "",
            email: student.email || "",
            phone: student.phone || ""
        };
    },

    createBlankStudent() {
        return { studentId: "", name: "", email: "", phone: "" };
    },

    writeCardData(values, sessionType, students) {
        const primaryStudent = students[0] || this.createBlankStudent();

        this.activeCard.dataset.mentor = values.mentor;
        this.activeCard.dataset.mentorNumber = values.mentorNumber || this.activeCard.dataset.mentorNumber || "";
        this.activeCard.dataset.date = values.date || this.activeCard.dataset.date;
        this.activeCard.dataset.time = values.time || this.activeCard.dataset.time;
        this.activeCard.dataset.studentId = primaryStudent.studentId;
        this.activeCard.dataset.name = primaryStudent.name;
        this.activeCard.dataset.email = primaryStudent.email;
        this.activeCard.dataset.phone = primaryStudent.phone;
        this.activeCard.dataset.sessionType = sessionType;
        this.activeCard.dataset.groupSize = String(students.length);
        this.activeCard.dataset.students = JSON.stringify(students);
        this.activeCard.dataset.location = values.location;
        this.activeCard.dataset.course = values.course;
        this.activeCard.dataset.topics = values.topics;
        this.activeCard.dataset.professor = values.professor;
        this.activeCard.dataset.madeBy = values.madeBy;
        this.activeCard.dataset.courseCode = this.extractCourseCode(values.course);

        this.activeCard.querySelector("h3").textContent = this.activeCard.dataset.time;
        this.setSummaryLine(this.activeCard.querySelector(".mentor"), "Mentor", values.mentor);
        this.setSummaryLine(this.activeCard.querySelector(".student"), "Student", this.getCardStudentSummary(students));
        this.setSummaryLine(this.activeCard.querySelector(".location-summary"), "Location:", values.location);
        this.setSummaryLine(this.activeCard.querySelector(".course-summary"), "Course:", values.course);

        this.updateBookingRecord(values, sessionType, students);
        this.moveCardToDateGroup(this.activeCard);
    },

    setSummaryLine(element, label, value) {
        if (!element) return;

        element.textContent = "";
        const strong = document.createElement("strong");
        strong.textContent = label;
        element.append(strong, document.createTextNode(` ${value || ""}`));
    },

    getCardStudentSummary(students) {
        const primaryName = students[0]?.name || "Unnamed student";
        return students.length > 1 ? `${primaryName} + ${students.length - 1}` : primaryName;
    },

    updateBookingRecord(values, sessionType, students) {
        if (typeof ViewData === "undefined" || !Array.isArray(ViewData.bookings)) return;

        const id = Number(this.activeCard.dataset.id);
        const record = ViewData.bookings.find(booking => Number(booking.id) === id);
        if (!record) return;

        Object.assign(record, {
            mentor: values.mentor,
            mentorNumber: values.mentorNumber || record.mentorNumber || "",
            studentId: students[0]?.studentId || "",
            name: students[0]?.name || "",
            email: students[0]?.email || "",
            phone: students[0]?.phone || "",
            sessionType,
            groupSize: students.length,
            students: students.map(student => ({ ...student })),
            date: this.toISODate(values.date) || record.date,
            time: values.time || record.time,
            location: values.location,
            course: values.course,
            topics: values.topics,
            professor: values.professor,
            madeBy: values.madeBy
        });
    },

    formatDateTimeDisplay(date, time) {
        if (!date && !time) return "No date selected";
        if (!date) return time;
        if (!time) return date;
        return `${date} - ${time}`;
    },

    extractCourseCode(courseValue = "") {
        return String(courseValue).split("-")[0].trim().replace(/\s+/g, "");
    },

    toISODate(dateLabel = "") {
        const cleaned = String(dateLabel).replace(/^[A-Za-z]+,\s*/, "").trim();
        const parsed = new Date(cleaned);
        if (Number.isNaN(parsed.getTime())) return "";

        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    },

    parseDisplayDate(dateLabel = "") {
        const cleaned = String(dateLabel).replace(/^[A-Za-z]+,\s*/, "").trim();
        const parsed = new Date(cleaned);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    },

    parseCardTime(time = "") {
        const parsed = new Date(`1970-01-01 ${time}`);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    },

    moveCardToDateGroup(card) {
        const bookingGrid = document.querySelector(".booking-grid");
        const dateLabel = card?.dataset.date;
        if (!bookingGrid || !card || !dateLabel) return;

        const originalGroup = card.closest(".booking-date-group");
        let targetGroup = [...bookingGrid.querySelectorAll(".booking-date-group")]
            .find(group => group.querySelector(".booking-date-label")?.textContent.trim() === dateLabel);

        if (!targetGroup) {
            targetGroup = document.createElement("div");
            targetGroup.className = "booking-date-group";
            targetGroup.innerHTML = `
                <div class="booking-date-label"></div>
                <div class="booking-date-cards"></div>
            `;
            targetGroup.querySelector(".booking-date-label").textContent = dateLabel;
            bookingGrid.appendChild(targetGroup);
            this.sortDateGroups(bookingGrid);
        }

        targetGroup.querySelector(".booking-date-cards").appendChild(card);
        this.sortCardsInGroup(targetGroup);

        if (originalGroup && originalGroup !== targetGroup && !originalGroup.querySelector(".booking-card")) {
            originalGroup.remove();
        }
    },

    sortDateGroups(bookingGrid) {
        const groups = [...bookingGrid.querySelectorAll(".booking-date-group")];
        groups
            .sort((a, b) => {
                const dateA = this.parseDisplayDate(a.querySelector(".booking-date-label")?.textContent);
                const dateB = this.parseDisplayDate(b.querySelector(".booking-date-label")?.textContent);
                return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
            })
            .forEach(group => bookingGrid.appendChild(group));
    },

    sortCardsInGroup(group) {
        const row = group.querySelector(".booking-date-cards");
        if (!row) return;

        [...row.querySelectorAll(".booking-card")]
            .sort((a, b) => this.parseCardTime(a.dataset.time) - this.parseCardTime(b.dataset.time))
            .forEach(card => row.appendChild(card));
    },

    syncFilterOptionsFromCards() {
        const previousSelection = {
            mentor: this.getSelectedValue("mentor"),
            student: this.getSelectedValue("student"),
            category: this.getSelectedValue("category"),
            hour: this.getSelectedValue("hour")
        };

        const values = {
            mentor: new Set(),
            student: new Set(),
            category: new Set(),
            hour: new Set()
        };

        document.querySelectorAll(".booking-grid .booking-card").forEach(card => {
            if (card.dataset.mentor) values.mentor.add(card.dataset.mentor);
            if (card.dataset.category) values.category.add(card.dataset.category);
            if (card.dataset.time) values.hour.add(card.dataset.time);

            this.getStudentsFromCard(card).forEach(student => {
                if (student.name) values.student.add(student.name);
            });
        });

        Object.entries(values).forEach(([type, set]) => {
            this.fillFilterDropdown(type, set, previousSelection[type]);
        });
    },

    fillFilterDropdown(type, values, selectedValue) {
        const dropdown = this.filterDropdowns[type];
        if (!dropdown) return;

        dropdown.innerHTML = "";

        [...values]
            .sort((a, b) => a.localeCompare(b))
            .forEach(value => {
                const option = document.createElement("div");
                option.textContent = value;
                option.dataset.value = value;
                if (value === selectedValue) option.classList.add("selected");
                dropdown.appendChild(option);
            });

        const all = document.createElement("div");
        all.textContent = "Show All";
        all.dataset.value = "all";
        if (selectedValue === "all" || !values.has(selectedValue)) {
            all.classList.add("selected");
        }
        dropdown.appendChild(all);
    },

    addToActiveSessions(card) {
        this.activeSessionsSection.classList.remove("hidden");

        const id = String(card.dataset.id || "");
        const existingActiveCard = this.getActiveSessionCard(id);
        if (existingActiveCard) return;

        const sourceCard = this.getPrimaryBookingCard(id) || card;
        const clone = sourceCard.cloneNode(true);
        clone.classList.add("active-session-card");
        clone.dataset.active = "true";

        this.activeSessionsContainer.appendChild(clone);
    },

    removeFromActiveSessions(id) {
        this.getActiveSessionCards(id).forEach(activeCard => activeCard.remove());

        if (this.activeSessionsContainer.children.length === 0) {
            this.activeSessionsSection.classList.add("hidden");
        }
    },

    getBookingCardsById(id) {
        return [...document.querySelectorAll(".booking-card")]
            .filter(card => String(card.dataset.id || "") === String(id || ""));
    },

    getPrimaryBookingCard(id) {
        return [...document.querySelectorAll(".booking-grid .booking-card")]
            .find(card => String(card.dataset.id || "") === String(id || ""));
    },

    getActiveSessionCards(id) {
        return [...this.activeSessionsContainer.querySelectorAll(".booking-card")]
            .filter(card => String(card.dataset.id || "") === String(id || ""));
    },

    getActiveSessionCard(id) {
        return this.getActiveSessionCards(id)[0] || null;
    },

    setBookingActiveState(id, isActive) {
        this.getBookingCardsById(id).forEach(card => {
            card.dataset.active = String(isActive);
        });
    },

    setupSessionHandlers() {
        this.startBtn.addEventListener("click", async () => {
            const active = this.startBtn.dataset.active === "true";
            const bookingId = this.activeCard.dataset.id;

            if (!active) {
                try {
                    if (window.CUAApi) await window.CUAApi.updateSession(bookingId, "start");
                } catch (error) {
                    this.notifyError(error.message || "Could not start the session.");
                    return;
                }

                this.startBtn.textContent = "Stop Session";
                this.startBtn.dataset.active = "true";
                this.startBtn.classList.add("stop-session-btn");
                this.startBtn.classList.remove("start-session-btn");
                this.setBookingActiveState(bookingId, true);
                this.addToActiveSessions(this.activeCard);
                this.modal.style.display = "none";
                this.notifySuccess("Mentorship session started.");
            } else {
                try {
                    if (window.CUAApi) await window.CUAApi.updateSession(bookingId, "stop");
                } catch (error) {
                    this.notifyError(error.message || "Could not stop the session.");
                    return;
                }

                this.startBtn.textContent = "Start Session";
                this.startBtn.dataset.active = "false";
                this.startBtn.classList.add("start-session-btn");
                this.startBtn.classList.remove("stop-session-btn");
                this.setBookingActiveState(bookingId, false);
                this.removeFromActiveSessions(bookingId);
                this.getPrimaryBookingCard(bookingId)?.remove();
                this.modal.style.display = "none";
                this.syncFilterOptionsFromCards();
                this.applyFilters();
                this.notifySuccess("Mentorship session completed.");
            }
        });

        this.cancelSessionBtn.addEventListener("click", async () => {
            const bookingId = this.activeCard?.dataset.id;
            if (!bookingId) return;

            const confirmed = await this.confirm("Cancel this booking?", {
                title: "Cancel booking",
                confirmText: "Cancel booking",
                danger: true
            });
            if (!confirmed) return;

            try {
                if (window.CUAApi) await window.CUAApi.updateSession(bookingId, "cancel");
            } catch (error) {
                this.notifyError(error.message || "Could not cancel the booking.");
                return;
            }

            this.removeFromActiveSessions(bookingId);
            this.getPrimaryBookingCard(bookingId)?.remove();
            this.modal.style.display = "none";
            this.syncFilterOptionsFromCards();
            this.applyFilters();
            this.notifySuccess("Booking cancelled.");
        });
    }
};

function openConfirmation(dateStr, timeStr) {
    if (window.viewEditDateCallback && typeof window.viewEditDateCallback === "function") {
        window.viewEditDateCallback(dateStr, timeStr);
        window.viewEditDateCallback = null;
    }
}
