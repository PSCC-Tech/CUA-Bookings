(function () {
    function digitsOnly(value) {
        return String(value || "").replace(/\D/g, "");
    }

    function formatPhone(value) {
        const digits = digitsOnly(value).slice(0, 10);
        const parts = [];

        if (digits.length > 0) parts.push(digits.slice(0, 3));
        if (digits.length > 3) parts.push(digits.slice(3, 6));
        if (digits.length > 6) parts.push(digits.slice(6, 10));

        return parts.join("-");
    }

    function formatPersonId(value) {
        const clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const letter = clean.match(/[A-Z]/)?.[0] || "";
        if (!letter) return "";

        let digits = clean.slice(clean.indexOf(letter) + 1).replace(/\D/g, "");
        if (digits.startsWith("00")) digits = digits.slice(2);
        digits = digits.slice(0, 6);

        return `${letter}00${digits}`;
    }

    function completePersonId(value) {
        const formatted = formatPersonId(value);
        if (!formatted) return "";

        const letter = formatted.charAt(0);
        const digits = formatted.slice(3).replace(/\D/g, "").slice(0, 6);
        return `${letter}00${digits.padStart(6, "0")}`;
    }

    function formatCourseCode(value, complete = false) {
        const clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const letters = clean.replace(/[^A-Z]/g, "").slice(0, 4);
        const digitStart = clean.search(/\d/);
        const digits = (digitStart >= 0 ? clean.slice(digitStart) : "").replace(/\D/g, "").slice(0, 4);

        if (!letters) return "";
        if (!digits) return letters;

        return `${letters} ${complete ? digits.padStart(4, "0") : digits}`;
    }

    function isPhoneInput(input) {
        const key = `${input.id || ""} ${input.name || ""} ${input.dataset.field || ""}`.toLowerCase();
        return input.type === "tel" || key.includes("phone");
    }

    function isEmailInput(input) {
        const key = `${input.id || ""} ${input.name || ""} ${input.dataset.field || ""}`.toLowerCase();
        return input.type === "email" || key.includes("email");
    }

    function isPersonIdInput(input) {
        const key = `${input.id || ""} ${input.name || ""} ${input.dataset.field || ""}`.toLowerCase();
        return key.includes("student-id")
            || key.includes("mentor-id")
            || key.includes("studentid")
            || input.dataset.format === "person-id"
            || /^student_\d+_id$/.test(input.name || "");
    }

    function isCourseCodeInput(input) {
        return input.id === "course-code" || input.classList.contains("course-code") || input.dataset.format === "course-code";
    }

    function isContactInput(input) {
        const key = `${input.id || ""} ${input.name || ""} ${input.dataset.field || ""}`.toLowerCase();
        return input.dataset.format === "contact" || key.includes("contact");
    }

    function applyAttributes(input) {
        if (!(input instanceof HTMLInputElement)) return;

        if (isPhoneInput(input)) {
            input.type = "tel";
            input.inputMode = "numeric";
            input.maxLength = 12;
            input.placeholder = input.placeholder || "787-555-5555";
            input.pattern = "\\d{3}-\\d{3}-\\d{4}";
        }

        if (isEmailInput(input)) {
            input.autocapitalize = "none";
            input.spellcheck = false;
            input.placeholder = input.placeholder || "name@example.edu";
        }

        if (isPersonIdInput(input)) {
            input.autocapitalize = "characters";
            input.maxLength = 9;
            input.pattern = "[A-Z]00\\d{6}";
            input.placeholder = input.placeholder || "A00123456";
        }

        if (isCourseCodeInput(input)) {
            input.autocapitalize = "characters";
            input.maxLength = 9;
            input.pattern = "[A-Z]{4}\\s\\d{4}";
            input.placeholder = input.placeholder || "Course Code (e.g., MATH 1500)";
        }

        if (isContactInput(input)) {
            input.autocapitalize = "none";
            input.spellcheck = false;
        }
    }

    function formatInput(input, complete = false) {
        if (!(input instanceof HTMLInputElement)) return;

        if (isPhoneInput(input)) {
            input.value = formatPhone(input.value);
        } else if (isEmailInput(input)) {
            input.value = input.value.trim().toLowerCase();
        } else if (isContactInput(input)) {
            input.value = /[a-z@]/i.test(input.value)
                ? input.value.trim().toLowerCase()
                : formatPhone(input.value);
        } else if (isPersonIdInput(input)) {
            input.value = complete ? completePersonId(input.value) : formatPersonId(input.value);
        } else if (isCourseCodeInput(input)) {
            input.value = formatCourseCode(input.value, complete);
        }
    }

    function hydrate(root = document) {
        root.querySelectorAll("input").forEach(applyAttributes);
    }

    document.addEventListener("input", event => {
        const input = event.target;
        applyAttributes(input);
        formatInput(input, false);
    }, true);

    document.addEventListener("blur", event => {
        const input = event.target;
        applyAttributes(input);
        formatInput(input, true);
    }, true);

    document.addEventListener("focusin", event => applyAttributes(event.target), true);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => hydrate());
    } else {
        hydrate();
    }

    window.CUAInputFormatters = {
        formatPhone,
        formatPersonId: completePersonId,
        formatCourseCode: value => formatCourseCode(value, true),
    };
})();
