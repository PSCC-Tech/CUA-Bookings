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
        this.setupPaginationUI();
        this.setupPeopleDropdown();
        this.initializePeopleCells();
        this.attachPeopleCellListeners();
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
        this.deletePanel = document.getElementById("delete-panel");
        this.deleteTableBody = document.querySelector("#delete-table tbody");
        this.confirmDeleteBtn = document.getElementById("confirm-delete-btn");

        // All course rows
        this.courseRows = document.querySelectorAll(".course-table tbody tr");
    },

    scrollToTable(section) {
        const table = section.querySelector(".course-table");

        const top = table.getBoundingClientRect().top + window.scrollY - 20;

        window.scrollTo({
            top,
            behavior: "smooth"
        });
    },

    setupPaginationUI() {

        // 1. Attach callback BEFORE registering tables
        TableManager.callbacks.onPaginationChange = (tableId) => {
            this.renderPaginationButtons(tableId);
            this.initializePeopleCells();
            this.attachPeopleCellListeners();
        };

        // 2. Register tables and apply pagination
        this.sections.forEach((section, index) => {
            const table = section.querySelector(".course-table");
            if (!table) return;

            const tableId = `table-${index}`;
            table.dataset.tableId = tableId;

            // Register table
            TableManager.registerTable(tableId, table);

            // Rows-per-page selector
            const selector = section.querySelector("#rows-per-page");
            const initialRows = selector ? parseInt(selector.value) : 10;

            if (selector) {
                selector.addEventListener("change", () => {
                    console.log("Calling setRowsPerPage for", tableId);
                    TableManager.setRowsPerPage(tableId, parseInt(selector.value));
                });
            }

            // Apply initial pagination
            TableManager.setRowsPerPage(tableId, initialRows);

            // 🔥 FORCE INITIAL RENDER (this was missing)
            TableManager.callbacks.onPaginationChange(tableId);

            // Link pagination container
            const paginationDiv = section.querySelector(".pagination");
            paginationDiv.dataset.tableId = tableId;
        });
    },

    renderPaginationButtons(tableId) {

        // Find the table by tableId
        const table = document.querySelector(`.course-table[data-table-id="${tableId}"]`);
        if (!table) return;

        // From the table, find its section
        const section = table.closest(".course-section");
        if (!section) return;

        const paginationDiv = section.querySelector(".pagination");
        paginationDiv.innerHTML = "";

        const totalPages = TableManager.getTotalPages(tableId);
        const currentPage = TableManager.pagination.tables[tableId].currentPage;

        // PREVIOUS
        const prevBtn = document.createElement("button");
        prevBtn.textContent = "Previous";
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener("click", () => {
            TableManager.goToPage(tableId, currentPage - 1);
            this.scrollToTable(section);
        });
        paginationDiv.appendChild(prevBtn);

        // NUMBERS
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("button");
            btn.textContent = i;
            if (i === currentPage) btn.classList.add("active-page");

            btn.addEventListener("click", () => {
                TableManager.goToPage(tableId, i);
                this.scrollToTable(section);
            });

            paginationDiv.appendChild(btn);
        }

        // NEXT
        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Next";
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener("click", () => {
            TableManager.goToPage(tableId, currentPage + 1);
            this.scrollToTable(section);
        });
        paginationDiv.appendChild(nextBtn);
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
        dropdown.querySelectorAll("div").forEach(o => o.classList.remove("selected"));
        option.classList.add("selected");
        dropdown.classList.add("hidden");

        if (dropdown === this.categoryDropdown) {
            TableManager.filters.category = option.dataset.category;
            TableManager.applyFilters(this.courseRows);
        }

        if (dropdown === this.mentorDropdown) {
            TableManager.filters.mentor = option.dataset.mentor;
            TableManager.applyFilters(this.courseRows);
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
    },

    initializePeopleCells() {
        document.querySelectorAll(".professor-cell").forEach(cell => {
            const list = cell.dataset.professors.split(",").map(s => s.trim());
            const selected = list[0]; // default first person
            cell.textContent = this.generatePreview(selected, list);
        });

        document.querySelectorAll(".mentor-cell").forEach(cell => {
            const list = cell.dataset.mentors.split(",").map(s => s.trim());
            const selected = list[0];
            cell.textContent = this.generatePreview(selected, list);
        });
    },

    generatePreview(selected, list) {
        const others = list.length - 1;
        return others > 0 ? `${selected} +${others} more` : selected;
    },

    /* -----------------------------------------
    PEOPLE DROPDOWN (Professors & Mentors)
    ----------------------------------------- */
    setupPeopleDropdown() {
        this.peopleDropdown = document.getElementById("people-dropdown");
        this.peopleDropdownList = document.getElementById("people-dropdown-list");
        this.peopleDropdownSearch = document.getElementById("people-dropdown-search");

        this.activeCell = null;
        this.fullList = [];

        // Select a name
        this.peopleDropdownList.addEventListener("click", (e) => {
            if (e.target.tagName !== "LI") return;

            const selected = e.target.textContent;
            const list = this.fullList;

            // Update cell text with preview
            this.activeCell.textContent = this.generatePreview(selected, list);

            // Save selected value to dataset (optional)
            this.activeCell.dataset.selected = selected;

            this.closePeopleDropdown();
        });

        // Close when clicking outside
        document.addEventListener("click", (e) => {
            if (!this.peopleDropdown.contains(e.target) &&
                !e.target.classList.contains("professor-cell") &&
                !e.target.classList.contains("mentor-cell")) {
                this.closePeopleDropdown();
            }
        });
    },

    openPeopleDropdown(cell, list) {
        this.activeCell = cell;
        this.fullList = list.sort((a, b) => a.localeCompare(b));

        this.peopleDropdownList.innerHTML = this.fullList
            .map(name => `<li>${name}</li>`)
            .join("");

        const rect = cell.getBoundingClientRect();
        this.peopleDropdown.style.top = `${rect.bottom + window.scrollY}px`;
        this.peopleDropdown.style.left = `${rect.left + window.scrollX}px`;

        this.peopleDropdown.classList.remove("hidden");
        this.peopleDropdownSearch.value = "";
        this.peopleDropdownSearch.focus();
    },

    closePeopleDropdown() {
        this.peopleDropdown.classList.add("hidden");
        this.activeCell = null;
    },

    attachPeopleCellListeners() {
        // Professors
        document.querySelectorAll(".professor-cell").forEach(cell => {
            cell.addEventListener("click", () => {
                const list = cell.dataset.professors.split(",").map(s => s.trim());
                this.openPeopleDropdown(cell, list);
            });
        });

        // Mentors
        document.querySelectorAll(".mentor-cell").forEach(cell => {
            cell.addEventListener("click", () => {
                const list = cell.dataset.mentors.split(",").map(s => s.trim());
                this.openPeopleDropdown(cell, list);
            });
        });
    },
    
};
