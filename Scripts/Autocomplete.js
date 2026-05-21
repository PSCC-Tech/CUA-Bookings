/**
 * Autocomplete Module - Reusable autocomplete/suggestion component
 * Uses backend data for courses and students.
 */

const Autocomplete = {
    courseCache: null,
    courseLoadPromise: null,
    lookupCache: null,
    lookupLoadPromise: null,

    /**
     * Configuration for data sources.
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
        },

        professors: {
            getData: async function(query, config = {}) {
                const normalizedQuery = Autocomplete._normalizeText(query);
                const selectedCourse = typeof config.getSelectedCourse === "function"
                    ? config.getSelectedCourse()
                    : null;
                const selectedCourseId = selectedCourse?.id || selectedCourse?.code || "";
                const selectedProfessorNames = Array.isArray(selectedCourse?.professors)
                    ? selectedCourse.professors
                    : [];

                const courseItems = selectedProfessorNames
                    .map(name => ({
                        name: String(name || "").trim(),
                        email: "",
                        source: selectedCourseId ? `Recommended for ${selectedCourseId}` : "Recommended professor"
                    }))
                    .filter(item => item.name);

                let lookupItems = [];
                try {
                    const lookups = await Autocomplete.loadLookupData();
                    lookupItems = Array.isArray(lookups.professors)
                        ? lookups.professors.map(professor => ({
                            name: String(professor.name || professor.full_name || "").trim(),
                            email: professor.email || "",
                            source: "Professor"
                        }))
                        : [];
                } catch (error) {
                    lookupItems = [];
                }

                const professors = Autocomplete._uniqueByField([...courseItems, ...lookupItems], "name");

                if (!normalizedQuery) {
                    return selectedCourse ? courseItems : [];
                }

                return professors.filter(professor =>
                    Autocomplete._matchesText(normalizedQuery, professor.name, professor.email)
                );
            },
            formatDisplay: (item) => item.name,
            formatSecondary: (item) => item.email || item.source || "Professor",
            getId: (item) => item.name,
            getName: (item) => item.name,
            getInputValue: (item) => item.name,
            noResultsText: "No matching professors. You can still type a new one."
        },

        topics: {
            getData: async function(query, config = {}) {
                const normalizedQuery = Autocomplete._normalizeText(query);
                const selectedCourse = typeof config.getSelectedCourse === "function"
                    ? config.getSelectedCourse()
                    : null;
                const selectedCourseId = selectedCourse?.id || selectedCourse?.code || "";
                const selectedTopics = Array.isArray(selectedCourse?.topics) ? selectedCourse.topics : [];

                const selectedItems = selectedTopics
                    .map(topic => ({
                        topic: String(topic || "").trim(),
                        courseId: selectedCourseId,
                        courseName: selectedCourse?.name || "",
                        source: selectedCourseId ? `Recommended for ${selectedCourseId}` : "Recommended topic",
                        selectedCourseTopic: true
                    }))
                    .filter(item => item.topic);

                let courseItems = [];
                try {
                    const courses = await Autocomplete.loadCourseData();
                    courseItems = courses.flatMap(course =>
                        (Array.isArray(course.topics) ? course.topics : [])
                            .map(topic => ({
                                topic: String(topic || "").trim(),
                                courseId: course.id || course.code || "",
                                courseName: course.name || "",
                                source: course.id ? `${course.id} - ${course.name}` : "Recommended topic",
                                selectedCourseTopic: Boolean(selectedCourseId && (course.id || course.code) === selectedCourseId)
                            }))
                    );
                } catch (error) {
                    courseItems = [];
                }

                const topics = Autocomplete._uniqueByField([...selectedItems, ...courseItems], "topic");

                if (!normalizedQuery) {
                    return selectedCourse ? topics.filter(item => item.selectedCourseTopic) : [];
                }

                return topics.filter(item =>
                    Autocomplete._matchesText(normalizedQuery, item.topic, item.courseId, item.courseName)
                );
            },
            formatDisplay: (item) => item.topic,
            formatSecondary: (item) => item.source || "Recommended topic",
            getId: (item) => item.topic,
            getName: (item) => item.topic,
            getInputValue: (item) => item.topic,
            noResultsText: "No matching topics. You can still type a new topic."
        },

        locations: {
            getData: async function(query, config = {}) {
                const normalizedQuery = Autocomplete._normalizeText(query);
                const htmlItems = typeof config.getLocationOptions === "function"
                    ? config.getLocationOptions()
                    : Autocomplete._getDatalistOptions("location");

                let lookupItems = [];
                try {
                    const lookups = await Autocomplete.loadLookupData();
                    lookupItems = Array.isArray(lookups.locations)
                        ? lookups.locations.map(location => ({
                            name: String(location.name || location.location_name || "").trim(),
                            type: location.type || location.location_type || "",
                            source: "Location"
                        }))
                        : [];
                } catch (error) {
                    lookupItems = [];
                }

                const locations = Autocomplete._uniqueByField([...lookupItems, ...htmlItems], "name");

                if (!normalizedQuery) {
                    return locations;
                }

                return locations.filter(location =>
                    Autocomplete._matchesText(normalizedQuery, location.name, location.type)
                );
            },
            formatDisplay: (item) => item.name,
            formatSecondary: (item) => item.type ? Autocomplete._capitalize(item.type) : item.source || "Location",
            getId: (item) => item.name,
            getName: (item) => item.name,
            getInputValue: (item) => item.name,
            noResultsText: "No matching locations. You can still type a new one."
        }
    },

    /**
     * Course data cache. Uses the PHP API and returns an empty list if the
     * backend cannot be reached.
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
                console.warn("Could not load course data:", error);
                this.courseCache = this.getFallbackCourseData();
            } finally {
                this.courseLoadPromise = null;
            }

            return this.courseCache;
        })();

        return this.courseLoadPromise;
    },

    async loadLookupData(force = false) {
        if (!force && this.lookupCache) return this.lookupCache;
        if (!force && this.lookupLoadPromise) return this.lookupLoadPromise;

        this.lookupLoadPromise = (async () => {
            try {
                if (!window.CUAApi) throw new Error("Backend API is not loaded.");
                this.lookupCache = await window.CUAApi.getLookups(force);
            } catch (error) {
                console.warn("Could not load lookup data:", error);
                this.lookupCache = {};
            } finally {
                this.lookupLoadPromise = null;
            }

            return this.lookupCache;
        })();

        return this.lookupLoadPromise;
    },

    getStaticCourseData() {
        return this.courseCache || this.getFallbackCourseData();
    },

    getFallbackCourseData() {
        return [];
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
            showNoResultsOnEmpty: true,
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
            let results = await Promise.resolve(data.dataSource.getData(query, data.config, inputElement));
            
            // Apply category filter if set
            if (data.config.categoryFilter && data.config.categoryFilter !== 'Show All' && data.config.categoryFilter !== 'all') {
                results = results.filter(item => item.category === data.config.categoryFilter);
            }
            
            const limited = results.slice(0, data.config.maxResults);

            data.suggestions = limited;
            data.selectedIndex = -1;

            if (limited.length === 0) {
                if (query.length === 0 && data.config.showNoResultsOnEmpty === false) {
                    this._clearSuggestions(inputElement);
                } else {
                    this._showNoResults(inputElement);
                }
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

        if (data.suggestionsContainer.style.display !== 'block') return;

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
                if (data.selectedIndex >= 0) {
                    event.preventDefault();
                    this._selectSuggestion(data.selectedIndex, inputElement);
                } else if (inputElement.tagName !== "TEXTAREA") {
                    event.preventDefault();
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

    _normalizeText(text = "") {
        return String(text || "").trim().toLowerCase();
    },

    _matchesText(normalizedQuery, ...values) {
        return values.some(value =>
            String(value || "").toLowerCase().includes(normalizedQuery)
        );
    },

    _uniqueByField(items, fieldName) {
        const seen = new Map();
        const unique = [];

        items.forEach(item => {
            const value = String(item?.[fieldName] || "").trim();
            if (!value) return;

            const key = value.toLowerCase();
            if (!seen.has(key)) {
                const normalizedItem = { ...item, [fieldName]: value };
                seen.set(key, normalizedItem);
                unique.push(normalizedItem);
                return;
            }

            const existing = seen.get(key);
            if (!existing.email && item.email) {
                existing.email = item.email;
            }
            if (!existing.type && item.type) {
                existing.type = item.type;
            }
            if ((!existing.source || existing.source === "Location") && item.source) {
                existing.source = item.source;
            }
        });

        return unique;
    },

    _getDatalistOptions(listId) {
        const list = typeof document !== "undefined" ? document.getElementById(listId) : null;
        if (!list) return [];

        return Array.from(list.options || [])
            .map(option => ({
                name: String(option.value || option.textContent || "").trim(),
                source: "Location"
            }))
            .filter(item => item.name);
    },

    _capitalize(value = "") {
        const text = String(value || "").trim();
        return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
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
     * Update data source.
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
