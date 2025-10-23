// --- 1. Konfiguration ---
const HIVE_MQ_HOST = 'bb23c26981ce486a9de6a8d83cff9f90.s1.eu.hivemq.cloud';
const HIVE_MQ_PORT = 8884;
const HIVE_MQ_USER = 'sbwwetter';
const HIVE_MQ_PASS = 'pbd7chu6kba!zrd2GTG';

// --- Flexible Topic-Zuordnung ---
const topicMap = {
    'home/temp/auszen': {
        id: 'aussen-temp',
        unit: ' °C'
    },
    'home/luftfeuchte/aktuell': {
        id: 'aussen-luft',
        unit: ' %'
    },
    'home/regen/status': {
        id: 'regen-status',
        unit: '',
        formatter: (payload) => (payload === '1' ? 'Ja 🌧️' : 'Nein ☀️')
    },
    'haus/historie/aussentemperatur_24h': {
        id: 'aussen-temp-chart'
    },
    'gasse/müll/nächste': {
        id: 'muell-naechste',
        unit: '',
        widgetId: 'widget-muell-naechste'
    },
    'gasse/unwetter': {
        id: 'unwetter-warnung', // <span> ID
        unit: '',
        widgetId: 'widget-unwetter', // <article> ID
        formatter: (payload) => {
            // Fängt null, undefined oder leere Strings ab
            if (!payload || payload.trim() === '') {
                return "keine Unwetterinformationen";
            }
            return payload; // Gibt den Warntext zurück
        }
    }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart;

// --- Helper-Funktion für Müll ---
function setMuellStyle(widgetElement, payload) {
    widgetElement.classList.remove('muell-rest', 'muell-gelb', 'muell-bio', 'muell-papier');
    const lowerPayload = payload.trim().toLowerCase();

    if (lowerPayload.includes('restmüll') || lowerPayload.includes('restmuell')) {
        widgetElement.classList.add('muell-rest');
    } else if (lowerPayload.includes('gelber sack')) {
        widgetElement.classList.add('muell-gelb');
    } else if (lowerPayload.includes('biotonne')) {
        widgetElement.classList.add('muell-bio');
    } else if (lowerPayload.includes('altpapier')) {
        widgetElement.classList.add('muell-papier');
    }
}

// ### AKTUALISIERTE HELPER-FUNKTION FÜR UNWETTER ###
/**
 * Setzt den Stil der Unwetter-Kachel basierend auf dem Payload.
 * @param {HTMLElement} widgetElement - Das <article>-Element.
 * @param {string} payload - Der *originale* MQTT-Payload-Text.
 */
function setUnwetterStyle(widgetElement, payload) {
    // Zuerst alle alten Klassen entfernen
    widgetElement.classList.remove('unwetter-aktiv-orange', 'unwetter-aktiv-rot', 'unwetter-aktiv-violett', 'unwetter-inaktiv');
    
    const lowerPayload = payload.trim().toLowerCase();

    // Prüfe auf die neuen Farbcodes
    if (lowerPayload.includes('orange')) {
        widgetElement.classList.add('unwetter-aktiv-orange');
    } else if (lowerPayload.includes('rot')) {
        widgetElement.classList.add('unwetter-aktiv-rot');
    } else if (lowerPayload.includes('violett')) {
        widgetElement.classList.add('unwetter-aktiv-violett');
    } else {
        // Wenn kein Farbcode gefunden wurde, ist es inaktiv
        widgetElement.classList.add('unwetter-inaktiv');
    }
}


// --- Graph initialisieren ---
function initChart() {
    // ... (CODE UNVERÄNDERT) ...
    const ctx = document.getElementById('tempChartCanvas').getContext('2d');
    if (window.myLineChart) window.myLineChart.destroy();
    window.myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperatur °C', data: [], borderWidth: 2, fill: false, tension: 0.1,
                segment: { borderColor: (ctx) => (ctx.p0 && ctx.p0.parsed) ? (ctx.p0.parsed.y < 0 ? 'var(--pico-color-blue-500)' : 'var(--pico-color-red-600)') : 'var(--pico-color-red-600)', },
                pointBackgroundColor: (ctx) => (ctx.parsed) ? (ctx.parsed.y < 0 ? 'var(--pico-color-blue-500)' : 'var(--pico-color-red-600)') : 'var(--pico-color-red-600)',
                pointBorderColor: (ctx) => (ctx.parsed) ? (ctx.parsed.y < 0 ? 'var(--pico-color-blue-500)' : 'var(--pico-color-red-600)') : 'var(--pico-color-red-600)'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 12 } }, y: { beginAtZero: false } },
            plugins: { legend: { display: false } }
        }
    });
    tempChart = window.myLineChart;
}


// --- 3. MQTT-Verbindung ---
const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
// ... (CODE UNVERÄNDERT) ...
const options = { clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8), username: HIVE_MQ_USER, password: HIVE_MQ_PASS, clean: true };
console.log('Verbinde mit ' + clientUrl);
const client = mqtt.connect(clientUrl, options);

// --- 4. Event-Handler ---
client.on('connect', () => {
    // ... (CODE UNVERÄNDERT) ...
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

    // ----- SPEZIALFALL 1: History-Daten für den Graphen -----
    if (mapping.id === 'aussen-temp-chart') {
        // ... (CODE UNVERÄNDERT) ...
        try {
            const historyData = JSON.parse(message);
            const labels = historyData.map(d => new Date(d._time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
            const dataPoints = historyData.map(d => d._value.toFixed(1));
            tempChart.data.labels = labels;
            tempChart.data.datasets[0].data = dataPoints;
            tempChart.update();
            console.log('Graph mit 24h-Daten gefüllt.');
        } catch (e) { console.error('Fehler beim Parsen der History-JSON:', e); }

    // ----- SPEZIALFALL 2: Live-Temperatur (Text UND Graph) -----
    } else if (topic === 'home/temp/auszen') {
        // ... (CODE UNVERÄNDERT) ...
        const element = document.getElementById(mapping.id);
        if (element) element.textContent = `${parseFloat(message).toFixed(1)} ${mapping.unit}`;
        if (tempChart) { /* ... (Graph-Update-Logik) ... */ }

    // ----- STANDARD-FALL: Alle anderen Widgets -----
    } else {
        const element = document.getElementById(mapping.id);
        if (!element) { console.error(`Element mit ID "${mapping.id}" nicht gefunden!`); return; }
        
        let displayValue = message;
        if (mapping.formatter) {
            displayValue = mapping.formatter(message);
        }
        
        const unit = mapping.unit || '';
        element.textContent = displayValue + unit;

        // Styling für Regen
        if (topic === 'home/regen/status') {
            // ... (CODE UNVERÄNDERT) ...
        }

        // Logik für Müll & Unwetter
        if (mapping.widgetId) {
            const widgetElement = document.getElementById(mapping.widgetId);
            if (!widgetElement) { console.error(`Widget-Element mit ID "${mapping.widgetId}" nicht gefunden!`); return; }

            // Müll-Logik
            if (topic.includes('gasse/müll')) {
                setMuellStyle(widgetElement, message);
            }
            
            // ### AKTUALISIERTE UNWETTER-LOGIK ###
            // Ruft die Styling-Funktion mit dem *originalen* Payload (`message`) auf,
            // da dieser "Orange", "Rot" etc. enthält.
            if (topic.includes('gasse/unwetter')) {
                setUnwetterStyle(widgetElement, message);
            }
        }
    }
});


// Fehler- und Reconnect-Handler
client.on('error', (err) => {
    // ... (CODE UNVERÄNDERT) ...
});
client.on('reconnect', () => {
    // ... (CODE UNVERÄNDERT) ...
});

// --- 5. App starten ---
console.log('App wird initialisiert...');
initChart();
console.log('Chart initialisiert');