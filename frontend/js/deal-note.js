// Deal Note page: reads a transaction_id from the URL, fetches the
// full deal note from the backend, and renders it in a print-friendly card.

const currentUser = requireRole('investor');

if (currentUser) {
    loadDealNote();
}

async function loadDealNote() {
    const card = document.getElementById('dealNoteCard');
    const params = new URLSearchParams(window.location.search);
    const transactionId = params.get('transaction_id');

    if (!transactionId) {
        card.innerHTML = '<div class="empty-state">No deal note specified.</div>';
        return;
    }

    try {
        const res = await fetch(API_BASE + '/orders/deal-note/' + transactionId, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const d = await res.json();

        if (!res.ok) {
            card.innerHTML = '<div class="empty-state">' + (d.message || 'Deal note not found.') + '</div>';
            return;
        }

        const tradeDate = new Date(d.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const settleDate = d.settlement_date ? new Date(d.settlement_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not recorded';

        card.innerHTML =
            '<div style="text-align:center; margin-bottom:24px;">' +
                '<div style="font-weight:700; font-size:18px; color:var(--ink);">' + d.broker + '</div>' +
                '<div style="color:var(--slate); font-size:13px;">Deal Note</div>' +
            '</div>' +
            '<div class="mono" style="text-align:center; background:var(--sky); padding:10px; border-radius:8px; margin-bottom:20px; font-size:14px;">' +
                d.deal_note_number +
            '</div>' +
            '<table style="width:100%; font-size:14px;">' +
                '<tr><td style="padding:8px 0; color:var(--slate);">Investor</td><td style="text-align:right; font-weight:600;">' + d.investor_name + '</td></tr>' +
                '<tr><td style="padding:8px 0; color:var(--slate);">Transaction type</td><td style="text-align:right; font-weight:600; text-transform:uppercase;">' + d.type + '</td></tr>' +
                '<tr><td style="padding:8px 0; color:var(--slate);">Company</td><td style="text-align:right; font-weight:600;">' + d.company_name + ' (' + d.ticker + ')</td></tr>' +
                '<tr><td style="padding:8px 0; color:var(--slate);">Quantity</td><td style="text-align:right;" class="mono">' + Number(d.quantity).toLocaleString() + '</td></tr>' +
                '<tr><td style="padding:8px 0; color:var(--slate);">Price per share</td><td style="text-align:right;" class="mono">MWK ' + parseFloat(d.price).toFixed(2) + '</td></tr>' +
                '<tr><td style="padding:8px 0; color:var(--slate); border-top:1px solid var(--border);">Gross value</td><td style="text-align:right; font-weight:700; border-top:1px solid var(--border);" class="mono">MWK ' + Number(d.gross_value).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td></tr>' +
                '<tr><td style="padding:8px 0; color:var(--slate);">Trade date</td><td style="text-align:right;">' + tradeDate + '</td></tr>' +
                '<tr><td style="padding:8px 0; color:var(--slate);">Settlement date (T+3)</td><td style="text-align:right;">' + settleDate + '</td></tr>' +
            '</table>' +
            '<p style="font-size:11.5px; color:var(--slate); margin-top:24px; text-align:center;">This deal note confirms execution of the above transaction by Stockbrokers Malawi Limited.</p>';

    } catch (err) {
        card.innerHTML = '<div class="empty-state">Could not load deal note.</div>';
    }
}