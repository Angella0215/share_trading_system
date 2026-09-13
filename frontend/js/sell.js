// Sell Shares page: loads the investor's own portfolio (not all
// companies - only ones they hold), validates quantity against what
// they own, and shows a live net-proceeds breakdown.

const currentUser = requireRole('investor');
let portfolioData = [];
let investorId = null;

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    init();
}

async function init() {
       try {
        const meRes = await authFetch(API_BASE + '/investors/me', {});
        if (!meRes) return;
        const meData = await meRes.json();

        if (!meRes.ok) {
            showBlocked('You need to open a trading account before you can sell shares. <a href="account.html">Open one now</a>.');
            return;
        }

        investorId = meData.investor_id;

        if (meData.account_status !== 'verified') {
            showBlocked('Your account is currently <strong>' + meData.account_status + '</strong>. You can only trade once your account has been verified by a broker.');
            return;
        }

        portfolioData = meData.portfolio;

        if (portfolioData.length === 0) {
            showBlocked('You do not own any shares yet. <a href="buy.html">Buy your first shares</a> before you can sell.');
            return;
        }

        loadCompanyOptions();

    } catch (err) {
        showBlocked('Could not check your account status. Make sure the backend is running.');
    }
}

function showBlocked(message) {
    const notice = document.getElementById('blockedNotice');
    notice.style.display = 'block';
    notice.innerHTML = message;
    document.getElementById('sellForm').style.display = 'none';
}

function loadCompanyOptions() {
    const select = document.getElementById('company_id');
    portfolioData.forEach(function (p) {
        const opt = document.createElement('option');
        opt.value = p.company_id;
        opt.textContent = p.company_name + ' (' + p.ticker + ') - ' + p.shares_owned + ' shares owned';
        select.appendChild(opt);
    });

    const params = new URLSearchParams(window.location.search);
    const preselect = params.get('company');
    if (preselect) {
        select.value = preselect;
        updateOwnedHint();
    }
}

function updateOwnedHint() {
    const companyId = document.getElementById('company_id').value;
    const hint = document.getElementById('ownedHint');

    if (!companyId) {
        hint.textContent = '';
        return;
    }

    const holding = portfolioData.find(function (p) { return p.company_id == companyId; });
    if (holding) {
        hint.textContent = 'You own ' + holding.shares_owned + ' shares of ' + holding.ticker + '.';
    }
}

function calculateCommission(shareValue) {
    if (shareValue <= 50000) {
        return shareValue * 0.02;
    } else if (shareValue <= 100000) {
        return (50000 * 0.02) + ((shareValue - 50000) * 0.015);
    } else {
        return (50000 * 0.02) + (50000 * 0.015) + ((shareValue - 100000) * 0.01);
    }
}

function updateSummary() {
    const companyId = document.getElementById('company_id').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const summaryEl = document.getElementById('orderSummary');

    if (!companyId || !quantity || quantity <= 0) {
        summaryEl.innerHTML = '<div class="empty-state">Select a company and enter a quantity to see the breakdown.</div>';
        return;
    }

    const holding = portfolioData.find(function (p) { return p.company_id == companyId; });
    if (!holding) return;

    if (quantity > holding.shares_owned) {
        summaryEl.innerHTML = '<div class="empty-state" style="color:var(--red);">You only own ' + holding.shares_owned + ' shares. Reduce the quantity.</div>';
        return;
    }

    const price = parseFloat(holding.current_price);
    const shareValue = quantity * price;
    const commission = calculateCommission(shareValue);
    const vat = commission * 0.175;
    const flatCharge = 50;
    const youReceive = shareValue - commission - vat - flatCharge;

    summaryEl.innerHTML =
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Shares to sell</span><span class="mono">' + quantity.toLocaleString() + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Price per share</span><span class="mono">MWK ' + price.toFixed(2) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Share value</span><span class="mono">MWK ' + shareValue.toFixed(2) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">Commission</span><span class="mono">-MWK ' + commission.toFixed(2) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:var(--slate); font-size:13.5px;">VAT (17.5%)</span><span class="mono">-MWK ' + vat.toFixed(2) + '</span></div>' +
                '<div style="display:flex; justify-content:space-between; margin-bottom:16px;"><span style="color:var(--slate); font-size:13.5px;">Flat charge</span><span class="mono">-MWK 50.00</span></div>' +
        '<div style="display:flex; justify-content:space-between; padding-top:16px; border-top:1px solid var(--border);"><strong>You receive</strong><strong class="mono" style="color:var(--green);">MWK ' + youReceive.toFixed(2) + '</strong></div>';
}

document.getElementById('company_id').addEventListener('change', function () {
    updateOwnedHint();
    updateSummary();
});
document.getElementById('quantity').addEventListener('input', updateSummary);

const sellForm = document.getElementById('sellForm');
sellForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    const btn = document.getElementById('sellBtn');

    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');

    const companyId = document.getElementById('company_id').value;
    const quantity = document.getElementById('quantity').value;

    if (!companyId || !quantity) {
        errorAlert.textContent = 'Please select a company and enter a quantity.';
        errorAlert.classList.add('show');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

       try {
        const res = await authFetch(API_BASE + '/orders/sell', {
            method: 'POST',
            body: JSON.stringify({
                investor_id: investorId,
                company_id: parseInt(companyId),
                quantity: parseInt(quantity)
            })
        });

        if (!res) return;

        const data = await res.json();      

        if (!res.ok) {
            errorAlert.textContent = data.message || 'Order failed. Please try again.';
            errorAlert.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Submit sell order';
            return;
        }
        successAlert.textContent = 'Sell order submitted! ' + data.quantity + ' shares, you will receive MWK ' + data.you_will_receive + '. Awaiting broker approval.';
        successAlert.classList.add('show');
        showToast('Sell order submitted successfully!', 'success');
        sellForm.reset();
        document.getElementById('orderSummary').innerHTML = '<div class="empty-state">Select a company and enter a quantity to see the breakdown.</div>';
        btn.disabled = false;
        btn.textContent = 'Submit sell order';

    } catch (err) {
        errorAlert.textContent = 'Could not reach the server. Make sure the backend is running.';
        errorAlert.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Submit sell order';
    }
});