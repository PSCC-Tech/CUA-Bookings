const CoursesUI = {
    selected: new Map(), // Stores selected courses for deletion

    init() {
        document.querySelectorAll(".course-select").forEach(cb => cb.checked = false);
        this.cacheElements();
        this.setupDropdowns();
        this.buildMentorDropdown();
        this.attachDropdownSelectionHandlers(); 
        this.setupCheckboxListeners();
        this.setupDeletePanelListeners();
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

        // NEW: Delete panel elements
        this.deletePanel = document.getElementById("delete-panel");
        this.deleteTableBody = document.querySelector("#delete-table tbody");
        this.confirmDeleteBtn = document.getElementById("confirm-delete-btn");

        // All course rows
        this.courseRows = document.querySelectorAll(".course-table tbody tr");
    },

    /* -----------------------------------------
       DROPDOWN TOGGLES
    ----------------------------------------- */
    setupDropdowns() {
        // Toggle dropdowns
        this.categoryBtn.addEventListener("click", () => {
            this.categoryDropdown.classList.toggle("hidden");
            this.mentorDropdown.classList.add("hidden");
        });

        this.mentorBtn.addEventListener("click", () => {
            this.mentorDropdown.classList.toggle("hidden");
            this.categoryDropdown.classList.add("hidden");
        });

        // Close when clicking outside
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".right-group")) {
                this.categoryDropdown.classList.add("hidden");
                this.mentorDropdown.classList.add("hidden");
            }
        });
    },

    attachDropdownSelectionHandlers() {
        // CATEGORY
        this.categoryDropdown.querySelectorAll("div").forEach(option => {
            option.addEventListener("click", () => {
                this.setSelectedOption(this.categoryDropdown, option);
            });
        });

        // MENTOR
        this.mentorDropdown.querySelectorAll("div").forEach(option => {
            option.addEventListener("click", () => {
                this.setSelectedOption(this.mentorDropdown, option);
            });
        });
    },

    setSelectedOption(dropdown, option) {
        // Remove previous selection
        dropdown.querySelectorAll("div").forEach(o => o.classList.remove("selected"));

        // Mark new selection
        option.classList.add("selected");

        // Close dropdown
        dropdown.classList.add("hidden");

        // OPTIONAL: If using TableManager filtering
        if (dropdown === this.categoryDropdown) {
            TableManager.filterByCategory(option.dataset.category);
        }

        if (dropdown === this.mentorDropdown) {
            TableManager.filterByMentor(option.dataset.mentor);
        }
    },

    /* -----------------------------------------
       BUILD MENTOR DROPDOWN DYNAMICALLY
    ----------------------------------------- */
    buildMentorDropdown() {
        const mentorCells = document.querySelectorAll("tbody tr td:nth-child(5)");
        const mentors = [...new Set(
            [...mentorCells].map(td => td.textContent.trim())
        )].sort((a, b) => a.localeCompare(b));

        this.mentorDropdown.innerHTML =
        mentors.map(m => `<div data-mentor="${m}">${m}</div>`).join("") +
        `<div data-mentor="all" class="selected">Show All</div>`;
    },

    /* -----------------------------------------
       CHECKBOX LISTENERS
    ----------------------------------------- */
    setupCheckboxListeners() {
        this.courseRows.forEach(row => {
            const checkbox = row.querySelector(".course-select");

            checkbox.addEventListener("change", () => {
                const courseId = row.children[1].innerText.trim();
                const courseName = row.children[2].innerText.trim();
                const professor = row.children[3].innerText.trim();
                const mentor = row.children[4].innerText.trim();

                if (checkbox.checked) {
                    this.addToDeletePanel(courseId, courseName, professor, mentor, row);
                } else {
                    this.removeFromDeletePanel(courseId);
                }
            });
        });
    },

    /* -----------------------------------------
       ADD COURSE TO DELETE PANEL
    ----------------------------------------- */
    addToDeletePanel(id, name, professor, mentor, row) {
        if (this.selected.has(id)) return;

        this.selected.set(id, { id, name, professor, mentor, row });

        const tr = document.createElement("tr");
        tr.dataset.id = id;

        tr.innerHTML = `
            <td>${id}</td>
            <td>${name}</td>
            <td>${professor}</td>
            <td>${mentor}</td>
            <td><button class="remove-delete-item">×</button></td>
        `;

        this.deleteTableBody.appendChild(tr);
        this.deletePanel.classList.remove("hidden");

        tr.querySelector(".remove-delete-item").addEventListener("click", () => {
            row.querySelector(".course-select").checked = false;
            this.removeFromDeletePanel(id);
        });
    },

    /* -----------------------------------------
       REMOVE COURSE FROM DELETE PANEL
    ----------------------------------------- */
    removeFromDeletePanel(id) {
        this.selected.delete(id);

        const row = this.deleteTableBody.querySelector(`tr[data-id="${id}"]`);
        if (row) row.remove();

        if (this.selected.size === 0) {
            this.deletePanel.classList.add("hidden");
        }
    },

    /* -----------------------------------------
       DELETE PANEL BUTTON 
    ----------------------------------------- */
    setupDeletePanelListeners() {
        this.confirmDeleteBtn.addEventListener("click", () => {
            alert("Delete action triggered for selected courses.");
            // Later: send delete request to backend
        });

        document.getElementById("cancel-delete-btn").addEventListener("click", () => {
            // Uncheck all selected rows
            this.selected.forEach(item => {
                item.row.querySelector(".course-select").checked = false;
            });

            // Clear the panel
            this.selected.clear();
            this.deleteTableBody.innerHTML = "";
            this.deletePanel.classList.add("hidden");
        });
    },

    /* -----------------------------------------
       TABLEMANAGER CALLBACKS
    ----------------------------------------- */
    setupTableManagerCallbacks() {
        // Keep delete panel visible during filtering
        TableManager.callbacks.onFilterComplete = () => {
            this.updateSectionVisibility();

            // Keep delete panel visible if needed
            if (this.selected.size > 0) {
                this.deletePanel.classList.remove("hidden");
            }
        };
    },

    /* -----------------------------------------
       SECTION-BASED VISIBILITY LOGIC
    ----------------------------------------- */
    updateSectionVisibility() {
        let anyVisible = false;

        this.sections.forEach(section => {
            const rows = [...section.querySelectorAll("tbody tr")];
            const visibleRows = rows.filter(r => !r.classList.contains("hidden"));
            const noResults = section.querySelector(".no-results");

            if (visibleRows.length > 0) {
                section.style.display = "block";
                noResults.classList.add("hidden");
                anyVisible = true;
            } else {
                section.style.display = "none";
                noResults.classList.add("hidden"); // hide section-level message
            }
        });

        // GLOBAL no-results message
        const globalMsg = document.getElementById("global-no-results");

        if (!anyVisible) {
            globalMsg.classList.remove("hidden");
        } else {
            globalMsg.classList.add("hidden");
        }
    }
};