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
    // ### NEUES TOPIC ###
    'home/regen/jahresstat': {
        id: 'regen-chart-jahresstat' // Spezialbehandlung
    }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart;
let regenChart; // ### NEUE GLOBALE VARIABLE ###

// --- Helper-Funktion für Müll ---
function setMuellStyle(widgetElement, payload) {
    // ... (Code unverändert)
    widgetElement.classList.remove('muell-rest', 'muell-gelb', 'muell-bio', 'muell-papier');
    const lowerPayload = payload.trim().toLowerCase();
    if (lowerPayload.includes('restmüll') || lowerPayload.includes('restmuell')) { widgetElement.classList.add('muell-rest'); }
    else if (lowerPayload.includes('gelber sack')) { widgetElement.classList.add('muell-gelb'); }
    else if (lowerPayload.includes('biotonne')) { widgetElement.classList.add('muell-bio'); }
    else if (lowerPayload.includes('altpapier')) { widgetElement.classList.add('muell-papier'); }
}

// --- Helper-Funktion für Unwetter ---
function setUnwetterStyle(widgetElement, payload) {
    // ... (Code unverändert)
    widgetElement.classList.remove('unwetter-aktiv-orange', 'unwetter-aktiv-rot', 'unwetter-aktiv-violett', 'unwetter-inaktiv');
    const lowerPayload = payload.trim().toLowerCase();
    if (lowerPayload.includes('orange')) { widgetElement.classList.add('unwetter-aktiv-orange'); }
    else if (lowerPayload.includes('rot')) { widgetElement.classList.add('unwetter-aktiv-rot'); }
    else if (lowerPayload.includes('violett')) { widgetElement.classList.add('unwetter-aktiv-violett'); }
    else { widgetElement.classList.add('unwetter-inaktiv'); }
}


// ### NEUE FUNKTION: Graph für Regen (Bar-Chart) ###
function initRegenChart() {
    // Prüft, ob das Element auf der Seite existiert (falls du den Tab mal entfernst)
    const canvasElement = document.getElementById('regenChartCanvas');
    if (!canvasElement) return; 
    
    const ctx = canvasElement.getContext('2d');
    if (window.myBarChart) window.myBarChart.destroy();

    window.myBarChart = new Chart(ctx, {
        type: 'bar', // Balkendiagramm
        data: {
            labels: [], // X-Achse (Jahre: 2020, 2021, ...)
            datasets: [{
                label: 'Regenmenge (mm)', // Wird durch JSON überschrieben
                data: [], // Y-Achse (Werte: 318, 404.5, ...)
                backgroundColor: 'var(--pico-color-blue-500)',
                borderColor: 'var(--pico-color-blue-600)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true // Regen fängt bei 0 an
                }
            },
            plugins: {
                legend: {
                    display: true, // Zeigt die Legende ("Jahresregenmenge") an
                    position: 'top',
                }
            }
        }
    });
    regenChart = window.myBarChart;
}

// --- Graph initialisieren (Temperatur) ---
function initChart() {
    // ... (Code unverändert)
    const ctx = document.getElementById('tempChartCanvas').getContext('2d');
    if (window.myLineChart) window.myLineChart.destroy();
    window.myLineChart = new Chart(ctx, { /* ... (dein Linien-Chart-Code) ... */ });
    tempChart = window.myLineChart;
}


// --- 3. MQTT-Verbindung ---
const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
// ... (Code unverändert)
const options = { clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8), username: HIVE_MQ_USER, password: HIVE_MQ_PASS, clean: true };
console.log('Verbinde mit ' + clientUrl);
const client = mqtt.connect(clientUrl, options);

// --- 4. Event-Handler ---
client.on('connect', () => {
    // ... (Code unverändert)
    console.log('Erfolgreich mit HiveMQ verbunden!');
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
    console.log(`Nachricht empfangen auf Topic '${topic}': "${message}"`);

    const mapping = topicMap[topic];
    if (!mapping) return;

    // ----- SPEZIALFALL 1: Temperatur-History (Linien-Chart) -----
    if (mapping.id === 'aussen-temp-chart') {
        try {
            const historyData = JSON.parse(message);
            const labels = historyData.map(d => new Date(d._time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
            const dataPoints = historyData.map(d => d._value.toFixed(1));
            tempChart.data.labels = labels;
            tempChart.data.datasets[0].data = dataPoints;
            tempChart.update();
            console.log('Temperatur-Graph (24h) gefüllt.');
        } catch (e) { console.error('Fehler beim Parsen der Temperatur-History-JSON:', e); }

    // ### NEUER SPEZIALFALL 2: Regen-History (Bar-Chart) ###
    } else if (mapping.id === 'regen-chart-jahresstat') {
        try {
            const data = JSON.parse(message);
            // Prüfen, ob Daten vorhanden sind und die Struktur passt
            if (data && data[0]) {
                const chartData = data[0];
                regenChart.data.labels = chartData.labels;
                regenChart.data.datasets[0].data = chartData.data;
                regenChart.data.datasets[0].label = chartData.series[0] || 'Regenmenge (mm)';
                regenChart.update();
                console.log('Regen-Graph (Jahr) gefüllt.');
            }
        } catch (e) {
            console.error('Fehler beim Parsen der Regen-History-JSON:', e);
        }

    // ----- SPEZIALFALL 3: Live-Temperatur (Text UND Graph) -----
    } else if (topic === 'home/temp/auszen') {
        // ... (Code unverändert)
        const element = document.getElementById(mapping.id);
        if (element) element.textContent = `${parseFloat(message).toFixed(1)} ${mapping.unit}`;
        if (tempChart) { /* ... (Graph-Update-Logik) ... */ }

    // ----- STANDARD-FALL: Alle anderen Widgets -----
    } else {
        // ... (Code unverändert)
        const element = document.getElementById(mapping.id);
        if (!element) { console.error(`Element mit ID "${mapping.id}" nicht gefunden!`); return; }
        
        let displayValue = message;
        if (mapping.formatter) { displayValue = mapping.formatter(message); }
        
        const unit = mapping.unit || '';
        element.textContent = displayValue + unit;

        if (topic === 'home/regen/status') { /* ... (Regen-Stil-Logik) ... */ }

        if (mapping.widgetId) {
            const widgetElement = document.getElementById(mapping.widgetId);
            if (!widgetElement) { console.error(`Widget-Element mit ID "${mapping.widgetId}" nicht gefunden!`); return; }
            if (topic.includes('gasse/müll')) { setMuellStyle(widgetElement, message); }
            if (topic.includes('gasse/unwetter')) { setUnwetterStyle(widgetElement, message); }
        }
    }
});


// Fehler- und Reconnect-Handler
client.on('error', (err) => { /* ... (unverändert) ... */ });
client.on('reconnect', () => { /* ... (unverändert) ... */ });

// --- 5. App starten ---
console.log('App wird initialisiert...');
initChart(); // Temperatur-Chart
initRegenChart(); // ### NEUEN CHART INITIALISIEREN ###
console.log('Charts initialisiert');