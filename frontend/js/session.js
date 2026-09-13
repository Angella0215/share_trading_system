// Runs on every protected page. Confirms the user is logged in and
// has the right role - if not, sends them back to the login page.

function requireRole(expectedRole) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = getLoginPath();
        return null;
    }

    const user = JSON.parse(userStr);

    if (user.role !== expectedRole) {
        window.location.href = getLoginPath();
        return null;
    }

    return user;
}

function getLoginPath() {
    // Works whether the page is at frontend/investor/page.html
    // or frontend/broker/page.html etc - always one folder up.
    return '../index.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../index.html';
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

// Wraps fetch for authenticated requests. If the token is invalid or
// expired, automatically logs the user out and sends them back to
// login with a clear message, instead of leaving them on a broken page.
async function authFetch(url, options = {}) {
    options.headers = Object.assign({}, getAuthHeaders(), options.headers || {});

    const res = await fetch(url, options);

    if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.setItem('sessionExpiredMessage', 'Your session has expired. Please log in again.');
        window.location.href = getLoginPath();
        return null;
    }

    return res;
}