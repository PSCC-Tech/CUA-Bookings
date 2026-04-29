const TableManager = {
    filters: {
        category: "all",
        mentor: "all",
        search: ""
    },

    pagination: {
        tables: {} // tableId → { rows, rowsPerPage, currentPage }
    },

    callbacks: {
        onSelectionChange: null,
        onFilterComplete: null,
        onPaginationChange: null
    },

    /* -----------------------------------------
       INIT (no more itemSelector)
    ----------------------------------------- */
    init(config) {
        const {
            categoryDropdown,
            mentorDropdown,
            searchInput,
            selectAllCheckbox,
            deleteButton,
            onSelectionChange,
            onFilterComplete
        } = config;

        if (onSelectionChange) this.callbacks.onSelectionChange = onSelectionChange;
        if (onFilterComplete) this.callbacks.onFilterComplete = onFilterComplete;

        /* CATEGORY FILTER */
        if (categoryDropdown) {
            const options = Array.from(categoryDropdown.querySelectorAll("div"));
            const sorted = [...options].sort((a, b) =>
                a.textContent.trim().localeCompare(b.textContent.trim())
            );
            sorted.forEach(option => categoryDropdown.appendChild(option));

            options.forEach(option => {
                option.addEventListener("click", () => {
                    this.filters.category = option.dataset.category;
                    this.applyFilters();
                });
            });
        }

        /* MENTOR FILTER */
        if (mentorDropdown) {
            mentorDropdown.querySelectorAll("div").forEach(option => {
                option.addEventListener("click", () => {
                    this.filters.mentor = option.dataset.mentor;
                    this.applyFilters();
                });
            });
        }

        /* SEARCH FILTER */
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                this.filters.search = searchInput.value.trim().toLowerCase();
                this.applyFilters();
            });
        }

        /* SELECT ALL */
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener("change", () => {
                this.getAllRows().forEach(item => {
                    const cb = item.querySelector("input[type='checkbox']");
                    if (cb) cb.checked = selectAllCheckbox.checked;
                });
                this.triggerSelectionChange();
            });

            this.getAllRows().forEach(item => {
                const cb = item.querySelector("input[type='checkbox']");
                if (!cb) return;

                cb.addEventListener("change", () => {
                    const allChecked = this.getAllRows().every(i =>
                        i.querySelector("input[type='checkbox']").checked
                    );
                    selectAllCheckbox.checked = allChecked;
                    this.triggerSelectionChange();
                });
            });
        }

        /* DELETE SELECTED */
        if (deleteButton) {
            deleteButton.addEventListener("click", () => {
                this.getAllRows().forEach(item => {
                    const cb = item.querySelector("input[type='checkbox']");
                    if (cb && cb.checked) item.remove();
                });

                this.triggerSelectionChange();
                this.applyFilters();
            });
        }
    },

    /* -----------------------------------------
       PAGINATION REGISTRATION
    ----------------------------------------- */
    registerTable(tableId, tableElement) {
        let rows = [];

        // Support real tables
        if (tableElement.querySelector("tbody")) {
            rows = [...tableElement.querySelectorAll("tbody tr")];
        }
        // Support mentor checkbox lists
        else {
            rows = [...tableElement.querySelectorAll("label")];
        }

        this.pagination.tables[tableId] = {
            rows,
            rowsPerPage: 10,
            currentPage: 1
        };
    },

    setRowsPerPage(tableId, n) {
        const table = this.pagination.tables[tableId];
        if (!table) return;

        table.rowsPerPage = n;
        table.currentPage = 1;
        this.applyPagination(tableId);
    },

    goToPage(tableId, page) {
        const table = this.pagination.tables[tableId];
        if (!table) return;

        table.currentPage = page;
        this.applyPagination(tableId);
    },

    getVisibleRows(tableId) {
        const table = this.pagination.tables[tableId];
        if (!table) return [];

        return table.rows.filter(r => !r.classList.contains("hidden"));
    },

    getTotalPages(tableId) {
        const table = this.pagination.tables[tableId];
        if (!table) return 1;

        const visible = this.getVisibleRows(tableId);
        return Math.max(1, Math.ceil(visible.length / table.rowsPerPage));
    },

    applyPagination(tableId) {
        const table = this.pagination.tables[tableId];
        if (!table) return;

        const visible = this.getVisibleRows(tableId);
        const totalPages = this.getTotalPages(tableId);

        if (table.currentPage > totalPages) {
            table.currentPage = 1;
        }

        const start = (table.currentPage - 1) * table.rowsPerPage;
        const end = start + table.rowsPerPage;

        table.rows.forEach(r => r.classList.remove("page-hidden"));

        visible.forEach((row, index) => {
            if (index < start || index >= end) {
                row.classList.add("page-hidden");
            }
        });

        if (this.callbacks.onPaginationChange) {
            this.callbacks.onPaginationChange(tableId);
        }
    },

    /* -----------------------------------------
       FILTER PIPELINE (now per-table)
    ----------------------------------------- */
    applyFilters() {
        const { category, mentor, search } = this.filters;

        Object.values(this.pagination.tables).forEach(table => {
            table.rows.forEach(item => {
                let visible = true;

                if (category !== "all") {
                    const multi = item.dataset.categories?.split(",") || [];
                    const single = item.dataset.category;
                    visible = multi.includes(category) || single === category;
                }

                if (visible && mentor !== "all") {
                    const mentorCell = item.querySelector(".mentor-cell");

                    if (mentorCell && mentorCell.dataset.mentors) {
                        const list = mentorCell.dataset.mentors
                            .toLowerCase()
                            .split(",")
                            .map(s => s.trim());

                        visible = list.includes(mentor.toLowerCase());
                    } else {
                        // fallback to single mentor dataset
                        visible = item.dataset.mentor?.toLowerCase() === mentor.toLowerCase();
                    }
                }

                if (visible && search) {
                    let rowText = item.innerText.toLowerCase();

                    // Include full professor list
                    const profCell = item.querySelector(".professor-cell");
                    if (profCell && profCell.dataset.professors) {
                        rowText += " " + profCell.dataset.professors.toLowerCase();
                    }

                    // Include full mentor list
                    const mentorCell = item.querySelector(".mentor-cell");
                    if (mentorCell && mentorCell.dataset.mentors) {
                        rowText += " " + mentorCell.dataset.mentors.toLowerCase();
                    }

                    visible = rowText.includes(search);
                }

                item.classList.toggle("hidden", !visible);
            });
        });

        // After filtering all rows:
        Object.values(this.pagination.tables).forEach(table => {
            table.rows.forEach(row => {
                this.highlightItem(row, search);
            });
        });


        // Apply pagination to all tables
        Object.keys(this.pagination.tables).forEach(tableId => {
            this.applyPagination(tableId);
        });

        if (this.callbacks.onFilterComplete) {
            const allItems = this.getAllRows();
            this.callbacks.onFilterComplete(allItems);
        }
    },

    /* -----------------------------------------
       HIGHLIGHTING
    ----------------------------------------- */
    highlightItem(item, query) {
        const cells = item.querySelectorAll("td, label");

        cells.forEach(cell => {
            if (cell.querySelector("input")) return;

            // Always use the CURRENT preview text
            const original = cell.innerText;
            cell.dataset.original = original;

            if (!query) {
                cell.innerHTML = original;
                return;
            }

            const regex = new RegExp(`(${query})`, "gi");
            cell.innerHTML = original.replace(regex, `<mark>$1</mark>`);
        });
    },

    /* -----------------------------------------
       SELECTION
    ----------------------------------------- */
    getAllRows() {
        return Object.values(this.pagination.tables)
            .flatMap(t => t.rows);
    },

    triggerSelectionChange() {
        if (!this.callbacks.onSelectionChange) return;

        const count = this.getAllRows().filter(i => {
            const cb = i.querySelector("input[type='checkbox']");
            return cb && cb.checked;
        }).length;

        this.callbacks.onSelectionChange(count);
    }
};