const ViewData = {

    bookingGrid: null,
    bookings: [],

    init() {
        this.bookingGrid = document.querySelector(".booking-grid");

        // Dummy data (replace with DB later)
        this.bookings = [
            {
                id: 1,
                date: "2026-04-14",
                time: "10:00 AM",
                mentor: "Sarah Smith",
                student: "John Doe",
                service: "Math Mentoring",
                location: "CUA",
                topics: "Polynoms and factoring."
            },
            {
                id: 2,
                date: "2026-04-14",
                time: "1:00 PM",
                mentor: "Sarah Smith",
                student: "John Doe",
                service: "English Mentoring",
                location: "Microsoft Teams",
                topics: "Essay structure."
            },
            {
                id: 3,
                date: "2026-04-17",
                time: "10:00 AM",
                mentor: "Sarah Smith",
                student: "John Doe",
                service: "Math Mentoring",
                location: "CUA",
                topics: "Factoring review."
            },
            {
                id: 4,
                date: "2026-04-17",
                time: "2:00 PM",
                mentor: "Sarah Smith",
                student: "John Doe",
                service: "Computer Mentoring",
                location: "Microsoft Teams",
                topics: "Intro to Python."
            },
            {
                id: 5,
                date: "2026-04-27",
                time: "12:00 PM",
                mentor: "Sarah Smith",
                student: "John Doe",
                service: "Chemistry Mentoring",
                location: "Microsoft Teams",
                topics: "Balancing equations."
            }
        ];

        this.render();
        this.populateFilters();
    },

    /* -----------------------------
       RENDER PIPELINE
    ----------------------------- */
    render(filteredList = null) {
        const data = filteredList || this.bookings;

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
        const d = new Date(dateStr);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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

        // Required for ViewUI.js
        card.dataset.id = b.id;
        card.dataset.name = b.student;
        card.dataset.service = b.service;
        card.dataset.date = this.formatDateLabel(b.date);
        card.dataset.time = b.time;
        card.dataset.location = b.location;
        card.dataset.topics = b.topics;

        card.innerHTML = `
            <h3>${b.time}</h3>
            <p class="mentor"><strong>Mentor</strong> ${b.mentor}</p>
            <p class="student"><strong>Student</strong> ${b.student}</p>
            <p><strong>Service:</strong> ${b.service}</p>
            <p><strong>Location:</strong> ${b.location}</p>
        `;

        return card;
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
            students.add(b.student);
            categories.add(b.service);
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

        values.forEach(v => {
            const div = document.createElement("div");
            div.textContent = v;
            div.dataset.value = v;
            dropdown.appendChild(div);
        });

        // Add "Show All"
        const all = document.createElement("div");
        all.textContent = "Show All";
        all.dataset.value = "all";
        dropdown.appendChild(all);

        const ViewFilters = {
            populateDropdowns() {
                this.populate("mentor");
                this.populate("student");
            },

            populate(type) {
                const dropdown = document.getElementById(`${type}-dropdown`);
                dropdown.innerHTML = "";

                const values = ["all", ...ViewData.getUniqueValues(type)];

                values.forEach(value => {
                    const div = document.createElement("div");
                    div.textContent = value === "all" ? "Show All" : value;
                    div.dataset.value = value;

                    // ⭐ Default selection
                    if (value === "all") div.classList.add("selected");

                    dropdown.appendChild(div);
                });
            }
        };
    }
};