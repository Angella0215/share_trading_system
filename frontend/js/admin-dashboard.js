// Admin Dashboard: shows system-wide counts.

const currentUser = requireRole('admin');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadStats();
}

async function loadStats() {
    try {
        const [usersRes, companiesRes] = await Promise.all([
            fetch(API_BASE + '/users', { headers: getAuthHeaders() }),
            fetch(API_BASE + '/companies', { headers: getAuthHeaders() })
        ]);

        const users = await usersRes.json();
        const companies = await companiesRes.json();

        const investorCount = Array.isArray(users) ? users.filter(function (u) { return u.role === 'investor'; }).length : 0;

        document.getElementById('statTotalUsers').textContent = Array.isArray(users) ? users.length : 0;
        document.getElementById('statInvestors').textContent = investorCount;
        document.getElementById('statCompanies').textContent = Array.isArray(companies) ? companies.length : 0;

    } catch (err) {
        document.getElementById('statTotalUsers').textContent = '-';
        document.getElementById('statInvestors').textContent = '-';
        document.getElementById('statCompanies').textContent = '-';
    }
}