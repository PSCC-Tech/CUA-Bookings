const ViewUI = {

    activeCard: null,
    editedDate: null,
    originalValues: {},

    init() {
        this.cacheElements();
        this.setupCardClickHandlers();
        this.setupInlineEditHandlers();
        this.setupSessionHandlers();
    },

    cacheElements() {
        this.modal = document.getElementById("booking-modal");
        this.closeBtn = document.querySelector(".modal-close");

        this.startBtn = document.getElementById("start-session-btn");
        this.cancelSessionBtn = document.getElementById("cancel-session-btn");

        this.editBtn = document.getElementById("edit-booking-btn");

        // NEW inline edit buttons
        this.saveInlineBtn = document.getElementById("save-inline-edit");
        this.cancelInlineBtn = document.getElementById("cancel-inline-edit");

        this.bookingCards = Array.from(document.querySelectorAll(".booking-card"));
    },

    setupCardClickHandlers() {
        this.bookingCards.forEach(card => {
            card.addEventListener("click", () => {
                this.activeCard = card;
                this.populateModal(card);
                this.modal.style.display = "flex";
            });
        });

        this.closeBtn.addEventListener("click", () => {
            this.modal.style.display = "none";
        });

        this.modal.addEventListener("click", e => {
            if (e.target === this.modal) this.modal.style.display = "none";
        });
    },

    populateModal(card) {
        document.getElementById("modal-name").textContent = card.dataset.name;
        document.getElementById("modal-service").textContent = card.dataset.service;
        document.getElementById("modal-date").textContent = card.dataset.date;
        document.getElementById("modal-time").textContent = card.dataset.time;
        document.getElementById("modal-location").textContent = card.dataset.location;
        document.getElementById("modal-topics").textContent = card.dataset.topics;

        // Reset session button
        this.startBtn.textContent = "Start Session";
        this.startBtn.dataset.active = "false";
        this.startBtn.classList.remove("stop-session-btn");
        this.startBtn.classList.add("start-session-btn");

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

    setupSessionHandlers() {
        this.startBtn.addEventListener("click", () => {
            const active = this.startBtn.dataset.active === "true";

            if (!active) {
                this.startBtn.textContent = "Stop Session";
                this.startBtn.dataset.active = "true";
                this.startBtn.classList.add("stop-session-btn");
                this.startBtn.classList.remove("start-session-btn");
            } else {
                this.startBtn.textContent = "Start Session";
                this.startBtn.dataset.active = "false";
                this.startBtn.classList.add("start-session-btn");
                this.startBtn.classList.remove("stop-session-btn");
            }
        });

        this.cancelSessionBtn.addEventListener("click", () => {
            alert("Session canceled (simulation)");
        });
    }
};