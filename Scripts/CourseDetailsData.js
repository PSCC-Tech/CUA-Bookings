const CourseDetailsData = {
    async init() {
        if (!window.CUAApi) return;

        const params = new URLSearchParams(window.location.search);
        const courseId = params.get("course_id");
        const courseCode = params.get("course_code");

        try {
            const query = courseId
                ? `?id=${encodeURIComponent(courseId)}`
                : courseCode
                    ? `?course_code=${encodeURIComponent(courseCode)}`
                    : "";
            const data = await window.CUAApi.request(`courses.php${query}`);
            const course = data.courses?.[0];
            if (!course) return;

            window.CUACurrentCourse = course;
            this.renderCourse(course);
            await this.renderMentorTabs(course);
            document.dispatchEvent(new CustomEvent("cua-course-details-loaded", {
                detail: { course }
            }));
        } catch (error) {
            console.warn("Could not load course details:", error);
        }
    },

    renderCourse(course) {
        this.setText("course-code", course.code || course.id);
        this.setText("course-name", course.name);

        const professorsList = document.getElementById("professors-list");
        if (professorsList) {
            professorsList.innerHTML = (course.professors || [])
                .map(name => `<li>${this.escapeHtml(name)}</li>`)
                .join("") || "<li>No professors assigned</li>";
        }

        const topicsList = document.getElementById("topics-list");
        if (topicsList) {
            topicsList.innerHTML = (course.topics || [])
                .map(topic => `<li>${this.escapeHtml(topic)}</li>`)
                .join("") || "<li>No topics listed</li>";
        }

        this.setText("course-description", course.description || "No description available.");
    },

    async renderMentorTabs(course) {
        const tabsContainer = document.querySelector(".mentor-tabs");
        if (!tabsContainer) return;

        const mentors = await window.CUAApi.getMentors({ course_code: course.code || course.id }, true);
        tabsContainer.innerHTML = mentors.length
            ? mentors.map((mentor, index) => `
                <button class="mentor-tab${index === 0 ? " active" : ""}" data-mentor="${this.escapeAttribute(mentor.mentor_number || mentor.number || mentor.name)}" data-mentor-name="${this.escapeAttribute(mentor.name)}">
                    ${this.escapeHtml(mentor.name)}
                </button>
            `).join("")
            : `<button class="mentor-tab active">No mentors</button>`;

        tabsContainer.querySelectorAll(".mentor-tab[data-mentor-name]").forEach(tab => {
            tab.addEventListener("click", () => {
                tabsContainer.querySelectorAll(".mentor-tab").forEach(item => item.classList.remove("active"));
                tab.classList.add("active");
                window.CUACalendar?.setMentor(tab.dataset.mentorName);
            });
        });

        if (window.CUACalendar) {
            window.CUACalendar.setCourse(course.code || course.id);
        }
    },

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "";
    },

    escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML;
    },

    escapeAttribute(value) {
        return this.escapeHtml(value).replace(/"/g, "&quot;");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    CourseDetailsData.init();
});
