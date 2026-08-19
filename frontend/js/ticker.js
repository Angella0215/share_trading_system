let tickerInterval = null;
let previousPrices = {};

async function loadTicker() {
    const el = document.getElementById('ticker');
    if (!el) return;

    try {
        const res = await fetch(`${API_BASE}/companies`);
        if (!res.ok) throw new Error('Failed to load companies');
        const companies = await res.json();

        companies.forEach(c => {
            if (!previousPrices[c.company_id]) {
                previousPrices[c.company_id] = parseFloat(c.current_price);
            }
        });

        const doubled = companies.concat(companies);

        el.innerHTML = doubled.map(c => {
            const price = parseFloat(c.current_price).toFixed(2);
            const prevPrice = previousPrices[c.company_id] || price;
            const change = price - prevPrice;
            const changeClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
            
            previousPrices[c.company_id] = parseFloat(price);
            
            return `<span class="ticker-item">
                        <span class="name">${c.ticker}</span>
                        <span class="price">MK ${price}</span>
                        <span class="change ${changeClass}">${change > 0 ? '▲' : (change < 0 ? '▼' : '')} ${Math.abs(change).toFixed(2)}</span>
                    </span>`;
        }).join('');

        updateMarketSnapshot(companies);

    } catch (err) {
        console.error('Ticker error:', err);
        el.innerHTML = '<span class="ticker-item"><span class="name">MSE Market Data Loading...</span></span>';
    }
}

function updateMarketSnapshot(companies) {
    const snapshotEl = document.getElementById('marketSnapshot');
    if (!snapshotEl) return;

    const sorted = [...companies].sort((a, b) => parseFloat(b.current_price) - parseFloat(a.current_price));
    const top5 = sorted.slice(0, 5);
    const totalMarketCap = companies.reduce((sum, c) => sum + parseFloat(c.market_cap || 0), 0);
    const avgPrice = companies.reduce((sum, c) => sum + parseFloat(c.current_price), 0) / companies.length;

    let html = `
        <div class="snapshot-stats">
            <div class="snapshot-stat">
                <span class="snapshot-label">Companies</span>
                <span class="snapshot-value">${companies.length}</span>
            </div>
            <div class="snapshot-stat">
                <span class="snapshot-label">Avg Price</span>
                <span class="snapshot-value">MK ${avgPrice.toFixed(2)}</span>
            </div>
            <div class="snapshot-stat">
                <span class="snapshot-label">Market Cap</span>
                <span class="snapshot-value">MK ${(totalMarketCap / 1000000000).toFixed(1)}B</span>
            </div>
        </div>
        <div class="snapshot-companies">
            ${top5.map(c => `
                <div class="snapshot-company">
                    <span class="snapshot-ticker">${c.ticker}</span>
                    <span class="snapshot-price">MK ${parseFloat(c.current_price).toFixed(2)}</span>
                </div>
            `).join('')}
        </div>
    `;

    snapshotEl.innerHTML = html;
}

function startTickerAutoRefresh() {
    if (tickerInterval) {
        clearInterval(tickerInterval);
    }
    tickerInterval = setInterval(loadTicker, 30000);
}

loadTicker();
startTickerAutoRefresh();

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (tickerInterval) {
            clearInterval(tickerInterval);
            tickerInterval = null;
        }
    } else {
        loadTicker();
        startTickerAutoRefresh();
    }
});