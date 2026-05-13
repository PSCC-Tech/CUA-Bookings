const MentorDetailsData = {
    async init() {
        if (!window.CUAApi) return;

        const params = new URLSearchParams(window.location.search);
        const mentorId = params.get("mentor_id");
        const mentorNumber = params.get("mentor_number");

        try {
            const query = mentorId
                ? `?id=${encodeURIComponent(mentorId)}`
                : mentorNumber
                    ? `?mentor_number=${encodeURIComponent(mentorNumber)}`
                    : "";
            const data = await window.CUAApi.request(`mentors.php${query}`);
            const mentor = data.mentors?.[0];
            if (!mentor) return;

            this.renderMentor(mentor);
            this.publishCourses(mentor.courses || []);
        } catch (error) {
            console.warn("Could not load mentor details:", error);
        }
    },

    renderMentor(mentor) {
        this.setText("mentor-id", mentor.mentor_number);
        this.setText("mentor-name", mentor.name);
        this.setText("mentor-contact", mentor.contact || mentor.email || mentor.phone || "");

        const scheduleList = document.getElementById("schedule-list");
        if (scheduleList) {
            const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
            const grouped = new Map();

            (mentor.schedule || []).forEach(block => {
                const day = weekdays[block.day_of_week - 1];
                if (!day) return;
                if (!grouped.has(day)) grouped.set(day, []);
                grouped.get(day).push(block);
            });

            scheduleList.innerHTML = weekdays.map(day => {
                const shifts = grouped.get(day) || [];
                const html = shifts.length
                    ? shifts.map(shift => `<div class="schedule-shift"><span class="schedule-start">${shift.start}</span> - <span class="schedule-end">${shift.end}</span></div>`).join("")
                    : `<div class="schedule-shift unavailable">Unavailable</div>`;
                return `<li><strong>${day}:</strong>${html}</li>`;
            }).join("");
        }
    },

    publishCourses(courses) {
        window.CUAMentorCourses = courses.map(course => ({
            id: course.code || course.id,
            name: course.name
        }));

        document.dispatchEvent(new CustomEvent("cua-mentor-courses-loaded", {
            detail: { courses: window.CUAMentorCourses }
        }));
    },

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "";
    }
};

document.addEventListener("DOMContentLoaded", () => {
    MentorDetailsData.init();
});
