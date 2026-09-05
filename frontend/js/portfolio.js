// Portfolio page: shows all the investor's holdings with totals,
// and a quick "Sell" link for each company.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadPortfolio();
}

async function loadPortfolio() {
    const wrap = document.getElementById('portfolioTableWrap');

    try {
        const res = await fetch(API_BASE + '/investors/me', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            wrap.innerHTML = '<div class="empty-state">You have not opened a trading account yet. <a href="account.html">Open one now</a>.</div>';
            return;
        }

        const portfolio = data.portfolio;

        if (portfolio.length === 0) {
            wrap.innerHTML = '<div class="empty-state">You do not own any shares yet. <a href="buy.html">Buy your first shares</a>.</div>';
            document.getElementById('statTotalValue').textContent = 'MWK 0.00';
            document.getElementById('statTotalShares').textContent = '0';
            document.getElementById('statCompanyCount').textContent = '0';
            return;
        }

        let totalValue = 0;
        let totalShares = 0;

        portfolio.forEach(function (p) {
            totalValue += p.shares_owned * parseFloat(p.current_price);
            totalShares += p.shares_owned;
        });

        document.getElementById('statTotalValue').textContent = 'MWK ' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('statTotalShares').textContent = totalShares.toLocaleString();
        document.getElementById('statCompanyCount').textContent = portfolio.length;

        renderTable(portfolio);

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load your portfolio. Make sure the backend is running.</div>';
    }
}

function renderTable(portfolio) {
    const wrap = document.getElementById('portfolioTableWrap');

    let html = '<table class="data-table"><thead><tr>' +
        '<th>Company</th><th>Ticker</th><th>Shares owned</th><th>Current price</th><th>Value</th><th></th>' +
        '</tr></thead><tbody>';

    portfolio.forEach(function (p) {
        const value = p.shares_owned * parseFloat(p.current_price);
        html += '<tr>' +
            '<td>' + p.company_name + '</td>' +
            '<td class="mono">' + p.ticker + '</td>' +
            '<td class="mono">' + p.shares_owned.toLocaleString() + '</td>' +
            '<td class="mono">MWK ' + parseFloat(p.current_price).toFixed(2) + '</td>' +
            '<td class="mono">MWK ' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
            '<td><a href="sell.html?company=' + p.company_id + '" class="btn btn-outline btn-sm">Sell</a></td>' +
            '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
}

async function downloadStatement(type) {
    try {
        const res = await fetch(API_BASE + '/statements/' + type, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            alert('Could not generate the statement.');
            return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = type + '-statement.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (err) {
        alert('Could not reach the server.');
    }
}