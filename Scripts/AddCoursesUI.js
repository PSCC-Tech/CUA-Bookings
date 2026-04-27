const AddCoursesUI = {
    init() {
        this.cacheElements();
        this.setupDropdowns();
        this.setupTableManagerCallbacks();
    },

    /* -----------------------------------------
       CACHE DOM ELEMENTS
    ----------------------------------------- */
    cacheElements() {
        this.categoryBtn = document.getElementById("category-btn");
        this.categoryDropdown = document.getElementById("category-dropdown");
        this.searchInput = document.getElementById("mentor-search");
        this.selectAllCheckbox = document.getElementById("select-all-mentors");
        this.mentorList = document.querySelector(".mentor-checkboxes");
        this.noResults = document.querySelector(".no-results"); // optional
    },

    /* -----------------------------------------
       DROPDOWN TOGGLES
    ----------------------------------------- */
    setupDropdowns() {
        // Toggle dropdown
        this.categoryBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.categoryDropdown.classList.toggle("hidden");
        });

        // Prevent closing when clicking inside dropdown
        this.categoryDropdown.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        // Update button text + retract dropdown
        this.categoryDropdown.querySelectorAll("div").forEach(option => {
            option.addEventListener("click", () => {
                this.categoryBtn.textContent = option.textContent.trim();
                this.categoryDropdown.classList.add("hidden");   // ⭐ retract dropdown
            });
        });

        // Close when clicking outside
        document.addEventListener("click", () => {
            this.categoryDropdown.classList.add("hidden");
        });
    },

    /* -----------------------------------------
       TABLEMANAGER CALLBACKS
    ----------------------------------------- */
    setupTableManagerCallbacks() {
        // No delete button on this page, so no selection callback needed

        TableManager.callbacks.onFilterComplete = (items) => {
            this.updateNoResults(items);
            this.syncSelectAll(items);
        };
    },

    /* -----------------------------------------
       NO RESULTS MESSAGE (optional)
    ----------------------------------------- */
    updateNoResults(items) {
        if (!this.noResults) return;

        const anyVisible = items.some(item => !item.classList.contains("hidden"));

        if (anyVisible) {
            this.noResults.classList.add("hidden");
        } else {
            this.noResults.classList.remove("hidden");
        }
    },

    /* -----------------------------------------
       SYNC SELECT ALL CHECKBOX
    ----------------------------------------- */
    syncSelectAll(items) {
        const visibleItems = items.filter(i => !i.classList.contains("hidden"));
        const allChecked = visibleItems.every(i => {
            const cb = i.querySelector("input[type='checkbox']");
            return cb && cb.checked;
        });

        this.selectAllCheckbox.checked = visibleItems.length > 0 && allChecked;
    }
};