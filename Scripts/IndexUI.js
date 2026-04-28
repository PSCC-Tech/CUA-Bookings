// Confirmation Script
function openConfirmation(dateStr, timeStr) {
    const confirmModal = document.getElementById("confirm-selection");
    const confirmText = document.getElementById("confirm-text");

    confirmText.textContent = `Confirm booking on ${dateStr} at ${timeStr}?`;
    confirmModal.classList.remove("hidden");

    document.getElementById("confirm-yes").onclick = () => {
        setSelectedDateTime(dateStr, timeStr);
        confirmModal.classList.add("hidden");
    };

    document.getElementById("confirm-no").onclick = () => {
        confirmModal.classList.add("hidden");
    };
}

document.getElementById("open-calendar-btn").addEventListener("click", () => {
    document.getElementById("calendar-modal").style.display = "flex";
});

document.getElementById("close-calendar").addEventListener("click", () => {
    document.getElementById("calendar-modal").style.display = "none";
});

function setSelectedDateTime(dateString, timeString) {
    const btn = document.getElementById("open-calendar-btn");
    const hidden = document.getElementById("selected-datetime");

    btn.textContent = `${dateString} — ${timeString}`;
    hidden.value = `${dateString} ${timeString}`;

    document.getElementById("calendar-modal").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {

    // -------------------------
    // GROUP COUNTER + STUDENTS
    // -------------------------

    const groupSizeEl = document.getElementById("group-size");
    const extraStudentsContainer = document.getElementById("extra-students");

    function restoreStudent1() {
        const block = document.getElementById("student-1-block");

        block.querySelectorAll("label").forEach(label => {
            label.style.display = "";
        });

        const title = document.getElementById("student-1-title");
        if (title) title.remove();
    }

    function convertStudent1ToGrouped() {
        const block = document.getElementById("student-1-block");

        block.querySelectorAll("label").forEach(label => {
            label.style.display = "none";
        });

        if (!document.getElementById("student-1-title")) {
            const title = document.createElement("h4");
            title.id = "student-1-title";
            title.textContent = "Student 1";
            block.prepend(title);
        }
    }

    function updateExtraStudents() {
        const size = parseInt(groupSizeEl.textContent, 10);

        if (size === 1) {
            restoreStudent1();
            extraStudentsContainer.innerHTML = "";
            return;
        }

        convertStudent1ToGrouped();
        extraStudentsContainer.innerHTML = "";

        for (let i = 2; i <= size; i++) {

            const label = document.createElement("h4");
            label.textContent = `Student ${i}`;
            extraStudentsContainer.appendChild(label);

            const row1 = document.createElement("div");
            row1.classList.add("extra-student-row");
            row1.innerHTML = `
                <div class="student-field">
                    <input type="text" name="student_${i}_name" placeholder="Name">
                </div>
                <div class="student-field">
                    <input type="text" name="student_${i}_id" placeholder="Student ID">
                </div>
            `;
            extraStudentsContainer.appendChild(row1);

            const row2 = document.createElement("div");
            row2.classList.add("extra-student-row");
            row2.innerHTML = `
                <div class="student-field">
                    <input type="email" name="student_${i}_email" placeholder="Email">
                </div>
                <div class="student-field">
                    <input type="text" name="student_${i}_phone" placeholder="Phone Number">
                </div>
            `;
            extraStudentsContainer.appendChild(row2);
        }
    }

    // Show/hide group size selector
    const groupContainer = document.getElementById("group-size-container");
    document.querySelectorAll("input[name='session-type']").forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.value === "group") {
                groupContainer.classList.remove("hidden");
                updateExtraStudents();
            } else {
                groupContainer.classList.add("hidden");
                extraStudentsContainer.innerHTML = "";
                restoreStudent1();
            }
        });
    });

    // Counter logic
    const decreaseBtn = document.getElementById("group-decrease");
    const increaseBtn = document.getElementById("group-increase");

    decreaseBtn.addEventListener("click", () => {
        let size = parseInt(groupSizeEl.textContent);
        if (size > 2) {
            groupSizeEl.textContent = size - 1;
            updateExtraStudents();
        }
    });

    increaseBtn.addEventListener("click", () => {
        let size = parseInt(groupSizeEl.textContent);
        if (size < 6) {
            groupSizeEl.textContent = size + 1;
            updateExtraStudents();
        }
    });

    // -------------------------
    // MENTOR DATA
    // -------------------------
    const mentorsData = [
        { name: "John Smith", categories: ["Math", "Computer Science"] },
        { name: "John Doe", categories: ["Business", "Biology"] },
        { name: "Jane Smith", categories: ["Math", "Biology"] },
        { name: "Jane Doe", categories: ["Biology", "Math"] },
        { name: "Dr. Wilson", categories: ["Computer Science", "Math"] },
        { name: "Dr. Adams", categories: ["Business"] }
    ];

    // -------------------------
    // CATEGORY DROPDOWN + FILTERING
    // -------------------------
    const categoryBtn = document.getElementById("category-btn");
    const categoryDropdown = document.getElementById("category-dropdown");
    const mentorSelect = document.getElementById("mentor-select");
    const courseCodeInput = document.getElementById("course-code");

    let selectedCategory = 'Show All';

    // Function to update mentors based on selected category
    function updateMentorsForCategory(category) {
        if (!mentorSelect) return;
        
        // Reset select to default option
        mentorSelect.value = '';
        
        // Get mentors for this category
        let mentorsForCategory = mentorsData;
        if (category && category !== 'Show All' && category !== 'all') {
            mentorsForCategory = mentorsData.filter(mentor => mentor.categories.includes(category));
        }
        
        // Update select options - keep the first default option, remove others
        const options = mentorSelect.querySelectorAll('option');
        options.forEach((option, index) => {
            if (index > 0) option.remove();
        });
        
        // Add mentor options
        mentorsForCategory.forEach(mentor => {
            const option = document.createElement('option');
            option.value = mentor.name;
            option.textContent = mentor.name;
            mentorSelect.appendChild(option);
        });
    }

    // Open/close dropdown
    categoryBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        categoryDropdown.classList.toggle("hidden");
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".dropdown-wrapper")) {
            categoryDropdown.classList.add("hidden");
        }
    });

    // Function to set selected option with checkmark
    function setSelectedOption(option) {
        categoryDropdown.querySelectorAll("div").forEach(o => o.classList.remove("selected"));
        option.classList.add("selected");
    }

    // When selecting a category
    categoryDropdown.querySelectorAll("div").forEach(item => {
        item.addEventListener("click", () => {
            setSelectedOption(item);
            
            selectedCategory = item.textContent.trim();
            categoryBtn.textContent = selectedCategory;
            categoryDropdown.classList.add("hidden");
            
            // Clear course code and course name inputs
            if (courseCodeInput) {
                courseCodeInput.value = '';
            }
            const courseNameInput = document.querySelector('input[placeholder="Course Name"]');
            if (courseNameInput) {
                courseNameInput.value = '';
            }
            
            // Disable mentor select and clear it
            if (mentorSelect) {
                mentorSelect.disabled = true;
                mentorSelect.value = '';
            }
            
            // Update autocomplete filter
            if (courseCodeInput && courseCodeInput.autocompleteData && Autocomplete) {
                Autocomplete.setCategory(courseCodeInput, selectedCategory);
            }
            
            // Update mentors display
            updateMentorsForCategory(selectedCategory);
        });
    });

    // Initialize autocomplete for course code
    if (courseCodeInput && Autocomplete) {
        Autocomplete.init(courseCodeInput, 'courses', {
            minChars: 1,
            maxResults: 8,
            debounceMs: 300,
            categoryFilter: selectedCategory,
            onSelect: (suggestion) => {
                courseCodeInput.value = suggestion.id;
                // Optionally fill course name if available
                const courseNameInput = document.querySelector('input[placeholder="Course Name"]');
                if (courseNameInput) {
                    courseNameInput.value = suggestion.name;
                }
                
                // Update category to match the selected course's category
                selectedCategory = suggestion.category;
                categoryBtn.textContent = selectedCategory;
                
                // Update checkmark on the category dropdown
                const categoryOption = categoryDropdown.querySelector(`[data-category="${selectedCategory}"]`);
                if (categoryOption) {
                    setSelectedOption(categoryOption);
                }
                
                // Update mentors based on the course's category
                updateMentorsForCategory(selectedCategory);
                
                // Enable mentor select
                if (mentorSelect) {
                    mentorSelect.disabled = false;
                }
            }
        });
    }

    // Initialize mentor list - start disabled
    updateMentorsForCategory(selectedCategory);
    if (mentorSelect) {
        mentorSelect.disabled = true;
    }

});