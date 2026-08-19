const API_BASE = 'http://localhost:5000/api';

const API_ENDPOINTS = {
       auth: {
        register: `${API_BASE}/register`,
        login: `${API_BASE}/login`,
    },

    companies: {
        list: `${API_BASE}/companies`,
        history: (id) => `${API_BASE}/companies/${id}/history`,
        updatePrice: (id) => `${API_BASE}/companies/${id}/update-price`,
    },
    investors: {
        openAccount: `${API_BASE}/investors/open-account`,
        pending: `${API_BASE}/investors/pending`,
        approve: (id) => `${API_BASE}/investors/${id}/approve`,
        reject: (id) => `${API_BASE}/investors/${id}/reject`,
    },
    orders: {
        buy: `${API_BASE}/orders/buy`,
        buyApprove: (id) => `${API_BASE}/orders/buy/${id}/approve`,
        sell: `${API_BASE}/orders/sell`,
        sellApprove: (id) => `${API_BASE}/orders/sell/${id}/approve`,
    },
    messages: {
        send: `${API_BASE}/messages`,
        conversation: (userId) => `${API_BASE}/messages/${userId}`,
    }
};

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    if (options.body && options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch(endpoint, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function setCurrentUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function isAuthenticated() {
    return !!getToken();
}

function hasRole(role) {
    const user = getCurrentUser();
    return user && user.role === role;
}