// Forgot Password page: sends a reset request to the backend.

const forgotForm = document.getElementById('forgotForm');

forgotForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    const btn = document.getElementById('submitBtn');

    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');

    if (!email) {
        errorAlert.textContent = 'Please enter your email address.';
        errorAlert.classList.add('show');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const res = await fetch(API_BASE + '/request-password-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const data = await res.json();

        successAlert.textContent = data.message;
        successAlert.classList.add('show');
        forgotForm.reset();

    } catch (err) {
        errorAlert.textContent = 'Could not reach the server. Make sure the backend is running.';
        errorAlert.classList.add('show');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send reset link';
    }
});