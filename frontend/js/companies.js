// Loads all MSE companies and shows current price plus the change
// versus the previous recorded price, color-coded like a ticker.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadCompanies();
}
let allCompanyItems = [];
let currentPage = 1;
const pageSize = 10;

async function loadCompanies() {
    const wrap = document.getElementById('companiesTableWrap');

    try {
        const res = await authFetch(API_BASE + '/companies', { method: 'GET' });
        if (!res) return;
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
                const histRes = await authFetch(API_BASE + '/companies/' + c.company_id + '/history', {});
                if (!histRes) return { company: c, change: null };
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
    allCompanyItems = items;
    renderPage();
}

function renderPage() {
    const wrap = document.getElementById('companiesTableWrap');
    const totalPages = Math.ceil(allCompanyItems.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const items = allCompanyItems.slice(start, start + pageSize);

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

    if (totalPages > 1) {
        html += '<div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">' +
            '<button class="btn btn-outline btn-sm" onclick="changePage(-1)" ' + (currentPage === 1 ? 'disabled' : '') + '>Previous</button>' +
            '<span style="font-size:13.5px; color:var(--slate);">Page ' + currentPage + ' of ' + totalPages + '</span>' +
            '<button class="btn btn-outline btn-sm" onclick="changePage(1)" ' + (currentPage === totalPages ? 'disabled' : '') + '>Next</button>' +
            '</div>';
    }

    wrap.innerHTML = html;
}

function changePage(direction) {
    const totalPages = Math.ceil(allCompanyItems.length / pageSize);
    currentPage = Math.max(1, Math.min(totalPages, currentPage + direction));
    renderPage();
}