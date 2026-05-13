const ViewData = {

    bookingGrid: null,
    bookings: [],

    async init() {
        this.bookingGrid = document.querySelector(".booking-grid");

        this.bookings = await this.loadBookings();
        this.render();
        this.populateFilters();
    },

    async loadBookings() {
        try {
            if (!window.CUAApi) throw new Error("Backend API is not loaded.");
            const bookings = await window.CUAApi.getBookings(true);
            this.loadError = "";
            return bookings;
        } catch (error) {
            console.warn("Using fallback booking data:", error);
            this.loadError = error.message || "Could not load bookings from the database.";
            return [
            {
                id: 1,
                date: "2026-04-14",
                time: "10:00 AM",
                mentor: "Sarah Smith",
                studentId: "S1003245",
                name: "John Doe",
                email: "john.doe@student.inter.edu",
                phone: "787-555-0101",
                sessionType: "Single",
                groupSize: 1,
                students: [
                    {
                        studentId: "S1003245",
                        name: "John Doe",
                        email: "john.doe@student.inter.edu",
                        phone: "787-555-0101"
                    }
                ],
                course: "MATH101 - Calculus I",
                category: "Math",
                location: "CUA (Library 2nd Floor)",
                topics: "Polynomials and factoring.",
                professor: "Dr. Rivera",
                madeBy: "Maria Ortiz"
            },
            {
                id: 2,
                date: "2026-04-14",
                time: "1:00 PM",
                mentor: "Sarah Smith",
                studentId: "S1004187",
                name: "Ana Torres",
                email: "ana.torres@student.inter.edu",
                phone: "787-555-0144",
                sessionType: "Grouped",
                groupSize: 2,
                students: [
                    {
                        studentId: "S1004187",
                        name: "Ana Torres",
                        email: "ana.torres@student.inter.edu",
                        phone: "787-555-0144"
                    },
                    {
                        studentId: "S1005332",
                        name: "Diego Morales",
                        email: "diego.morales@student.inter.edu",
                        phone: "787-555-0166"
                    }
                ],
                course: "ENGL210 - Essay Writing",
                category: "English",
                location: "Online (Microsoft Teams)",
                topics: "Essay structure.",
                professor: "Prof. Hernandez",
                madeBy: "Luis Santiago"
            },
            {
                id: 3,
                date: "2026-04-17",
                time: "10:00 AM",
                mentor: "Sarah Smith",
                studentId: "S1006291",
                name: "Carlos Vega",
                email: "carlos.vega@student.inter.edu",
                phone: "787-555-0188",
                sessionType: "Single",
                groupSize: 1,
                students: [
                    {
                        studentId: "S1006291",
                        name: "Carlos Vega",
                        email: "carlos.vega@student.inter.edu",
                        phone: "787-555-0188"
                    }
                ],
                course: "MATH101 - Calculus I",
                category: "Math",
                location: "CUA (Library 2nd Floor)",
                topics: "Factoring review.",
                professor: "Dr. Santiago",
                madeBy: "Maria Ortiz"
            },
            {
                id: 4,
                date: "2026-04-17",
                time: "2:00 PM",
                mentor: "Sarah Smith",
                studentId: "S1007340",
                name: "Laura Ortiz",
                email: "laura.ortiz@student.inter.edu",
                phone: "787-555-0199",
                sessionType: "Single",
                groupSize: 1,
                students: [
                    {
                        studentId: "S1007340",
                        name: "Laura Ortiz",
                        email: "laura.ortiz@student.inter.edu",
                        phone: "787-555-0199"
                    }
                ],
                course: "COMP101 - Intro to Computer Science",
                category: "Computer Science",
                location: "Online (Microsoft Teams)",
                topics: "Intro to Python.",
                professor: "Prof. Martinez",
                madeBy: "Andrea Rivera"
            },
            {
                id: 5,
                date: "2026-04-27",
                time: "12:00 PM",
                mentor: "Sarah Smith",
                studentId: "S1008458",
                name: "Miguel Ramos",
                email: "miguel.ramos@student.inter.edu",
                phone: "787-555-0125",
                sessionType: "Grouped",
                groupSize: 3,
                students: [
                    {
                        studentId: "S1008458",
                        name: "Miguel Ramos",
                        email: "miguel.ramos@student.inter.edu",
                        phone: "787-555-0125"
                    },
                    {
                        studentId: "S1009164",
                        name: "Sofia Colon",
                        email: "sofia.colon@student.inter.edu",
                        phone: "787-555-0135"
                    },
                    {
                        studentId: "S1010286",
                        name: "Natalia Perez",
                        email: "natalia.perez@student.inter.edu",
                        phone: "787-555-0175"
                    }
                ],
                course: "CHEM110 - General Chemistry",
                category: "Chemistry",
                location: "PC & Mac Lab (C234-C235)",
                topics: "Balancing equations.",
                professor: "Dr. Navarro",
                madeBy: "Luis Santiago"
            }
            ];
        }
    },

    /* -----------------------------
       RENDER PIPELINE
    ----------------------------- */
    render(filteredList = null) {
        const data = filteredList || this.bookings;

        if (this.loadError && !filteredList) {
            this.bookingGrid.innerHTML = `<div class="no-bookings">${this.escapeHtml(this.loadError)}</div>`;
            return;
        }

        if (!data.length) {
            this.bookingGrid.innerHTML = `<div class="no-bookings">No upcoming bookings available.</div>`;
            return;
        }

        const grouped = this.groupByDate(data);
        const sortedDates = Object.keys(grouped).sort();

        this.bookingGrid.innerHTML = "";

        sortedDates.forEach(dateStr => {
            const section = this.createDaySection(dateStr, grouped[dateStr]);
            this.bookingGrid.appendChild(section);
        });
    },

    /* -----------------------------
       GROUPING + SORTING
    ----------------------------- */
    groupByDate(list) {
        const map = {};

        list.forEach(b => {
            if (!map[b.date]) map[b.date] = [];
            map[b.date].push(b);
        });

        // Sort each day's bookings by time
        Object.keys(map).forEach(date => {
            map[date].sort((a, b) => this.parseTime(a.time) - this.parseTime(b.time));
        });

        return map;
    },

    parseTime(timeStr) {
        return new Date(`1970-01-01 ${timeStr}`);
    },

    formatDateLabel(dateStr) {
        const [year, month, day] = String(dateStr).split("-").map(Number);
        const d = year && month && day ? new Date(year, month - 1, day) : new Date(dateStr);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    },

    escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML;
    },

    /* -----------------------------
       CREATE DAY SECTION
    ----------------------------- */
    createDaySection(dateStr, bookings) {
        const wrapper = document.createElement("div");
        wrapper.className = "booking-date-group";

        const label = document.createElement("div");
        label.className = "booking-date-label";
        label.textContent = this.formatDateLabel(dateStr);

        const cardsRow = document.createElement("div");
        cardsRow.className = "booking-date-cards";

        bookings.forEach(b => {
            const card = this.createBookingCard(b);
            cardsRow.appendChild(card);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(cardsRow);

        return wrapper;
    },

    /* -----------------------------
       CREATE BOOKING CARD
    ----------------------------- */
    createBookingCard(b) {
        const card = document.createElement("div");
        card.className = "booking-card";
        const students = this.getBookingStudents(b);
        const primaryStudent = students[0];
        const sessionType = this.normalizeSessionType(b.sessionType);

        // Required for ViewUI.js
        card.dataset.id = b.id;
        card.dataset.studentId = primaryStudent.studentId;
        card.dataset.name = primaryStudent.name;
        card.dataset.email = primaryStudent.email;
        card.dataset.phone = primaryStudent.phone;
        card.dataset.sessionType = sessionType;
        card.dataset.groupSize = String(students.length);
        card.dataset.students = JSON.stringify(students);
        card.dataset.course = b.course;
        card.dataset.category = b.category;
        card.dataset.date = this.formatDateLabel(b.date);
        card.dataset.time = b.time;
        card.dataset.mentor = b.mentor;
        card.dataset.location = b.location;
        card.dataset.topics = b.topics;
        card.dataset.professor = b.professor;
        card.dataset.madeBy = b.madeBy;
        card.dataset.courseCode = b.courseCode || this.extractCourseCode(b.course);
        card.dataset.mentorNumber = b.mentorNumber || "";
        card.dataset.active = b.active ? "true" : "false";
        card.dataset.bookingType = b.bookingType || "scheduled";

        card.innerHTML = `
            <h3>${b.time}</h3>
            <p class="mentor"><strong>Mentor</strong> ${b.mentor}</p>
            <p class="student"><strong>Student</strong> ${this.getStudentSummary(students)}</p>
            <p class="course-summary"><strong>Course:</strong> ${b.course}</p>
            <p class="location-summary"><strong>Location:</strong> ${b.location}</p>
        `;

        return card;
    },

    extractCourseCode(courseValue = "") {
        return String(courseValue).split("-")[0].trim().replace(/\s+/g, "");
    },

    getBookingStudents(booking) {
        const students = Array.isArray(booking.students) && booking.students.length
            ? booking.students
            : [
                {
                    studentId: booking.studentId,
                    name: booking.name,
                    email: booking.email,
                    phone: booking.phone
                }
            ];

        return students.map(student => ({
            studentId: student.studentId || "",
            name: student.name || "",
            email: student.email || "",
            phone: student.phone || ""
        }));
    },

    normalizeSessionType(value) {
        return /group/i.test(value || "") ? "Grouped" : "Single";
    },

    getStudentSummary(students) {
        const primaryName = students[0]?.name || "Unnamed student";
        return students.length > 1 ? `${primaryName} + ${students.length - 1}` : primaryName;
    },

    /* -----------------------------
       POPULATE FILTER DROPDOWNS
    ----------------------------- */
    populateFilters() {
        const mentors = new Set();
        const students = new Set();
        const categories = new Set();
        const hours = new Set();

        this.bookings.forEach(b => {
            mentors.add(b.mentor);
            this.getBookingStudents(b).forEach(student => {
                if (student.name) students.add(student.name);
            });
            categories.add(b.category);
            hours.add(b.time);
        });

        this.fillDropdown("mentor-dropdown", mentors);
        this.fillDropdown("student-dropdown", students);
        this.fillDropdown("category-dropdown", categories);
        this.fillDropdown("hour-dropdown", hours);
    },

    fillDropdown(id, values) {
        const dropdown = document.getElementById(id);
        dropdown.innerHTML = "";

        [...values]
            .sort((a, b) => a.localeCompare(b))
            .forEach(v => {
                const div = document.createElement("div");
                div.textContent = v;
                div.dataset.value = v;
                dropdown.appendChild(div);
            });

        const all = document.createElement("div");
        all.textContent = "Show All";
        all.dataset.value = "all";
        all.classList.add("selected");
        dropdown.appendChild(all);
    }
};
