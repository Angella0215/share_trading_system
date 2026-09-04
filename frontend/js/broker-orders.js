// Broker Orders page: shows pending and first-approved buy/sell
// orders, with dual approval (maker-checker) buttons for each.

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

function buildActionCell(item, idField, firstFn, finalFn) {
    let actionCell = '';
    if (item.status === 'pending') {
        actionCell = '<button class="btn btn-success btn-sm" onclick="' + firstFn + '(' + item[idField] + ')">First Approve</button>';
    } else if (item.status === 'first_approved') {
        if (item.first_approver_id == currentUser.user_id) {
            actionCell = '<span style="color:var(--slate); font-size:12px;">Awaiting a different approver</span>';
        } else {
            actionCell = '<button class="btn btn-primary btn-sm" onclick="' + finalFn + '(' + item[idField] + ')">Final Approve</button>';
        }
    }
    return actionCell;
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
            '<th>Investor</th><th>Company</th><th>Quantity</th><th>Price</th><th>Total</th><th>Proof</th><th>Status</th><th></th>' +
            '</tr></thead><tbody>';

        orders.forEach(function (o) {
            const actionCell = buildActionCell(o, 'order_id', 'firstApproveBuy', 'finalApproveBuy');

            html += '<tr>' +
                '<td>' + o.firstname + ' ' + o.surname + '<br><span style="color:var(--slate); font-size:12px;">' + o.email + '</span></td>' +
                '<td>' + o.company_name + ' <span class="mono">(' + o.ticker + ')</span></td>' +
                '<td class="mono">' + o.quantity.toLocaleString() + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.price).toFixed(2) + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
                '<td>' + (fileUrl(o.proof_of_payment_path) ? '<a href="' + fileUrl(o.proof_of_payment_path) + '" target="_blank" class="btn btn-outline btn-sm">View</a>' : '-') + '</td>' +
                '<td><span class="status-pill status-' + o.status + '">' + o.status.replace('_', ' ') + '</span></td>' +
                '<td>' + actionCell + '</td>' +
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
            '<th>Investor</th><th>Company</th><th>Quantity</th><th>Price</th><th>Investor receives</th><th>Status</th><th></th>' +
            '</tr></thead><tbody>';

        orders.forEach(function (o) {
            const actionCell = buildActionCell(o, 'sell_id', 'firstApproveSell', 'finalApproveSell');

            html += '<tr>' +
                '<td>' + o.firstname + ' ' + o.surname + '<br><span style="color:var(--slate); font-size:12px;">' + o.email + '</span></td>' +
                '<td>' + o.company_name + ' <span class="mono">(' + o.ticker + ')</span></td>' +
                '<td class="mono">' + o.quantity.toLocaleString() + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.price).toFixed(2) + '</td>' +
                '<td class="mono">MWK ' + parseFloat(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
                '<td><span class="status-pill status-' + o.status + '">' + o.status.replace('_', ' ') + '</span></td>' +
                '<td>' + actionCell + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load sell orders.</div>';
    }
}

async function firstApproveBuy(orderId) {
    await runApproval('/orders/buy/' + orderId + '/first-approve', loadBuyOrders);
}

async function finalApproveBuy(orderId) {
    await runApproval('/orders/buy/' + orderId + '/final-approve', loadBuyOrders);
}

async function firstApproveSell(sellId) {
    await runApproval('/orders/sell/' + sellId + '/first-approve', loadSellOrders);
}

async function finalApproveSell(sellId) {
    await runApproval('/orders/sell/' + sellId + '/final-approve', loadSellOrders);
}

async function runApproval(endpoint, reloadFn) {
    const successAlert = document.getElementById('successAlert');
    try {
        const res = await fetch(API_BASE + endpoint, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            successAlert.textContent = data.message;
            successAlert.classList.add('show');
            reloadFn();
        } else {
            alert(data.message || 'Approval failed.');
        }
    } catch (err) {
        alert('Could not reach the server.');
    }
}