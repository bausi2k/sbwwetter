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
    'home/regen/stat7d': { id: 'regen-7d', unit: ' mm' },
    'home/regen/stat14d': { id: 'regen-14d', unit: ' mm' },
    'home/regen/stat1m': { id: 'regen-1m', unit: ' mm' },
    'home/regen/stat3m': { id: 'regen-3m', unit: ' mm' },
    'home/regen/stat6m': { id: 'regen-6m', unit: ' mm' },
    // ### NEUES TOPIC HINZUGEFÜGT ###
    'home/wetter/prognose/morgen': {
        id: 'wetter-prognose', // ID des <span> Elements
        unit: '',             // Kein Suffix
        widgetId: 'widget-prognose' // ID des <article> Elements für evtl. Styling
    }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart;
let regenChart;
let client;

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
const options = { /* ... (unverändert) ... */ };
console.log('Verbinde mit ' + clientUrl);
try {
    client = mqtt.connect(clientUrl, options);
    console.log('mqtt.connect() aufgerufen, warte auf Events...');

    // --- 6. Event-Handler registrieren ---

    client.on('connect', () => { /* ... (unverändert) ... */ });

    client.on('message', (topic, payload) => {
        const message = payload.toString();
        // console.log(`Nachricht empfangen auf Topic '${topic}': "${message}"`);

        const mapping = topicMap[topic];
        if (!mapping) return;

        // ----- SPEZIALFALL 1: Temperatur-History (Linien-Chart) -----
        if (mapping.id === 'aussen-temp-chart') { /* ... (unverändert) ... */ }
        // ----- SPEZIALFALL 2: Regen-History (Bar-Chart) -----
        else if (mapping.id === 'regen-chart-jahresstat') { /* ... (unverändert) ... */ }
        // ----- SPEZIALFALL 3: Live-Temperatur (Text UND Graph) -----
        else if (topic === 'home/temp/auszen') { /* ... (unverändert) ... */ }
        // ----- STANDARD-FALL: Alle anderen Widgets (INKL. WETTER PROGNOSE) -----
        else {
            const element = document.getElementById(mapping.id);
            if (!element) { console.error(`Element mit ID "${mapping.id}" nicht gefunden!`); return; }

            let displayValue = message;
            if (mapping.formatter) { displayValue = mapping.formatter(message); }

            const unit = mapping.unit || '';
            element.textContent = displayValue + unit;

            // Styling für Regen-Status
            if (topic === 'home/regen/status') { /* ... (unverändert) ... */ }

            // Styling für Müll & Unwetter & evtl. Prognose
            if (mapping.widgetId) {
                const widgetElement = document.getElementById(mapping.widgetId);
                if (!widgetElement) { console.error(`Widget-Element mit ID "${mapping.widgetId}" nicht gefunden!`); return; }
                if (topic.includes('gasse/müll')) { setMuellStyle(widgetElement, message); }
                if (topic.includes('gasse/unwetter')) { setUnwetterStyle(widgetElement, message); }
                // Hier könnte man Styling für die Prognose hinzufügen, z.B.
                // if (topic.includes('wetter/prognose')) { setPrognoseStyle(widgetElement, message); }
            }
        }
    });

    client.on('error', (err) => { /* ... (unverändert) ... */ });
    client.on('reconnect', () => { /* ... (unverändert) ... */ });
    client.on('close', () => { /* ... (unverändert) ... */ });
    client.on('offline', () => { /* ... (unverändert) ... */ });

} catch (e) { /* ... (unverändert) ... */ }