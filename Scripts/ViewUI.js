const ViewUI = {

    activeCard: null,
    editedDate: null,
    originalValues: {},
    isEditMode: false,
    selectedSearch: "",

    init() {
        this.cacheElements();
        this.setupCardClickHandlers();
        this.setupInlineEditHandlers();
        this.setupSessionHandlers();
        this.setupFilterHandlers();
        this.setupSearchListener();
        this.setupCalendarCloseHandler();
        this.applyFilters(); // Ensure initial state is correct
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

        this.mentorBtn = document.getElementById("mentor-btn");
        this.studentBtn = document.getElementById("student-btn");
        this.mentorDropdown = document.getElementById("mentor-dropdown");
        this.studentDropdown = document.getElementById("student-dropdown");
        this.searchInput = document.getElementById("booking-search");
    },

    setupCalendarCloseHandler() {
        const closeCalendarBtn = document.getElementById("close-calendar");
        if (closeCalendarBtn) {
            closeCalendarBtn.addEventListener("click", () => {
                document.getElementById("calendar-modal").style.display = "none";
            });
        }
    },

    setupCardClickHandlers() {
        // Handle clicks on ANY dynamically created booking card
        document.addEventListener("click", (e) => {
            const card = e.target.closest(".booking-card");
            if (!card) return;

            // Prevent card selection while in edit mode
            if (this.isEditMode) {
                return;
            }

            this.activeCard = card;
            this.populateModal(card);
            this.modal.style.display = "flex";
        });

        // Close modal
        this.closeBtn.addEventListener("click", () => {
            this.isEditMode = false;
            this.modal.style.display = "none";
        });

        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) {
                this.isEditMode = false;
                this.modal.style.display = "none";
            }
        });
    },

    populateModal(card) {
        document.getElementById("modal-name").textContent = card.dataset.name;
        document.getElementById("modal-service").textContent = card.dataset.service;
        document.getElementById("modal-date").textContent = card.dataset.date;
        document.getElementById("modal-time").textContent = card.dataset.time;
        document.getElementById("modal-location").textContent = card.dataset.location;
        document.getElementById("modal-topics").textContent = card.dataset.topics;

        // If this booking is active, show Stop Session
        if (card.dataset.active === "true") {
            this.startBtn.textContent = "Stop Session";
            this.startBtn.dataset.active = "true";
            this.startBtn.classList.add("stop-session-btn");
            this.startBtn.classList.remove("start-session-btn");
            // Disable edit button when session is active
            this.editBtn.disabled = true;
            this.editBtn.style.opacity = "0.5";
            this.editBtn.style.cursor = "not-allowed";
        } 
        // Otherwise show Start Session
        else {
            this.startBtn.textContent = "Start Session";
            this.startBtn.dataset.active = "false";
            this.startBtn.classList.remove("stop-session-btn");
            this.startBtn.classList.add("start-session-btn");
            // Enable edit button when session is not active
            this.editBtn.disabled = false;
            this.editBtn.style.opacity = "1";
            this.editBtn.style.cursor = "pointer";
        }

        // Reset edit mode
        document.querySelector(".modal-actions").style.display = "flex";
        document.querySelector(".edit-actions-inline").classList.add("hidden");
    },

    setupInlineEditHandlers() {
        this.editBtn.addEventListener("click", () => {
            // Prevent editing if session is active
            if (this.editBtn.disabled) {
                alert("Cannot edit booking while session is active. Stop the session first.");
                return;
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

    setupFilterHandlers() {
        // Default selected options
        const mentorAll = this.mentorDropdown.querySelector('[data-value="all"]');
        const studentAll = this.studentDropdown.querySelector('[data-value="all"]');

        if (mentorAll) mentorAll.classList.add("selected");
        if (studentAll) studentAll.classList.add("selected");

        // Toggle dropdowns
        this.mentorBtn.addEventListener("click", () => {
            this.mentorDropdown.classList.toggle("hidden");
            this.studentDropdown.classList.add("hidden");
        });

        this.studentBtn.addEventListener("click", () => {
            this.studentDropdown.classList.toggle("hidden");
            this.mentorDropdown.classList.add("hidden");
        });

        // Mentor selection
        this.mentorDropdown.addEventListener("click", (e) => {
            if (!e.target.dataset.value) return;

            this.updateSelected("mentor", e.target);
            this.applyFilters();
            this.mentorDropdown.classList.add("hidden");
        });

        // Student selection
        this.studentDropdown.addEventListener("click", (e) => {
            if (!e.target.dataset.value) return;

            this.updateSelected("student", e.target);
            this.applyFilters();
            this.studentDropdown.classList.add("hidden");
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

        if (mentorFilter !== "all") {
            const mentorText = card.querySelector(".mentor").textContent;
            if (!mentorText.toLowerCase().includes(mentorFilter.toLowerCase())) {
                return false;
            }
        }

        if (studentFilter !== "all") {
            const studentText = card.querySelector(".student").textContent;
            if (!studentText.toLowerCase().includes(studentFilter.toLowerCase())) {
                return false;
            }
        }

        if (this.selectedSearch) {
            const cardText = card.innerText.toLowerCase();
            if (!cardText.includes(this.selectedSearch)) {
                return false;
            }
        }

        return true;
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
        return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    },

    getSelectedValue(type) {
        const dropdown = document.getElementById(`${type}-dropdown`);
        const selectedOption = dropdown.querySelector(".selected");
        return selectedOption ? selectedOption.dataset.value : "all";
    },

    updateSelected(type, optionDiv) {
        const dropdown = document.getElementById(`${type}-dropdown`);

        // Remove previous selection
        dropdown.querySelectorAll("div").forEach(div => {
            div.classList.remove("selected");
        });

        // Mark new selection
        optionDiv.classList.add("selected");
    },

    enableEditMode() {
        this.isEditMode = true;
        this.originalValues = {};

        document.querySelectorAll(".editable-field").forEach(row => {
            const field = row.dataset.field;
            const span = row.querySelector(".field-value");
            const value = span.textContent.trim();

            this.originalValues[field] = value;

            let input;

            if (field === "topics") {
                input = document.createElement("textarea");
                input.rows = 4;
                input.value = value;
            }
            else if (field === "service") {
                input = document.createElement("select");
                ["Math Tutoring","Computer Mentoring","Biology Help","Business Coaching"]
                    .forEach(opt => {
                        const o = document.createElement("option");
                        o.textContent = opt;
                        if (opt === value) o.selected = true;
                        input.appendChild(o);
                    });
            }
            else if (field === "time") {
                input = document.createElement("select");
                ["8:00 AM","9:00 AM","10:00 AM","11:00 AM","1:00 PM","2:00 PM","3:00 PM"]
                    .forEach(opt => {
                        const o = document.createElement("option");
                        o.textContent = opt;
                        if (opt === value) o.selected = true;
                        input.appendChild(o);
                    });
            }
            else if (field === "location") {
                input = document.createElement("select");
                ["Microsoft Teams","Library","Science Building","Business Center","CUA"]
                    .forEach(opt => {
                        const o = document.createElement("option");
                        o.textContent = opt;
                        if (opt === value) o.selected = true;
                        input.appendChild(o);
                    });
            }
            else if (field === "date") {
                input = document.createElement("button");
                input.textContent = value;
                input.classList.add("date-btn");

                input.addEventListener("click", () => {
                    // Set up the callback for calendar selection
                    window.viewEditDateCallback = (dateStr, timeStr) => {
                        input.textContent = dateStr;
                        this.editedDate = dateStr;
                        document.getElementById("calendar-modal").style.display = "none";
                    };

                    document.getElementById("calendar-modal").style.display = "flex";
                });
            }
            else {
                input = document.createElement("input");
                input.type = "text";
                input.value = value;
            }

            span.replaceWith(input);
        });

        document.querySelector(".modal-actions").style.display = "none";
        document.querySelector(".edit-actions-inline").classList.remove("hidden");
    },

    saveInlineEdits() {
        document.querySelectorAll(".editable-field").forEach(row => {
            const field = row.dataset.field;
            const input = row.querySelector("input, select, textarea, button");

            const newValue = input.tagName === "BUTTON"
                ? input.textContent
                : input.value;

            const span = document.createElement("span");
            span.classList.add("field-value");
            span.textContent = newValue;
            input.replaceWith(span);

            this.activeCard.dataset[field] = newValue;

            if (field === "time") {
                this.activeCard.querySelector("h3").textContent = newValue;
            }
            if (field === "location") {
                this.activeCard.querySelector("p:nth-child(5)").innerHTML =
                    `<strong>Location:</strong> ${newValue}`;
            }
            if (field === "service") {
                this.activeCard.querySelector("p:nth-child(4)").innerHTML =
                    `<strong>Service:</strong> ${newValue}`;
            }
        });

        this.exitEditMode();
    },

    cancelInlineEdits() {
        document.querySelectorAll(".editable-field").forEach(row => {
            const field = row.dataset.field;
            const input = row.querySelector("input, select, textarea, button");

            const span = document.createElement("span");
            span.classList.add("field-value");
            span.textContent = this.originalValues[field];

            input.replaceWith(span);
        });

        this.exitEditMode();
    },

    exitEditMode() {
        this.isEditMode = false;
        document.querySelector(".modal-actions").style.display = "flex";
        document.querySelector(".edit-actions-inline").classList.add("hidden");
    },

    addToActiveSessions(card) {
        this.activeSessionsSection.classList.remove("hidden");

        const clone = card.cloneNode(true);
        clone.classList.add("active-session-card");

        // Keep dataset values
        clone.dataset.active = "true";

        this.activeSessionsContainer.appendChild(clone);
    },

    removeFromActiveSessions(id) {
        const activeCard = this.activeSessionsContainer.querySelector(`[data-id="${id}"]`);
        if (activeCard) activeCard.remove();

        // Hide section if empty
        if (this.activeSessionsContainer.children.length === 0) {
            this.activeSessionsSection.classList.add("hidden");
        }
    },

    setupSessionHandlers() {
        this.startBtn.addEventListener("click", () => {
            const active = this.startBtn.dataset.active === "true";

            if (!active) {
                // FIRST update UI state
                this.startBtn.textContent = "Stop Session";
                this.startBtn.dataset.active = "true";
                this.startBtn.classList.add("stop-session-btn");
                this.startBtn.classList.remove("start-session-btn");

                // THEN add to active sessions
                this.addToActiveSessions(this.activeCard);

                // FINALLY close modal
                this.modal.style.display = "none";

            } else {
                // FIRST update UI state
                this.startBtn.textContent = "Start Session";
                this.startBtn.dataset.active = "false";
                this.startBtn.classList.add("start-session-btn");
                this.startBtn.classList.remove("stop-session-btn");

                // THEN remove from active sessions
                this.removeFromActiveSessions(this.activeCard.dataset.id);

                // FINALLY close modal
                this.modal.style.display = "none";
            }
        });

        this.cancelSessionBtn.addEventListener("click", () => {
            alert("Session canceled (simulation)");
        });
    }
};

// Global function called by Calendar.js when a date/time is selected
function openConfirmation(dateStr, timeStr) {
    // If in edit mode with a date callback set, use it
    if (window.viewEditDateCallback && typeof window.viewEditDateCallback === "function") {
        window.viewEditDateCallback(dateStr, timeStr);
        window.viewEditDateCallback = null;
    }
}