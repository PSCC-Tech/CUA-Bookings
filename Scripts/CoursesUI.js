const CoursesUI = {
    init() {
        this.cacheElements();
        this.setupDropdowns();
        this.buildMentorDropdown();
        this.setupTableManagerCallbacks();
    },

    /* -----------------------------------------
       CACHE DOM ELEMENTS
    ----------------------------------------- */
    cacheElements() {
        this.categoryBtn = document.getElementById("category-btn");
        this.mentorBtn = document.getElementById("mentor-btn");
        this.categoryDropdown = document.getElementById("category-dropdown");
        this.mentorDropdown = document.getElementById("mentor-dropdown");
        this.searchInput = document.getElementById("course-search");
        this.sections = document.querySelectorAll(".course-section");
        this.deleteBtn = document.getElementById("delete-courses-btn");
    },

    /* -----------------------------------------
       DROPDOWN TOGGLES
    ----------------------------------------- */
    setupDropdowns() {
        this.categoryBtn.addEventListener("click", () => {
            this.categoryDropdown.classList.toggle("hidden");
            this.mentorDropdown.classList.add("hidden");
        });

        this.mentorBtn.addEventListener("click", () => {
            this.mentorDropdown.classList.toggle("hidden");
            this.categoryDropdown.classList.add("hidden");
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".right-group")) {
                this.categoryDropdown.classList.add("hidden");
                this.mentorDropdown.classList.add("hidden");
            }
        });
    },

    /* -----------------------------------------
       BUILD MENTOR DROPDOWN DYNAMICALLY
    ----------------------------------------- */
    buildMentorDropdown() {
        const mentorCells = document.querySelectorAll("tbody tr td:nth-child(5)");
        const mentors = [...new Set([...mentorCells].map(td => td.textContent.trim()))];

        this.mentorDropdown.innerHTML =
            mentors.map(m => `<div data-mentor="${m}">${m}</div>`).join("") +
            `<div data-mentor="all">Show All</div>`;
    },

    /* -----------------------------------------
       TABLEMANAGER CALLBACKS
    ----------------------------------------- */
    setupTableManagerCallbacks() {
        TableManager.callbacks.onSelectionChange = (count) => {
            this.deleteBtn.style.display = count > 0 ? "inline-block" : "none";
        };

        TableManager.callbacks.onFilterComplete = (items) => {
            this.updateSectionVisibility(items);
        };
    },

    /* -----------------------------------------
       SECTION-BASED VISIBILITY LOGIC
    ----------------------------------------- */
    updateSectionVisibility(items) {
        this.sections.forEach(section => {
            const rows = [...section.querySelectorAll("tbody tr")];
            const visibleRows = rows.filter(r => !r.classList.contains("hidden"));
            const noResults = section.querySelector(".no-results");

            if (visibleRows.length > 0) {
                section.style.display = "block";
                noResults.classList.add("hidden");
            } else {
                section.style.display = "none";
                noResults.classList.remove("hidden");
            }
        });
    }
};