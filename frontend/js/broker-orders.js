// Broker Orders page: shows pending and first-approved buy/sell
// orders, with dual approval (maker-checker) buttons for each.

const currentUser = requireRole('broker');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadBuyOrders();
    loadSellOrders();
    loadCompleted();
}

function fileUrl(path) {
    if (!path) return null;
    const filename = path.replace(/\\/g, '/').split('/').pop();
    return 'http://localhost:5000/uploads/' + filename;
}

function buildActionCell(item, idField, firstFn, finalFn) {
    const rejectFn = firstFn.indexOf('Buy') !== -1 ? 'rejectBuy' : 'rejectSell';
    const cancelBtn = ' <button class="btn btn-outline btn-sm" onclick="' + rejectFn + '(' + item[idField] + ')">Cancel</button>';

    let actionCell = '';
    if (item.status === 'pending') {
        actionCell = '<button class="btn btn-success btn-sm" onclick="' + firstFn + '(' + item[idField] + ')">First Approve</button>' + cancelBtn;
    } else if (item.status === 'first_approved') {
        if (item.first_approver_id == currentUser.user_id) {
            actionCell = '<span style="color:var(--slate); font-size:12px;">Awaiting a different approver</span>' + cancelBtn;
        } else {
            actionCell = '<button class="btn btn-primary btn-sm" onclick="' + finalFn + '(' + item[idField] + ')">Final Approve</button>' + cancelBtn;
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
            '<th>Investor</th><th>Company</th><th>Amount deposited</th><th>Proof</th><th>Status</th><th></th>' +
            '</tr></thead><tbody>';

        orders.forEach(function (o) {
            const actionCell = buildActionCell(o, 'order_id', 'firstApproveBuy', 'finalApproveBuy');

            html += '<tr>' +
                '<td>' + o.firstname + ' ' + o.surname + '<br><span style="color:var(--slate); font-size:12px;">' + o.email + '</span></td>' +
                '<td>' + o.company_name + ' <span class="mono">(' + o.ticker + ')</span></td>' +
                               '<td class="mono">MWK ' + parseFloat(o.amount_deposited).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
                '<td>' + (docButton(o.proof_of_payment_path, 'View') || '-') + '</td>' +
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
             '<th>Investor</th><th>Company</th><th>Quantity</th><th>Pricing</th><th>Status</th><th></th>' +
            '</tr></thead><tbody>';

        orders.forEach(function (o) {
            const actionCell = buildActionCell(o, 'sell_id', 'firstApproveSell', 'finalApproveSell');

            html += '<tr>' +
                '<td>' + o.firstname + ' ' + o.surname + '<br><span style="color:var(--slate); font-size:12px;">' + o.email + '</span></td>' +
                '<td>' + o.company_name + ' <span class="mono">(' + o.ticker + ')</span></td>' +
                '<td class="mono">' + o.quantity.toLocaleString() + '</td>' +
                '<td style="color:var(--slate); font-size:12.5px;">Set at final approval</td>' +
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
    try {
        const res = await fetch(API_BASE + endpoint, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            reloadFn();
            loadCompleted();
        } else {
            showToast(data.message || 'Approval failed.', 'error');
        }
    } catch (err) {
        showToast('Could not reach the server.', 'error');
    }
}

async function rejectBuy(orderId) {
    await runReject('/orders/buy/' + orderId + '/reject', loadBuyOrders);
}

async function rejectSell(sellId) {
    await runReject('/orders/sell/' + sellId + '/reject', loadSellOrders);
}

async function runReject(endpoint, reloadFn) {
    const reason = prompt('Reason for cancelling this order. The investor will receive this message:');
    if (reason === null) return; // broker pressed Cancel on the box

    if (reason.trim().length < 5) {
        showToast('Please give a reason (at least 5 characters).', 'error');
        return;
    }

    try {
        const res = await fetch(API_BASE + endpoint, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason: reason.trim() })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            reloadFn();
            loadCompleted();
        } else {
            showToast(data.message || 'Could not cancel the order.', 'error');
        }
    } catch (err) {
        showToast('Could not reach the server.', 'error');
    }
}

function escHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

async function loadCompleted() {
    const wrap = document.getElementById('completedWrap');

    try {
        const res = await fetch(API_BASE + '/orders/history', { headers: getAuthHeaders() });
        const orders = await res.json();

        if (!res.ok) {
            wrap.innerHTML = '<div class="empty-state">' + escHtml(orders.message || 'Could not load completed orders.') + '</div>';
            return;
        }

        if (orders.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No completed orders yet.</div>';
            return;
        }

        // Newest activity first; show the latest 10 only.
        const recent = orders.slice().sort(function (a, b) {
            return new Date(b.closed_at || b.created_at) - new Date(a.closed_at || a.created_at);
        }).slice(0, 10);

        let html = '<table class="data-table"><thead><tr>' +
            '<th>Order</th><th>Investor</th><th>Company</th><th>Shares</th><th>Amount</th><th>Outcome</th><th>Handled by</th><th>Closed</th>' +
            '</tr></thead><tbody>';

        recent.forEach(function (o) {
            const outcome = o.status === 'rejected' ? 'Cancelled' : 'Approved';
            const closer = o.status === 'approved' ? (o.final_approver || o.closed_by) : o.closed_by;
            const amount = o.total_amount != null ? o.total_amount : o.amount_deposited;
            const closed = o.closed_at
                ? new Date(o.closed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '-';

            html += '<tr>' +
                '<td style="text-transform:capitalize;">' + escHtml(o.type) + ' #' + escHtml(o.id) + '</td>' +
                '<td>' + escHtml(o.investor_name) + '</td>' +
                '<td>' + escHtml(o.company_name) + ' <span class="mono">(' + escHtml(o.ticker) + ')</span></td>' +
                '<td class="mono">' + (o.quantity != null ? Number(o.quantity).toLocaleString() : '-') + '</td>' +
                '<td class="mono">' + (amount != null ? 'MWK ' + parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-') + '</td>' +
                '<td><span class="status-pill status-' + escHtml(o.status) + '">' + outcome + '</span></td>' +
                '<td>' + escHtml(closer || '-') + '</td>' +
                '<td style="font-size:12px;">' + escHtml(closed) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load completed orders.</div>';
    }
}