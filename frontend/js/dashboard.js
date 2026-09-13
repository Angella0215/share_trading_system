// Loads the logged-in investor's real account status and portfolio
// from the backend, and fills in the dashboard page.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    document.getElementById('welcomeName').textContent = ', ' + currentUser.fullname.split(' ')[0];

    loadAccountData();
}

async function loadAccountData() {
    try {
                const res = await authFetch(API_BASE + '/investors/me', { method: 'GET' });
        if (!res) return;
        const data = await res.json();

        if (!res.ok) {
            // No account application yet - guide them to open one.
            document.getElementById('accountStatusPill').textContent = 'No account opened';
            document.getElementById('accountStatusPill').className = 'status-pill status-pending';
            document.getElementById('statStatus').textContent = 'Not started';
            document.getElementById('portfolioTableWrap').innerHTML =
                '<div class="empty-state">You have not opened a trading account yet. <a href="account.html">Open one now</a>.</div>';
            return;
        }

        const statusPill = document.getElementById('accountStatusPill');
        statusPill.textContent = data.account_status.charAt(0).toUpperCase() + data.account_status.slice(1);
        statusPill.className = 'status-pill status-' + data.account_status;

        document.getElementById('statStatus').textContent = data.account_status.charAt(0).toUpperCase() + data.account_status.slice(1);
        document.getElementById('statCompanies').textContent = data.portfolio.length;

        const totalShares = data.portfolio.reduce(function (sum, p) { return sum + p.shares_owned; }, 0);
        document.getElementById('statHoldings').textContent = totalShares.toLocaleString();

        renderPortfolioTable(data.portfolio);

    } catch (err) {
        document.getElementById('portfolioTableWrap').innerHTML =
            '<div class="empty-state">Could not load your account. Make sure the backend is running.</div>';
    }
}

function renderPortfolioTable(portfolio) {
    const wrap = document.getElementById('portfolioTableWrap');

    if (portfolio.length === 0) {
        wrap.innerHTML = '<div class="empty-state">You do not own any shares yet. <a href="buy.html">Buy your first shares</a>.</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr>' +
        '<th>Company</th><th>Ticker</th><th>Shares owned</th><th>Current price</th><th>Value</th>' +
        '</tr></thead><tbody>';

    portfolio.forEach(function (p) {
        const value = (p.shares_owned * parseFloat(p.current_price)).toFixed(2);
        html += '<tr>' +
            '<td>' + p.company_name + '</td>' +
            '<td class="mono">' + p.ticker + '</td>' +
            '<td class="mono">' + p.shares_owned.toLocaleString() + '</td>' +
            '<td class="mono">MWK ' + parseFloat(p.current_price).toFixed(2) + '</td>' +
            '<td class="mono">MWK ' + Number(value).toLocaleString() + '</td>' +
            '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
}