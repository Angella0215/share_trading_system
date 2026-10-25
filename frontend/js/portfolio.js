// Portfolio page: shows all the investor's holdings with totals,
// and a quick "Sell" link for each company.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadPortfolio();
    loadTrades();
}

async function loadPortfolio() {
    const wrap = document.getElementById('portfolioTableWrap');

    try {
        const res = await authFetch(API_BASE + '/investors/me', { method: 'GET' });
        if (!res) return;
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

function fmtBoughtDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTable(portfolio) {
    const wrap = document.getElementById('portfolioTableWrap');

    let html = '<table class="data-table"><thead><tr>' +
        '<th>Company</th><th>Ticker</th><th>Shares bought</th><th>Date bought</th><th>Current price</th><th>Value</th><th></th>' +
        '</tr></thead><tbody>';

    portfolio.forEach(function (p) {
        const value = p.shares_owned * parseFloat(p.current_price);

        let dateHtml = fmtBoughtDate(p.last_bought);
        if (Number(p.purchase_count) > 1) {
            dateHtml += '<br><span style="font-size:11.5px; color:var(--slate);">' +
                p.purchase_count + ' purchases, first on ' + fmtBoughtDate(p.first_bought) + '</span>';
        }

        html += '<tr>' +
            '<td>' + p.company_name + '</td>' +
            '<td class="mono">' + p.ticker + '</td>' +
            '<td class="mono">' + p.shares_owned.toLocaleString() + '</td>' +
            '<td>' + dateHtml + '</td>' +
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

let allTrades = [];
let tradePage = 1;
const tradePageSize = 10;

async function loadTrades() {
    const wrap = document.getElementById('tradesTableWrap');

    try {
        const res = await authFetch(API_BASE + '/orders/my-transactions', {});
        if (!res) return;
        const data = await res.json();

        if (!res.ok) {
            wrap.innerHTML = '<div class="empty-state">No approved trades yet.</div>';
            return;
        }
        if (data.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No approved trades yet. Once a broker approves an order, it will appear here.</div>';
            return;
        }

        allTrades = data;
        renderTrades();

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load your trades. Make sure the backend is running.</div>';
    }
}

function fmtTradeDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTrades() {
    const wrap = document.getElementById('tradesTableWrap');
    const totalPages = Math.ceil(allTrades.length / tradePageSize);
    const start = (tradePage - 1) * tradePageSize;
    const items = allTrades.slice(start, start + tradePageSize);

    let html = '<table class="data-table"><thead><tr>' +
        '<th>Date</th><th>Type</th><th>Company</th><th>Shares</th><th>Price</th><th>Value</th><th>Settlement</th><th></th>' +
        '</tr></thead><tbody>';

    items.forEach(function (t) {
        const price = parseFloat(t.price);
        const value = t.quantity * price;
        const isBuy = t.type === 'buy';

        html += '<tr>' +
            '<td>' + fmtTradeDate(t.transaction_date) + '</td>' +
            '<td><strong style="color:' + (isBuy ? 'var(--brand)' : 'var(--slate)') + ';">' + (isBuy ? 'Buy' : 'Sell') + '</strong></td>' +
            '<td>' + t.company_name + ' <span class="mono">(' + t.ticker + ')</span></td>' +
            '<td class="mono">' + Number(t.quantity).toLocaleString() + '</td>' +
            '<td class="mono">MWK ' + price.toFixed(2) + '</td>' +
            '<td class="mono">MWK ' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
            '<td style="font-size:12.5px;">' + fmtTradeDate(t.settlement_date) + '</td>' +
            '<td>' + (isBuy
    ? '<a href="deal-note.html?transaction_id=' + t.transaction_id + '" class="btn btn-outline btn-sm">Deal Note</a>'
    : '<button class="btn btn-outline btn-sm" onclick="downloadSaleNote(' + t.sell_order_id + ')">Sale Note</button>') +
'</td>' +
            '</tr>';
    });

    html += '</tbody></table>';

    if (totalPages > 1) {
        html += '<div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">' +
            '<button class="btn btn-outline btn-sm" onclick="changeTradePage(-1)" ' + (tradePage === 1 ? 'disabled' : '') + '>Previous</button>' +
            '<span style="font-size:13.5px; color:var(--slate);">Page ' + tradePage + ' of ' + totalPages + '</span>' +
            '<button class="btn btn-outline btn-sm" onclick="changeTradePage(1)" ' + (tradePage === totalPages ? 'disabled' : '') + '>Next</button>' +
            '</div>';
    }

    wrap.innerHTML = html;
}

function changeTradePage(direction) {
    const totalPages = Math.ceil(allTrades.length / tradePageSize);
    tradePage = Math.max(1, Math.min(totalPages, tradePage + direction));
    renderTrades();
}

async function downloadSaleNote(sellId) {
    try {
        const res = await authFetch(API_BASE + '/statements/sale-note/' + sellId, { method: 'GET' });
        if (!res) return;

        if (!res.ok) {
            let message = 'Could not generate the sale note.';
            try { message = (await res.json()).message || message; } catch (e) { /* not JSON */ }
            showToast(message, 'error');
            return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sale-note-' + sellId + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (err) {
        showToast('Could not reach the server.', 'error');
    }
}