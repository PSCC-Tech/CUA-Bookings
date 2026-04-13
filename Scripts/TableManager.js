const TableManager = {
    filters: {
        category: "all",
        mentor: "all",
        search: ""
    },

    callbacks: {
        onSelectionChange: null,   // UI Manager will set this
        onFilterComplete: null     // UI Manager will set this
    },

    init(config) {
        const {
            itemSelector,
            categoryDropdown,
            mentorDropdown,
            searchInput,
            selectAllCheckbox,
            deleteButton,
            onSelectionChange,
            onFilterComplete
        } = config;

        const items = [...document.querySelectorAll(itemSelector)];

        // Register callbacks
        if (onSelectionChange) this.callbacks.onSelectionChange = onSelectionChange;
        if (onFilterComplete) this.callbacks.onFilterComplete = onFilterComplete;

        /* CATEGORY FILTER */
        if (categoryDropdown) {

            // 1. Get all category options (convert NodeList → Array)
            const options = Array.from(categoryDropdown.querySelectorAll("div"));

            // 2. Sort alphabetically by visible text
            options.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));

            // 3. Clear dropdown
            categoryDropdown.innerHTML = "";

            // 4. Re‑append sorted options
            options.forEach(option => categoryDropdown.appendChild(option));

            // 5. Attach click listeners AFTER sorting
            options.forEach(option => {
                option.addEventListener("click", () => {
                    this.filters.category = option.dataset.category;
                    this.applyFilters(items);
                });
            });
        }

        /* MENTOR FILTER */
        if (mentorDropdown) {
            mentorDropdown.querySelectorAll("div").forEach(option => {
                option.addEventListener("click", () => {
                    this.filters.mentor = option.dataset.mentor;
                    this.applyFilters(items);
                });
            });
        }

        /* SEARCH FILTER */
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                this.filters.search = searchInput.value.trim().toLowerCase();
                this.applyFilters(items);
            });
        }

        /* SELECT ALL */
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener("change", () => {
                items.forEach(item => {
                    const cb = item.querySelector("input[type='checkbox']");
                    if (cb) cb.checked = selectAllCheckbox.checked;
                });

                this.triggerSelectionChange(items);
            });

            items.forEach(item => {
                const cb = item.querySelector("input[type='checkbox']");
                if (!cb) return;

                cb.addEventListener("change", () => {
                    const allChecked = items.every(i => i.querySelector("input[type='checkbox']").checked);
                    selectAllCheckbox.checked = allChecked;
                    this.triggerSelectionChange(items);
                });
            });
        }

        /* DELETE SELECTED */
        if (deleteButton) {
            deleteButton.addEventListener("click", () => {
                items.forEach(item => {
                    const cb = item.querySelector("input[type='checkbox']");
                    if (cb && cb.checked) item.remove();
                });

                this.triggerSelectionChange(items);
                this.applyFilters(items);
            });
        }
    },

    /* MAIN FILTER PIPELINE */
    applyFilters(items) {
        const { category, mentor, search } = this.filters;

        items.forEach(item => {
            let visible = true;

            // CATEGORY FILTER
            if (category !== "all") {
                const multi = item.dataset.categories?.split(",") || [];
                const single = item.dataset.category;
                visible = multi.includes(category) || single === category;
            }

            // MENTOR FILTER
            if (visible && mentor !== "all") {
                visible = item.dataset.mentor === mentor;
            }

            // SEARCH FILTER
            if (visible && search) {
            const rowText = item.innerText.toLowerCase();
            visible = rowText.includes(search);
            }

            item.classList.toggle("hidden", !visible);

            // Highlight search matches
            this.highlightItem(item, search);
        });

        // Notify UI Manager
        if (this.callbacks.onFilterComplete) {
            this.callbacks.onFilterComplete(items);
        }
    },

    /* SEARCH HIGHLIGHTING */
    highlightItem(item, query) {
        const cells = item.querySelectorAll("td, label");

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
    },

    /* DELETE BUTTON VISIBILITY */
    triggerSelectionChange(items) {
        if (!this.callbacks.onSelectionChange) return;

        const count = items.filter(i => {
            const cb = i.querySelector("input[type='checkbox']");
            return cb && cb.checked;
        }).length;

        this.callbacks.onSelectionChange(count);
    }
};