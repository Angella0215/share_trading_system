// Users page: lists all registered accounts with role and join date.

const currentUser = requireRole('admin');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadUsers();
}
let allUserItems = [];
let currentUserPage = 1;
const userPageSize = 10;

async function loadUsers() {
    const wrap = document.getElementById('usersTableWrap');

    try {
        const res = await fetch(API_BASE + '/users', { headers: getAuthHeaders() });
        const users = await res.json();

        if (!res.ok || users.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No users found.</div>';
            return;
        }

        allUserItems = users;
        renderUserPage();

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load users. Make sure the backend is running.</div>';
    }
}

function renderUserPage() {
    const wrap = document.getElementById('usersTableWrap');
    const totalPages = Math.ceil(allUserItems.length / userPageSize);
    const start = (currentUserPage - 1) * userPageSize;
    const users = allUserItems.slice(start, start + userPageSize);

    let html = '<table class="data-table"><thead><tr>' +
            '<th>Name</th><th>Email</th><th>Role</th><th>Joined</th>' +
            '</tr></thead><tbody>';

        users.forEach(function (u) {
            const date = new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const roleColor = u.role === 'admin' ? 'var(--red)' : (u.role === 'broker' ? 'var(--brand)' : 'var(--slate)');

            html += '<tr>' +
                '<td>' + u.fullname + '</td>' +
                '<td>' + u.email + '</td>' +
                '<td><span style="color:' + roleColor + '; font-weight:600; text-transform:capitalize;">' + u.role + '</span></td>' +
                '<td class="mono">' + date + '</td>' +
                '</tr>';
            });

        html += '</tbody></table>';

    if (totalPages > 1) {
        html += '<div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">' +
            '<button class="btn btn-outline btn-sm" onclick="changeUserPage(-1)" ' + (currentUserPage === 1 ? 'disabled' : '') + '>Previous</button>' +
            '<span style="font-size:13.5px; color:var(--slate);">Page ' + currentUserPage + ' of ' + totalPages + '</span>' +
            '<button class="btn btn-outline btn-sm" onclick="changeUserPage(1)" ' + (currentUserPage === totalPages ? 'disabled' : '') + '>Next</button>' +
            '</div>';
    }

    wrap.innerHTML = html;
}

function changeUserPage(direction) {
    const totalPages = Math.ceil(allUserItems.length / userPageSize);
    currentUserPage = Math.max(1, Math.min(totalPages, currentUserPage + direction));
    renderUserPage();
}