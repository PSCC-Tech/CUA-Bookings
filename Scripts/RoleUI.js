(function () {
    const ADMIN_ONLY_PAGES = {
        "absence.html": "index.html",
        "data.html": "index.html",
        "add-courses.html": "courses.html",
        "add-mentors.html": "mentors.html"
    };

    function getCurrentPage() {
        return window.location.pathname.split("/").pop() || "index.html";
    }

    function isAdministrator(user) {
        return String(user?.role || "").toLowerCase() === "administrator";
    }

    function setRoleClass(user) {
        const admin = isAdministrator(user);
        document.documentElement.classList.toggle("role-admin", admin);
        document.documentElement.classList.toggle("role-staff", !admin);
        document.body.dataset.currentRole = admin ? "Administrator" : "Staff";
    }

    function hideAdminOnlyControls() {
        document.querySelectorAll("[data-admin-only]").forEach(element => {
            element.hidden = true;
            element.setAttribute("aria-hidden", "true");
        });
    }

    function enhanceClickableNavigation() {
        document.querySelectorAll(".nav-links li[onclick], .top-option[onclick]").forEach(element => {
            const isButton = element.tagName.toLowerCase() === "button";
            if (!isButton) {
                element.setAttribute("role", "link");
                element.setAttribute("tabindex", "0");
            }

            element.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                element.click();
            });
        });
    }

    function addReadOnlyNotice() {
        const target = document.querySelector(".booking-header .left-group, #course-info, #mentor-info");
        if (!target || target.querySelector(".role-access-note")) return;

        const note = document.createElement("p");
        note.className = "role-access-note";
        note.textContent = "Staff access: records can be viewed here, while administrative changes are reserved for administrators.";
        target.appendChild(note);
    }

    async function initRoleUI() {
        const auth = window.CUAAuth?.ready;
        const user = auth && typeof auth.then === "function"
            ? await auth.catch(() => null)
            : window.CUAAuth?.user;

        if (!user) return;

        const admin = isAdministrator(user);
        setRoleClass(user);
        enhanceClickableNavigation();

        if (admin) return;

        const page = getCurrentPage();
        const redirect = ADMIN_ONLY_PAGES[page];

        if (redirect) {
            window.CUANotify?.flash("That area is available to administrators only.", "warning");
            window.location.replace(redirect);
            return;
        }

        hideAdminOnlyControls();

        if (page === "courses.html" || page === "mentors.html" || page.endsWith("-details.html")) {
            addReadOnlyNotice();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initRoleUI);
    } else {
        initRoleUI();
    }
})();
