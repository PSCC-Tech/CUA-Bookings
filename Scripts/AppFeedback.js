(function () {
    const TOAST_DURATION = 4200;
    let toastRegion = null;
    let activeConfirm = null;

    function ensureToastRegion() {
        if (toastRegion) return toastRegion;

        toastRegion = document.createElement("div");
        toastRegion.className = "cua-toast-region";
        toastRegion.setAttribute("aria-live", "polite");
        toastRegion.setAttribute("aria-atomic", "false");
        document.body.appendChild(toastRegion);
        return toastRegion;
    }

    function inferType(message, fallback = "info") {
        const text = String(message || "").toLowerCase();

        if (text.includes("success") || text.includes("saved") || text.includes("created") || text.includes("deleted")) {
            return "success";
        }

        if (
            text.includes("could not") ||
            text.includes("invalid") ||
            text.includes("required") ||
            text.includes("please ") ||
            text.includes("failed") ||
            text.includes("error")
        ) {
            return "error";
        }

        return fallback;
    }

    function showToast(message, options = {}) {
        const text = String(message || "").trim();
        if (!text) return null;

        const type = options.type || inferType(text);
        const region = ensureToastRegion();
        const toast = document.createElement("div");
        toast.className = `cua-toast cua-toast-${type}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");

        const content = document.createElement("div");
        content.className = "cua-toast-content";

        if (options.title) {
            const title = document.createElement("strong");
            title.textContent = options.title;
            content.appendChild(title);
        }

        const body = document.createElement("span");
        body.textContent = text;
        content.appendChild(body);

        const close = document.createElement("button");
        close.type = "button";
        close.className = "cua-toast-close";
        close.setAttribute("aria-label", "Dismiss notification");
        close.textContent = "x";

        const removeToast = () => {
            toast.classList.add("is-leaving");
            window.setTimeout(() => toast.remove(), 180);
        };

        close.addEventListener("click", removeToast);
        toast.append(content, close);
        region.appendChild(toast);

        window.setTimeout(removeToast, options.duration || TOAST_DURATION);
        return toast;
    }

    function clearConfirm() {
        if (!activeConfirm) return;
        activeConfirm.remove();
        activeConfirm = null;
    }

    function confirmDialog(message, options = {}) {
        clearConfirm();

        return new Promise(resolve => {
            const previousFocus = document.activeElement;
            const backdrop = document.createElement("div");
            backdrop.className = "cua-confirm-backdrop";

            const dialog = document.createElement("section");
            dialog.className = "cua-confirm-dialog";
            dialog.setAttribute("role", "dialog");
            dialog.setAttribute("aria-modal", "true");
            dialog.setAttribute("aria-labelledby", "cua-confirm-title");
            dialog.setAttribute("aria-describedby", "cua-confirm-message");

            const eyebrow = document.createElement("span");
            eyebrow.className = "cua-confirm-eyebrow";
            eyebrow.textContent = options.eyebrow || "Confirmation";

            const title = document.createElement("h2");
            title.id = "cua-confirm-title";
            title.textContent = options.title || "Confirm action";

            const body = document.createElement("p");
            body.id = "cua-confirm-message";
            body.textContent = String(message || "Are you sure?");

            const actions = document.createElement("div");
            actions.className = "cua-confirm-actions";

            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "cua-confirm-cancel";
            cancel.textContent = options.cancelText || "Cancel";

            const confirm = document.createElement("button");
            confirm.type = "button";
            confirm.className = options.danger ? "cua-confirm-danger" : "cua-confirm-primary";
            confirm.textContent = options.confirmText || "Confirm";

            function onKeydown(event) {
                if (event.key !== "Escape") return;
                finish(false);
            }

            function finish(value) {
                document.removeEventListener("keydown", onKeydown);
                clearConfirm();
                if (previousFocus && typeof previousFocus.focus === "function") {
                    previousFocus.focus();
                }
                resolve(value);
            }

            cancel.addEventListener("click", () => finish(false));
            confirm.addEventListener("click", () => finish(true));
            backdrop.addEventListener("click", event => {
                if (event.target === backdrop) finish(false);
            });
            document.addEventListener("keydown", onKeydown);

            actions.append(cancel, confirm);
            dialog.append(eyebrow, title, body, actions);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);
            activeConfirm = backdrop;

            confirm.focus();
        });
    }

    function flash(message, type = "info") {
        try {
            window.sessionStorage.setItem("cua-flash", JSON.stringify({ message, type }));
        } catch (error) {
            console.warn("Could not store flash notification:", error);
        }
    }

    function showStoredFlash() {
        let payload = null;
        try {
            payload = window.sessionStorage.getItem("cua-flash");
            window.sessionStorage.removeItem("cua-flash");
        } catch (error) {
            return;
        }

        if (!payload) return;

        try {
            const data = JSON.parse(payload);
            showToast(data.message, { type: data.type || "info" });
        } catch (error) {
            showToast(payload, { type: "info" });
        }
    }

    window.CUANotify = {
        show: showToast,
        success: message => showToast(message, { type: "success" }),
        error: message => showToast(message, { type: "error" }),
        info: message => showToast(message, { type: "info" }),
        warning: message => showToast(message, { type: "warning" }),
        flash
    };

    window.CUAConfirm = confirmDialog;

    const nativeAlert = window.alert?.bind(window);
    window.CUANativeAlert = nativeAlert;
    window.alert = message => {
        showToast(message, { type: inferType(message) });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showStoredFlash);
    } else {
        showStoredFlash();
    }
})();
