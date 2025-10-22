// --- 1. Konfiguration ---
const HIVE_MQ_HOST = 'bb23c26981ce486a9de6a8d83cff9f90.s1.eu.hivemq.cloud'; // Deinen Hostnamen von HiveMQ eintragen
const HIVE_MQ_PORT = 8884; // WICHTIG: Der WSS-Port (meist 8884)
const HIVE_MQ_USER = 'sbwwetter'; // Den Benutzer für die Webseite (siehe Sicherheitshinweis unten!)
const HIVE_MQ_PASS = 'pbd7chu6kba!zrd2GTG';     // Das Passwort für diesen Benutzer
// --- Flexible Topic-Zuordnung ---
const topicMap = {
    // Live-Wert
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
    // NEU: History-Topic für den Graphen
    'haus/historie/aussentemperatur_24h': {
        id: 'aussen-temp-chart'
        // Dieses Topic wird speziell behandelt
    }
};

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart; // Hier speichern wir das Chart-Objekt

// --- NEU: Graph initialisieren ---
function initChart() {
    const ctx = document.getElementById('tempChartCanvas').getContext('2d');
    
    // Verhindern, dass alte Graphen beim Reconnect doppelt gezeichnet werden
    if (window.myLineChart) {
        window.myLineChart.destroy();
    }

    window.myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Zeitstempel (X-Achse)
            datasets: [{
                label: 'Temperatur °C',
                data: [], // Werte (Y-Achse)
                borderColor: 'var(--pico-primary)',
                backgroundColor: 'var(--pico-primary-background)',
                borderWidth: 2,
                fill: false,
                tension: 0.1 // Macht die Linie leicht kurvig
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 12 // Zeigt nicht jeden einzelnen Zeitstempel an
                    }
                },
                y: {
                    beginAtZero: false // Y-Achse muss nicht bei 0 anfangen
                }
            },
            plugins: {
                legend: {
                    display: false // Legende ausblenden (ist im Titel)
                }
            }
        }
    });
    tempChart = window.myLineChart;
}

// --- 3. MQTT-Verbindung ---
const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
const options = {
    clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8),
    username: HIVE_MQ_USER,
    password: HIVE_MQ_PASS,
    clean: true,
};

console.log('Verbinde mit ' + clientUrl);
const client = mqtt.connect(clientUrl, options);

// --- 4. Event-Handler ---

client.on('connect', () => {
    console.log('Erfolgreich mit HiveMQ verbunden!');
    statusElement.textContent = 'Verbunden';
    statusElement.style.backgroundColor = 'var(--pico-color-green-200)';
    statusElement.style.color = 'var(--pico-color-green-700)';

    const topicsToSubscribe = Object.keys(topicMap);
    client.subscribe(topicsToSubscribe, (err) => {
        if (!err) {
            console.log(`Erfolgreich Topics abonniert: ${topicsToSubscribe.join(', ')}`);
        } else {
            console.error('Subscribe-Fehler:', err);
        }
    });
});

// STARK ANGEPASSTER Message-Handler
client.on('message', (topic, payload) => {
    const message = payload.toString();
    console.log(`Nachricht empfangen auf Topic '${topic}': ${message}`);

    const mapping = topicMap[topic];
    if (!mapping) return; // Topic nicht in unserer Map

    // ----- SPEZIALFALL 1: History-Daten für den Graphen -----
    if (mapping.id === 'aussen-temp-chart') {
        try {
            const historyData = JSON.parse(message); // Nachricht ist ein JSON-Array
            
            // Daten für Chart.js aufbereiten
            const labels = historyData.map(d => 
                new Date(d._time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            );
            const dataPoints = historyData.map(d => d._value.toFixed(1)); // Auf eine Kommastelle runden

            // Graph mit den 24h-Daten füllen
            tempChart.data.labels = labels;
            tempChart.data.datasets[0].data = dataPoints;
            tempChart.update();
            console.log('Graph mit 24h-Daten gefüllt.');

        } catch (e) {
            console.error('Fehler beim Parsen der History-JSON:', e);
        }
    
    // ----- SPEZIALFALL 2: Live-Temperatur (Text UND Graph) -----
    } else if (topic === 'home/temp/auszen') {
        // 1. Text-Widget aktualisieren (wie bisher)
        const element = document.getElementById(mapping.id);
        if (element) {
            element.textContent = `${parseFloat(message).toFixed(1)} ${mapping.unit}`;
        }
        
        // 2. Live-Wert zum Graphen hinzufügen
        if (tempChart) {
            // Nur hinzufügen, wenn der Wert sich vom letzten unterscheidet (optional)
            const lastDataPoint = tempChart.data.datasets[0].data.slice(-1)[0];
            if (lastDataPoint != parseFloat(message).toFixed(1)) {
                
                // Neuen Zeitstempel und Wert hinzufügen
                const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                tempChart.data.labels.push(now);
                tempChart.data.datasets[0].data.push(parseFloat(message).toFixed(1));

                // Optional: Alten Wert entfernen, damit der Graph nicht unendlich wird
                // if (tempChart.data.labels.length > 50) { // z.B. max 50 Punkte
                //     tempChart.data.labels.shift();
                //     tempChart.data.datasets[0].data.shift();
                // }

                tempChart.update();
            }
        }
        
    // ----- STANDARD-FALL: Alle anderen Widgets (Luftfeuchte, Regen) -----
    } else {
        const element = document.getElementById(mapping.id);
        if (element) {
            let displayValue = message;
            if (mapping.formatter) {
                displayValue = mapping.formatter(message);
            }
            const unit = mapping.unit || '';
            element.textContent = displayValue + unit;
            
            // Styling für Regen (wie bisher)
            if (topic === 'home/regen/status') {
                if (displayValue.includes('Ja')) {
                    element.style.color = 'var(--pico-color-blue-500)';
                } else {
                    element.style.color = 'var(--pico-color-orange-500)';
                }
            }
        }
    }
});


// Fehler- und Reconnect-Handler (unverändert)
client.on('error', (err) => {
    // ... (unverändert)
});
client.on('reconnect', () => {
    // ... (unverändert)
});


// --- 5. App starten ---
// Zeichne den leeren Graphen, sobald die Seite geladen ist.
initChart();