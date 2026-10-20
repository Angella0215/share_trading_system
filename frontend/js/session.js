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
// Shows a floating notification in the top-right corner. It fades away after
// "duration" milliseconds (default 10 seconds) or when the user clicks it.
function showToast(message, type = 'success', duration = 60000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    toast.style.cursor = 'pointer';
    toast.title = 'Click to dismiss';
    container.appendChild(toast);

    // Trigger the fade-in on the next frame so the CSS transition runs.
    requestAnimationFrame(function () {
        toast.classList.add('show');
    });

    function dismiss() {
        toast.classList.remove('show');
        setTimeout(function () {
            toast.remove();
        }, 300);
    }

    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
}

// Shows an unread-message badge on the sidebar "Messages" link and pops up
// a notice when a new message arrives while the page is open.
(function () {
    let lastCount = null;

    async function checkUnread() {
        const token = localStorage.getItem('token');
        const link = document.querySelector('.sidebar-nav a[href="messages.html"]');
        if (!token || !link) return;

        try {
            const res = await fetch(API_BASE + '/messages/unread-count', {
                headers: { 'Authorization': 'Bearer ' + token },
                cache: 'no-store'
            });
            if (!res.ok) return;
            const data = await res.json();

            let badge = link.querySelector('.nav-badge');
            if (data.total > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'nav-badge';
                    link.appendChild(badge);
                }
                badge.textContent = data.total > 99 ? '99+' : data.total;
            } else if (badge) {
                badge.remove();
            }

            if (lastCount !== null && data.total > lastCount) {
                showToast('You have a new message', 'success');
            }
            lastCount = data.total;
        } catch (err) {
            // Ignore network errors; we'll try again on the next check.
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        checkUnread();
        setInterval(checkUnread, 15000);
    });
})();

// Helpers for opening protected documents (KYC files, proof of payment).
function docFilename(path) {
    if (!path) return null;
    return String(path).replace(/\\/g, '/').split('/').pop();
}

function docButton(path, label) {
    const file = docFilename(path);
    if (!file) return '';
    const safe = file.replace(/[^\w.\-]/g, '');
    return '<button type="button" class="btn btn-outline btn-sm" onclick="openDocument(\'' + safe + '\')">' + (label || 'View') + '</button>';
}

async function openDocument(filename) {
    // Open the tab straight away (from the click) so the browser doesn't block it.
    const tab = window.open('', '_blank');

    try {
        const res = await fetch(API_BASE + '/files/' + encodeURIComponent(filename), {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });

        if (!res.ok) {
            let message = 'Could not open the document.';
            try { message = (await res.json()).message || message; } catch (e) { /* not JSON */ }
            throw new Error(message);
        }

        const url = URL.createObjectURL(await res.blob());
        if (tab) {
            tab.location = url;
        } else {
            window.open(url, '_blank');
        }
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);

    } catch (err) {
        if (tab) tab.close();
        showToast(err.message, 'error');
    }
}