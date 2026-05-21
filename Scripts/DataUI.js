const DataUI = {
    currentReport: "bookings",
    columns: [],
    rows: [],
    reportLabels: {
        bookings: "Bookings",
        mentors: "Mentors",
        courses: "Courses",
        students: "Students",
        absences: "Absences"
    },
    reportFilters: {
        bookings: ["date_from", "date_to", "status", "booking_type", "category", "mentor", "course", "student", "professor", "location", "made_by", "q"],
        mentors: ["category", "course", "active", "q"],
        courses: ["category", "mentor", "professor", "active", "q"],
        students: ["date_from", "date_to", "mentor", "course", "q"],
        absences: ["date_from", "date_to", "mentor", "q"]
    },

    async init() {
        this.cacheElements();
        this.bindEvents();
        this.setVisibleFilters();
        await this.loadFilterOptions();
        await this.loadReport();
    },

    cacheElements() {
        this.summary = document.getElementById("data-summary");
        this.form = document.getElementById("data-filter-form");
        this.tabs = document.querySelectorAll(".report-tab");
        this.reportTitle = document.getElementById("data-report-title");
        this.resultCount = document.getElementById("data-result-count");
        this.tableHead = document.getElementById("data-table-head");
        this.tableBody = document.getElementById("data-table-body");
        this.downloadBtn = document.getElementById("download-csv-btn");
        this.refreshBtn = document.getElementById("refresh-data-btn");
        this.resetBtn = document.getElementById("reset-filters-btn");
    },

    bindEvents() {
        this.tabs.forEach(tab => {
            tab.addEventListener("click", async () => {
                this.currentReport = tab.dataset.report || "bookings";
                this.tabs.forEach(item => item.classList.toggle("active", item === tab));
                this.form.reset();
                this.setVisibleFilters();
                await this.loadReport();
            });
        });

        this.form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await this.loadReport();
        });

        this.refreshBtn.addEventListener("click", () => this.loadReport());
        this.resetBtn.addEventListener("click", async () => {
            this.form.reset();
            await this.loadReport();
        });
        this.downloadBtn.addEventListener("click", () => this.downloadCsv());
    },

    setVisibleFilters() {
        const visible = new Set(this.reportFilters[this.currentReport] || []);
        this.form.querySelectorAll("[data-filter]").forEach(field => {
            const isVisible = visible.has(field.dataset.filter);
            field.classList.toggle("is-hidden", !isVisible);
        });
    },

    async loadFilterOptions() {
        try {
            const [lookups, mentors, courses] = await Promise.all([
                window.CUAApi.getLookups(true),
                window.CUAApi.getMentors({}, true),
                window.CUAApi.getCourses(true)
            ]);

            this.populateSelect("data-category-filter", lookups.categories || [], "name", "name", "All categories");
            this.populateSelect("data-location-filter", lookups.locations || [], "name", "name", "All locations");
            this.populateSelect("data-professor-filter", lookups.professors || [], "name", "name", "All professors");
            this.populateSelect("data-user-filter", lookups.users || [], "name", "name", "Anyone");
            this.populateSelect("data-mentor-filter", mentors || [], "mentor_number", mentor => `${mentor.mentor_number} - ${mentor.name}`, "All mentors");
            this.populateSelect("data-course-filter", courses || [], "code", course => `${course.code || course.id} - ${course.name}`, "All courses");
        } catch (error) {
            console.warn("Could not load data filter options:", error);
        }
    },

    populateSelect(id, items, valueKey, labelKey, defaultLabel) {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = `<option value="">${this.escapeHtml(defaultLabel)}</option>`;
        items.forEach(item => {
            const value = typeof valueKey === "function" ? valueKey(item) : item[valueKey];
            const label = typeof labelKey === "function" ? labelKey(item) : item[labelKey];
            if (!value || !label) return;

            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        });
    },

    buildQuery() {
        const params = new URLSearchParams();
        params.set("report", this.currentReport);
        const visible = new Set(this.reportFilters[this.currentReport] || []);
        const data = new FormData(this.form);

        visible.forEach(key => {
            const value = String(data.get(key) || "").trim();
            if (value) params.set(key, value);
        });

        return params.toString();
    },

    async loadReport() {
        this.setLoading();

        try {
            const data = await window.CUAApi.request(`data.php?${this.buildQuery()}`);
            this.columns = data.columns || [];
            this.rows = data.rows || [];
            this.render();
            this.summary.textContent = `Generated ${data.generated_at || ""}`.trim();
        } catch (error) {
            this.columns = [];
            this.rows = [];
            this.renderError(error.message || "Could not load report data.");
        }
    },

    setLoading() {
        this.reportTitle.textContent = this.reportLabels[this.currentReport] || "Data";
        this.resultCount.textContent = "Loading";
        this.tableHead.innerHTML = "";
        this.tableBody.innerHTML = `<tr class="loading-row"><td>Loading data...</td></tr>`;
        this.downloadBtn.disabled = true;
    },

    render() {
        this.reportTitle.textContent = this.reportLabels[this.currentReport] || "Data";
        this.resultCount.textContent = `${this.rows.length} ${this.rows.length === 1 ? "row" : "rows"}`;
        this.downloadBtn.disabled = this.rows.length === 0;

        this.tableHead.innerHTML = `
            <tr>
                ${this.columns.map(column => `<th>${this.escapeHtml(column.label)}</th>`).join("")}
            </tr>
        `;

        if (!this.rows.length) {
            this.tableBody.innerHTML = `<tr class="empty-row"><td colspan="${Math.max(this.columns.length, 1)}">No matching data.</td></tr>`;
            return;
        }

        this.tableBody.innerHTML = this.rows.map(row => `
            <tr>
                ${this.columns.map(column => `<td>${this.escapeHtml(row[column.key])}</td>`).join("")}
            </tr>
        `).join("");
    },

    renderError(message) {
        this.reportTitle.textContent = this.reportLabels[this.currentReport] || "Data";
        this.resultCount.textContent = "0 rows";
        this.downloadBtn.disabled = true;
        this.tableHead.innerHTML = "";
        this.tableBody.innerHTML = `<tr class="empty-row"><td>${this.escapeHtml(message)}</td></tr>`;
        this.summary.textContent = "";
    },

    downloadCsv() {
        if (!this.rows.length || !this.columns.length) return;

        const header = this.columns.map(column => this.csvEscape(column.label)).join(",");
        const rows = this.rows.map(row =>
            this.columns.map(column => this.csvEscape(row[column.key])).join(",")
        );
        const csv = [header, ...rows].join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 10);

        link.href = url;
        link.download = `cua-${this.currentReport}-${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    },

    csvEscape(value) {
        const text = String(value ?? "");
        if (/[",\r\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    },

    escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const user = window.CUAAuth?.ready
        ? await window.CUAAuth.ready.catch(() => null)
        : window.CUAAuth?.user;

    if (String(user?.role || "").toLowerCase() !== "administrator") return;

    DataUI.init();
});
