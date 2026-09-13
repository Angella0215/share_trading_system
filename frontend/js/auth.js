const loginForm = document.getElementById('loginForm');
const sessionExpiredMessage = localStorage.getItem('sessionExpiredMessage');
if (sessionExpiredMessage) {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
        errorAlert.textContent = sessionExpiredMessage;
        errorAlert.classList.add('show');
    }
    localStorage.removeItem('sessionExpiredMessage');
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailField = document.getElementById('emailField');
        const passwordField = document.getElementById('passwordField');
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;
        const errorAlert = document.getElementById('errorAlert');
        const btn = document.getElementById('loginBtn');

        emailField.classList.remove('has-error');
        passwordField.classList.remove('has-error');
        errorAlert.classList.remove('show');
        errorAlert.style.display = 'none';

        let valid = true;
        if (!email || !email.includes('@')) {
            emailField.classList.add('has-error');
            valid = false;
        }
        if (!password || password.length < 1) {
            passwordField.classList.add('has-error');
            valid = false;
        }
        if (!valid) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                errorAlert.textContent = data.message || 'Login failed. Please check your credentials.';
                errorAlert.style.display = 'block';
                errorAlert.classList.add('show');
                btn.disabled = false;
                btn.innerHTML = 'Log in';
                return;
            }

            if (data.token && data.user) {
                setToken(data.token);
                setCurrentUser(data.user);

                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                } else {
                    localStorage.removeItem('rememberMe');
                }

                const role = data.user.role;
                const dashboardMap = {
                    'investor': 'investor/dashboard.html',
                    'broker': 'broker/dashboard.html',
                    'admin': 'admin/dashboard.html'
                };
                window.location.href = dashboardMap[role] || 'index.html';
            }

        } catch (err) {
            console.error('Login error:', err);
            errorAlert.textContent = 'Could not reach the server. Please make sure the backend is running on port 5000.';
            errorAlert.style.display = 'block';
            errorAlert.classList.add('show');
            btn.disabled = false;
            btn.innerHTML = 'Log in';
        }
    });

    const rememberMe = localStorage.getItem('rememberMe');
    if (rememberMe === 'true') {
        const emailInput = document.getElementById('email');
        const savedEmail = localStorage.getItem('savedEmail');
        if (emailInput && savedEmail) {
            emailInput.value = savedEmail;
        }
        const rememberCheckbox = document.getElementById('rememberMe');
        if (rememberCheckbox) {
            rememberCheckbox.checked = true;
        }
    }

    document.getElementById('email')?.addEventListener('change', function() {
        if (document.getElementById('rememberMe')?.checked) {
            localStorage.setItem('savedEmail', this.value);
        }
    });

    document.getElementById('rememberMe')?.addEventListener('change', function() {
        if (this.checked) {
            const email = document.getElementById('email')?.value;
            if (email) {
                localStorage.setItem('savedEmail', email);
            }
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('savedEmail');
            localStorage.removeItem('rememberMe');
        }
    });
}

async function handleGoogleLogin(response) {
    try {
        const res = await fetch(API_BASE + '/google-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || 'Google sign-in failed.');
            return;
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.role === 'investor') {
            window.location.href = 'investor/dashboard.html';
        } else if (data.user.role === 'broker') {
            window.location.href = 'broker/dashboard.html';
        } else if (data.user.role === 'admin') {
            window.location.href = 'admin/dashboard.html';
        }

    } catch (err) {
        alert('Could not reach the server. Make sure the backend is running.');
    }
}