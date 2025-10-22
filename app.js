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
    'gasse/müll/übernächste': {
        id: 'muell-uebernaechste',
        unit: '',
        widgetId: 'widget-muell-uebernaechste'
    }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart;

// --- Helper-Funktion (MIT NEUEN LOGS) ---
function setMuellStyle(widgetElement, payload) {
    // DEBUG: Zeigen, was reinkommt
    console.log(`[setMuellStyle] Prüfe Payload: "${payload}"`);

    widgetElement.classList.remove('muell-rest', 'muell-gelb', 'muell-bio', 'muell-papier');
    const lowerPayload = payload.toLowerCase();

    if (lowerPayload.includes('restmuell')) {
        console.log('[setMuellStyle] Setze Klasse: muell-rest');
        widgetElement.classList.add('muell-rest');
    } else if (lowerPayload.includes('gelber sack')) {
        console.log('[setMuellStyle] Setze Klasse: muell-gelb');
        widgetElement.classList.add('muell-gelb');
    } else if (lowerPayload.includes('biotonne')) {
        console.log('[setMuellStyle] Setze Klasse: muell-bio');
        widgetElement.classList.add('muell-bio');
    } else if (lowerPayload.includes('altpapier')) {
        console.log('[setMuellStyle] Setze Klasse: muell-papier');
        widgetElement.classList.add('muell-papier');
    } else {
        // DEBUG: Zeigen, wenn nichts zutrifft
        console.log('[setMuellStyle] Kein Mülltyp gefunden. Setze keine Klasse.');
    }
}

// --- Graph initialisieren ---
function initChart() {
    // ... (Code unverändert, hier gekürzt)
    const ctx = document.getElementById('tempChartCanvas').getContext('2d');
    if (window.myLineChart) window.myLineChart.destroy();
    window.myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperatur °C', data: [], borderWidth: 2, fill: false, tension: 0.1,
                segment: {
                    borderColor: (ctx) => (ctx.p0 && ctx.p0.parsed) ? (ctx.p0.parsed.y < 0 ? 'var(--pico-color-blue-500)' : 'var(--pico-color-red-600)') : 'var(--pico-color-red-600)',
                },
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
const options = { clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8), username: HIVE_MQ_USER, password: HIVE_MQ_PASS, clean: true };
console.log('Verbinde mit ' + clientUrl);
const client = mqtt.connect(clientUrl, options);

// --- 4. Event-Handler ---
client.on('connect', () => {
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
    // Diese Meldung hatten wir schon, sie ist sehr wichtig:
    console.log(`Nachricht empfangen auf Topic '${topic}': ${message}`);

    const mapping = topicMap[topic];
    if (!mapping) return;

    // ----- SPEZIALFALL 1: History-Daten für den Graphen -----
    if (mapping.id === 'aussen-temp-chart') {
        // ... (Code unverändert, hier gekürzt)
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
        // ... (Code unverändert, hier gekürzt)
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

    // ----- STANDARD-FALL: Alle anderen Widgets (Luftfeuchte, Regen, MÜLL) -----
    } else {
        const element = document.getElementById(mapping.id);
        if (element) {
            let displayValue = message;
            if (mapping.formatter) {
                displayValue = mapping.formatter(message);
            }
            const unit = mapping.unit || '';
            element.textContent = displayValue + unit;

            // Styling für Regen
            if (topic === 'home/regen/status') {
                if (displayValue.includes('Ja')) {
                    element.style.color = 'var(--pico-color-blue-500)';
                } else {
                    element.style.color = 'var(--pico-color-orange-500)';
                }
            }

            // Logik für Müll (MIT NEUEN LOGS)
            if (mapping.widgetId) {
                // DEBUG: Prüfen, ob wir die widgetId finden
                console.log(`[Müll-Logik] Suche Kachel-Element mit ID: '${mapping.widgetId}'`);
                const widgetElement = document.getElementById(mapping.widgetId);
                
                if (widgetElement) {
                    // DEBUG: Bestätigen, dass das Element gefunden wurde
                    console.log(`[Müll-Logik] Kachel-Element gefunden! Rufe setMuellStyle auf.`);
                    setMuellStyle(widgetElement, message);
                } else {
                    // DEBUG: FEHLER, WENN ID FALSCH IST
                    console.error(`[Müll-Logik] FEHLER: Kachel-Element mit ID '${mapping.widgetId}' NICHT gefunden. Prüfe die index.html!`);
                }
            }
        }
    }
});


// Fehler- und Reconnect-Handler
client.on('error', (err) => {
    // ... (Code unverändert)
});
client.on('reconnect', () => {
    // ... (Code unverändert)
});

// --- 5. App starten ---
initChart();