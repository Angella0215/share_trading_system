// Handles the registration form: validates input, calls the backend,
// and redirects to login on success.

const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    const btn = document.getElementById('registerBtn');

    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');

    if (!fullname || !email || !phone || !password) {
      errorAlert.textContent = 'Please fill in all fields.';
      errorAlert.classList.add('show');
      return;
    }

    if (password !== confirmPassword) {
      errorAlert.textContent = 'Passwords do not match.';
      errorAlert.classList.add('show');
      return;
    }

    if (password.length < 6) {
      errorAlert.textContent = 'Password must be at least 6 characters.';
      errorAlert.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const res = await fetch(API_BASE + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname: fullname,
          email: email,
          phone: phone,
          password: password,
          role: 'investor'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        errorAlert.textContent = data.message || 'Registration failed. Please try again.';
        errorAlert.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Create account';
        return;
      }

      successAlert.textContent = 'Account created! Redirecting to login...';
      successAlert.classList.add('show');

      setTimeout(function () {
        window.location.href = 'index.html';
      }, 1500);

    } catch (err) {
      errorAlert.textContent = 'Could not reach the server. Make sure the backend is running.';
      errorAlert.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}