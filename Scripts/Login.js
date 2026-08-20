(function () {
    const AUTH_ENDPOINT = "api/auth.php";
    const DEFAULT_REDIRECT = "index.html";

    function getSafeReturnTo() {
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get("return_to") || DEFAULT_REDIRECT;

        if (
            returnTo.startsWith("http://") ||
            returnTo.startsWith("https://") ||
            returnTo.startsWith("//") ||
            returnTo.includes("\\")
        ) {
            return DEFAULT_REDIRECT;
        }

        const page = returnTo.split("?")[0].split("#")[0];
        if (page === "" || page === "login.html") {
            return DEFAULT_REDIRECT;
        }

        return returnTo;
    }

    function setMessage(message, type = "error") {
        const messageEl = document.getElementById("login-message");
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `login-message ${type}`;
        messageEl.hidden = !message;
    }

    function setSubmitting(form, isSubmitting) {
        const button = form.querySelector("button[type='submit']");
        form.classList.toggle("is-submitting", isSubmitting);

        if (button) {
            button.disabled = isSubmitting;
            button.textContent = isSubmitting ? "Signing in..." : "Sign in";
        }
    }

    async function parseJsonResponse(response, endpoint) {
        const text = await response.text();

        if (!text.trim()) {
            throw new Error(`${endpoint} returned an empty response with HTTP ${response.status}. Check the live PHP error log for this endpoint.`);
        }

        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error(`${endpoint} returned invalid JSON with HTTP ${response.status}. Response started with: ${text.slice(0, 120)}`);
        }
    }

    async function requestAuth(payload, method = "POST") {
        const response = await fetch(AUTH_ENDPOINT, {
            method,
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                "Accept": "application/json",
                ...(payload ? { "Content-Type": "application/json" } : {})
            },
            body: payload ? JSON.stringify(payload) : undefined
        });
        const data = await parseJsonResponse(response, AUTH_ENDPOINT);

        if (!response.ok || data.ok === false) {
            throw new Error(data.error || "Authentication failed.");
        }

        return data;
    }

    async function redirectIfAlreadySignedIn() {
        try {
            const status = await requestAuth(null, "GET");
            if (status.authenticated) {
                window.location.replace(getSafeReturnTo());
            }
        } catch (error) {
            setMessage("");
        }
    }

    function showLogoutNotice() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("logged_out") !== "1") return;

        setMessage("You have been logged out.", "success");
        params.delete("logged_out");
        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        window.history.replaceState({}, document.title, nextUrl);
    }

    function setupLoginForm() {
        const form = document.getElementById("login-form");
        if (!form) return;

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            setMessage("");
            setSubmitting(form, true);

            const formData = new FormData(form);
            const payload = {
                email: String(formData.get("email") || "").trim(),
                password: String(formData.get("password") || "")
            };

            try {
                await requestAuth(payload);
                window.location.replace(getSafeReturnTo());
            } catch (error) {
                setMessage(error.message || "Could not sign in.");
            } finally {
                setSubmitting(form, false);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        setupLoginForm();
        showLogoutNotice();
        redirectIfAlreadySignedIn();
    });
})();
