// --- 1. Konfiguration ---
const HIVE_MQ_HOST = 'bb23c26981ce486a9de6a8d83cff9f90.s1.eu.hivemq.cloud'; // Deinen Hostnamen von HiveMQ eintragen
const HIVE_MQ_PORT = 8884; // WICHTIG: Der WSS-Port (meist 8884)
const HIVE_MQ_USER = 'sbwwetter'; // Den Benutzer für die Webseite (siehe Sicherheitshinweis unten!)
const HIVE_MQ_PASS = 'pbd7chu6kba!zrd2GTG';     // Das Passwort für diesen Benutzer

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

    // HIER SIND DIE ÄNDERUNGEN:
    'gasse/müll/nächste': {
        id: 'muell-naechste', 
        unit: '', 
        widgetId: 'widget-muell-naechste' // ID der <article>-Kachel
    },
    'gasse/müll/übernächste': {
        id: 'muell-uebernaechste', 
        unit: '',
        widgetId: 'widget-muell-uebernaechste' // ID der <article>-Kachel
    }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart; 

// --- NEUE HELPER-FUNKTION (zum Setzen der CSS-Klasse) ---
/**
 * Setzt die Farb-CSS-Klasse für ein Müll-Widget basierend auf dem Text.
 * @param {HTMLElement} widgetElement - Das <article>-Element des Widgets.
 * @param {string} payload - Der rohe Text (z.B. "Morgen: Abholung Biotonne").
 */
function setMuellStyle(widgetElement, payload) {
    // Zuerst alle alten Farbklassen entfernen
    widgetElement.classList.remove('muell-rest', 'muell-gelb', 'muell-bio', 'muell-papier');

    // Die passende neue Klasse hinzufügen
    if (payload.includes('Restmuell')) {
        widgetElement.classList.add('muell-rest');
    } else if (payload.includes('Gelber Sack')) {
        widgetElement.classList.add('muell-gelb');
    } else if (payload.includes('Biotonne')) {
        widgetElement.classList.add('muell-bio');
    } else if (payload.includes('Altpapier')) {
        widgetElement.classList.add('muell-papier');
    }
    // Wenn nichts zutrifft, bleibt die Kachel neutral (Standardfarbe)
}

// --- Graph initialisieren ---
function initChart() {
    // ... (Code unverändert)
    const ctx = document.getElementById('tempChartCanvas').getContext('2d');
    if (window.myLineChart) window.myLineChart.destroy();
    window.myLineChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Temperatur °C', data: [], borderColor: 'var(--pico-primary)', backgroundColor: 'var(--pico-primary-background)', borderWidth: 2, fill: true, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 12 }}, y: { beginAtZero: false }}, plugins: { legend: { display: false }}}
    });
    tempChart = window.myLineChart;
}

// --- 3. MQTT-Verbindung ---
const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
// ... (Code für options unverändert)
const options = { clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8), username: HIVE_MQ_USER, password: HIVE_MQ_PASS, clean: true };
console.log('Verbinde mit ' + clientUrl);
const client = mqtt.connect(clientUrl, options);

// --- 4. Event-Handler ---
client.on('connect', () => {
    // ... (Code unverändert)
    console.log('Erfolgreich mit HiveMQ verbunden!');
    statusElement.textContent = 'Verbunden';
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
    console.log(`Nachricht empfangen auf Topic '${topic}': ${message}`);

    const mapping = topicMap[topic];
    if (!mapping) return; 

    // ----- SPEZIALFALL 1: History-Daten für den Graphen -----
    if (mapping.id === 'aussen-temp-chart') {
        // ... (Code unverändert)
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
        // ... (Code unverändert)
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
            
            // Styling für Regen (unverändert)
            if (topic === 'home/regen/status') {
                if (displayValue.includes('Ja')) {
                    element.style.color = 'var(--pico-color-blue-500)';
                } else {
                    element.style.color = 'var(--pico-color-orange-500)';
                }
            }

            // --- HIER IST DIE NEUE LOGIK FÜR MÜLL ---
            // Prüfen, ob für dieses Topic eine widgetId definiert ist
            if (mapping.widgetId) {
                const widgetElement = document.getElementById(mapping.widgetId);
                if (widgetElement) {
                    // Rufe die Helper-Funktion auf, um die Kachel einzufärben
                    setMuellStyle(widgetElement, message);
                }
            }
        }
    }
});


// Fehler- und Reconnect-Handler
client.on('error', (err) => {
    // ... (Code unverändert)
    console.error('Verbindungsfehler:', err);
    statusElement.textContent = 'Fehler!';
    statusElement.style.backgroundColor = 'var(--pico-color-red-200)';
    statusElement.style.color = 'var(--pico-color-red-700)';
    client.end();
});
client.on('reconnect', () => {
    // ... (Code unverändert)
    console.log('Versuche Wiederverbindung...');
    statusElement.textContent = 'Wiederverbindung...';
    statusElement.style.backgroundColor = 'var(--pico-color-orange-200)';
    statusElement.style.color = 'var(--pico-color-orange-700)';
});

// --- 5. App starten ---
initChart();