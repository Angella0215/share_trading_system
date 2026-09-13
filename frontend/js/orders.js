// Order History page: loads the investor's combined buy/sell order
// history and displays it as a single table, with status badges.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadOrders();
}

let myTransactions = [];

async function loadOrders() {
    const wrap = document.getElementById('ordersTableWrap');

    try {
             const txRes = await authFetch(API_BASE + '/orders/my-transactions', {});
        if (txRes && txRes.ok) {
            myTransactions = await txRes.json();
        }

        const res = await authFetch(API_BASE + '/orders/my-orders', {});
        if (!res) return;  

        const orders = await res.json();

        if (!res.ok) {
            wrap.innerHTML = '<div class="empty-state">You have not opened a trading account yet. <a href="account.html">Open one now</a>.</div>';
            return;
        }

        if (orders.length === 0) {
            wrap.innerHTML = '<div class="empty-state">You have not placed any orders yet.</div>';
            return;
        }

        renderTable(orders);

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load your orders. Make sure the backend is running.</div>';
    }
}

function renderTable(orders) {
    const wrap = document.getElementById('ordersTableWrap');
   
       let html = '<table class="data-table"><thead><tr>' +
        '<th>Date</th><th>Type</th><th>Company</th><th>Quantity</th><th>Price</th><th>Total</th><th>Status</th><th>Settlement</th><th></th>' +
        '</tr></thead><tbody>';

    orders.forEach(function (o) {
        const date = new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const typeLabel = o.type === 'buy'
            ? '<span style="color:var(--brand); font-weight:600;">Buy</span>'
            : '<span style="color:var(--slate); font-weight:600;">Sell</span>';

        html += '<tr>' +
            '<td>' + date + '</td>' +
            '<td>' + typeLabel + '</td>' +
            '<td>' + o.company_name + ' <span class="mono" style="color:var(--slate);">(' + o.ticker + ')</span></td>' +
            '<td class="mono">' + o.quantity.toLocaleString() + '</td>' +
            '<td class="mono">MWK ' + parseFloat(o.price).toFixed(2) + '</td>' +
            '<td class="mono">MWK ' + parseFloat(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
              '<td>' + buildStatusPill(o.status) + '</td>' +
            '<td>' + buildSettlementCell(o) + '</td>' +
            '<td>' +
                (o.status === 'pending' ? '<button class="btn btn-danger btn-sm" onclick="cancelOrder(' + o.id + ', \'' + o.type + '\')">Cancel</button>' : '') +
                (o.status === 'approved' ? findDealNoteLink(o) : '') +
            '</td>' +
            '</tr>';

    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
}
function buildStatusPill(status) {
    const displayStatus = status === 'first_approved' ? 'pending' : status;
    const label = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);
    return '<span class="status-pill status-' + displayStatus + '">' + label + '</span>';
}

function findDealNoteLink(order) {
    const match = myTransactions.find(function (t) {
        return order.type === 'buy' ? t.buy_order_id === order.id : t.sell_order_id === order.id;
    });

    if (match) {
        return '<a href="deal-note.html?transaction_id=' + match.transaction_id + '" class="btn btn-outline btn-sm">Deal Note</a>';
    }
    return '';
}

async function cancelOrder(id, type) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    const endpoint = type === 'buy' ? '/orders/buy/' + id + '/cancel' : '/orders/sell/' + id + '/cancel';

    try {
                const res = await authFetch(API_BASE + endpoint, { method: 'PUT' });
        if (!res) return;

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            loadOrders();
        } else {
            alert(data.message || 'Cancellation failed.');
        }

    } catch (err) {
        alert('Could not reach the server.');
    }
}

function buildSettlementCell(order) {
    if (order.status !== 'approved') {
        return '<span style="color:var(--slate); font-size:12.5px;">-</span>';
    }

    const match = myTransactions.find(function (t) {
        return order.type === 'buy' ? t.buy_order_id === order.id : t.sell_order_id === order.id;
    });

    if (match && match.settlement_date) {
        const date = new Date(match.settlement_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return '<span class="mono" style="font-size:12.5px;">' + date + '</span>';
    }

    return '<span style="color:var(--slate); font-size:12.5px;">Pending</span>';
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