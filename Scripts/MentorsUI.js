const MentorsUI = {
    selected: new Map(), // Stores selected mentors for deletion
    selectedCategory: "all", // Tracks selected category filter
    selectedSearch: "", // Tracks search filter
    
    init() {
        document.querySelectorAll(".mentor-select").forEach(cb => cb.checked = false);
        this.cacheElements();
        this.setupDropdowns();
        this.setupCheckboxListeners();
        this.setupDeletePanelListeners();
        this.setupTableManagerCallbacks();
        this.setupSearchListener(); // New: setup search listener
        this.updateSectionVisibility(); // New: ensure initial visibility
    },

    /* -----------------------------------------
       CACHE DOM ELEMENTS
    ----------------------------------------- */
    cacheElements() {
        this.categoryBtn = document.getElementById("category-btn");
        this.categoryDropdown = document.getElementById("category-dropdown");
        this.searchInput = document.getElementById("mentor-search");
        this.deleteBtn = document.getElementById("delete-mentors-btn");
        this.tableBody = document.querySelector(".mentor-table tbody");
        this.noResults = document.querySelector(".no-results");

        this.deletePanel = document.getElementById("delete-panel");
        this.deleteTableBody = document.querySelector("#delete-table tbody");
        this.confirmDeleteBtn = document.getElementById("confirm-delete-btn");

        // All mentors rows
        this.mentorRows = document.querySelectorAll(".mentor-table tbody tr");
        // New: cache sections for visibility logic
        this.sections = document.querySelectorAll(".mentor-section");
    },

    /* -----------------------------------------
       DROPDOWN TOGGLES
    ----------------------------------------- */
    setupDropdowns() {
        this.categoryBtn.addEventListener("click", () => {
            this.categoryDropdown.classList.toggle("hidden");
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".dropdown-wrapper")) {
                this.categoryDropdown.classList.add("hidden");
            }
        });

        // New: Handle category selection
        this.categoryDropdown.querySelectorAll("div").forEach(option => {
            option.addEventListener("click", () => {
                this.selectedCategory = option.dataset.category;
                this.categoryDropdown.classList.add("hidden"); // Hide dropdown after selection
                this.updateSectionVisibility(); // Apply filter
            });
        });
    },

       /* -----------------------------------------
       CHECKBOX LISTENERS
    ----------------------------------------- */
    setupCheckboxListeners() {
        this.mentorRows.forEach(row => {
            const checkbox = row.querySelector(".mentor-select");

            checkbox.addEventListener("change", () => {
                const mentorId = row.children[1].innerText.trim();
                const mentorName = row.children[2].innerText.trim();
                const contact = row.children[3].innerText.trim();

                if (checkbox.checked) {
                    this.addToDeletePanel(mentorId, mentorName, contact, row);
                } else {
                    this.removeFromDeletePanel(mentorId);
                }
            });
        });
    },

    /* -----------------------------------------
       ADD COURSE TO DELETE PANEL
    ----------------------------------------- */
    addToDeletePanel(id, name, contact, row) {
        if (this.selected.has(id)) return;

        this.selected.set(id, { id, name, contact, row });

        const tr = document.createElement("tr");
        tr.dataset.id = id;

        tr.innerHTML = `
            <td>${id}</td>
            <td>${name}</td>
            <td>${contact}</td>
            <td><button class="remove-delete-item">×</button></td>
        `;

        this.deleteTableBody.appendChild(tr);
        this.deletePanel.classList.remove("hidden");

        tr.querySelector(".remove-delete-item").addEventListener("click", () => {
            row.querySelector(".mentor-select").checked = false;
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
            alert("Delete action triggered for selected mentors.");
            // Later: send delete request to backend
        });

        document.getElementById("cancel-delete-btn").addEventListener("click", () => {
            // Uncheck all selected rows
            this.selected.forEach(item => {
                item.row.querySelector(".mentor-select").checked = false;
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
       SEARCH LISTENER
    ----------------------------------------- */
    setupSearchListener() {
        this.searchInput.addEventListener("input", () => {
            this.selectedSearch = this.searchInput.value.trim().toLowerCase();
            this.updateSectionVisibility();
        });
    },

    /* -----------------------------------------
       SECTION-BASED VISIBILITY LOGIC
    ----------------------------------------- */
    updateSectionVisibility() {
        let anyVisible = false;

        this.sections.forEach(section => {
            const rows = [...section.querySelectorAll("tbody tr")];
            const visibleRows = rows.filter(r => this.isRowVisible(r));
            const noResults = section.querySelector(".no-results");

            if (visibleRows.length > 0) {
                section.style.display = "block";
                noResults.classList.add("hidden");
                anyVisible = true;
            } else {
                section.style.display = "none";
                noResults.classList.add("hidden"); // hide section-level message
            }

            // Apply visibility and highlighting to rows
            rows.forEach(row => {
                const visible = this.isRowVisible(row);
                row.classList.toggle("hidden", !visible);
                this.highlightRow(row, this.selectedSearch);
            });
        });

        // GLOBAL no-results message
        const globalMsg = document.getElementById("global-no-results");

        if (!anyVisible) {
            globalMsg.classList.remove("hidden");
        } else {
            globalMsg.classList.add("hidden");
        }
    },

    /* -----------------------------------------
       ROW VISIBILITY CHECK
    ----------------------------------------- */
    isRowVisible(row) {
        // Category filter
        if (this.selectedCategory !== "all") {
            const categories = row.dataset.categories?.split(",") || [];
            if (!categories.includes(this.selectedCategory)) {
                return false;
            }
        }

        // Search filter
        if (this.selectedSearch) {
            const rowText = row.innerText.toLowerCase();
            if (!rowText.includes(this.selectedSearch)) {
                return false;
            }
        }

        return true;
    },

    /* -----------------------------------------
       SEARCH HIGHLIGHTING
    ----------------------------------------- */
    highlightRow(row, query) {
        const cells = row.querySelectorAll("td");

        cells.forEach(cell => {
            if (cell.querySelector("input")) return; // skip checkboxes

            const original = cell.dataset.original || cell.innerText;
            cell.dataset.original = original;

            if (!query) {
                cell.innerHTML = original;
                return;
            }

            const regex = new RegExp(`(${query})`, "gi");
            cell.innerHTML = original.replace(regex, `<mark>$1</mark>`);
        });
    }
};