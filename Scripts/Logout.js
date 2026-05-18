(function () {
    const LOGOUT_ENDPOINT = "logout.php";
    const FALLBACK_REDIRECT = "login.html?logged_out=1";

    function clearApiCache() {
        if (!window.CUAApi || !window.CUAApi.cache) return;

        Object.keys(window.CUAApi.cache).forEach((key) => {
            window.CUAApi.cache[key] = null;
        });
    }

    function clearStorage() {
        try {
            window.sessionStorage.clear();
        } catch (error) {
            console.warn("Could not clear session storage during logout:", error);
        }

        try {
            Object.keys(window.localStorage)
                .filter((key) => key.toLowerCase().startsWith("cua"))
                .forEach((key) => window.localStorage.removeItem(key));
        } catch (error) {
            console.warn("Could not clear local storage during logout:", error);
        }
    }

    async function requestLogout() {
        if (!window.CUAApi) return FALLBACK_REDIRECT;

        try {
            const result = await window.CUAApi.request(LOGOUT_ENDPOINT, { method: "POST" });
            return result.redirect || FALLBACK_REDIRECT;
        } catch (error) {
            console.warn("Logout endpoint failed; continuing with local logout:", error);
            return FALLBACK_REDIRECT;
        }
    }

    function setProcessing(logoutControl, isProcessing) {
        logoutControl.classList.toggle("is-logging-out", isProcessing);
        logoutControl.setAttribute("aria-disabled", isProcessing ? "true" : "false");

        const label = logoutControl.querySelector("span");
        if (!label) return;

        if (!label.dataset.originalText) {
            label.dataset.originalText = label.textContent;
        }

        label.textContent = isProcessing ? "Signing out..." : label.dataset.originalText;
    }

    async function handleLogout(event) {
        event.preventDefault();

        const logoutControl = event.currentTarget;
        if (logoutControl.classList.contains("is-logging-out")) return;

        const confirmed = window.confirm("Log out of CUA Bookings?");
        if (!confirmed) return;

        setProcessing(logoutControl, true);
        clearApiCache();
        clearStorage();

        const redirect = await requestLogout();
        window.location.href = redirect;
    }

    function showLoggedOutNotice() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("logged_out") !== "1") return;

        const notice = document.createElement("div");
        notice.className = "logout-notice";
        notice.textContent = "You have been logged out.";
        document.body.appendChild(notice);

        params.delete("logged_out");
        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        window.history.replaceState({}, document.title, nextUrl);

        window.setTimeout(() => {
            notice.remove();
        }, 3500);
    }

    function enhanceLogoutControl(logoutControl) {
        logoutControl.setAttribute("role", "button");
        logoutControl.setAttribute("tabindex", "0");
        logoutControl.setAttribute("aria-label", "Log out");

        logoutControl.addEventListener("click", handleLogout);
        logoutControl.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            handleLogout(event);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".logout").forEach(enhanceLogoutControl);
        showLoggedOutNotice();
    });
})();
