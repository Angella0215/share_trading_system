// Messages page: lets an investor pick a broker and chat with them,
// using the existing send/conversation endpoints.

const currentUser = requireRole('investor');
let selectedBrokerId = null;
let pollInterval = null;

if (currentUser) {
    document.getElementById('userName').textContent = currentUser.fullname;
    document.getElementById('userAvatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
    loadBrokers();
}

async function loadBrokers() {
    try {
        const res = await fetch(API_BASE + '/brokers', { headers: getAuthHeaders() });
        const brokers = await res.json();

        const select = document.getElementById('broker_id');
        brokers.forEach(function (b) {
            const opt = document.createElement('option');
            opt.value = b.user_id;
            opt.textContent = b.fullname;
            select.appendChild(opt);
        });

    } catch (err) {
        document.getElementById('chatThread').innerHTML = '<div class="empty-state">Could not load brokers.</div>';
    }
}

document.getElementById('broker_id').addEventListener('change', function () {
    selectedBrokerId = this.value;

    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }

    if (selectedBrokerId) {
        loadConversation();
        // Refresh every 5 seconds so replies show up without a manual reload.
        pollInterval = setInterval(loadConversation, 5000);
    } else {
        document.getElementById('chatThread').innerHTML = '<div class="empty-state">Select a broker to view your conversation.</div>';
    }
});

async function loadConversation() {
    if (!selectedBrokerId) return;

    try {
        const res = await fetch(API_BASE + '/messages/' + selectedBrokerId, { headers: getAuthHeaders() });
        const messages = await res.json();

        const thread = document.getElementById('chatThread');

        if (messages.length === 0) {
            thread.innerHTML = '<div class="empty-state">No messages yet. Say hello!</div>';
            return;
        }

        let html = '';
        messages.forEach(function (m) {
            const isMine = m.sender == currentUser.user_id;
            const time = new Date(m.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

            html += '<div style="margin-bottom:14px; display:flex; flex-direction:column; align-items:' + (isMine ? 'flex-end' : 'flex-start') + ';">' +
                '<div style="background:' + (isMine ? 'var(--brand)' : 'var(--white)') + '; color:' + (isMine ? '#fff' : 'var(--ink)') + '; padding:10px 14px; border-radius:12px; max-width:75%; font-size:14px; border:1px solid ' + (isMine ? 'var(--brand)' : 'var(--border)') + ';">' +
                m.message +
                '</div>' +
                '<div style="font-size:11px; color:var(--slate); margin-top:4px;">' + (isMine ? 'You' : m.sender_name) + ' &middot; ' + time + '</div>' +
                '</div>';
        });

        thread.innerHTML = html;
        thread.scrollTop = thread.scrollHeight;

    } catch (err) {
        // Silently skip a failed poll - next interval will retry.
    }
}

const messageForm = document.getElementById('messageForm');
messageForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!selectedBrokerId) {
        alert('Please select a broker first.');
        return;
    }

    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;

    try {
        const res = await fetch(API_BASE + '/messages', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ receiver: selectedBrokerId, message: text })
        });

        if (res.ok) {
            input.value = '';
            loadConversation();
        }

    } catch (err) {
        // If sending fails, leave the text in the box so they can retry.
    }
});