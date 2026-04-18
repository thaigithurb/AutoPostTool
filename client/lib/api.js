const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Helper fetch — tự thêm headers và parse JSON
 */
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    // Không set Content-Type cho FormData (browser tự thêm boundary)
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const res = await fetch(url, config);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || 'Có lỗi xảy ra');
    }

    return data;
}

// ============================================================
// Accounts
// ============================================================
export async function fetchAccounts() {
    return fetchAPI('/accounts');
}

export async function createAccount(data) {
    return fetchAPI('/accounts', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateAccount(id, data) {
    return fetchAPI(`/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteAccount(id) {
    return fetchAPI(`/accounts/${id}`, {
        method: 'DELETE',
    });
}

// ============================================================
// Posts
// ============================================================
export async function fetchPosts(query = '') {
    return fetchAPI(`/posts${query ? `?${query}` : ''}`);
}

export async function createPost(data) {
    return fetchAPI('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updatePost(id, data) {
    return fetchAPI(`/posts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deletePost(id) {
    return fetchAPI(`/posts/${id}`, {
        method: 'DELETE',
    });
}

// ============================================================
// Upload (Cloudinary)
// ============================================================
export async function uploadMedia(files) {
    const formData = new FormData();
    for (const file of files) {
        formData.append('media', file);
    }

    return fetchAPI('/upload', {
        method: 'POST',
        body: formData,
    });
}

// ============================================================
// Account Health Check
// ============================================================
export async function checkAccountHealth(id) {
    return fetchAPI(`/accounts/${id}/check-health`, {
        method: 'POST',
    });
}

export async function syncAccountTargets(id) {
    return fetchAPI(`/accounts/${id}/sync-targets`, {
        method: 'POST',
    });
}

// ============================================================
// Scraper
// ============================================================
export async function scrapeGroup(data) {
    return fetchAPI('/scraper/scrape', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchScrapedPosts(query = '') {
    return fetchAPI(`/scraper/posts${query ? `?${query}` : ''}`);
}

export async function fetchScrapedCategories() {
    return fetchAPI('/scraper/categories');
}

export async function bookmarkScrapedPost(id) {
    return fetchAPI(`/scraper/posts/${id}/bookmark`, {
        method: 'PUT',
    });
}

export async function deleteScrapedPost(id) {
    return fetchAPI(`/scraper/posts/${id}`, {
        method: 'DELETE',
    });
}

// ==== Scrape Targets ====
export async function fetchScrapeTargets() {
    return fetchAPI('/scraper/targets');
}

export async function createScrapeTarget(data) {
    return fetchAPI('/scraper/targets', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateScrapeTarget(id, data) {
    return fetchAPI(`/scraper/targets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteScrapeTarget(id) {
    return fetchAPI(`/scraper/targets/${id}`, {
        method: 'DELETE',
    });
}
