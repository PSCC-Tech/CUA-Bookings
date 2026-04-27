/**
 * BACKEND INTEGRATION EXAMPLES
 * How to adapt the autocomplete feature for your backend API
 */

// ============================================
// EXAMPLE 1: Simple Fetch-based API
// ============================================
// When your backend is ready, replace the getData function in Autocomplete.js

/*
const exampleSimpleAPI = {
    // Replace this in Autocomplete.dataSources.courses.getData:
    getData: async function(query) {
        const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        return data.courses; // Backend returns { courses: [...] }
    }
};
*/

// ============================================
// EXAMPLE 2: With Error Handling & Timeout
// ============================================
/*
const exampleWithErrorHandling = {
    getData: async function(query) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(
                `/api/courses/search?q=${encodeURIComponent(query)}`,
                { signal: controller.signal }
            );
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Course search failed:', error);
            return [];
        }
    }
};
*/

// ============================================
// EXAMPLE 3: With Caching for Performance
// ============================================
/*
const exampleWithCaching = {
    cache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 minutes

    getData: async function(query) {
        // Check cache first
        if (this.cache.has(query)) {
            const cached = this.cache.get(query);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
            // Invalidate expired cache
            this.cache.delete(query);
        }

        // Fetch from API
        const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        // Store in cache
        this.cache.set(query, {
            data: data,
            timestamp: Date.now()
        });

        return data;
    },

    clearCache() {
        this.cache.clear();
    }
};
*/

// ============================================
// EXAMPLE 4: Integration Steps (In MentorsDetailsEdit.js)
// ============================================

/*
// STEP 1: Load your data source at app startup
function initializeAutocompleteWithBackend() {
    // Define your custom getData function
    const customGetData = async function(query) {
        const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search failed');
        return await response.json();
    };

    // Update the Autocomplete module to use your backend
    Autocomplete.updateDataSource('courses', customGetData);
}

// STEP 2: Call this when page loads or auth completes
document.addEventListener('DOMContentLoaded', initializeAutocompleteWithBackend);

// STEP 3: Initialize autocomplete as usual (no changes needed)
Autocomplete.init(newCourseId, 'courses', {
    minChars: 1,
    maxResults: 8,
    onSelect: handleCourseSelection
});
*/

// ============================================
// EXAMPLE 5: Hybrid - Load All Courses on Init
// ============================================
/*
// If you want to fetch all courses once at startup:

const allCourses = []; // Will be populated

async function loadAllCoursesOnce() {
    const response = await fetch('/api/courses');
    const data = await response.json();
    allCourses = data.courses;

    // Then use local filtering
    Autocomplete.dataSources.courses.getData = function(query) {
        return allCourses.filter(course =>
            course.id.toLowerCase().includes(query.toLowerCase()) ||
            course.name.toLowerCase().includes(query.toLowerCase())
        );
    };
}

document.addEventListener('DOMContentLoaded', loadAllCoursesOnce);
*/

// ============================================
// EXPECTED BACKEND RESPONSE FORMAT
// ============================================

/*
GET /api/courses/search?q=math

Response (200 OK):
[
    {
        "id": "MATH101",
        "name": "Calculus I"
    },
    {
        "id": "MATH102",
        "name": "Calculus II"
    },
    {
        "id": "MATH201",
        "name": "Linear Algebra"
    }
]

OR with metadata:
{
    "courses": [
        { "id": "MATH101", "name": "Calculus I" },
        { "id": "MATH102", "name": "Calculus II" }
    ],
    "total": 100,
    "limit": 8
}
*/

// ============================================
// TESTING BACKEND INTEGRATION
// ============================================

/*
// Quick test in browser console:

// Test 1: Verify data source is set
console.log(Autocomplete.dataSources.courses.getData);

// Test 2: Manually search
Autocomplete.dataSources.courses.getData('math').then(results => {
    console.log('Results:', results);
});

// Test 3: Check what user selected
document.getElementById('new-course-id').addEventListener('autocomplete-select', (e) => {
    console.log('Selected:', e.detail.suggestion);
    // This fires when user picks a course from suggestions
});
*/

// ============================================
// ADVANCED: Dynamic Data Source Switching
// ============================================

/*
// Support different data sources based on context:

const DataSources = {
    productionAPI: async function(query) {
        const response = await fetch(`/api/courses/search?q=${query}`);
        return await response.json();
    },

    stagingAPI: async function(query) {
        const response = await fetch(`/staging-api/courses/search?q=${query}`);
        return await response.json();
    },

    mockData: function(query) {
        return Autocomplete.getStaticCourseData().filter(course =>
            course.id.toLowerCase().includes(query.toLowerCase())
        );
    }
};

// Switch data source based on environment:
const environment = process.env.NODE_ENV || 'development';
const dataSourceName = environment === 'production' ? 'productionAPI' : 'mockData';

Autocomplete.updateDataSource('courses', DataSources[dataSourceName]);
*/
