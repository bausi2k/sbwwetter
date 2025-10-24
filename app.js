// --- 1. Konfiguration ---
const HIVE_MQ_HOST = 'bb23c26981ce486a9de6a8d83cff9f90.s1.eu.hivemq.cloud';
const HIVE_MQ_PORT = 8884;
const HIVE_MQ_USER = 'sbwwetter';
const HIVE_MQ_PASS = 'pbd7chu6kba!zrd2GTG';

// --- Flexible Topic-Zuordnung --- (MIT REGEN-STATS)
const topicMap = {
    'home/temp/auszen': { id: 'aussen-temp', unit: ' °C' },
    'home/luftfeuchte/aktuell': { id: 'aussen-luft', unit: ' %' },
    'home/regen/status': {
        id: 'regen-status',
        unit: '',
        formatter: (payload) => (payload === '1' ? 'Ja 🌧️' : 'Nein ☀️')
    },
    'haus/historie/aussentemperatur_24h': {
        id: 'aussen-temp-chart' // Spezialbehandlung
    },
    'gasse/müll/nächste': {
        id: 'muell-naechste',
        unit: '',
        widgetId: 'widget-muell-naechste'
    },
    'gasse/unwetter': {
        id: 'unwetter-warnung',
        unit: '',
        widgetId: 'widget-unwetter',
        formatter: (payload) => (!payload || payload.trim() === '') ? "keine Unwetterinformationen" : payload
    },
    'home/regen/jahresstat': {
        id: 'regen-chart-jahresstat' // Spezialbehandlung
    },
    // ### HIER SIND DIE FEHLENDEN REGEN-STATISTIK TOPICS ###
    'home/regen/stat7d': { id: 'regen-7d', unit: ' mm' },
    'home/regen/stat14d': { id: 'regen-14d', unit: ' mm' },
    'home/regen/stat1m': { id: 'regen-1m', unit: ' mm' },
    'home/regen/stat3m': { id: 'regen-3m', unit: ' mm' },
    'home/regen/stat6m': { id: 'regen-6m', unit: ' mm' }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart;
let regenChart;
let client; // MQTT Client global machen

// --- 3. Helper-Funktionen ---
function setMuellStyle(widgetElement, payload) {
    widgetElement.classList.remove('muell-rest', 'muell-gelb', 'muell-bio', 'muell-papier');
    const lowerPayload = payload.trim().toLowerCase();
    if (lowerPayload.includes('restmüll') || lowerPayload.includes('restmuell')) { widgetElement.classList.add('muell-rest'); }
    else if (lowerPayload.includes('gelber sack')) { widgetElement.classList.add('muell-gelb'); }
    else if (lowerPayload.includes('biotonne')) { widgetElement.classList.add('muell-bio'); }
    else if (lowerPayload.includes('altpapier')) { widgetElement.classList.add('muell-papier'); }
}

function setUnwetterStyle(widgetElement, payload) {
    widgetElement.classList.remove('unwetter-aktiv-orange', 'unwetter-aktiv-rot', 'unwetter-aktiv-violett', 'unwetter-inaktiv');
    const lowerPayload = payload.trim().toLowerCase();
    if (lowerPayload.includes('orange')) { widgetElement.classList.add('unwetter-aktiv-orange'); }
    else if (lowerPayload.includes('rot')) { widgetElement.classList.add('unwetter-aktiv-rot'); }
    else if (lowerPayload.includes('violett')) { widgetElement.classList.add('unwetter-aktiv-violett'); }
    else { widgetElement.classList.add('unwetter-inaktiv'); }
}

function initRegenChart() {
    const canvasElement = document.getElementById('regenChartCanvas');
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    if (window.myBarChart) window.myBarChart.destroy();

    window.myBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Regenmenge (mm)',
                data: [],
                backgroundColor: '#2196F3', // Feste Hex-Farbe
                borderColor: '#1976D2',     // Feste Hex-Farbe
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: true, position: 'top' } }
        }
    });
    regenChart = window.myBarChart;
}

function initChart() {
    const canvasElement = document.getElementById('tempChartCanvas');
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    if (window.myLineChart) window.myLineChart.destroy();

    window.myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperatur °C',
                data: [],
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                segment: {
                    borderColor: (ctx) => (ctx.p0 && ctx.p0.parsed) ? (ctx.p0.parsed.y < 0 ? 'var(--pico-color-blue-500)' : 'var(--pico-color-red-600)') : 'var(--pico-color-red-600)',
                },
                pointBackgroundColor: (ctx) => (ctx.parsed) ? (ctx.parsed.y < 0 ? 'var(--pico-color-blue-500)' : 'var(--pico-color-red-600)') : 'var(--pico-color-red-600)',
                pointBorderColor: (ctx) => (ctx.parsed) ? (ctx.parsed.y < 0 ? 'var(--pico-color-blue-500)' : 'var(--pico-color-red-600)') : 'var(--pico-color-red-600)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { autoSkip: true, maxTicksLimit: 12 } },
                y: { beginAtZero: false }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
    tempChart = window.myLineChart;
}


// --- 4. App starten ---
console.log('App wird initialisiert...');
initChart();
initRegenChart();
console.log('Charts initialisiert.');


// --- 5. MQTT verbinden (ERST NACHDEM DIE CHARTS INITIALISIERT SIND) ---

const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
const options = {
    clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8),
    username: HIVE_MQ_USER,
    password: HIVE_MQ_PASS,
    clean: true,
    connectTimeout: 10000 // 10 Sekunden
};

console.log('Verbinde mit ' + clientUrl);
try {
    client = mqtt.connect(clientUrl, options);
    console.log('mqtt.connect() aufgerufen, warte auf Events...');

    // --- 6. Event-Handler registrieren ---

    client.on('connect', () => {
        console.log('✅✅✅ MQTT Connect Event ausgelöst! Erfolgreich verbunden!');
        statusElement.textContent = 'Verbunden ✅';
        statusElement.style.backgroundColor = 'var(--pico-color-green-200)';
        statusElement.style.color = 'var(--pico-color-green-700)';
        const topicsToSubscribe = Object.keys(topicMap);
        client.subscribe(topicsToSubscribe, (err) => {
            if (!err) console.log(`Erfolgreich Topics abonniert: ${topicsToSubscribe.join(', ')}`);
            else console.error('Subscribe-Fehler:', err);
        });
    });

    client.on('message', (topic, payload) => {
        const message = payload.toString();
        // console.log(`Nachricht empfangen auf Topic '${topic}': "${message}"`); // Kann man wieder aktivieren bei Bedarf

        const mapping = topicMap[topic];
        if (!mapping) return;

        // ----- SPEZIALFALL 1: Temperatur-History (Linien-Chart) -----
        if (mapping.id === 'aussen-temp-chart') {
            try {
                const historyData = JSON.parse(message);
                const labels = historyData.map(d => new Date(d._time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
                const dataPoints = historyData.map(d => d._value.toFixed(1));

                if (tempChart) {
                    tempChart.data.labels = labels;
                    tempChart.data.datasets[0].data = dataPoints;
                    tempChart.update();
                } else {
                    console.warn('Temperatur-Chart war bei Eintreffen der Nachricht noch nicht bereit.');
                }
            } catch (e) {
                console.error('Fehler bei Temperatur-History:', e);
            }

        // ----- SPEZIALFALL 2: Regen-History (Bar-Chart) -----
        } else if (mapping.id === 'regen-chart-jahresstat') {
            try {
                const data = JSON.parse(message);
                if (data && data[0]) {
                    const chartData = data[0];
                    if (regenChart) {
                        regenChart.data.labels = chartData.labels;
                        regenChart.data.datasets[0].data = chartData.data;
                        regenChart.data.datasets[0].label = chartData.series[0] || 'Regenmenge (mm)';
                        regenChart.update();
                    } else {
                         console.warn('Regen-Chart war bei Eintreffen der Nachricht noch nicht bereit.');
                    }
                }
            } catch (e) {
                console.error('Fehler bei Regen-History:', e);
            }

        // ----- SPEZIALFALL 3: Live-Temperatur (Text UND Graph) -----
        } else if (topic === 'home/temp/auszen') {
            const element = document.getElementById(mapping.id);
            if (element) element.textContent = `${parseFloat(message).toFixed(1)} ${mapping.unit}`;

            if (tempChart) {
                const lastDataPoint = tempChart.data.datasets[0].data.slice(-1)[0];
                if (lastDataPoint != parseFloat(message).toFixed(1)) {
                    const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    tempChart.data.labels.push(now);
                    tempChart.data.datasets[0].data.push(parseFloat(message).toFixed(1));
                    tempChart.update();
                }
            }

        // ----- STANDARD-FALL: Alle anderen Widgets (INKL. REGEN-STATS) -----
        } else {
            const element = document.getElementById(mapping.id);
            if (!element) { console.error(`Element mit ID "${mapping.id}" nicht gefunden!`); return; }

            let displayValue = message;
            if (mapping.formatter) { displayValue = mapping.formatter(message); }

            const unit = mapping.unit || '';
            element.textContent = displayValue + unit;

            if (topic === 'home/regen/status') {
                 if (displayValue.includes('Ja')) { element.style.color = 'var(--pico-color-blue-500)'; }
                 else { element.style.color = 'var(--pico-color-orange-500)'; }
            }

            if (mapping.widgetId) {
                const widgetElement = document.getElementById(mapping.widgetId);
                if (!widgetElement) { console.error(`Widget-Element mit ID "${mapping.widgetId}" nicht gefunden!`); return; }
                if (topic.includes('gasse/müll')) { setMuellStyle(widgetElement, message); }
                if (topic.includes('gasse/unwetter')) { setUnwetterStyle(widgetElement, message); }
            }
        }
    });

    client.on('error', (err) => {
        console.error('🔥🔥🔥 MQTT Error Event ausgelöst! Fehler:', err);
        statusElement.textContent = 'Verbindungsfehler!';
        statusElement.style.backgroundColor = 'var(--pico-color-red-200)';
        statusElement.style.color = 'var(--pico-color-red-700)';
    });

    client.on('reconnect', () => {
        console.log('⏳ MQTT Reconnect Event ausgelöst! Versuche Wiederverbindung...');
        statusElement.textContent = 'Wiederverbindung...';
        statusElement.style.backgroundColor = 'var(--pico-color-orange-200)';
        statusElement.style.color = 'var(--pico-color-orange-700)';
    });

    client.on('close', () => {
        console.log('🚪 MQTT Close Event ausgelöst! Verbindung geschlossen.');
    });

    client.on('offline', () => {
        console.log('🔌 MQTT Offline Event ausgelöst! Client ist offline.');
        statusElement.textContent = 'Offline';
        statusElement.style.backgroundColor = 'var(--pico-color-gray-300)';
        statusElement.style.color = 'var(--pico-color-gray-700)';
    });

} catch (e) {
    console.error('💥💥💥 Kritischer Fehler BEIM AUFRUF von mqtt.connect:', e);
    statusElement.textContent = 'Init-Fehler!';
    statusElement.style.backgroundColor = 'var(--pico-color-red-200)';
    statusElement.style.color = 'var(--pico-color-red-700)';
}