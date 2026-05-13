const AccountUI = {
    originalValues: {},

    init() {
        this.form = document.getElementById("admin-profile-form");
        this.editBtn = document.getElementById("edit-profile-btn");
        this.cancelBtn = document.getElementById("cancel-profile-btn");
        this.message = document.getElementById("profile-message");
        this.editActions = document.querySelector(".edit-actions");
        this.editableFields = [...document.querySelectorAll("[data-editable]")];

        this.setupListeners();
        this.loadAccount();
    },

    setupListeners() {
        this.editBtn.addEventListener("click", () => this.enterEditMode());
        this.cancelBtn.addEventListener("click", () => this.cancelEdits());

        this.form.addEventListener("submit", (event) => {
            event.preventDefault();
            this.saveEdits();
        });
    },

    enterEditMode() {
        this.originalValues = this.getCurrentValues();
        this.setFieldsDisabled(false);
        this.editBtn.classList.add("hidden");
        this.editActions.classList.remove("hidden");
        this.message.textContent = "";
    },

    async saveEdits() {
        try {
            const saved = window.CUAApi
                ? await window.CUAApi.updateAccount(this.getCurrentValues())
                : this.getCurrentValues();

            this.renderAccount(saved);
            this.setFieldsDisabled(true);
            this.editActions.classList.add("hidden");
            this.editBtn.classList.remove("hidden");
            this.originalValues = this.getCurrentValues();
            this.message.textContent = "Profile changes saved.";
        } catch (error) {
            this.message.textContent = error.message || "Could not save profile changes.";
        }
    },

    cancelEdits() {
        this.editableFields.forEach(field => {
            field.value = this.originalValues[field.name];
        });

        this.setFieldsDisabled(true);
        this.editActions.classList.add("hidden");
        this.editBtn.classList.remove("hidden");
        this.message.textContent = "Changes canceled.";
    },

    getCurrentValues() {
        return this.editableFields.reduce((values, field) => {
            values[field.name] = field.value;
            return values;
        }, {});
    },

    setFieldsDisabled(disabled) {
        this.editableFields.forEach(field => {
            field.disabled = disabled;
        });
    },

    async loadAccount() {
        if (!window.CUAApi) return;

        try {
            const account = await window.CUAApi.getAccount(true);
            this.renderAccount(account);
            this.originalValues = this.getCurrentValues();
        } catch (error) {
            const message = error.message || "Could not load account details.";
            this.message.textContent = message;
            this.setText("account-display-name", "Database connection needed");
        }
    },

    renderAccount(account) {
        if (!account) return;

        this.setValue("fullName", account.fullName);
        this.setValue("title", account.title);
        this.setValue("email", account.email);
        this.setValue("phone", account.phone);
        this.setValue("office", account.office);
        this.setValue("preferredContact", account.preferredContact);

        this.setText("account-display-name", account.fullName);
        this.setText("account-id", `ADM-${String(account.user_id || 1).padStart(4, "0")}`);
        this.setText("account-role", account.role || "Administrator");
        this.setText("account-access-level", account.accessLevel || "Full management");
        this.setText("account-last-login", account.lastLogin || "Not recorded");
        this.setText("account-password-status", account.passwordStatus || "Updated recently");
        this.setText("account-two-step", account.twoStepVerification || "Enabled");

        const permissionList = document.getElementById("permission-list");
        if (permissionList && Array.isArray(account.permissions)) {
            permissionList.innerHTML = account.permissions.map(permission => `<span>${permission}</span>`).join("");
        }
    },

    setValue(name, value) {
        const field = this.form?.elements[name];
        if (field) field.value = value || "";
    },

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "";
    }
};

document.addEventListener("DOMContentLoaded", () => {
    AccountUI.init();
});
