// Buy Shares page: loads companies, calculates a live order preview
// using the same commission/VAT rules as the backend, and submits
// the order with proof of payment attached.

const currentUser = requireRole('investor');
let companiesData = [];
let investorId = null;

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    init();
}

async function init() {
    // Confirm the investor has a verified account before letting them trade.
    try {
 const meRes = await authFetch(API_BASE + '/investors/me', {});
        if (!meRes) return;
        const meData = await meRes.json();

        if (!meRes.ok) {
            showBlocked('You need to open a trading account before you can buy shares. <a href="account.html">Open one now</a>.');
            return;
        }

        investorId = meData.investor_id;

        if (meData.account_status !== 'verified') {
            showBlocked('Your account is currently <strong>' + meData.account_status + '</strong>. You can only trade once your account has been verified by a broker.');
            return;
        }

    } catch (err) {
        showBlocked('Could not check your account status. Make sure the backend is running.');
        return;
    }

    await loadCompanies();
}

function showBlocked(message) {
    const notice = document.getElementById('blockedNotice');
    notice.style.display = 'block';
    notice.innerHTML = message;
    document.getElementById('buyForm').style.display = 'none';
}

async function loadCompanies() {
    try {
        const res = await authFetch(API_BASE + '/companies', {});
        if (!res) return;
        companiesData = await res.json();
        const select = document.getElementById('company_id');
        companiesData.forEach(function (c) {
            const opt = document.createElement('option');
            opt.value = c.company_id;
            opt.textContent = c.company_name + ' (' + c.ticker + ') - MWK ' + parseFloat(c.current_price).toFixed(2);
            select.appendChild(opt);
        });

        // Pre-select company if we arrived here from the Companies page.
        const params = new URLSearchParams(window.location.search);
        const preselect = params.get('company');
        if (preselect) {
            select.value = preselect;
        }

        updateSummary();

    } catch (err) {
        document.getElementById('orderSummary').innerHTML = '<div class="empty-state">Could not load companies.</div>';
    }
}

// Mirrors the backend's tiered commission calculation exactly, so the
// investor sees the correct number before they submit.
function calculateCommission(shareCost) {
    if (shareCost <= 50000) {
        return shareCost * 0.02;
    } else if (shareCost <= 100000) {
        return (50000 * 0.02) + ((shareCost - 50000) * 0.015);
    } else {
        return (50000 * 0.02) + (50000 * 0.015) + ((shareCost - 100000) * 0.01);
    }
}

function updateSummary() {
    const companyId = document.getElementById('company_id').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const summaryEl = document.getElementById('orderSummary');

    if (!companyId || !amount || amount <= 0) {
        summaryEl.innerHTML = '<div class="empty-state">Select a company and enter an amount to see the breakdown.</div>';
        return;
    }

    const company = companiesData.find(function (c) { return c.company_id == companyId; });
    if (!company) return;

    const price = parseFloat(company.current_price);
    const quantity = Math.floor(amount / price);

    if (quantity < 1) {
        summaryEl.innerHTML = '<div class="empty-state">Amount is too low to buy at least 1 share at MWK ' + price.toFixed(2) + '.</div>';
        return;
    }

    const shareCost = quantity * price;
    const commission = calculateCommission(shareCost);
    const vat = commission * 0.175;
    const flatCharge = 50;
    const total = shareCost + commission + vat + flatCharge;

    summaryEl.innerHTML =
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Shares</span><span class="mono">' + quantity.toLocaleString() + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Price per share</span><span class="mono">MWK ' + price.toFixed(2) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Share cost</span><span class="mono">MWK ' + shareCost.toFixed(2) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Commission</span><span class="mono">MWK ' + commission.toFixed(2) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">VAT (17.5%)</span><span class="mono">MWK ' + vat.toFixed(2) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:16px;"><span style="color:var(--slate); font-size:13.5px;">Flat charge</span><span class="mono">MWK 50.00</span></div>' +
        '<div style="display:flex; justify-content:space-between; padding-top:16px; border-top:1px solid var(--border);"><strong>Total</strong><strong class="mono">MWK ' + total.toFixed(2) + '</strong></div>';
}

document.getElementById('company_id').addEventListener('change', updateSummary);
document.getElementById('amount').addEventListener('input', updateSummary);

const buyForm = document.getElementById('buyForm');
buyForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    const btn = document.getElementById('buyBtn');

    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');

    const companyId = document.getElementById('company_id').value;
    const amount = document.getElementById('amount').value;
    const proofFile = document.getElementById('proof_of_payment').files[0];

    if (!companyId || !amount) {
        errorAlert.textContent = 'Please select a company and enter an amount.';
        errorAlert.classList.add('show');
        return;
    }

    if (!proofFile) {
        errorAlert.textContent = 'Please attach proof of payment.';
        errorAlert.classList.add('show');
        return;
    }

    const formData = new FormData();
    formData.append('investor_id', investorId);
    formData.append('company_id', companyId);
    formData.append('amount', amount);
    formData.append('proof_of_payment', proofFile);

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(API_BASE + '/orders/buy', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            errorAlert.textContent = data.message || 'Order failed. Please try again.';
            errorAlert.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Submit buy order';
            return;
        }

        successAlert.textContent = 'Buy order submitted! ' + data.quantity + ' shares, total MWK ' + data.total_amount + '. Awaiting broker approval.';
        successAlert.classList.add('show');
        buyForm.reset();
        updateSummary();
        btn.disabled = false;
        btn.textContent = 'Submit buy order';

    } catch (err) {
        errorAlert.textContent = 'Could not reach the server. Make sure the backend is running.';
        errorAlert.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Submit buy order';
    }
});