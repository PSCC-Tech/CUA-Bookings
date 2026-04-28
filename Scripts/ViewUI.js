const ViewUI = {

    activeCard: null,
    editedDate: null,
    originalValues: {},

    init() {
        this.cacheElements();
        this.setupCardClickHandlers();
        this.setupInlineEditHandlers();
        this.setupSessionHandlers();
        this.setupFilterHandlers();
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
    },

    setupCardClickHandlers() {
        // Handle clicks on ANY dynamically created booking card
        document.addEventListener("click", (e) => {
            const card = e.target.closest(".booking-card");
            if (!card) return;

            this.activeCard = card;
            this.populateModal(card);
            this.modal.style.display = "flex";
        });

        // Close modal
        this.closeBtn.addEventListener("click", () => {
            this.modal.style.display = "none";
        });

        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) {
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
        } 
        // Otherwise show Start Session
        else {
            this.startBtn.textContent = "Start Session";
            this.startBtn.dataset.active = "false";
            this.startBtn.classList.remove("stop-session-btn");
            this.startBtn.classList.add("start-session-btn");
        }

        // Reset edit mode
        document.querySelector(".modal-actions").style.display = "flex";
        document.querySelector(".edit-actions-inline").style.display = "none";
    },

    setupInlineEditHandlers() {
        this.editBtn.addEventListener("click", () => {
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
        // Toggle dropdowns
        this.mentorBtn.addEventListener("click", () => {
            this.mentorDropdown.classList.toggle("hidden");
            this.studentDropdown.classList.add("hidden");
        });

        this.studentBtn.addEventListener("click", () => {
            this.studentDropdown.classList.toggle("hidden");
            this.mentorDropdown.classList.add("hidden");
        });

        this.mentorDropdown.addEventListener("click", (e) => {
            if (!e.target.dataset.value) return;

            this.updateSelected("mentor", e.target);
            this.filterBy("mentor", e.target.dataset.value);
            this.mentorDropdown.classList.add("hidden");
        });

        this.studentDropdown.addEventListener("click", (e) => {
            if (!e.target.dataset.value) return;

            this.updateSelected("student", e.target);
            this.filterBy("student", e.target.dataset.value);
            this.studentDropdown.classList.add("hidden");
        });

    },

    filterBy(type, value) {
        const cards = document.querySelectorAll(".booking-card");

        // SHOW ALL FIX
        if (value === "all") {
            cards.forEach(card => card.style.display = "block");
            return;
        }

        cards.forEach(card => {
            const text = card.querySelector(`.${type}`).textContent;
            card.style.display = text.includes(value) ? "block" : "none";
        });
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
                    document.getElementById("calendar-modal").style.display = "flex";

                    window.setSelectedDateTime = (dateStr, timeStr) => {
                        input.textContent = dateStr;
                        this.editedDate = dateStr;
                        document.getElementById("calendar-modal").style.display = "none";
                    };
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
        document.querySelector(".edit-actions-inline").style.display = "flex";
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
        document.querySelector(".modal-actions").style.display = "flex";
        document.querySelector(".edit-actions-inline").style.display = "none";
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