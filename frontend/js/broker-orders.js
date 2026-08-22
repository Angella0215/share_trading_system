// Broker Orders page: shows pending buy and sell orders as tables,
// with an approve button for each. Also links to proof of payment
// for buy orders, so the broker can verify funds were sent.

const currentUser = requireRole('broker');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadBuyOrders();
    loadSellOrders();
}

function fileUrl(path) {
    if (!path) return null;
    const filename = path.replace(/\\/g, '/').split('/').pop();
    return 'http://localhost:5000/uploads/' + filename;
}

async function loadBuyOrders() {
    const wrap = document.getElementById('buyOrdersWrap');

    try {
        const res = await fetch(API_BASE + '/orders/buy/pending', { headers: getAuthHeaders() });
        const orders = await res.json();

        if (!res.ok || orders.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No pending buy orders.</div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>' +
            '<th>Investor</th><th>Company</th><th>Quantity</th><th>Price</th><th>Total</th><th>Proof</th><th></th>' +
            '</tr></thead><tbody>';

        orders.forEach(function (o) {
            html += '<tr>' +
                '<td>' + o.firstname + ' ' + o.surname + '<br><span style="color:var(--slate); font-size:12px;">' + o.email + '</span></td>' +
                '<td>' + o.company_name + ' <span class="mono">(' + o.ticker + ')</span></td>' +
                '<td class="mono">' + o.quantity.toLocaleString() + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.price).toFixed(2) + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
                '<td>' + (fileUrl(o.proof_of_payment_path) ? '<a href="' + fileUrl(o.proof_of_payment_path) + '" target="_blank" class="btn btn-outline btn-sm">View</a>' : '-') + '</td>' +
                '<td><button class="btn btn-success btn-sm" onclick="approveBuy(' + o.order_id + ')">Approve</button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load buy orders.</div>';
    }
}

async function loadSellOrders() {
    const wrap = document.getElementById('sellOrdersWrap');

    try {
        const res = await fetch(API_BASE + '/orders/sell/pending', { headers: getAuthHeaders() });
        const orders = await res.json();

        if (!res.ok || orders.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No pending sell orders.</div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>' +
            '<th>Investor</th><th>Company</th><th>Quantity</th><th>Price</th><th>Investor receives</th><th></th>' +
            '</tr></thead><tbody>';

        orders.forEach(function (o) {
            html += '<tr>' +
                '<td>' + o.firstname + ' ' + o.surname + '<br><span style="color:var(--slate); font-size:12px;">' + o.email + '</span></td>' +
                '<td>' + o.company_name + ' <span class="mono">(' + o.ticker + ')</span></td>' +
                '<td class="mono">' + o.quantity.toLocaleString() + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.price).toFixed(2) + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
                '<td><button class="btn btn-success btn-sm" onclick="approveSell(' + o.sell_id + ')">Approve</button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load sell orders.</div>';
    }
}

async function approveBuy(orderId) {
    const successAlert = document.getElementById('successAlert');
    try {
        const res = await fetch(API_BASE + '/orders/buy/' + orderId + '/approve', {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            successAlert.textContent = data.message;
            successAlert.classList.add('show');
            loadBuyOrders();
        } else {
            alert(data.message || 'Approval failed.');
        }
    } catch (err) {
        alert('Could not reach the server.');
    }
}

async function approveSell(sellId) {
    const successAlert = document.getElementById('successAlert');
    try {
        const res = await fetch(API_BASE + '/orders/sell/' + sellId + '/approve', {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            successAlert.textContent = data.message;
            successAlert.classList.add('show');
            loadSellOrders();
        } else {
            alert(data.message || 'Approval failed.');
        }
    } catch (err) {
        alert('Could not reach the server.');
    }
}