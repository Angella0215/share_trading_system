// Audit trail: read-only list of who placed, approved and cancelled orders.

const currentUser = requireRole('admin');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadAudit();
}

function esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

const actionLabels = {
    order_placed: 'Order placed',
    first_approved: 'First approval',
    final_approved: 'Final approval',
    order_cancelled: 'Order cancelled',
    order_rejected: 'Cancelled by broker',
    queue_skip_blocked: 'Queue skip blocked'
    
};

async function loadAudit() {
    const wrap = document.getElementById('auditTableWrap');

    try {
        const res = await fetch(API_BASE + '/audit', { headers: getAuthHeaders() });
        const rows = await res.json();

        if (!res.ok || rows.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No activity recorded yet.</div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>' +
            '<th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Order</th><th>Company</th><th>Details</th>' +
            '</tr></thead><tbody>';

        rows.forEach(function (r) {
            const time = new Date(r.created_at).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const flagged = r.action === 'queue_skip_blocked';
            const orderRef = r.entity_type ? (r.entity_type === 'buy_order' ? 'Buy #' : 'Sell #') + r.entity_id : '-';

            html += '<tr' + (flagged ? ' style="background:rgba(220,38,38,0.08);"' : '') + '>' +
                '<td class="mono" style="font-size:12px;">' + esc(time) + '</td>' +
                '<td>' + esc(r.user_name || '-') + '</td>' +
                '<td style="text-transform:capitalize;">' + esc(r.role || '-') + '</td>' +
                '<td><strong>' + esc(actionLabels[r.action] || r.action) + '</strong></td>' +
                '<td class="mono">' + esc(orderRef) + '</td>' +
                '<td>' + esc(r.company_name || '-') + '</td>' +
                '<td style="font-size:12.5px; color:var(--slate);">' + esc(r.details || '') + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load the audit trail. Make sure the backend is running.</div>';
    }
}