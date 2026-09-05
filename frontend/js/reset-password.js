// Reset Password page: reads the reset token from the URL and
// submits the new password to the backend.

const resetForm = document.getElementById('resetForm');
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

resetForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    const btn = document.getElementById('submitBtn');

    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');

    if (!token) {
        errorAlert.textContent = 'This reset link is missing its token. Please request a new one.';
        errorAlert.classList.add('show');
        return;
    }

    if (!newPassword || newPassword.length < 6) {
        errorAlert.textContent = 'Password must be at least 6 characters.';
        errorAlert.classList.add('show');
        return;
    }

    if (newPassword !== confirmPassword) {
        errorAlert.textContent = 'Passwords do not match.';
        errorAlert.classList.add('show');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Resetting...';

    try {
        const res = await fetch(API_BASE + '/confirm-password-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, new_password: newPassword })
        });

        const data = await res.json();

        if (!res.ok) {
            errorAlert.textContent = data.message || 'Reset failed. Please try again.';
            errorAlert.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Reset password';
            return;
        }

        successAlert.textContent = data.message + ' Redirecting to login...';
        successAlert.classList.add('show');

        setTimeout(function () {
            window.location.href = 'index.html';
        }, 1800);

    } catch (err) {
        errorAlert.textContent = 'Could not reach the server. Make sure the backend is running.';
        errorAlert.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Reset password';
    }
});