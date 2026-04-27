/**
 * Autocomplete Module - Reusable autocomplete/suggestion component
 * Designed to work with static data now, easily adapted for backend integration
 */

const Autocomplete = {
    /**
     * Configuration for data sources
     * This structure allows easy switching between static data and backend APIs
     */
    dataSources: {
        courses: {
            // LOCAL DATA (replace with backend call later)
            getData: function(query) {
                return Autocomplete.getStaticCourseData().filter(course =>
                    course.id.toLowerCase().includes(query.toLowerCase()) ||
                    course.name.toLowerCase().includes(query.toLowerCase())
                );
            },
            // FUTURE: Backend implementation
            // getData: async function(query) {
            //     const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`);
            //     return await response.json();
            // }
            formatDisplay: (item) => `${item.id} - ${item.name}`,
            getId: (item) => item.id,
            getName: (item) => item.name
        }
    },

    /**
     * Static course data - Replace this function with backend call
     * FUTURE: Remove this and call backend API instead
     */
    getStaticCourseData() {
        return [
            { id: 'MATH101', name: 'Calculus I' },
            { id: 'MATH102', name: 'Calculus II' },
            { id: 'MATH201', name: 'Linear Algebra' },
            { id: 'COMP101', name: 'Intro to Computer Science' },
            { id: 'COMP201', name: 'Data Structures I' },
            { id: 'COMP202', name: 'Data Structures II' },
            { id: 'COMP301', name: 'Algorithms' },
            { id: 'PHYS101', name: 'Physics I' },
            { id: 'PHYS102', name: 'Physics II' },
            { id: 'CHEM101', name: 'Chemistry I' }
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
    _fetchAndDisplaySuggestions(query, inputElement) {
        const data = inputElement.autocompleteData;

        try {
            const results = data.dataSource.getData(query);
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
                <div class="autocomplete-item-secondary">${this._escape(data.dataSource.getId(item))}</div>
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

        container.innerHTML = '<div class="autocomplete-no-results">No courses found</div>';
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

        // Update input field with ID
        inputElement.value = data.dataSource.getId(suggestion);

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
