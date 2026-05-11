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

    saveEdits() {
        this.setFieldsDisabled(true);
        this.editActions.classList.add("hidden");
        this.editBtn.classList.remove("hidden");
        this.originalValues = this.getCurrentValues();
        this.message.textContent = "Profile changes saved.";
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
    }
};

document.addEventListener("DOMContentLoaded", () => {
    AccountUI.init();
});
