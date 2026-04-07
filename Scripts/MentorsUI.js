const MentorsUI = {
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
        this.deleteBtn = document.getElementById("delete-mentors-btn");
        this.tableBody = document.querySelector(".mentor-table tbody");
        this.noResults = document.querySelector(".no-results");
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
    },

    /* -----------------------------------------
       TABLEMANAGER CALLBACKS
    ----------------------------------------- */
    setupTableManagerCallbacks() {
        // Show/hide delete button
        TableManager.callbacks.onSelectionChange = (count) => {
            this.deleteBtn.style.display = count > 0 ? "inline-block" : "none";
        };

        // Show/hide "No results found"
        TableManager.callbacks.onFilterComplete = (items) => {
            this.updateNoResults(items);
        };
    },

    /* -----------------------------------------
       NO RESULTS MESSAGE
    ----------------------------------------- */
    updateNoResults(items) {
        const anyVisible = items.some(item => !item.classList.contains("hidden"));

        if (anyVisible) {
            this.noResults.classList.add("hidden");
        } else {
            this.noResults.classList.remove("hidden");
        }
    }
};