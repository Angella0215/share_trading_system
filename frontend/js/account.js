// Handles the account-opening form: conditional fields, file uploads,
// and submission to the backend.

const currentUser = requireRole('investor');
let currentUserId = null;

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    currentUserId = currentUser.user_id;
    checkExistingAccount();
}

// Show/hide employment sub-sections based on selection.
const employmentSelect = document.getElementById('employment_status');
employmentSelect.addEventListener('change', function () {
    document.getElementById('employedFields').style.display = this.value === 'employed' ? 'block' : 'none';
    document.getElementById('selfEmployedFields').style.display = this.value === 'self_employed' ? 'block' : 'none';
    document.getElementById('notEmployedFields').style.display = this.value === 'not_employed' ? 'block' : 'none';
});

// Show residential permit field only for foreign investors.
const foreignLocalSelect = document.getElementById('foreign_local');
foreignLocalSelect.addEventListener('change', function () {
    document.getElementById('permitField').style.display = this.value === 'foreign' ? 'block' : 'none';
});

// If the investor already has an account application, show its status
// instead of letting them submit a duplicate one.
async function checkExistingAccount() {
    try {
        const res = await fetch(API_BASE + '/investors/me', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            const data = await res.json();

            const pill = document.getElementById('accountStatusPill');
            pill.style.display = 'inline-flex';
            pill.textContent = data.account_status.charAt(0).toUpperCase() + data.account_status.slice(1);
            pill.className = 'status-pill status-' + data.account_status;

            const notice = document.getElementById('alreadySubmittedNotice');
            notice.style.display = 'block';
            notice.innerHTML = '<strong>You have already submitted an account application.</strong> ' +
                'Its current status is <strong>' + data.account_status + '</strong>. ' +
                'You do not need to submit this form again.';

            document.getElementById('accountForm').style.display = 'none';
        }
        // If res is not ok (404), that means no application exists yet -
        // leave the form visible so they can submit one.
    } catch (err) {
        // Silently ignore - form stays visible as the default state.
    }
}

const accountForm = document.getElementById('accountForm');

accountForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    const btn = document.getElementById('submitBtn');

    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');

    // Basic required-field check before we even try uploading files.
    const required = ['firstname', 'surname', 'gender', 'phone_number', 'physical_address',
        'national_id_number', 'meter_number', 'next_of_kin_name', 'next_of_kin_phone',
        'employment_status', 'bank_name', 'bank_account_number', 'proof_of_residence_type'];

    for (const fieldId of required) {
        const el = document.getElementById(fieldId);
        if (!el.value) {
            errorAlert.textContent = 'Please fill in all required fields (marked with *).';
            errorAlert.classList.add('show');
            el.focus();
            return;
        }
    }

    const utilityFile = document.getElementById('utility_receipt').files[0];
    const bankFile = document.getElementById('bank_statement').files[0];
    const idFile = document.getElementById('id_document').files[0];

    if (!utilityFile || !bankFile || !idFile) {
        errorAlert.textContent = 'Please attach all three required documents.';
        errorAlert.classList.add('show');
        return;
    }

    // Build the multipart form data - text fields plus files together.
    const formData = new FormData();
    formData.append('user_id', currentUserId);

    const textFields = ['firstname', 'surname', 'other_names', 'date_of_birth', 'marital_status',
        'spouse_full_name', 'gender', 'phone_number', 'physical_address', 'postal_address',
        'house_number', 'home_village', 'ta', 'district', 'directions', 'national_id_number',
        'id_expiry_date', 'nationality', 'foreign_local', 'residential_permit_type', 'meter_number',
        'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_email', 'next_of_kin_relationship',
        'employment_status', 'employer_name', 'designation', 'employer_address',
        'years_self_employed', 'business_type', 'source_of_income', 'expected_monthly_income',
        'bank_name', 'bank_branch', 'bank_account_type', 'bank_account_number',
        'proof_of_residence_type', 'account_type'];

    textFields.forEach(function (name) {
        const el = document.getElementById(name);
        if (el && el.value) {
            formData.append(name, el.value);
        }
    });

    formData.append('utility_receipt', utilityFile);
    formData.append('bank_statement', bankFile);
    formData.append('id_document', idFile);

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        const token = localStorage.getItem('token');

        const res = await fetch(API_BASE + '/investors/open-account', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
                // Note: no Content-Type here - the browser sets the correct
                // multipart boundary automatically when sending FormData.
            },
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            errorAlert.textContent = data.message || 'Submission failed. Please check your details.';
            errorAlert.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Submit application';
            return;
        }

        successAlert.textContent = 'Application submitted! Redirecting to your dashboard...';
        successAlert.classList.add('show');

        setTimeout(function () {
            window.location.href = 'dashboard.html';
        }, 1800);

    } catch (err) {
        errorAlert.textContent = 'Could not reach the server. Make sure the backend is running.';
        errorAlert.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Submit application';
    }
});