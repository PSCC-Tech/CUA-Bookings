const CoursesUI = {
    selected: new Map(), // Stores selected courses for deletion
    categorySections: [
        { name: "Mathematics", title: "Mathematics Courses", icon: "fa-solid fa-square-root-variable" },
        { name: "Sciences", title: "Sciences Courses", icon: "fa-solid fa-flask" },
        { name: "Spanish", title: "Spanish Courses", icon: "fa-solid fa-book-open" },
        { name: "English", title: "English Courses", icon: "fa-solid fa-book" },
        { name: "Stadistics", title: "Stadistics Courses", icon: "fa-solid fa-chart-column" },
        { name: "Accounting", title: "Accounting Courses", icon: "fa-solid fa-calculator" },
        { name: "Finances", title: "Finances Courses", icon: "fa-solid fa-coins" },
        { name: "Microeconomics", title: "Microeconomics Courses", icon: "fa-solid fa-chart-line" },
        { name: "Quantitative Methods", title: "Quantitative Methods Courses", icon: "fa-solid fa-percent" },
        { name: "Technology", title: "Technology Courses", icon: "fa-solid fa-computer" },
        { name: "Others", title: "Other Courses", icon: "fa-solid fa-layer-group" }
    ],

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

    async loadFromBackend() {
        if (!window.CUAApi) return;

        try {
            const courses = await window.CUAApi.getCourses(true);
            this.renderCourseTables(courses);
        } catch (error) {
            console.warn("Could not load courses from the database:", error);
            this.showLoadError(error.message || "Could not load courses from the database.");
        }
    },

    showLoadError(message) {
        const root = document.getElementById("courses");
        if (!root) return;

        root.querySelectorAll(".course-table tbody").forEach(tbody => {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">${this.escapeHtml(message)}</td>
                </tr>
            `;
        });
    },

    renderCourseTables(courses) {
        const root = document.getElementById("courses");
        if (!root) return;

        this.ensureCourseSections(root);

        const grouped = new Map(this.categorySections.map(category => [category.name, []]));
        courses.forEach(course => {
            if (!grouped.has(course.category)) return;
            grouped.get(course.category).push(course);
        });

        this.categorySections.forEach(category => {
            const section = root.querySelector(`.course-section[data-category="${category.name}"]`);
            const tbody = section?.querySelector("tbody");
            if (!tbody) return;

            const rows = grouped.get(category.name) || [];
            tbody.innerHTML = rows.map(course => this.createCourseRow(course)).join("");
        });
    },

    ensureCourseSections(root) {
        const existingSections = [...root.querySelectorAll(".course-section")];
        const allowedCategories = new Set(this.categorySections.map(category => category.name));

        existingSections.forEach(section => {
            if (section.dataset.category && !allowedCategories.has(section.dataset.category)) {
                section.remove();
                return;
            }
            if (section.dataset.category) return;
            const title = section.querySelector(".title-text")?.textContent || "";
            const match = this.categorySections.find(category => title.includes(category.name));
            if (match) section.dataset.category = match.name;
        });

        this.categorySections.forEach(category => {
            if (root.querySelector(`.course-section[data-category="${category.name}"]`)) return;
            root.appendChild(this.createCourseSection(category));
        });
    },

    createCourseSection(category) {
        const section = document.createElement("div");
        section.className = "course-section";
        section.dataset.category = category.name;
        section.innerHTML = `
            <div class="no-results hidden">No matching courses found.</div>
            <div class="course-inner">
                <h2><i class="${category.icon}"></i>
                    <span class="title-text">${category.title}</span>
                </h2>
                <div class="pagination-controls">
                    Show:
                    <select class="rows-per-page">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="25">25</option>
                    </select>
                    courses per page
                </div>
                <table class="course-table">
                    <thead>
                        <tr>
                            <th>Select</th>
                            <th>Course ID</th>
                            <th>Course Name</th>
                            <th>Professors</th>
                            <th>Mentors</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                <div class="pagination"></div>
            </div>
        `;
        return section;
    },

    createCourseRow(course) {
        const professors = (course.professors || []).join(", ");
        const mentors = (course.mentors || []).join(", ");
        const detailsUrl = `courses-details.html?course_id=${encodeURIComponent(course.course_id)}`;

        return `
            <tr data-course-id="${course.course_id}" data-name="${this.escapeHtml(course.name)}" data-category="${this.escapeHtml(course.category)}" data-mentor="${this.escapeHtml(mentors)}">
                <td><input type="checkbox" class="course-select"></td>
                <td>${this.escapeHtml(course.code || course.id)}</td>
                <td class="course-name-link" onclick="window.location='${detailsUrl}'">${this.escapeHtml(course.name)}</td>
                <td class="professor-cell" data-professors="${this.escapeAttribute(professors)}"></td>
                <td class="mentor-cell" data-mentors="${this.escapeAttribute(mentors)}"></td>
                <td>
                    <button type="button" class="course-details-btn" onclick="window.location='${detailsUrl}'">
                        View details
                    </button>
                </td>
            </tr>
        `;
    },

    escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML;
    },

    escapeAttribute(value) {
        return this.escapeHtml(value).replace(/"/g, "&quot;");
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

            // NEW: highlight AFTER preview is updated
            const table = TableManager.pagination.tables[tableId];
            if (table) {
                table.rows.forEach(row => {
                    TableManager.highlightItem(row, TableManager.filters.search);
                });
            }
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
            const selector = section.querySelector("#rows-per-page, .rows-per-page");
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
            const inside =
                e.target.closest("#category-btn") ||
                e.target.closest("#mentor-btn") ||
                e.target.closest("#category-dropdown") ||
                e.target.closest("#mentor-dropdown") ||

                // NEW: table dropdowns
                e.target.closest(".professor-dropdown") ||
                e.target.closest(".mentor-dropdown") ||
                e.target.closest(".professor-cell") ||
                e.target.closest(".mentor-cell");

            if (!inside) {
                this.categoryDropdown.classList.add("hidden");
                this.mentorDropdown.classList.add("hidden");

                // NEW: close table dropdowns
                document.querySelectorAll(".professor-dropdown").forEach(d => d.classList.add("hidden"));
                document.querySelectorAll(".mentor-dropdown").forEach(d => d.classList.add("hidden"));
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
            [...mentorCells]
                .flatMap(td => (td.dataset.mentors || td.textContent || "")
                    .split(",")
                    .map(m => m.trim()))
                .filter(m => m.length > 0)
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
                const courseId = row.dataset.courseId || row.children[1].innerText.trim();
                const courseCode = row.children[1].innerText.trim();
                const courseName = row.children[2].innerText.trim();
                const professor = row.children[3].innerText.trim();
                const mentor = row.children[4].innerText.trim();

                if (checkbox.checked) {
                    this.addToDeletePanel(courseId, courseCode, courseName, professor, mentor, row);
                } else {
                    this.removeFromDeletePanel(courseId);
                }
            });
        });
    },

    /* -----------------------------------------
       ADD COURSE TO DELETE PANEL
    ----------------------------------------- */
    addToDeletePanel(id, code, name, professor, mentor, row) {
        if (this.selected.has(id)) return;

        this.selected.set(id, { id, code, name, professor, mentor, row });

        const tr = document.createElement("tr");
        tr.dataset.id = id;

        tr.innerHTML = `
            <td>${code}</td>
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
        this.confirmDeleteBtn.addEventListener("click", async () => {
            if (!this.selected.size) return;
            if (!window.CUAApi?.deleteCourses) {
                this.notifyError("Backend API is not loaded.");
                return;
            }

            const names = [...this.selected.values()].map(item => item.code).join(", ");
            const confirmed = await this.confirm(`Delete selected course${this.selected.size === 1 ? "" : "s"}: ${names}?`, {
                title: "Delete courses",
                confirmText: "Delete",
                danger: true
            });
            if (!confirmed) return;

            try {
                await window.CUAApi.deleteCourses([...this.selected.keys()]);
                window.CUANotify?.flash("Selected course records were deleted.", "success");
                window.location.reload();
            } catch (error) {
                this.notifyError(error.message || "Could not delete selected courses.");
            }
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
        const search = TableManager.filters.search?.toLowerCase() || "";
        const activeMentorFilter = TableManager.filters.mentor?.toLowerCase() || "all";

        // PROFESSORS
        document.querySelectorAll(".professor-cell").forEach(cell => {
            const raw = cell.dataset.professors;
            if (!raw) return; // SAFETY FIX

            const list = raw.split(",").map(s => s.trim());
            let selected = list[0];

            // Search match
            if (search) {
                const match = list.find(name =>
                    name.toLowerCase().includes(search)
                );
                if (match) selected = match;
            }

            // Manual selection
            if (!search && cell.dataset.selected) {
                selected = cell.dataset.selected;
            }

            const preview = this.generatePreview(selected, list);

            if (cell.dataset.original !== preview) {
                cell.textContent = preview;
                cell.dataset.original = preview;
            }
        });

        // MENTORS
        document.querySelectorAll(".mentor-cell").forEach(cell => {
            const raw = cell.dataset.mentors;
            if (!raw) return; // SAFETY FIX

            const list = raw.split(",").map(s => s.trim());
            let selected = list[0];

            // Mentor filter match
            if (activeMentorFilter !== "all") {
                const match = list.find(name =>
                    name.toLowerCase() === activeMentorFilter
                );
                if (match) selected = match;
            }

            // Search match
            if (search) {
                const match = list.find(name =>
                    name.toLowerCase().includes(search)
                );
                if (match) selected = match;
            }

            // Manual selection
            if (!search && cell.dataset.selected) {
                selected = cell.dataset.selected;
            }

            const preview = this.generatePreview(selected, list);

            if (cell.dataset.original !== preview) {
                cell.textContent = preview;
                cell.dataset.original = preview;
            }
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
        // Close when clicking outside
        document.addEventListener("click", (e) => {
            const inside =
                e.target.closest(".professor-cell") ||
                e.target.closest(".mentor-cell") ||
                e.target.closest("#people-dropdown") ||
                e.target.closest("#people-dropdown-search");

            if (!inside) {
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
        if (this.peopleDropdownSearch) {
            this.peopleDropdownSearch.value = "";
            this.peopleDropdownSearch.focus();
        }
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
