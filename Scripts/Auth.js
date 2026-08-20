(function () {
    const LOGIN_PAGE = "login.html";
    const STATUS_ENDPOINT = "api/auth.php";

    document.documentElement.classList.add("auth-pending");

    function getCurrentPage() {
        return window.location.pathname.split("/").pop() || "index.html";
    }

    function getReturnTo() {
        return `${getCurrentPage()}${window.location.search}${window.location.hash}`;
    }

    function redirectToLogin() {
        const params = new URLSearchParams();
        params.set("return_to", getReturnTo());
        window.location.replace(`${LOGIN_PAGE}?${params.toString()}`);
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

    async function checkSession() {
        try {
            const response = await fetch(STATUS_ENDPOINT, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            });
            const payload = await parseJsonResponse(response, STATUS_ENDPOINT);

            if (!response.ok || payload.ok === false || !payload.authenticated) {
                redirectToLogin();
                return null;
            }

            window.CUAAuth.user = payload.user;
            document.documentElement.classList.remove("auth-pending");
            document.dispatchEvent(new CustomEvent("cua-auth-ready", { detail: payload.user }));
            return payload.user;
        } catch (error) {
            console.warn("Could not verify authentication:", error);
            redirectToLogin();
            return null;
        }
    }

    window.CUAAuth = {
        user: null,
        ready: checkSession()
    };
})();
