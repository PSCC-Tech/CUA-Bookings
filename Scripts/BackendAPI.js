const CUAApi = {
    basePath: "api/",
    cache: {
        courses: null,
        mentors: null,
        schedule: null,
        lookups: null,
        bookings: null,
        account: null
    },

    buildLoginRedirect() {
        const page = window.location.pathname.split("/").pop() || "index.html";
        const returnTo = `${page}${window.location.search}${window.location.hash}`;
        return `login.html?return_to=${encodeURIComponent(returnTo)}`;
    },

    redirectToLogin() {
        if (window.location.pathname.endsWith("/login.html")) return;
        window.location.href = this.buildLoginRedirect();
    },

    async request(endpoint, options = {}) {
        if (window.location.protocol === "file:") {
            throw new Error("Open this project through XAMPP/Apache: http://localhost/CUA-Bookings/index.html. PHP APIs cannot run from a file path.");
        }

        const response = await fetch(`${this.basePath}${endpoint}`, {
            credentials: "same-origin",
            headers: {
                "Accept": "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {})
            },
            ...options
        });

        const text = await response.text();
        let payload;

        try {
            payload = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error(`The PHP API did not return JSON. Open the page through http://localhost/CUA-Bookings/ and make sure Apache and MySQL are running.`);
        }

        if (!response.ok || payload.ok === false) {
            if (response.status === 401) {
                this.redirectToLogin();
            }

            throw new Error(payload.error || `Request failed: ${endpoint}`);
        }

        return payload;
    },

    async getCourses(force = false) {
        if (!force && this.cache.courses) return this.cache.courses;
        const data = await this.request("courses.php");
        this.cache.courses = data.courses || [];
        return this.cache.courses;
    },

    async getMentors(params = {}, force = false) {
        const query = new URLSearchParams(params).toString();
        const cacheKey = query ? `mentors:${query}` : "mentors";

        if (!force && this.cache[cacheKey]) return this.cache[cacheKey];
        const data = await this.request(`mentors.php${query ? `?${query}` : ""}`);
        this.cache[cacheKey] = data.mentors || [];

        if (!query) this.cache.mentors = this.cache[cacheKey];
        return this.cache[cacheKey];
    },

    async getSchedule(force = false) {
        if (!force && this.cache.schedule) return this.cache.schedule;
        const data = await this.request("schedule.php");
        this.cache.schedule = data.mentors || [];
        return this.cache.schedule;
    },

    async getLookups(force = false) {
        if (!force && this.cache.lookups) return this.cache.lookups;
        const data = await this.request("lookups.php");
        this.cache.lookups = data;
        return data;
    },

    async getBookings(force = false) {
        if (!force && this.cache.bookings) return this.cache.bookings;
        const data = await this.request("bookings.php");
        this.cache.bookings = data.bookings || [];
        return this.cache.bookings;
    },

    async searchStudents(query = "") {
        const params = new URLSearchParams();
        if (query) params.set("q", query);

        const data = await this.request(`students.php${params.toString() ? `?${params}` : ""}`);
        return data.students || [];
    },

    async createBooking(payload) {
        const data = await this.request("bookings.php", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        this.cache.bookings = data.bookings || null;
        this.cache.schedule = null;
        return data;
    },

    async updateBooking(id, payload) {
        const data = await this.request(`bookings.php?id=${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });
        this.cache.bookings = data.bookings || null;
        this.cache.schedule = null;
        return data;
    },

    async updateSession(bookingId, action) {
        const data = await this.request("sessions.php", {
            method: "POST",
            body: JSON.stringify({ booking_id: bookingId, action })
        });
        this.cache.bookings = null;
        this.cache.schedule = null;
        return data;
    },

    async createCourse(payload) {
        const data = await this.request("courses.php", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        this.cache.courses = null;
        this.cache.schedule = null;
        return data;
    },

    async createMentor(payload) {
        const data = await this.request("mentors.php", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        this.cache.mentors = null;
        this.cache.schedule = null;
        return data;
    },

    async updateMentor(identifier, payload) {
        const params = new URLSearchParams();
        const id = String(identifier || "").trim();

        if (/^\d+$/.test(id)) {
            params.set("id", id);
        } else if (id) {
            params.set("mentor_number", id);
        }

        const data = await this.request(`mentors.php${params.toString() ? `?${params}` : ""}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });
        this.cache.mentors = null;
        this.cache.schedule = null;
        return data;
    },

    async createAbsence(payload) {
        const data = await this.request("absences.php", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        this.cache.schedule = null;
        return data;
    },

    async getAccount(force = false) {
        if (!force && this.cache.account) return this.cache.account;
        const data = await this.request("account.php");
        this.cache.account = data.account;
        return this.cache.account;
    },

    async updateAccount(payload) {
        const data = await this.request("account.php", {
            method: "PUT",
            body: JSON.stringify(payload)
        });
        this.cache.account = data.account;
        return data.account;
    }
};

window.CUAApi = CUAApi;
