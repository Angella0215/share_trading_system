// Order History page: loads the investor's combined buy/sell order
// history and displays it as a single table, with status badges.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadOrders();
}

async function loadOrders() {
    const wrap = document.getElementById('ordersTableWrap');

    try {
        const res = await fetch(API_BASE + '/orders/my-orders', {
            method: 'GET',
            headers: getAuthHeaders()
        });

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
        '<th>Date</th><th>Type</th><th>Company</th><th>Quantity</th><th>Price</th><th>Total</th><th>Status</th><th></th>' +
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
                   '<td><span class="status-pill status-' + o.status + '">' + o.status.charAt(0).toUpperCase() + o.status.slice(1) + '</span></td>' +
            '<td>' + (o.status === 'pending' ? '<button class="btn btn-danger btn-sm" onclick="cancelOrder(' + o.id + ', \'' + o.type + '\')">Cancel</button>' : '') + '</td>' +
            '</tr>';     
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
}
async function cancelOrder(id, type) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    const endpoint = type === 'buy' ? '/orders/buy/' + id + '/cancel' : '/orders/sell/' + id + '/cancel';

    try {
        const res = await fetch(API_BASE + endpoint, {
            method: 'PUT',
            headers: getAuthHeaders()
        });

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