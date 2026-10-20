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
            const avail = Number(c.available_shares) || 0;
            const opt = document.createElement('option');
            opt.value = c.company_id;
            opt.textContent = c.company_name + ' (' + c.ticker + ') - MWK ' +
                parseFloat(c.current_price).toFixed(2) + ' - ' +
                (avail > 0 ? avail.toLocaleString() + ' available' : 'Sold out');
            opt.disabled = avail <= 0;
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

function updateSummary() {
    document.getElementById('orderSummary').innerHTML =
        '<ol style="padding-left:18px; font-size:13.5px; color:var(--slate); line-height:1.8;">' +
        '<li>Transfer the amount you want to invest to the SML account shown on this page.</li>' +
        '<li>Upload your proof of payment and submit your order.</li>' +
        '<li>Our staff verify your payment and your account.</li>' +
        '<li>When your order receives final approval, the share price on that day is used to work out your number of shares. Commission, VAT and the K50 flat charge are taken from your deposit.</li>' +
        '<li>Your shares, price and fees then appear in Order History and on your Deal Note.</li>' +
        '</ol>';
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
        successAlert.textContent = 'Buy order submitted! Your deposit of MWK ' + data.amount_deposited + ' is awaiting approval. Your shares, price and fees will be confirmed when the order is approved.';
        successAlert.classList.add('show');
        successAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Buy order submitted successfully! Your order is now in the queue and awaiting broker approval.', 'success', 60000);
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