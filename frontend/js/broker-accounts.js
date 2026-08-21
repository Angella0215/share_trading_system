// Account Applications page: lists pending investor KYC applications
// as cards, with document links and approve/reject actions.

const currentUser = requireRole('broker');

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadApplications();
}

async function loadApplications() {
    const wrap = document.getElementById('applicationsWrap');

    try {
        const res = await fetch(API_BASE + '/investors/pending', { headers: getAuthHeaders() });
        const applications = await res.json();

        if (!res.ok || applications.length === 0) {
            wrap.innerHTML = '<div class="empty-state">No pending applications right now.</div>';
            return;
        }

        renderApplications(applications);

    } catch (err) {
        wrap.innerHTML = '<div class="empty-state">Could not load applications. Make sure the backend is running.</div>';
    }
}

function fileUrl(path) {
    if (!path) return null;
    // Stored paths look like "uploads\1234-5678.pdf" - convert to a URL.
    const filename = path.replace(/\\/g, '/').split('/').pop();
    return 'http://localhost:5000/uploads/' + filename;
}

function renderApplications(applications) {
    const wrap = document.getElementById('applicationsWrap');

    let html = '';

    applications.forEach(function (a) {
        html += '<div class="card" style="margin-bottom:20px;">' +
            '<div class="card-header">' +
                '<div class="card-title">' + a.firstname + ' ' + a.surname + '</div>' +
                '<span class="status-pill status-pending">Pending</span>' +
            '</div>' +

            '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px; font-size:14px;">' +
                '<div><strong>Email:</strong> ' + a.email + '</div>' +
                '<div><strong>Phone:</strong> ' + a.phone_number + '</div>' +
                '<div><strong>National ID:</strong> ' + a.national_id_number + '</div>' +
                '<div><strong>Gender:</strong> ' + (a.gender || '-') + '</div>' +
                '<div><strong>Physical address:</strong> ' + (a.physical_address || '-') + '</div>' +
                '<div><strong>Employment:</strong> ' + (a.employment_status || '-') + '</div>' +
                '<div><strong>Bank:</strong> ' + (a.bank_name || '-') + ' (' + (a.bank_account_number || '-') + ')</div>' +
                '<div><strong>Meter/Bill number:</strong> ' + (a.meter_number || '-') + '</div>' +
            '</div>' +

            '<div style="display:flex; gap:10px; margin-bottom:16px;">' +
                (fileUrl(a.utility_receipt_path) ? '<a href="' + fileUrl(a.utility_receipt_path) + '" target="_blank" class="btn btn-outline btn-sm">View utility receipt</a>' : '') +
                (fileUrl(a.bank_statement_path) ? '<a href="' + fileUrl(a.bank_statement_path) + '" target="_blank" class="btn btn-outline btn-sm">View bank statement</a>' : '') +
                (fileUrl(a.id_document_path) ? '<a href="' + fileUrl(a.id_document_path) + '" target="_blank" class="btn btn-outline btn-sm">View ID document</a>' : '') +
            '</div>' +

            '<div class="hint" style="margin-bottom:12px;">Check that the meter/bill number above matches the number shown on the uploaded utility receipt before approving.</div>' +

            '<div style="display:flex; gap:10px;">' +
                '<button class="btn btn-success" onclick="decide(' + a.investor_id + ', \'approve\')">Approve</button>' +
                '<button class="btn btn-danger" onclick="decide(' + a.investor_id + ', \'reject\')">Reject</button>' +
            '</div>' +
        '</div>';
    });

    wrap.innerHTML = html;
}

async function decide(investorId, action) {
    const successAlert = document.getElementById('successAlert');

    try {
        const res = await fetch(API_BASE + '/investors/' + investorId + '/' + action, {
            method: 'PUT',
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (res.ok) {
            successAlert.textContent = data.message;
            successAlert.classList.add('show');
            loadApplications();
        } else {
            alert(data.message || 'Action failed.');
        }

    } catch (err) {
        alert('Could not reach the server.');
    }
}