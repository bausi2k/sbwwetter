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

// --- Helper-Funktion (zum Setzen der CSS-Klasse) - MIT DEBUG ---
function setMuellStyle(widgetElement, payload) {
    console.log('========================================');
    console.log('🗑️ setMuellStyle aufgerufen!');
    console.log('Widget Element:', widgetElement);
    console.log('Widget Element ID:', widgetElement ? widgetElement.id : 'NICHT GEFUNDEN');
    console.log('Payload (original):', `"${payload}"`);
    console.log('Payload Länge:', payload.length);
    console.log('Payload Bytes:', Array.from(payload).map(c => c.charCodeAt(0)));
    
    // Alle alten Klassen entfernen
    widgetElement.classList.remove('muell-rest', 'muell-gelb', 'muell-bio', 'muell-papier');
    console.log('Alte Klassen entfernt');
    
    const lowerPayload = payload.trim().toLowerCase();
    console.log('Payload (lowercase & trimmed):', `"${lowerPayload}"`);
    
    // Teste alle Bedingungen einzeln
    console.log('Test "restmüll":', lowerPayload.includes('restmüll'));
    console.log('Test "restmuell":', lowerPayload.includes('restmuell'));
    console.log('Test "gelber sack":', lowerPayload.includes('gelber sack'));
    console.log('Test "biotonne":', lowerPayload.includes('biotonne'));
    console.log('Test "altpapier":', lowerPayload.includes('altpapier'));

    if (lowerPayload.includes('restmüll') || lowerPayload.includes('restmuell')) {
        console.log('✅ MATCH: Restmüll - Füge Klasse "muell-rest" hinzu');
        widgetElement.classList.add('muell-rest');
    } else if (lowerPayload.includes('gelber sack')) {
        console.log('✅ MATCH: Gelber Sack - Füge Klasse "muell-gelb" hinzu');
        widgetElement.classList.add('muell-gelb');
    } else if (lowerPayload.includes('biotonne')) {
        console.log('✅ MATCH: Biotonne - Füge Klasse "muell-bio" hinzu');
        widgetElement.classList.add('muell-bio');
    } else if (lowerPayload.includes('altpapier')) {
        console.log('✅ MATCH: Altpapier - Füge Klasse "muell-papier" hinzu');
        widgetElement.classList.add('muell-papier');
    } else {
        console.log('❌ KEIN MATCH gefunden!');
    }
    
    console.log('Finale Klassen:', widgetElement.className);
    console.log('========================================');
}

// --- Graph initialisieren ---
function initChart() {
    const ctx = document.getElementById('tempChartCanvas').getContext('2d');
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


// --- 3. MQTT-Verbindung ---
const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
const options = { 
    clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8), 
    username: HIVE_MQ_USER, 
    password: HIVE_MQ_PASS, 
    clean: true 
};
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
    console.log(`📨 Nachricht empfangen auf Topic '${topic}': "${message}"`);

    const mapping = topicMap[topic];
    if (!mapping) {
        console.log('⚠️ Kein Mapping für dieses Topic gefunden');
        return;
    }

    console.log('Mapping gefunden:', mapping);

    // ----- SPEZIALFALL 1: History-Daten für den Graphen -----
    if (mapping.id === 'aussen-temp-chart') {
        try {
            const historyData = JSON.parse(message);
            const labels = historyData.map(d => new Date(d._time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
            const dataPoints = historyData.map(d => d._value.toFixed(1));
            tempChart.data.labels = labels;
            tempChart.data.datasets[0].data = dataPoints;
            tempChart.update();
            console.log('Graph mit 24h-Daten gefüllt.');
        } catch (e) { 
            console.error('Fehler beim Parsen der History-JSON:', e); 
        }

    // ----- SPEZIALFALL 2: Live-Temperatur (Text UND Graph) -----
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

    // ----- STANDARD-FALL: Alle anderen Widgets -----
    } else {
        console.log(`📝 Standard-Widget-Verarbeitung für ${mapping.id}`);
        const element = document.getElementById(mapping.id);
        
        if (!element) {
            console.error(`❌ Element mit ID "${mapping.id}" nicht gefunden!`);
            return;
        }
        
        console.log('Element gefunden:', element);
        
        let displayValue = message;
        if (mapping.formatter) {
            displayValue = mapping.formatter(message);
            console.log('Formatter angewendet:', displayValue);
        }
        
        const unit = mapping.unit || '';
        element.textContent = displayValue + unit;
        console.log('Text gesetzt:', displayValue + unit);

        // Styling für Regen
        if (topic === 'home/regen/status') {
            if (displayValue.includes('Ja')) {
                element.style.color = 'var(--pico-color-blue-500)';
            } else {
                element.style.color = 'var(--pico-color-orange-500)';
            }
        }

        // Logik für Müll
        if (mapping.widgetId) {
            console.log(`🗑️ Müll-Widget erkannt! widgetId: ${mapping.widgetId}`);
            const widgetElement = document.getElementById(mapping.widgetId);
            
            if (!widgetElement) {
                console.error(`❌ Widget-Element mit ID "${mapping.widgetId}" nicht gefunden!`);
            } else {
                console.log('✅ Widget-Element gefunden, rufe setMuellStyle auf...');
                setMuellStyle(widgetElement, message);
            }
        } else {
            console.log('ℹ️ Kein widgetId definiert (kein Müll-Widget)');
        }
    }
});


// Fehler- und Reconnect-Handler
client.on('error', (err) => {
    console.error('Verbindungsfehler:', err);
    statusElement.textContent = 'Fehler!';
    statusElement.style.backgroundColor = 'var(--pico-color-red-200)';
    statusElement.style.color = 'var(--pico-color-red-700)';
    client.end();
});

client.on('reconnect', () => {
    console.log('Versuche Wiederverbindung...');
    statusElement.textContent = 'Wiederverbindung...';
    statusElement.style.backgroundColor = 'var(--pico-color-orange-200)';
    statusElement.style.color = 'var(--pico-color-orange-700)';
});

// --- 5. App starten ---
console.log('🚀 App wird initialisiert...');
initChart();
console.log('✅ Chart initialisiert');