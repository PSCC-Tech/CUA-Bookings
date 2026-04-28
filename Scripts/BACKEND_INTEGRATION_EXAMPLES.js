/**
 * BACKEND INTEGRATION EXAMPLES
 * How to adapt the autocomplete feature for your backend API
 */

// ============================================
// EXAMPLE 1: Simple Fetch-based API (Both Fields)
// ============================================
// When your backend is ready, replace the getData functions in Autocomplete.js

/*
// For coursesByID data source:
const exampleSimpleAPIbyID = {
    getData: async function(query) {
        const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}&searchBy=id`);
        const data = await response.json();
        return data.courses;
    }
};

// For coursesByName data source:
const exampleSimpleAPIbyName = {
    getData: async function(query) {
        const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}&searchBy=name`);
        const data = await response.json();
        return data.courses;
    }
};
*/

// ============================================
// EXAMPLE 2: With Error Handling & Timeout (Both Fields)
// ============================================
/*
const exampleWithErrorHandling = {
    search: async function(query, searchBy = 'id') {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(
                `/api/courses/search?q=${encodeURIComponent(query)}&searchBy=${searchBy}`,
                { signal: controller.signal }
            );
            clearTimeout(timeout);

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Course search failed:', error);
            return [];
        }
    }
};

// Use in Autocomplete.js:
// coursesByID.getData = async (query) => exampleWithErrorHandling.search(query, 'id');
// coursesByName.getData = async (query) => exampleWithErrorHandling.search(query, 'name');
*/

// ============================================
// EXAMPLE 3: Unified API Handling
// ============================================
/*
// If your backend returns the same format for both searches:

function initializeCoursesAutocomplete() {
    const courseSearchFunction = async function(query) {
        try {
            const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            return await response.json();
        } catch (error) {
            console.error('Course search error:', error);
            return [];
        }
    };

    // Update all course data sources to use the same backend function
    Autocomplete.dataSources.courses.getData = courseSearchFunction;
    Autocomplete.dataSources.coursesByID.getData = courseSearchFunction;
    Autocomplete.dataSources.coursesByName.getData = courseSearchFunction;
}

// Call this on app initialization:
document.addEventListener('DOMContentLoaded', initializeCoursesAutocomplete);
*/

// ============================================
// EXAMPLE 4: With Caching for Performance
// ============================================
/*
class CourseSearchCache {
    constructor(cacheTimeMs = 5 * 60 * 1000) {
        this.cache = new Map();
        this.cacheTimeout = cacheTimeMs;
    }

    async search(query, searchBy = 'id') {
        const cacheKey = `${searchBy}:${query}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }

        const response = await fetch(
            `/api/courses/search?q=${encodeURIComponent(query)}&searchBy=${searchBy}`
        );
        const data = await response.json();

        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    }

    clearCache() {
        this.cache.clear();
    }
}

const courseCache = new CourseSearchCache();

// Use in Autocomplete.js:
// coursesByID.getData = (query) => courseCache.search(query, 'id');
// coursesByName.getData = (query) => courseCache.search(query, 'name');
*/

// ============================================
// EXAMPLE 5: Complete Integration Setup
// ============================================

/*
// In your main app initialization file:

async function initializeAutocompleteWithBackend() {
    // Define your backend search function
    async function searchCourses(query, searchBy = 'all') {
        try {
            const response = await fetch(
                `/api/courses/search?q=${encodeURIComponent(query)}&searchBy=${searchBy}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return Array.isArray(data) ? data : data.courses || [];
        } catch (error) {
            console.error('Course search error:', error);
            return [];
        }
    }

    // Update Course ID search
    Autocomplete.dataSources.coursesByID.getData = async function(query) {
        return await searchCourses(query, 'id');
    };

    // Update Course Name search
    Autocomplete.dataSources.coursesByName.getData = async function(query) {
        return await searchCourses(query, 'name');
    };

    // Update general courses search
    Autocomplete.dataSources.courses.getData = async function(query) {
        return await searchCourses(query, 'all');
    };
}

// Call when DOM is ready
document.addEventListener('DOMContentLoaded', initializeAutocompleteWithBackend);
*/

// ============================================
// EXPECTED BACKEND RESPONSE FORMATS
// ============================================

/*
GET /api/courses/search?q=math&searchBy=id

Response (200 OK):
[
    { "id": "MATH101", "name": "Calculus I" },
    { "id": "MATH102", "name": "Calculus II" },
    { "id": "MATH201", "name": "Linear Algebra" }
]

OR

GET /api/courses/search?q=calculus&searchBy=name

Response (200 OK):
[
    { "id": "MATH101", "name": "Calculus I" },
    { "id": "MATH102", "name": "Calculus II" }
]

With metadata:
{
    "courses": [
        { "id": "MATH101", "name": "Calculus I" },
        { "id": "MATH102", "name": "Calculus II" }
    ],
    "total": 100,
    "searchBy": "name",
    "query": "calculus"
}
*/

// ============================================
// BROWSER TESTING
// ============================================

/*
// Test in browser console to verify setup:

// Test 1: Check data sources
console.log('Available data sources:', Object.keys(Autocomplete.dataSources));

// Test 2: Test Course ID search
Autocomplete.dataSources.coursesByID.getData('MATH').then(results => {
    console.log('Search by ID (MATH):', results);
});

// Test 3: Test Course Name search
Autocomplete.dataSources.coursesByName.getData('Calculus').then(results => {
    console.log('Search by Name (Calculus):', results);
});

// Test 4: Monitor selections
document.getElementById('new-course-id').addEventListener('autocomplete-select', (e) => {
    console.log('Selected from Course ID field:', e.detail.suggestion);
});

document.getElementById('new-course-name').addEventListener('autocomplete-select', (e) => {
    console.log('Selected from Course Name field:', e.detail.suggestion);
});
*/
