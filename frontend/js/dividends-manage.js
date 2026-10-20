// Dividends page shared by Admin and Broker.
// The page sets DIVIDEND_ROLE ('admin' or 'broker') before loading this file.

const currentUser = requireRole(DIVIDEND_ROLE);
const isAdmin = DIVIDEND_ROLE === 'admin';

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    if (isAdmin) {
        loadCompanyOptions();
        document.getElementById('dividendForm').addEventListener('submit', declareDividend);
    }
    loadDividends();
}

function esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function mwk(value) {
    return 'MWK ' + parseFloat(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusLabels = {
    declared: 'Declared',
    calculated: 'Awaiting first approval',
    first_approved: 'Awaiting final approval',
    approved: 'Approved - ready to pay',
    paid: 'Paid',
    cancelled: 'Cancelled'
};

const statusClass = {
    declared: 'pending',
    calculated: 'pending',
    first_approved: 'pending',
    approved: 'approved',
    paid: 'verified',
    cancelled: 'rejected'
};

async function loadCompanyOptions() {
    const select = document.getElementById('div_company');
    try {
        const res = await fetch(API_BASE + '/companies', { headers: getAuthHeaders() });
        const companies = await res.json();
        companies.forEach(function (c) {
            const opt = document.createElement('option');
            opt.value = c.company_id;
            opt.textContent = c.company_name + ' (' + c.ticker + ')';
            select.appendChild(opt);
        });
    } catch (err) {
        showToast('Could not load companies.', 'error');
    }
}

async function declareDividend(e) {
    e.preventDefault();
    const btn = document.getElementById('declareBtn');

    const body = {
        company_id: document.getElementById('div_company').value,
        amount_per_share: document.getElementById('div_amount').value,
        tax_rate: document.getElementById('div_tax').value,
        record_date: document.getElementById('div_record').value,
        payment_date: document.getElementById('div_payment').value
    };

    if (!confirm('Declare this dividend? Check the amount per share, tax rate and dates first.')) return;

    btn.disabled = true;
    try {
        const res = await fetch(API_BASE + '/dividends', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            document.getElementById('dividendForm').reset();
            loadDividends();
        } else {
            showToast(data.message || 'Could not declare the dividend.', 'error');
        }
    } catch (err) {
        showToast('Could not reach the server.', 'error');
    }
    btn.disabled = false;
}

async function loadDividends() {
    const wrap = document.getElementById('dividendsWrap');

    try {
        const res = await fetch(API_BASE + '/dividends', { headers: getAuthHeaders() });
        const rows = await res.json();

        if (!res.ok) {
            wrap.innerHTML = '<div class="empty-state">' + esc(rows.message || 'Could not load dividends.') + '</div>';
            return;
        }
        if (rows.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No dividends yet.</div>';
            return;
        }

        let html = '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
            '<th>Company</th><th>Per share</th><th>Tax</th><th>Record date</th><th>Payment date</th>' +
            '<th>Investors</th><th>Gross</th><th>Tax</th><th>Net</th><th>Status</th><th></th>' +
            '</tr></thead><tbody>';

        rows.forEach(function (d) {
            const note = [];
            if (d.first_approver_name) note.push('1st: ' + d.first_approver_name);
            if (d.final_approver_name) note.push('2nd: ' + d.final_approver_name);
            if (d.payment_reference) note.push('Ref: ' + d.payment_reference);

            html += '<tr>' +
                '<td>' + esc(d.company_name) + ' <span class="mono">(' + esc(d.ticker) + ')</span></td>' +
                '<td class="mono">MWK ' + parseFloat(d.amount_per_share).toFixed(4) + '</td>' +
                '<td class="mono">' + parseFloat(d.tax_rate).toFixed(2) + '%</td>' +
                '<td class="mono">' + esc(d.record_date) + '</td>' +
                '<td class="mono">' + esc(d.payment_date) + '</td>' +
                '<td class="mono">' + Number(d.payout_count) + '</td>' +
                '<td class="mono">' + mwk(d.total_gross) + '</td>' +
                '<td class="mono">' + mwk(d.total_tax) + '</td>' +
                '<td class="mono">' + mwk(d.total_net) + '</td>' +
                '<td><span class="status-pill status-' + statusClass[d.status] + '">' + esc(statusLabels[d.status] || d.status) + '</span>' +
                    (note.length ? '<br><span style="font-size:11.5px; color:var(--slate);">' + esc(note.join(' | ')) + '</span>' : '') + '</td>' +
                '<td style="white-space:nowrap;">' + actionsFor(d) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load dividends. Make sure the backend is running.</div>';
    }
}

function actionsFor(d) {
    const id = d.dividend_id;
    const view = d.status !== 'declared' && d.status !== 'cancelled'
        ? ' <button class="btn btn-outline btn-sm" onclick="viewPayouts(' + id + ', \'' + esc(d.company_name).replace(/'/g, '') + '\')">View payouts</button>'
        : '';

    if (isAdmin) {
        let out = '';
        if (d.status === 'declared') {
            if (Number(d.record_date_reached)) {
                out += '<button class="btn btn-primary btn-sm" onclick="calculatePayouts(' + id + ')">Calculate payouts</button> ';
            } else {
                out += '<span style="font-size:12px; color:var(--slate);">Record date not reached</span> ';
            }
        }
        if (d.status === 'declared' || d.status === 'calculated') {
            out += '<button class="btn btn-outline btn-sm" onclick="cancelDividend(' + id + ')">Cancel</button>';
        }
        return out + view;
    }

    // Broker
    let out = '';
    if (d.status === 'calculated') {
        out = '<button class="btn btn-success btn-sm" onclick="firstApprove(' + id + ')">First approve</button>';
    } else if (d.status === 'first_approved') {
        if (d.first_approver_id == currentUser.user_id) {
            out = '<span style="font-size:12px; color:var(--slate);">Awaiting a different approver</span>';
        } else {
            out = '<button class="btn btn-primary btn-sm" onclick="finalApprove(' + id + ')">Final approve</button>';
        }
    } else if (d.status === 'approved') {
        out = '<button class="btn btn-primary btn-sm" onclick="markPaid(' + id + ')">Mark as paid</button>';
    }
    return out + view;
}

async function callDividend(path, method, body, confirmText) {
    if (confirmText && !confirm(confirmText)) return;

    try {
        const res = await fetch(API_BASE + '/dividends/' + path, {
            method: method,
            headers: getAuthHeaders(),
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        showToast(data.message || (res.ok ? 'Done.' : 'Action failed.'), res.ok ? 'success' : 'error');
        if (res.ok) loadDividends();
    } catch (err) {
        showToast('Could not reach the server.', 'error');
    }
}

function calculatePayouts(id) {
    callDividend(id + '/calculate', 'POST', null,
        'Calculate payouts now? Each investor\'s shares will be worked out as at the record date.');
}

function cancelDividend(id) {
    callDividend(id + '/cancel', 'PUT', null, 'Cancel this dividend?');
}

function firstApprove(id) {
    callDividend(id + '/first-approve', 'PUT', null, 'Give first approval to this dividend payout list?');
}

function finalApprove(id) {
    callDividend(id + '/final-approve', 'PUT', null, 'Give final approval to this dividend payout list?');
}

function markPaid(id) {
    const ref = prompt('Enter the bank payment reference. Every investor will be notified that they have been paid:');
    if (ref === null) return;
    if (ref.trim().length < 3) {
        showToast('Please enter the payment reference (at least 3 characters).', 'error');
        return;
    }
    callDividend(id + '/mark-paid', 'PUT', { payment_reference: ref.trim() }, null);
}

async function viewPayouts(id, companyName) {
    const card = document.getElementById('payoutsCard');
    const wrap = document.getElementById('payoutsWrap');
    document.getElementById('payoutsTitle').textContent = 'Payouts - ' + companyName + ' (dividend #' + id + ')';
    card.style.display = 'block';
    wrap.innerHTML = '<div class="empty-state">Loading payouts...</div>';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await fetch(API_BASE + '/dividends/' + id + '/payouts', { headers: getAuthHeaders() });
        const rows = await res.json();

        if (!res.ok || rows.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No payouts.</div>';
            return;
        }

        let html = '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
            '<th>Investor</th><th>Shares on record date</th><th>Gross</th><th>Tax</th><th>Net</th><th>Bank</th><th>Status</th>' +
            '</tr></thead><tbody>';

        rows.forEach(function (p) {
            html += '<tr>' +
                '<td>' + esc(p.investor_name) + '</td>' +
                '<td class="mono">' + Number(p.shares_held).toLocaleString() + '</td>' +
                '<td class="mono">' + mwk(p.gross_amount) + '</td>' +
                '<td class="mono">' + mwk(p.tax_amount) + '</td>' +
                '<td class="mono"><strong>' + mwk(p.net_amount) + '</strong></td>' +
                '<td style="font-size:12.5px;">' + esc(p.bank_name || '-') + '<br><span class="mono">' + esc(p.bank_account_number || '') + '</span></td>' +
                '<td><span class="status-pill status-' + (p.status === 'paid' ? 'verified' : 'pending') + '">' + esc(p.status) + '</span></td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load payouts.</div>';
    }
}