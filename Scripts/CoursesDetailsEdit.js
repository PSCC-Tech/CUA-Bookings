
document.addEventListener("DOMContentLoaded", () => {

    const editBtn = document.querySelector(".edit-btn");
    const editActions = document.querySelector(".edit-actions");

    let originalData = {};

    let allMentors = [];

    if (window.CUAApi) {
        window.CUAApi.getMentors({}, true)
            .then(mentors => {
                allMentors = mentors.map(mentor => ({
                    id: mentor.mentor_number || mentor.id,
                    name: mentor.name,
                    categories: mentor.categories || []
                }));
            })
            .catch(error => console.warn("Could not load mentors for course details:", error));
    }

    function enterEditMode() {
        // Always re-query current elements (they get replaced)
        const codeSpan = document.getElementById("course-code");
        const nameSpan = document.getElementById("course-name");
        const professorList = document.getElementById("professors-list");
        const topicsList = document.getElementById("topics-list");
        const descriptionWrapper = document.getElementById("course-description-wrapper");
        const descriptionP = descriptionWrapper.querySelector("#course-description");

        // Save original data
        originalData = {
            courseDbId: window.CUACurrentCourse?.course_id || "",
            code: codeSpan.textContent,
            name: nameSpan.textContent,
            professors: [...professorList.querySelectorAll("li")]
                .map(li => li.textContent.trim())
                .filter(text => text && text !== "No professors assigned"),
            topics: [...topicsList.querySelectorAll("li")]
                .map(li => li.textContent.trim())
                .filter(text => text && text !== "No topics listed"),
            description: descriptionP.textContent
        };

        // Replace code + name with inputs
        codeSpan.outerHTML = `<input id="edit-code" value="${originalData.code}">`;
        nameSpan.outerHTML = `<input id="edit-name" value="${originalData.name}">`;

        // Replace professors with editable list
        professorList.innerHTML = originalData.professors
            .map(p => `<li><input value="${p}"><button class="remove-prof">✖</button></li>`)
            .join("") +
            `<button id="add-prof">+ Add Professor</button>`;

        // Replace topics with editable list
        topicsList.innerHTML = originalData.topics
            .map(t => `<li><input value="${t}"><button class="remove-topic">✖</button></li>`)
            .join("") +
            `<button id="add-topic">+ Add Topic</button>`;

        // Replace description with textarea (inside wrapper)
        descriptionWrapper.innerHTML =
            `<textarea id="edit-description">${originalData.description}</textarea>`;

        const descTextarea = document.getElementById("edit-description");

        // Auto-resize textarea
        descTextarea.style.width = "100%";
        descTextarea.style.overflowY = "hidden";
        descTextarea.style.height = "auto";
        descTextarea.style.height = descTextarea.scrollHeight + "px";

        descTextarea.addEventListener("input", () => {
            descTextarea.style.height = "auto";
            descTextarea.style.height = descTextarea.scrollHeight + "px";
        });

        // MENTOR EDIT MODE
        const mentorTabs = document.querySelector(".mentor-tabs");

        // Save original mentors
        originalData.mentors = [...mentorTabs.querySelectorAll(".mentor-tab")]
            .map(tab => ({
                id: tab.dataset.mentor || tab.dataset.mentorName || tab.textContent.trim(),
                name: tab.dataset.mentorName || tab.textContent.trim()
            }))
            .filter(mentor => mentor.name && mentor.name !== "No mentors");

        // Replace mentor tabs with editable version
        mentorTabs.innerHTML = originalData.mentors.map(m => `
            <button class="mentor-tab editable" data-mentor="${m.id}">
                ${m.name}
                <span class="remove-mentor">✖</span>
            </button>
        `).join("") + `
            <button id="add-mentor-btn" class="add-mentor-btn">+ Add Mentor</button>
        `;

        attachMentorEditEvents();
        attachDynamicButtons();

        editBtn.style.display = "none";
        editActions.style.display = "flex";
    }

    function openMentorModal() {
        loadMentorModalList();
        document.getElementById("mentor-modal").classList.remove("hidden");
    }

    function closeMentorModal() {
        document.getElementById("mentor-modal").classList.add("hidden");
    }

    function attachMentorEditEvents() {
        // Remove mentor (from editable tabs)
        document.querySelectorAll(".remove-mentor").forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const tab = btn.closest(".mentor-tab");
                const name = tab.childNodes[0].textContent.trim();

                if (confirm(`Remove ${name} from this course?`)) {
                    tab.remove();
                }
            };
        });

        // Add mentor (open modal)
        const addBtn = document.getElementById("add-mentor-btn");
        if (addBtn) {
            addBtn.onclick = () => {
                openMentorModal();
            };
        }
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

        window.CUACurrentCourse = {
            ...(window.CUACurrentCourse || {}),
            course_id: result.course_id || originalData.courseDbId,
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
        const infoList = document.getElementById("course-info-list");
        const topicsList = document.getElementById("topics-list");
        const descriptionWrapper = document.getElementById("course-description-wrapper");

        if (save) {
            const newCode = document.getElementById("edit-code").value;
            const newName = document.getElementById("edit-name").value;
            const newDesc = document.getElementById("edit-description").value;

            const newProfessors = [...document.querySelectorAll("#professors-list input")]
                .map(i => i.value.trim())
                .filter(v => v.length > 0);

            const newTopics = [...document.querySelectorAll("#topics-list input")]
                .map(i => i.value.trim())
                .filter(v => v.length > 0);

            const newMentors = [...document.querySelectorAll(".mentor-tab.editable")].map(tab => ({
                id: tab.dataset.mentor,
                name: tab.childNodes[0].textContent.trim()
            })).filter(mentor => mentor.id && mentor.name);

            if (!newCode || !newName) {
                alert("Course code and course name are required.");
                return;
            }

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
            }

            infoList.innerHTML = `
                <li><strong>Code:</strong> <span id="course-code">${newCode}</span></li>
                <li><strong>Name:</strong> <span id="course-name">${newName}</span></li>
                <li><strong>Professors:</strong>
                    <ul id="professors-list">
                        ${newProfessors.map(p => `<li>${p}</li>`).join("")}
                    </ul>
                </li>
            `;

            topicsList.innerHTML =
                newTopics.map(t => `<li>${t}</li>`).join("");

            descriptionWrapper.innerHTML =
                `<p id="course-description">${newDesc}</p>`;

        } else {
            infoList.innerHTML = `
                <li><strong>Code:</strong> <span id="course-code">${originalData.code}</span></li>
                <li><strong>Name:</strong> <span id="course-name">${originalData.name}</span></li>
                <li><strong>Professors:</strong>
                    <ul id="professors-list">
                        ${originalData.professors.map(p => `<li>${p}</li>`).join("")}
                    </ul>
                </li>
            `;

            topicsList.innerHTML =
                originalData.topics.map(t => `<li>${t}</li>`).join("");

            descriptionWrapper.innerHTML =
                `<p id="course-description">${originalData.description}</p>`;
        }

        // Restore mentor tabs
        const mentorTabs = document.querySelector(".mentor-tabs");

        if (save) {
            const newMentors = (window.CUACurrentCourse?.mentor_numbers || []).map((id, index) => ({
                id,
                name: window.CUACurrentCourse?.mentors?.[index] || id
            }));

            mentorTabs.innerHTML = newMentors.map(m => `
                <button class="mentor-tab" data-mentor="${m.id}" data-mentor-name="${m.name}">${m.name}</button>
            `).join("");

        } else {
            mentorTabs.innerHTML = originalData.mentors.map(m => `
                <button class="mentor-tab" data-mentor="${m.id}" data-mentor-name="${m.name}">${m.name}</button>
            `).join("");
        }

        window.CUACalendar?.setCourse?.(save ? document.getElementById("course-code")?.textContent : originalData.code);

        editActions.style.display = "none";
        editBtn.style.display = "inline-block";
    }

    function attachDynamicButtons() {
        const professorList = document.getElementById("professors-list");
        const topicsList = document.getElementById("topics-list");

        // Add professor
        const addProfBtn = document.getElementById("add-prof");
        if (addProfBtn) {
            addProfBtn.onclick = () => {
                professorList.insertAdjacentHTML(
                    "beforeend",
                    `<li><input value=""><button class="remove-prof">✖</button></li>`
                );
                attachDynamicButtons();
            };
        }

        // Remove professor
        document.querySelectorAll(".remove-prof").forEach(btn => {
            btn.onclick = () => btn.parentElement.remove();
        });

        // Add topic
        const addTopicBtn = document.getElementById("add-topic");
        if (addTopicBtn) {
            addTopicBtn.onclick = () => {
                topicsList.insertAdjacentHTML(
                    "beforeend",
                    `<li><input value=""><button class="remove-topic">✖</button></li>`
                );
                attachDynamicButtons();
            };
        }

        // Remove topic
        document.querySelectorAll(".remove-topic").forEach(btn => {
            btn.onclick = () => btn.parentElement.remove();
        });
    }

    function loadMentorModalList() {
        const container = document.getElementById("modal-mentor-checkboxes");
        container.innerHTML = "";

        allMentors.sort((a, b) => a.name.localeCompare(b.name));

        for (let i = 0; i < allMentors.length; i += 6) {
            const column = document.createElement("div");
            column.classList.add("mentor-column");

            allMentors.slice(i, i + 6).forEach(m => {
                const label = document.createElement("label");
                label.dataset.name = m.name;
                label.dataset.categories = m.categories.join(",");

                label.innerHTML = `
                    <input type="checkbox" data-id="${m.id}" data-name="${m.name}">
                    ${m.name}
                `;

                column.appendChild(label);
            });

            container.appendChild(column);
        }
    }

    // Confirm add mentors from modal
    document.getElementById("confirm-add-mentors").onclick = () => {
        const selected = [...document.querySelectorAll("#modal-mentor-checkboxes input:checked")];

        const mentorTabs = document.querySelector(".mentor-tabs");
        const existing = new Set([...mentorTabs.querySelectorAll(".mentor-tab.editable")]
            .map(tab => tab.dataset.mentor));

        selected.forEach(s => {
            if (existing.has(s.dataset.id)) return;
            mentorTabs.insertAdjacentHTML("beforeend", `
                <button class="mentor-tab editable" data-mentor="${s.dataset.id}">
                    ${s.dataset.name}
                    <span class="remove-mentor">✖</span>
                </button>
            `);
        });

        attachMentorEditEvents();
        closeMentorModal();
    };

    // Close modal button
    const closeModalBtn = document.getElementById("close-mentor-modal");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeMentorModal);
    }

    // Main edit controls
    editBtn.addEventListener("click", enterEditMode);
    document.querySelector(".confirm-btn").addEventListener("click", () => exitEditMode(true));
    document.querySelector(".cancel-btn").addEventListener("click", () => exitEditMode(false));
});
