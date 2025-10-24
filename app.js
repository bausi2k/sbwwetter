// --- 1. Konfiguration ---
// BITTE NOCHMAL GENAU PRÜFEN UND KOPIEREN:
const HIVE_MQ_HOST = 'bb23c26981ce486a9de6a8d83cff9f90.s1.eu.hivemq.cloud';
const HIVE_MQ_PORT = 8884;
const HIVE_MQ_USER = 'sbwwetter';
const HIVE_MQ_PASS = 'pbd7chu6kba!zrd2GTG'; // <-- Genau kopieren!

// --- Flexible Topic-Zuordnung ---
const topicMap = { /* ... (unverändert) ... */ };

// --- 2. Globale Variablen ---
const statusElement = document.getElementById('status');
let tempChart;
let regenChart;
let client; // MQTT Client global machen

// --- 3. Helper-Funktionen ---
function setMuellStyle(widgetElement, payload) { /* ... (unverändert) ... */ }
function setUnwetterStyle(widgetElement, payload) { /* ... (unverändert) ... */ }
function initRegenChart() { /* ... (unverändert, nutzt feste Hex-Farbe #2196F3) ... */ }
function initChart() { /* ... (unverändert) ... */ }

// --- 4. App starten ---
console.log('App wird initialisiert...');
initChart();
initRegenChart();
console.log('Charts initialisiert.');

// --- 5. MQTT verbinden (MIT MEHR DEBUGGING) ---

const clientUrl = `wss://${HIVE_MQ_HOST}:${HIVE_MQ_PORT}/mqtt`;
const options = {
    clientId: 'mein-web-dashboard-' + Math.random().toString(16).substr(2, 8),
    username: HIVE_MQ_USER,
    password: HIVE_MQ_PASS,
    clean: true,
    // Optional: Längeres Timeout versuchen
    connectTimeout: 10000 // 10 Sekunden (Standard ist 4s)
};

console.log('Versuche MQTT-Verbindung mit Optionen:', options);
try {
    // Versuche, die Verbindung herzustellen
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
        // ... (Dieser Teil ist unverändert) ...
        const message = payload.toString();
        // console.log(`Nachricht empfangen auf Topic '${topic}': "${message}"`); // Kann man wieder aktivieren bei Bedarf
        const mapping = topicMap[topic];
        if (!mapping) return;
        // ... (Rest der Message-Logik unverändert) ...
    });

    // ERWEITERTER ERROR HANDLER
    client.on('error', (err) => {
        console.error('🔥🔥🔥 MQTT Error Event ausgelöst! Fehler:', err);
        console.error('Fehlercode:', err.code);
        console.error('Fehlermeldung:', err.message);
        statusElement.textContent = 'Verbindungsfehler!';
        statusElement.style.backgroundColor = 'var(--pico-color-red-200)';
        statusElement.style.color = 'var(--pico-color-red-700)';
        // client.end(); // Nicht automatisch beenden, damit Reconnect versucht wird
    });

    client.on('reconnect', () => {
        console.log('⏳ MQTT Reconnect Event ausgelöst! Versuche Wiederverbindung...');
        statusElement.textContent = 'Wiederverbindung...';
        statusElement.style.backgroundColor = 'var(--pico-color-orange-200)';
        statusElement.style.color = 'var(--pico-color-orange-700)';
    });

    client.on('close', () => {
        console.log('🚪 MQTT Close Event ausgelöst! Verbindung geschlossen.');
        // Status nicht ändern, Reconnect wird wahrscheinlich versuchen
    });

    client.on('offline', () => {
        console.log('🔌 MQTT Offline Event ausgelöst! Client ist offline.');
        statusElement.textContent = 'Offline';
        statusElement.style.backgroundColor = 'var(--pico-color-gray-300)';
        statusElement.style.color = 'var(--pico-color-gray-700)';
    });

} catch (e) {
    // Fängt Fehler ab, die *direkt* beim Aufruf von mqtt.connect passieren (sehr selten)
    console.error('💥💥💥 Kritischer Fehler BEIM AUFRUF von mqtt.connect:', e);
    statusElement.textContent = 'Init-Fehler!';
    statusElement.style.backgroundColor = 'var(--pico-color-red-200)';
    statusElement.style.color = 'var(--pico-color-red-700)';
}