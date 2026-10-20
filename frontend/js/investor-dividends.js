// Investor Dividends page: shows approved and paid dividend payouts.

const currentUser = requireRole('investor');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadMyDividends();
}

function esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function mwk(value) {
    return 'MWK ' + parseFloat(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadMyDividends() {
    const wrap = document.getElementById('myDividendsWrap');

    try {
        const res = await authFetch(API_BASE + '/dividends/my', {});
        if (!res) return;
        const rows = await res.json();

        if (!res.ok) {
            wrap.innerHTML = '<div class="empty-state">' + esc(rows.message || 'Could not load your dividends.') + '</div>';
            return;
        }

        let paidTotal = 0;
        let upcomingTotal = 0;
        rows.forEach(function (r) {
            if (r.dividend_status === 'paid') paidTotal += parseFloat(r.net_amount);
            else upcomingTotal += parseFloat(r.net_amount);
        });

        document.getElementById('paidTotal').textContent = mwk(paidTotal);
        document.getElementById('upcomingTotal').textContent = mwk(upcomingTotal);

        if (rows.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No dividends yet. When a company you hold shares in pays a dividend, it will appear here.</div>';
            return;
        }

        let html = '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
            '<th>Company</th><th>Record date</th><th>Payment date</th><th>Shares held</th><th>Per share</th>' +
            '<th>Gross</th><th>Tax</th><th>Net</th><th>Status</th><th>Reference</th>' +
            '</tr></thead><tbody>';

        rows.forEach(function (r) {
            const paid = r.dividend_status === 'paid';
            html += '<tr>' +
                '<td>' + esc(r.company_name) + ' <span class="mono">(' + esc(r.ticker) + ')</span></td>' +
                '<td class="mono">' + esc(r.record_date) + '</td>' +
                '<td class="mono">' + esc(r.payment_date) + '</td>' +
                '<td class="mono">' + Number(r.shares_held).toLocaleString() + '</td>' +
                '<td class="mono">MWK ' + parseFloat(r.amount_per_share).toFixed(4) + '</td>' +
                '<td class="mono">' + mwk(r.gross_amount) + '</td>' +
                '<td class="mono">' + mwk(r.tax_amount) + ' <span style="color:var(--slate); font-size:11.5px;">(' + parseFloat(r.tax_rate).toFixed(2) + '%)</span></td>' +
                '<td class="mono"><strong>' + mwk(r.net_amount) + '</strong></td>' +
                '<td><span class="status-pill status-' + (paid ? 'verified' : 'pending') + '">' + (paid ? 'Paid' : 'Approved - payment coming') + '</span></td>' +
                '<td class="mono" style="font-size:12px;">' + esc(r.payment_reference || '-') + '</td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load your dividends. Make sure the backend is running.</div>';
    }
}