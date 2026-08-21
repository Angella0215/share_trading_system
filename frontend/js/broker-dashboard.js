// Broker Dashboard: shows counts of pending items needing review.

const currentUser = requireRole('broker');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadStats();
}

async function loadStats() {
    try {
        const [accountsRes, buysRes, sellsRes] = await Promise.all([
            fetch(API_BASE + '/investors/pending', { headers: getAuthHeaders() }),
            fetch(API_BASE + '/orders/buy/pending', { headers: getAuthHeaders() }),
            fetch(API_BASE + '/orders/sell/pending', { headers: getAuthHeaders() })
        ]);

        const accounts = await accountsRes.json();
        const buys = await buysRes.json();
        const sells = await sellsRes.json();

        document.getElementById('statPendingAccounts').textContent = Array.isArray(accounts) ? accounts.length : 0;
        document.getElementById('statPendingBuys').textContent = Array.isArray(buys) ? buys.length : 0;
        document.getElementById('statPendingSells').textContent = Array.isArray(sells) ? sells.length : 0;

    } catch (err) {
        document.getElementById('statPendingAccounts').textContent = '-';
        document.getElementById('statPendingBuys').textContent = '-';
        document.getElementById('statPendingSells').textContent = '-';
    }
}