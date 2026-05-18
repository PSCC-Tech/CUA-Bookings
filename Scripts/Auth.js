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
            const payload = await response.json();

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
