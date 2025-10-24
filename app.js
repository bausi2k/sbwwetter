// --- 1. Konfiguration ---
const HIVE_MQ_HOST = 'bb23c26981ce486a9de6a8d83cff9f90.s1.eu.hivemq.cloud';
const HIVE_MQ_PORT = 8884;
const HIVE_MQ_USER = 'sbwwetter';
const HIVE_MQ_PASS = 'pbd7chu6kba!zrd2GTG';

// --- Flexible Topic-Zuordnung ---
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
    // ### NEUE REGEN-STATISTIK TOPICS ###
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

// --- 3. Helper-Funktionen ---
function setMuellStyle(widgetElement, payload) { /* ... (unverändert) ... */ }
function setUnwetterStyle(widgetElement, payload) { /* ... (unverändert) ... */ }
function initRegenChart() { /* ... (unverändert) ... */ }
function initChart() { /* ... (unverändert) ... */ }

// --- 4. App starten ---
console.log('App wird initialisiert...');
initChart();
initRegenChart();
console.log('Charts initialisiert.');

// --- 5. MQTT verbinden ---
const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
// ... (options unverändert) ...
const options = { /* ... */ };
console.log('Verbinde mit ' + clientUrl);
const client = mqtt.connect(clientUrl, options);

// --- 6. Event-Handler registrieren ---
client.on('connect', () => { /* ... (unverändert) ... */ });

client.on('message', (topic, payload) => {
    const message = payload.toString();
    console.log(`Nachricht empfangen auf Topic '${topic}': "${message}"`);

    const mapping = topicMap[topic];
    if (!mapping) return;

    // ----- SPEZIALFALL 1: Temperatur-History (Linien-Chart) -----
    if (mapping.id === 'aussen-temp-chart') {
        // ... (Logik unverändert) ...
    // ----- SPEZIALFALL 2: Regen-History (Bar-Chart) -----
    } else if (mapping.id === 'regen-chart-jahresstat') {
        // ... (Logik unverändert) ...
    // ----- SPEZIALFALL 3: Live-Temperatur (Text UND Graph) -----
    } else if (topic === 'home/temp/auszen') {
        // ... (Logik unverändert) ...
    // ----- STANDARD-FALL: Alle anderen Widgets (INKLUSIVE NEUE REGEN STATS) -----
    } else {
        const element = document.getElementById(mapping.id);
        if (!element) { console.error(`Element mit ID "${mapping.id}" nicht gefunden!`); return; }

        let displayValue = message;
        if (mapping.formatter) { displayValue = mapping.formatter(message); }

        const unit = mapping.unit || '';
        // Für die neuen Regen-Stats wird hier z.B. "15.2 mm" gesetzt.
        element.textContent = displayValue + unit;

        // Styling für Regen-Status (Ja/Nein)
        if (topic === 'home/regen/status') { /* ... (unverändert) ... */ }

        // Styling für Müll & Unwetter
        if (mapping.widgetId) { /* ... (unverändert) ... */ }
    }
});

client.on('error', (err) => { /* ... (unverändert) ... */ });
client.on('reconnect', () => { /* ... (unverändert) ... */ });