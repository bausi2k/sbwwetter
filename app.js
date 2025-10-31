// --- 1. Konfiguration ---
const HIVE_MQ_HOST = 'bb23c26981ce486a9de6a8d83cff9f90.s1.eu.hivemq.cloud';
const HIVE_MQ_PORT = 8884;
const HIVE_MQ_USER = 'sbwwetter';
const HIVE_MQ_PASS = 'pbd7chu6kba!zrd2GTG';

// --- Flexible Topic-Zuordnung ---
const topicMap = {
    'home/temp/auszen': { id: 'aussen-temp', unit: ' °C', chartId: 'line-1' },
    'home/luftfeuchte/aktuell': { id: 'aussen-luft', unit: ' %' },
    'home/regen/status': {
        id: 'regen-status',
        unit: '',
        formatter: (payload) => (payload === '1' ? 'Ja 🌧️' : 'Nein ☀️')
    },
    'home/wind/now': { id: 'wind-now', unit: ' km/h' },
    'home/zero': { id: 'temp-chart-line-2', chartId: 'line-2' },
    'home/webservice/gefuehltetemperatur': {
        id: 'gefuehlte-temp',
        unit: ' °C',
        chartId: 'line-3'
    },
    'gasse/müll/nächste': { id: 'muell-naechste', unit: '', widgetId: 'widget-muell-naechste' },
    'gasse/unwetter': {
        id: 'unwetter-warnung',
        unit: '',
        widgetId: 'widget-unwetter',
        formatter: (payload) => (!payload || payload.trim() === '') ? "keine Unwetterinformationen" : payload
    },
    'home/wetter/prognose/morgen': { id: 'wetter-prognose', unit: '', widgetId: 'widget-prognose' },
    'home/regen/jahresstat': { id: 'regen-chart-jahresstat' },
    'home/regen/stat7d': { id: 'regen-7d', unit: ' mm' },
    'home/regen/stat14d': { id: 'regen-14d', unit: ' mm' },
    'home/regen/stat1m': { id: 'regen-1m', unit: ' mm' },
    'home/regen/stat3m': { id: 'regen-3m', unit: ' mm' },
    'home/regen/stat6m': { id: 'regen-6m', unit: ' mm' },
    'home/regen/stat12m': { id: 'regen-12m', unit: ' mm' },
    'haus/historie/aussentemperatur_24h': { id: 'aussen-temp-chart' },
    'haus/historie/gef_aussentemperatur_24h': { id: 'gefuehlte-temp-chart' }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart;
let regenChart;
let client;

// --- 3. Helper-Funktionen ---
function setMuellStyle(widgetElement, payload) { /* ... (unverändert) ... */ }
function setUnwetterStyle(widgetElement, payload) { /* ... (unverändert) ... */ }
function initRegenChart() { /* ... (unverändert, nutzt feste Hex-Farbe #2196F3) ... */ }

// ### KORRIGIERTE `initChart` FUNKTION ###
function initChart() {
    const canvasElement = document.getElementById('tempChartCanvas');
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    if (window.myLineChart) window.myLineChart.destroy();

    // Farben als feste Hex-Codes
    const farbeBlau = '#2196F3'; // Pico Blue 500
    const farbeRot = '#D32F2F';   // Pico Red 600
    const farbeGruen = '#4CAF50'; // Pico Green 500
    const farbeOrange = '#FF9800';// Pico Orange 500

    window.myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    // DATASET 0: Temperatur
                    label: 'Temperatur °C',
                    data: [],
                    borderWidth: 2,
                    fill: false, // Geändert (war 'true' in deinem Snippet)
                    tension: 0.1,
                    segment: {
                        borderColor: (ctx) => (ctx.p0 && ctx.p0.parsed) ? (ctx.p0.parsed.y < 0 ? farbeBlau : farbeRot) : farbeRot,
                    },
                    pointBackgroundColor: (ctx) => (ctx.parsed) ? (ctx.parsed.y < 0 ? farbeBlau : farbeRot) : farbeRot,
                    pointBorderColor: (ctx) => (ctx.parsed) ? (ctx.parsed.y < 0 ? farbeBlau : farbeRot) : farbeRot
                },
                {
                    // DATASET 1: 'Zero' LINIE
                    label: 'Zero Line',
                    data: [],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    borderColor: farbeGruen,
                    pointBackgroundColor: farbeGruen,
                    pointBorderColor: farbeGruen,
                    pointRadius: 2
                },
                {
                    // DATASET 2: 'Gefühlte' LINIE
                    label: 'Gefühlte Temp. °C',
                    data: [],
                    borderWidth: 2,
                    fill: false, // Geändert (war 'true' in deinem Snippet)
                    tension: 0.1,
                    borderColor: farbeOrange,
                    pointBackgroundColor: farbeOrange,
                    pointBorderColor: farbeOrange, // Dein '#ff0000' funktionierte, aber Orange ist konsistenter
                    pointRadius: 2,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { autoSkip: true, maxTicksLimit: 12 } },
                y: { beginAtZero: false }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        filter: function(legendItem, chartData) {
                            return legendItem.text !== 'Zero Line';
                        }
                    }
                }
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


// --- 5. MQTT verbinden ---
const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
const options = { /* ... (unverändert) ... */ };
console.log('Verbinde mit ' + clientUrl);
try {
    client = mqtt.connect(clientUrl, options);
    console.log('mqtt.connect() aufgerufen, warte auf Events...');

    // --- 6. Event-Handler registrieren ---
    client.on('connect', () => { /* ... (unverändert) ... */ });
    client.on('message', (topic, payload) => { /* ... (unverändert, siehe vorige Antwort) ... */ });
    client.on('error', (err) => { /* ... (unverändert) ... */ });
    client.on('reconnect', () => { /* ... (unverändert) ... */ });
    client.on('close', () => { /* ... (unverändert) ... */ });
    client.on('offline', () => { /* ... (unverändert) ... */ });

} catch (e) { /* ... (unverändert) ... */ }

// --- Cookie Banner Logic ---
document.addEventListener('DOMContentLoaded', () => { /* ... (unverändert) ... */ });