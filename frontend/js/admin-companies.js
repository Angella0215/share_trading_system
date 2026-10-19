// Companies page: lists all companies with an inline price-update
// form and an available-shares form for each row (admin only).

const currentUser = requireRole('admin');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadCompanies();
}

const inputStyle = 'padding:8px 10px; border:1.5px solid var(--border); border-radius:8px;';

async function loadCompanies() {
    const wrap = document.getElementById('companiesTableWrap');

    try {
        const res = await fetch(API_BASE + '/companies', { headers: getAuthHeaders() });
        const companies = await res.json();

        if (!res.ok || companies.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No companies found.</div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>' +
            '<th>Company</th><th>Ticker</th><th>Sector</th><th>Current price</th>' +
            '<th>New price</th><th>Volume traded</th><th></th>' +
            '<th>Available shares</th><th></th>' +
            '</tr></thead><tbody>';

        companies.forEach(function (c) {
            html += '<tr>' +
                '<td>' + c.company_name + '</td>' +
                '<td class="mono">' + c.ticker + '</td>' +
                '<td>' + (c.sector || '-') + '</td>' +
                '<td class="mono">MWK ' + parseFloat(c.current_price).toFixed(2) + '</td>' +
                '<td><input type="number" step="0.01" min="0" id="price-' + c.company_id + '" style="width:100px; ' + inputStyle + '" placeholder="0.00"></td>' +
                '<td><input type="number" min="0" id="volume-' + c.company_id + '" style="width:100px; ' + inputStyle + '" placeholder="0"></td>' +
                '<td><button class="btn btn-primary btn-sm" onclick="updatePrice(' + c.company_id + ')">Update</button></td>' +
                '<td><input type="number" min="0" step="1" id="avail-' + c.company_id + '" value="' + (Number(c.available_shares) || 0) + '" style="width:120px; ' + inputStyle + '"></td>' +
                '<td><button class="btn btn-outline btn-sm" onclick="updateAvailableShares(' + c.company_id + ')">Save</button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load companies. Make sure the backend is running.</div>';
    }
}

async function updatePrice(companyId) {
    const priceInput = document.getElementById('price-' + companyId);
    const volumeInput = document.getElementById('volume-' + companyId);
    const successAlert = document.getElementById('successAlert');

    const price = priceInput.value;
    const volume = volumeInput.value || 0;

    if (!price) {
        alert('Please enter a new price.');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/companies/' + companyId + '/update-price', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ price: parseFloat(price), volume_traded: parseInt(volume) })
        });

        const data = await res.json();

        if (res.ok) {
            successAlert.textContent = data.message + ' New price: MWK ' + data.new_price;
            successAlert.classList.add('show');
            loadCompanies();
        } else {
            alert(data.message || 'Update failed.');
        }

    } catch (err) {
        alert('Could not reach the server.');
    }
}

async function updateAvailableShares(companyId) {
    const qty = parseInt(document.getElementById('avail-' + companyId).value, 10);
    const successAlert = document.getElementById('successAlert');

    if (isNaN(qty) || qty < 0) {
        alert('Please enter a whole number of 0 or more.');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/companies/' + companyId + '/available-shares', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ available_shares: qty })
        });

        const data = await res.json();

        if (res.ok) {
            successAlert.textContent = data.message + ' Now ' + data.available_shares.toLocaleString() + ' available.';
            successAlert.classList.add('show');
            loadCompanies();
        } else {
            alert(data.message || 'Update failed.');
        }

    } catch (err) {
        alert('Could not reach the server.');
    }
}