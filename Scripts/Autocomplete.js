/**
 * Autocomplete Module - Reusable autocomplete/suggestion component
 * Designed to work with static data now, easily adapted for backend integration
 */

const Autocomplete = {
    courseCache: null,
    courseLoadPromise: null,

    /**
     * Configuration for data sources
     * This structure allows easy switching between static data and backend APIs
     */
    dataSources: {
        // Search by course ID (displays: "ID - Name")
        courses: {
            getData: async function(query) {
                const courses = await Autocomplete.loadCourseData();
                return courses.filter(course =>
                    course.id.toLowerCase().includes(query.toLowerCase()) ||
                    course.name.toLowerCase().includes(query.toLowerCase())
                );
            },
            formatDisplay: (item) => `${item.id} - ${item.name}`,
            getId: (item) => item.id,
            getName: (item) => item.name
        },

        // Search by course ID specifically (for ID field)
        coursesByID: {
            getData: async function(query) {
                const courses = await Autocomplete.loadCourseData();
                return courses.filter(course =>
                    course.id.toLowerCase().includes(query.toLowerCase())
                );
            },
            formatDisplay: (item) => `${item.id} - ${item.name}`,
            getId: (item) => item.id,
            getName: (item) => item.name
        },

        // Search by course name specifically (for Name field)
        coursesByName: {
            getData: async function(query) {
                const courses = await Autocomplete.loadCourseData();
                return courses.filter(course =>
                    course.name.toLowerCase().includes(query.toLowerCase()) ||
                    course.id.toLowerCase().includes(query.toLowerCase())
                );
            },
            formatDisplay: (item) => `${item.name} (${item.id})`,
            getId: (item) => item.id,
            getName: (item) => item.name,
            getInputValue: (item) => item.name
        },

        studentsByID: {
            getData: async function(query) {
                if (!window.CUAApi) return [];
                return window.CUAApi.searchStudents(query);
            },
            formatDisplay: (item) => `${item.studentId} - ${item.name}`,
            formatSecondary: (item) => item.email || item.phone || "Existing student",
            getId: (item) => item.studentId,
            getName: (item) => item.name,
            noResultsText: "No matching students found"
        }
    },

    /**
     * Course data cache. Uses the PHP API when available and falls back to
     * prototype data if the backend cannot be reached.
     */
    async loadCourseData(force = false) {
        if (!force && this.courseCache) return this.courseCache;
        if (!force && this.courseLoadPromise) return this.courseLoadPromise;

        this.courseLoadPromise = (async () => {
            try {
                if (!window.CUAApi) throw new Error("Backend API is not loaded.");
                const courses = await window.CUAApi.getCourses(force);
                this.courseCache = courses.map(course => ({
                    id: course.id || course.code,
                    code: course.code || course.id,
                    name: course.name,
                    category: course.category,
                    courseId: course.course_id,
                    professors: course.professors || [],
                    mentors: course.mentors || [],
                    topics: course.topics || [],
                    description: course.description || ""
                }));
            } catch (error) {
                console.warn("Using fallback course data:", error);
                this.courseCache = this.getFallbackCourseData();
            } finally {
                this.courseLoadPromise = null;
            }

            return this.courseCache;
        })();

        return this.courseLoadPromise;
    },

    getStaticCourseData() {
        return this.courseCache || this.getFallbackCourseData();
    },

    getFallbackCourseData() {
        return [
            { id: 'MATH101', name: 'Calculus I', category: 'Math' },
            { id: 'MATH102', name: 'Calculus II', category: 'Math' },
            { id: 'MATH201', name: 'Linear Algebra', category: 'Math' },
            { id: 'COMP101', name: 'Intro to Computer Science', category: 'Computer Science' },
            { id: 'COMP201', name: 'Data Structures I', category: 'Computer Science' },
            { id: 'COMP202', name: 'Data Structures II', category: 'Computer Science' },
            { id: 'COMP301', name: 'Algorithms', category: 'Computer Science' },
            { id: 'BIOL110', name: 'General Biology', category: 'Biology' },
            { id: 'BIOL215', name: 'Human Anatomy', category: 'Biology' },
            { id: 'BUSS101', name: 'Introduction to Business', category: 'Business' }
        ];
    },

    /**
     * Initialize autocomplete for an input field
     * @param {HTMLInputElement} inputElement - The input field to attach autocomplete to
     * @param {string} dataSourceKey - Key of the data source to use (e.g., 'courses')
     * @param {Object} options - Additional configuration options
     */
    init(inputElement, dataSourceKey = 'courses', options = {}) {
        const dataSource = this.dataSources[dataSourceKey];
        if (!dataSource) throw new Error(`Data source '${dataSourceKey}' not found`);

        const config = {
            minChars: 1,
            maxResults: 8,
            debounceMs: 300,
            onSelect: null,
            categoryFilter: null,
            ...options
        };

        // Create suggestion container
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'autocomplete-suggestions';
        suggestionsContainer.dataset.autocompleteFor = inputElement.id;
        inputElement.parentElement.insertBefore(suggestionsContainer, inputElement.nextSibling);

        // Store references
        inputElement.autocompleteData = {
            dataSource,
            config,
            suggestionsContainer,
            debounceTimer: null,
            selectedIndex: -1,
            suggestions: []
        };

        // Event listeners
        inputElement.addEventListener('input', (e) => this._handleInput(e, inputElement));
        inputElement.addEventListener('keydown', (e) => this._handleKeydown(e, inputElement));
        inputElement.addEventListener('focus', (e) => this._handleFocus(e, inputElement));
        document.addEventListener('click', (e) => this._handleDocumentClick(e, inputElement));
    },

    /**
     * Handle input event with debouncing
     */
    _handleInput(event, inputElement) {
        const data = inputElement.autocompleteData;
        clearTimeout(data.debounceTimer);

        data.debounceTimer = setTimeout(() => {
            const query = inputElement.value.trim();

            if (query.length < data.config.minChars) {
                this._clearSuggestions(inputElement);
                return;
            }

            this._fetchAndDisplaySuggestions(query, inputElement);
        }, data.config.debounceMs);
    },

    /**
     * Fetch suggestions and display them
     */
    async _fetchAndDisplaySuggestions(query, inputElement) {
        const data = inputElement.autocompleteData;

        try {
            let results = await Promise.resolve(data.dataSource.getData(query));
            
            // Apply category filter if set
            if (data.config.categoryFilter && data.config.categoryFilter !== 'Show All' && data.config.categoryFilter !== 'all') {
                results = results.filter(item => item.category === data.config.categoryFilter);
            }
            
            const limited = results.slice(0, data.config.maxResults);

            data.suggestions = limited;
            data.selectedIndex = -1;

            if (limited.length === 0) {
                this._showNoResults(inputElement);
            } else {
                this._renderSuggestions(limited, inputElement);
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
            this._showError(inputElement);
        }
    },

    /**
     * Render suggestion items
     */
    _renderSuggestions(suggestions, inputElement) {
        const data = inputElement.autocompleteData;
        const container = data.suggestionsContainer;

        container.innerHTML = suggestions.map((item, index) => `
            <div class="autocomplete-item" data-index="${index}" role="option" tabindex="-1">
                <div class="autocomplete-item-primary">${this._escape(data.dataSource.formatDisplay(item))}</div>
                <div class="autocomplete-item-secondary">${this._escape(data.dataSource.formatSecondary ? data.dataSource.formatSecondary(item) : data.dataSource.getId(item))}</div>
            </div>
        `).join('');

        container.style.display = 'block';

        // Attach click listeners
        container.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this._selectSuggestion(index, inputElement);
            });
            item.addEventListener('mouseenter', () => {
                const index = parseInt(item.dataset.index);
                this._highlightItem(index, inputElement);
            });
        });
    },

    /**
     * Show "no results" message
     */
    _showNoResults(inputElement) {
        const data = inputElement.autocompleteData;
        const container = data.suggestionsContainer;

        container.innerHTML = `<div class="autocomplete-no-results">${this._escape(data.config.noResultsText || data.dataSource.noResultsText || "No results found")}</div>`;
        container.style.display = 'block';
    },

    /**
     * Show error message
     */
    _showError(inputElement) {
        const data = inputElement.autocompleteData;
        const container = data.suggestionsContainer;

        container.innerHTML = '<div class="autocomplete-error">Error loading suggestions</div>';
        container.style.display = 'block';
    },

    /**
     * Handle keyboard navigation
     */
    _handleKeydown(event, inputElement) {
        const data = inputElement.autocompleteData;

        if (data.suggestionsContainer.style.display === 'none') return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this._moveSelection(1, inputElement);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this._moveSelection(-1, inputElement);
                break;
            case 'Enter':
                event.preventDefault();
                if (data.selectedIndex >= 0) {
                    this._selectSuggestion(data.selectedIndex, inputElement);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this._clearSuggestions(inputElement);
                break;
        }
    },

    /**
     * Move selection up/down
     */
    _moveSelection(direction, inputElement) {
        const data = inputElement.autocompleteData;
        const newIndex = Math.max(-1, Math.min(data.selectedIndex + direction, data.suggestions.length - 1));

        this._highlightItem(newIndex, inputElement);
    },

    /**
     * Highlight a specific item
     */
    _highlightItem(index, inputElement) {
        const data = inputElement.autocompleteData;
        const container = data.suggestionsContainer;

        // Remove previous highlight
        container.querySelectorAll('.autocomplete-item').forEach(item => {
            item.classList.remove('highlighted');
        });

        // Add new highlight
        if (index >= 0) {
            const item = container.querySelector(`[data-index="${index}"]`);
            if (item) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            }
        }

        data.selectedIndex = index;
    },

    /**
     * Select a suggestion
     */
    _selectSuggestion(index, inputElement) {
        const data = inputElement.autocompleteData;
        const suggestion = data.suggestions[index];

        if (!suggestion) return;

        // Different fields can choose what selected text should remain visible.
        inputElement.value = data.dataSource.getInputValue
            ? data.dataSource.getInputValue(suggestion)
            : data.dataSource.getId(suggestion);

        // Clear suggestions
        this._clearSuggestions(inputElement);

        // Trigger custom event
        const event = new CustomEvent('autocomplete-select', {
            detail: { suggestion, value: data.dataSource.getId(suggestion) }
        });
        inputElement.dispatchEvent(event);

        // Call callback if provided
        if (data.config.onSelect) {
            data.config.onSelect(suggestion);
        }
    },

    /**
     * Handle focus event
     */
    _handleFocus(event, inputElement) {
        const data = inputElement.autocompleteData;
        const query = inputElement.value.trim();

        // Show suggestions if input has value
        if (query.length >= data.config.minChars) {
            this._fetchAndDisplaySuggestions(query, inputElement);
        }
    },

    /**
     * Handle document click to close suggestions
     */
    _handleDocumentClick(event, inputElement) {
        const data = inputElement.autocompleteData;

        if (!inputElement.contains(event.target) && !data.suggestionsContainer.contains(event.target)) {
            this._clearSuggestions(inputElement);
        }
    },

    /**
     * Clear suggestions
     */
    _clearSuggestions(inputElement) {
        const data = inputElement.autocompleteData;
        data.suggestionsContainer.style.display = 'none';
        data.suggestionsContainer.innerHTML = '';
        data.selectedIndex = -1;
    },

    /**
     * Escape HTML to prevent XSS
     */
    _escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Set category filter for autocomplete
     * Filters results to show only items matching the category
     */
    setCategory(inputElement, category) {
        if (!inputElement.autocompleteData) return;
        inputElement.autocompleteData.config.categoryFilter = category;
        // Refresh suggestions if input has value
        const query = inputElement.value.trim();
        if (query.length >= inputElement.autocompleteData.config.minChars) {
            this._fetchAndDisplaySuggestions(query, inputElement);
        }
    },

    /**
     * Get filtered courses by category
     */
    getCoursesForCategory(category) {
        const allCourses = this.getStaticCourseData();
        if (!category || category === 'all' || category === 'Show All') {
            return allCourses;
        }
        return allCourses.filter(course => course.category === category);
    },

    /**
     * Update data source (useful for switching between static/backend)
     * FUTURE: Call this when switching to backend
     */
    updateDataSource(dataSourceKey, newDataFunction) {
        if (this.dataSources[dataSourceKey]) {
            this.dataSources[dataSourceKey].getData = newDataFunction;
        }
    },

    /**
     * Destroy autocomplete instance
     */
    destroy(inputElement) {
        if (inputElement.autocompleteData) {
            inputElement.autocompleteData.suggestionsContainer.remove();
            delete inputElement.autocompleteData;
        }
    }
};

if (typeof window !== "undefined") {
    window.Autocomplete = Autocomplete;
}
