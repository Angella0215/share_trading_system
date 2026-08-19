// Loads all MSE companies and shows current price plus the change
// versus the previous recorded price, color-coded like a ticker.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadCompanies();
}

async function loadCompanies() {
    const wrap = document.getElementById('companiesTableWrap');

    try {
        const res = await fetch(API_BASE + '/companies', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const companies = await res.json();

        if (!res.ok || companies.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No companies found.</div>';
            return;
        }

        // For each company, fetch its price history so we can show
        // the change versus the previous price - not just today's price.
        const withChange = await Promise.all(companies.map(async function (c) {
            let change = null;
            try {
                const histRes = await fetch(API_BASE + '/companies/' + c.company_id + '/history', {
                    headers: getAuthHeaders()
                });
                const history = await histRes.json();
                if (history.length >= 2) {
                    const latest = parseFloat(history[history.length - 1].price);
                    const previous = parseFloat(history[history.length - 2].price);
                    change = latest - previous;
                }
            } catch (err) {
                // If history fails for one company, just show no change indicator.
            }
            return { company: c, change: change };
        }));

        renderTable(withChange);

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load companies. Make sure the backend is running.</div>';
    }
}

function renderTable(items) {
    const wrap = document.getElementById('companiesTableWrap');

    let html = '<table class="data-table"><thead><tr>' +
        '<th>Company</th><th>Ticker</th><th>Sector</th><th>Price (MWK)</th><th>Change</th><th></th>' +
        '</tr></thead><tbody>';

    items.forEach(function (item) {
        const c = item.company;
        const price = parseFloat(c.current_price).toFixed(2);

        let changeHtml = '<span style="color:var(--slate);">-</span>';
        if (item.change !== null) {
            const changeVal = item.change.toFixed(2);
            if (item.change > 0) {
                changeHtml = '<span style="color:var(--green);">&#9650; ' + changeVal + '</span>';
            } else if (item.change < 0) {
                changeHtml = '<span style="color:var(--red);">&#9660; ' + Math.abs(changeVal) + '</span>';
            } else {
                changeHtml = '<span style="color:var(--slate);">0.00</span>';
            }
        }

        html += '<tr>' +
            '<td>' + c.company_name + '</td>' +
            '<td class="mono">' + c.ticker + '</td>' +
            '<td>' + (c.sector || '-') + '</td>' +
            '<td class="mono">' + price + '</td>' +
            '<td class="mono">' + changeHtml + '</td>' +
            '<td><a href="buy.html?company=' + c.company_id + '" class="btn btn-primary btn-sm">Buy</a></td>' +
            '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
}