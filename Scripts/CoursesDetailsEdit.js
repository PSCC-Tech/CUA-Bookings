document.addEventListener("DOMContentLoaded", () => {
    const editBtn = document.querySelector(".edit-btn");
    const editActions = document.querySelector(".edit-actions");
    const confirmBtn = document.querySelector(".confirm-btn");
    const cancelBtn = document.querySelector(".cancel-btn");
    const mentorModal = document.getElementById("mentor-modal");
    const mentorModalList = document.getElementById("modal-mentor-checkboxes");
    const mentorSearch = document.getElementById("modal-mentor-search");
    const mentorCategoryBtn = document.getElementById("modal-category-btn");
    const mentorCategoryDropdown = document.getElementById("modal-category-dropdown");
    const mentorSelectAll = document.getElementById("modal-select-all-mentors");
    const confirmAddMentorsBtn = document.getElementById("confirm-add-mentors");
    const closeModalBtn = document.getElementById("close-mentor-modal");

    if (!editBtn || !editActions) return;

    let originalData = {};
    let allMentors = [];
    let activeModalCategory = "all";
    let isEditing = false;

    const mentorLoadPromise = window.CUAApi
        ? window.CUAApi.getMentors({}, true)
            .then(mentors => {
                allMentors = mentors.map(mentor => ({
                    id: String(mentor.mentor_number || mentor.number || mentor.id || ""),
                    name: mentor.name || mentor.full_name || "",
                    categories: mentor.categories || []
                })).filter(mentor => mentor.id && mentor.name);
                return allMentors;
            })
            .catch(error => {
                console.warn("Could not load mentors for course details:", error);
                allMentors = [];
                return allMentors;
            })
        : Promise.resolve([]);

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML;
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/"/g, "&quot;");
    }

    function setEditControlsVisible(visible) {
        editBtn.style.display = visible ? "none" : "inline-block";
        editActions.style.display = visible ? "flex" : "none";
    }

    function getTextList(selector, emptyLabel) {
        return [...document.querySelectorAll(selector)]
            .map(item => item.textContent.trim())
            .filter(text => text && text !== emptyLabel);
    }

    function getMentorNameFromTab(tab) {
        return tab?.querySelector(".mentor-tab-name")?.textContent.trim() ||
            tab?.dataset.mentorName ||
            tab?.textContent.replace("x", "").trim() ||
            "";
    }

    function getEditableMentors() {
        return [...document.querySelectorAll(".mentor-tab.editable")]
            .map(tab => ({
                id: tab.dataset.mentor || "",
                name: getMentorNameFromTab(tab)
            }))
            .filter(mentor => mentor.id && mentor.name);
    }

    function createEditableMentorTab(mentor, isActive = false) {
        return `
            <button type="button" class="mentor-tab editable${isActive ? " active" : ""}" data-mentor="${escapeAttribute(mentor.id)}" data-mentor-name="${escapeAttribute(mentor.name)}">
                <span class="mentor-tab-name">${escapeHtml(mentor.name)}</span>
                <span class="remove-mentor" role="button" aria-label="Remove ${escapeAttribute(mentor.name)}">x</span>
            </button>
        `;
    }

    function createReadOnlyMentorTab(mentor, isActive = false) {
        return `
            <button type="button" class="mentor-tab${isActive ? " active" : ""}" data-mentor="${escapeAttribute(mentor.id)}" data-mentor-name="${escapeAttribute(mentor.name)}">
                ${escapeHtml(mentor.name)}
            </button>
        `;
    }

    function setEditableActiveMentor(tab) {
        if (!tab?.dataset.mentorName) return;

        document.querySelectorAll(".mentor-tab.editable").forEach(item => item.classList.remove("active"));
        tab.classList.add("active");
        window.CUACalendar?.setMentor?.(tab.dataset.mentorName);
    }

    function bindReadOnlyMentorTabs() {
        const mentorTabs = document.querySelector(".mentor-tabs");
        if (!mentorTabs) return;

        mentorTabs.querySelectorAll(".mentor-tab[data-mentor-name]").forEach(tab => {
            tab.onclick = () => {
                mentorTabs.querySelectorAll(".mentor-tab").forEach(item => item.classList.remove("active"));
                tab.classList.add("active");
                window.CUACalendar?.setMentor?.(tab.dataset.mentorName);
            };
        });
    }

    function renderReadOnlyMentorTabs(mentors, preferredMentorName = "") {
        const mentorTabs = document.querySelector(".mentor-tabs");
        if (!mentorTabs) return;

        const cleanMentors = mentors.filter(mentor => mentor.id && mentor.name);

        if (!cleanMentors.length) {
            mentorTabs.innerHTML = `<button type="button" class="mentor-tab active" disabled>No mentors</button>`;
            return;
        }

        const activeName = preferredMentorName || cleanMentors[0].name;
        mentorTabs.innerHTML = cleanMentors
            .map(mentor => createReadOnlyMentorTab(mentor, mentor.name === activeName))
            .join("");

        bindReadOnlyMentorTabs();

        const activeTab = mentorTabs.querySelector(".mentor-tab.active[data-mentor-name]") ||
            mentorTabs.querySelector(".mentor-tab[data-mentor-name]");
        if (activeTab) {
            activeTab.classList.add("active");
            window.CUACalendar?.setMentor?.(activeTab.dataset.mentorName);
        }
    }

    function renderEditableMentorTabs(mentors) {
        const mentorTabs = document.querySelector(".mentor-tabs");
        if (!mentorTabs) return;

        const activeName = document.querySelector(".mentor-tab.active")?.dataset.mentorName ||
            mentors[0]?.name ||
            "";

        mentorTabs.innerHTML = mentors
            .map(mentor => createEditableMentorTab(mentor, mentor.name === activeName))
            .join("") + `
                <button type="button" id="add-mentor-btn" class="add-mentor-btn">+ Add Mentor</button>
            `;

        const activeTab = mentorTabs.querySelector(".mentor-tab.editable.active") ||
            mentorTabs.querySelector(".mentor-tab.editable");
        if (activeTab) activeTab.classList.add("active");

        attachMentorEditEvents();
    }

    function renderCourseInfo({ code, name, professors, topics, description }) {
        const infoList = document.getElementById("course-info-list");
        const topicsList = document.getElementById("topics-list");
        const descriptionWrapper = document.getElementById("course-description-wrapper");

        infoList.innerHTML = `
            <li><strong>Code:</strong> <span id="course-code">${escapeHtml(code)}</span></li>
            <li><strong>Name:</strong> <span id="course-name">${escapeHtml(name)}</span></li>
            <li><strong>Professors:</strong>
                <ul id="professors-list">
                    ${professors.length ? professors.map(p => `<li>${escapeHtml(p)}</li>`).join("") : "<li>No professors assigned</li>"}
                </ul>
            </li>
        `;

        topicsList.innerHTML = topics.length
            ? topics.map(topic => `<li>${escapeHtml(topic)}</li>`).join("")
            : "<li>No topics listed</li>";

        descriptionWrapper.innerHTML = `<p id="course-description">${escapeHtml(description)}</p>`;
    }

    function enterEditMode() {
        if (isEditing) return;

        const codeSpan = document.getElementById("course-code");
        const nameSpan = document.getElementById("course-name");
        const professorList = document.getElementById("professors-list");
        const topicsList = document.getElementById("topics-list");
        const descriptionWrapper = document.getElementById("course-description-wrapper");
        const descriptionP = descriptionWrapper?.querySelector("#course-description");
        const mentorTabs = document.querySelector(".mentor-tabs");

        if (!codeSpan || !nameSpan || !professorList || !topicsList || !descriptionWrapper || !descriptionP || !mentorTabs) {
            return;
        }

        originalData = {
            courseDbId: window.CUACurrentCourse?.course_id || "",
            code: codeSpan.textContent.trim(),
            name: nameSpan.textContent.trim(),
            professors: getTextList("#professors-list li", "No professors assigned"),
            topics: getTextList("#topics-list li", "No topics listed"),
            description: descriptionP.textContent.trim(),
            activeMentorName: mentorTabs.querySelector(".mentor-tab.active")?.dataset.mentorName || "",
            mentors: [...mentorTabs.querySelectorAll(".mentor-tab[data-mentor-name]")]
                .map(tab => ({
                    id: tab.dataset.mentor || tab.dataset.mentorName || "",
                    name: tab.dataset.mentorName || tab.textContent.trim()
                }))
                .filter(mentor => mentor.id && mentor.name && mentor.name !== "No mentors")
        };

        codeSpan.outerHTML = `<input id="edit-code" value="${escapeAttribute(originalData.code)}">`;
        nameSpan.outerHTML = `<input id="edit-name" value="${escapeAttribute(originalData.name)}">`;

        professorList.innerHTML = originalData.professors
            .map(professor => `<li><input value="${escapeAttribute(professor)}"><button type="button" class="remove-prof">x</button></li>`)
            .join("") +
            `<button type="button" id="add-prof">+ Add Professor</button>`;

        topicsList.innerHTML = originalData.topics
            .map(topic => `<li><input value="${escapeAttribute(topic)}"><button type="button" class="remove-topic">x</button></li>`)
            .join("") +
            `<button type="button" id="add-topic">+ Add Topic</button>`;

        descriptionWrapper.innerHTML = `<textarea id="edit-description">${escapeHtml(originalData.description)}</textarea>`;

        const descTextarea = document.getElementById("edit-description");
        descTextarea.style.width = "100%";
        descTextarea.style.overflowY = "hidden";
        descTextarea.style.height = "auto";
        descTextarea.style.height = descTextarea.scrollHeight + "px";
        descTextarea.addEventListener("input", () => {
            descTextarea.style.height = "auto";
            descTextarea.style.height = descTextarea.scrollHeight + "px";
        });

        renderEditableMentorTabs(originalData.mentors);
        attachDynamicButtons();
        setEditControlsVisible(true);
        isEditing = true;
    }

    async function openMentorModal() {
        await mentorLoadPromise;
        loadMentorModalList();
        resetMentorModalFilters();
        mentorModal?.classList.remove("hidden");
        mentorModal?.setAttribute("aria-hidden", "false");
        mentorSearch?.focus();
    }

    function closeMentorModal() {
        mentorModal?.classList.add("hidden");
        mentorModal?.setAttribute("aria-hidden", "true");
        mentorCategoryDropdown?.classList.add("hidden");
    }

    function attachMentorEditEvents() {
        document.querySelectorAll(".mentor-tab.editable").forEach(tab => {
            tab.onclick = event => {
                if (event.target.closest(".remove-mentor")) return;
                setEditableActiveMentor(tab);
            };
        });

        document.querySelectorAll(".remove-mentor").forEach(btn => {
            btn.onclick = event => {
                event.stopPropagation();
                const tab = btn.closest(".mentor-tab");
                const name = getMentorNameFromTab(tab);
                const wasActive = tab.classList.contains("active");

                if (confirm(`Remove ${name} from this course?`)) {
                    tab.remove();
                    if (wasActive) {
                        const nextTab = document.querySelector(".mentor-tab.editable");
                        if (nextTab) setEditableActiveMentor(nextTab);
                    }
                }
            };
        });

        const addBtn = document.getElementById("add-mentor-btn");
        if (addBtn) addBtn.onclick = () => openMentorModal();
    }

    async function persistCourseEdits(payload) {
        if (!window.CUAApi?.updateCourse) {
            throw new Error("Backend API is not loaded.");
        }

        const identifier = originalData.courseDbId || originalData.code;
        const result = await window.CUAApi.updateCourse(identifier, {
            course_id: originalData.courseDbId,
            course_code: payload.code,
            course_name: payload.name,
            professors: payload.professors,
            topics: payload.topics,
            description: payload.description,
            mentor_numbers: payload.mentors.map(mentor => mentor.id)
        });

        await window.Autocomplete?.loadCourseData?.(true).catch(() => null);
        await window.MentorScheduleStore?.loadFromApi?.(true).catch(() => null);

        let savedCourse = null;
        const savedCourseId = result.course_id || originalData.courseDbId;

        if (window.CUAApi?.request && savedCourseId) {
            const data = await window.CUAApi.request(`courses.php?id=${encodeURIComponent(savedCourseId)}`).catch(() => null);
            savedCourse = data?.courses?.[0] || null;
        }

        window.CUACurrentCourse = savedCourse || {
            ...(window.CUACurrentCourse || {}),
            course_id: savedCourseId,
            code: result.course_code || payload.code,
            id: result.course_code || payload.code,
            name: payload.name,
            description: payload.description,
            professors: payload.professors,
            topics: payload.topics,
            mentor_numbers: payload.mentors.map(mentor => mentor.id),
            mentors: payload.mentors.map(mentor => mentor.name)
        };
    }

    async function exitEditMode(save) {
        if (!isEditing) return;

        if (save) {
            const newCode = document.getElementById("edit-code").value.trim();
            const newName = document.getElementById("edit-name").value.trim();
            const newDesc = document.getElementById("edit-description").value.trim();
            const newProfessors = [...document.querySelectorAll("#professors-list input")]
                .map(input => input.value.trim())
                .filter(Boolean);
            const newTopics = [...document.querySelectorAll("#topics-list input")]
                .map(input => input.value.trim())
                .filter(Boolean);
            const newMentors = getEditableMentors();
            const activeMentorName = document.querySelector(".mentor-tab.editable.active")?.dataset.mentorName ||
                newMentors[0]?.name ||
                originalData.activeMentorName;

            if (!newCode || !newName) {
                alert("Course code and course name are required.");
                return;
            }

            confirmBtn.disabled = true;
            confirmBtn.textContent = "Saving...";

            try {
                await persistCourseEdits({
                    code: newCode,
                    name: newName,
                    description: newDesc,
                    professors: newProfessors,
                    topics: newTopics,
                    mentors: newMentors
                });
            } catch (error) {
                alert(error.message || "Could not save course changes.");
                return;
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = "Confirm";
            }

            const savedCourse = window.CUACurrentCourse || {};
            renderCourseInfo({
                code: savedCourse.code || savedCourse.id || newCode,
                name: savedCourse.name || newName,
                professors: savedCourse.professors || newProfessors,
                topics: savedCourse.topics || newTopics,
                description: savedCourse.description || newDesc
            });

            const savedMentors = (savedCourse.mentor_numbers || []).map((id, index) => ({
                id,
                name: savedCourse.mentors?.[index] || id
            }));
            renderReadOnlyMentorTabs(savedMentors, activeMentorName);
            window.CUACalendar?.setCourse?.(savedCourse.code || savedCourse.id || newCode, activeMentorName);
            bindReadOnlyMentorTabs();
        } else {
            renderCourseInfo(originalData);
            renderReadOnlyMentorTabs(originalData.mentors, originalData.activeMentorName);
            window.CUACalendar?.setCourse?.(originalData.code, originalData.activeMentorName);
            bindReadOnlyMentorTabs();
        }

        closeMentorModal();
        setEditControlsVisible(false);
        isEditing = false;
    }

    function attachDynamicButtons() {
        const professorList = document.getElementById("professors-list");
        const topicsList = document.getElementById("topics-list");
        const addProfBtn = document.getElementById("add-prof");
        const addTopicBtn = document.getElementById("add-topic");

        if (addProfBtn) {
            addProfBtn.onclick = () => {
                addProfBtn.insertAdjacentHTML("beforebegin", `<li><input value=""><button type="button" class="remove-prof">x</button></li>`);
                attachDynamicButtons();
            };
        }

        professorList?.querySelectorAll(".remove-prof").forEach(btn => {
            btn.onclick = () => btn.parentElement.remove();
        });

        if (addTopicBtn) {
            addTopicBtn.onclick = () => {
                addTopicBtn.insertAdjacentHTML("beforebegin", `<li><input value=""><button type="button" class="remove-topic">x</button></li>`);
                attachDynamicButtons();
            };
        }

        topicsList?.querySelectorAll(".remove-topic").forEach(btn => {
            btn.onclick = () => btn.parentElement.remove();
        });
    }

    function resetMentorModalFilters() {
        activeModalCategory = "all";
        if (mentorSearch) mentorSearch.value = "";
        if (mentorCategoryBtn) mentorCategoryBtn.textContent = "Show All";
        if (mentorSelectAll) {
            mentorSelectAll.checked = false;
            mentorSelectAll.indeterminate = false;
        }
        applyMentorModalFilters();
    }

    function loadMentorModalList() {
        if (!mentorModalList) return;

        mentorModalList.innerHTML = "";
        const existing = new Set(getEditableMentors().map(mentor => mentor.id));
        const sortedMentors = [...allMentors].sort((a, b) => a.name.localeCompare(b.name));

        if (!sortedMentors.length) {
            mentorModalList.innerHTML = `<div class="no-events">No mentors available.</div>`;
            return;
        }

        for (let i = 0; i < sortedMentors.length; i += 6) {
            const column = document.createElement("div");
            column.classList.add("mentor-column");

            sortedMentors.slice(i, i + 6).forEach(mentor => {
                const label = document.createElement("label");
                const input = document.createElement("input");
                const name = document.createElement("span");

                label.dataset.name = mentor.name;
                label.dataset.categories = mentor.categories.join(",");

                input.type = "checkbox";
                input.dataset.id = mentor.id;
                input.dataset.name = mentor.name;

                if (existing.has(mentor.id)) {
                    input.disabled = true;
                    label.classList.add("is-assigned");
                }

                name.textContent = mentor.name;
                label.append(input, name);

                if (existing.has(mentor.id)) {
                    const note = document.createElement("span");
                    note.className = "assigned-note";
                    note.textContent = "Assigned";
                    label.append(note);
                }

                column.appendChild(label);
            });

            mentorModalList.appendChild(column);
        }

        applyMentorModalFilters();
    }

    function applyMentorModalFilters() {
        if (!mentorModalList) return;

        const query = (mentorSearch?.value || "").trim().toLowerCase();
        const category = activeModalCategory.toLowerCase();

        mentorModalList.querySelectorAll("label").forEach(label => {
            const nameMatches = (label.dataset.name || "").toLowerCase().includes(query);
            const categories = (label.dataset.categories || "")
                .split(",")
                .map(item => item.trim().toLowerCase())
                .filter(Boolean);
            const categoryMatches = category === "all" || categories.includes(category);

            label.classList.toggle("hidden", !(nameMatches && categoryMatches));
        });

        syncSelectAllState();
    }

    function syncSelectAllState() {
        if (!mentorSelectAll || !mentorModalList) return;

        const visibleInputs = [...mentorModalList.querySelectorAll("label:not(.hidden) input[type='checkbox']:not(:disabled)")];
        const checkedInputs = visibleInputs.filter(input => input.checked);

        mentorSelectAll.checked = visibleInputs.length > 0 && checkedInputs.length === visibleInputs.length;
        mentorSelectAll.indeterminate = checkedInputs.length > 0 && checkedInputs.length < visibleInputs.length;
        mentorSelectAll.disabled = visibleInputs.length === 0;
    }

    function addSelectedMentors() {
        const selected = [...document.querySelectorAll("#modal-mentor-checkboxes input:checked:not(:disabled)")];
        const mentorTabs = document.querySelector(".mentor-tabs");
        const addBtn = document.getElementById("add-mentor-btn");

        if (!mentorTabs || !selected.length) {
            closeMentorModal();
            return;
        }

        const existing = new Set(getEditableMentors().map(mentor => mentor.id));
        let firstAddedTab = null;

        selected.forEach(input => {
            if (existing.has(input.dataset.id)) return;

            const mentor = {
                id: input.dataset.id,
                name: input.dataset.name
            };
            existing.add(mentor.id);

            const html = createEditableMentorTab(mentor, false);
            if (addBtn) {
                addBtn.insertAdjacentHTML("beforebegin", html);
                firstAddedTab = firstAddedTab || addBtn.previousElementSibling;
            } else {
                mentorTabs.insertAdjacentHTML("beforeend", html);
                firstAddedTab = firstAddedTab || mentorTabs.lastElementChild;
            }
        });

        attachMentorEditEvents();

        if (!mentorTabs.querySelector(".mentor-tab.editable.active") && firstAddedTab) {
            setEditableActiveMentor(firstAddedTab);
        }

        closeMentorModal();
    }

    mentorCategoryBtn?.addEventListener("click", event => {
        event.stopPropagation();
        mentorCategoryDropdown?.classList.toggle("hidden");
    });

    mentorCategoryDropdown?.addEventListener("click", event => {
        const option = event.target.closest("div[data-category]");
        if (!option) return;

        activeModalCategory = option.dataset.category || "all";
        mentorCategoryBtn.textContent = option.textContent.trim();
        mentorCategoryDropdown.classList.add("hidden");
        applyMentorModalFilters();
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".dropdown-wrapper")) {
            mentorCategoryDropdown?.classList.add("hidden");
        }
    });

    mentorSearch?.addEventListener("input", applyMentorModalFilters);
    mentorModalList?.addEventListener("change", syncSelectAllState);
    mentorSelectAll?.addEventListener("change", () => {
        mentorModalList?.querySelectorAll("label:not(.hidden) input[type='checkbox']:not(:disabled)")
            .forEach(input => {
                input.checked = mentorSelectAll.checked;
            });
        syncSelectAllState();
    });

    confirmAddMentorsBtn?.addEventListener("click", addSelectedMentors);
    closeModalBtn?.addEventListener("click", closeMentorModal);
    mentorModal?.addEventListener("click", event => {
        if (event.target === mentorModal) closeMentorModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && mentorModal && !mentorModal.classList.contains("hidden")) {
            closeMentorModal();
        }
    });

    editBtn.addEventListener("click", enterEditMode);
    confirmBtn?.addEventListener("click", () => exitEditMode(true));
    cancelBtn?.addEventListener("click", () => exitEditMode(false));
    document.addEventListener("cua-course-details-loaded", bindReadOnlyMentorTabs);
});
