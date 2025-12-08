const WebSocket = require('ws');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_API_KEY;
const model = "models/gemini-2.5-flash-native-audio-preview-09-2025";
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log("--- TEST CONNECTION GEMINI LIVE ---");
console.log(`Model: ${model}`);
console.log(`API Key present: ${!!apiKey}`);

if (!apiKey) {
    console.error("ERREUR: Pas de clé API trouvée dans .env.local");
    process.exit(1);
}

console.log("Connecting to WebSocket...");
const ws = new WebSocket(url);

ws.on('open', () => {
    console.log("✅ WebSocket Connected!");

    // 1. Send Setup Message
    const setupMsg = {
        setup: {
            model: model,
            generationConfig: {
                responseModalities: ["AUDIO"]
            }
        }
    };
    console.log("Sending Setup Config...");
    ws.send(JSON.stringify(setupMsg));

    // 2. Send Hello Message after a short delay
    setTimeout(() => {
        const clientContent = {
            client_content: {
                turns: [{
                    role: "user",
                    parts: [{ text: "Hello, this is a test." }]
                }],
                turn_complete: true
            }
        };
        console.log("Sending Test Message...");
        ws.send(JSON.stringify(clientContent));
    }, 1000);
});

ws.on('message', (data) => {
    const str = data.toString();
    console.log("📩 Received Message from Gemini:", str.substring(0, 200) + (str.length > 200 ? "..." : ""));

    try {
        const json = JSON.parse(str);
        if (json.serverContent?.modelTurn) {
            console.log("✅ Received Audio/Content Response!");
            // Success, we can close
            console.log("Test Successful. Closing...");
            ws.close();
            process.exit(0);
        }
    } catch (e) { }
});

ws.on('error', (error) => {
    console.error("❌ WebSocket Error:", error.message);
});

ws.on('close', (code, reason) => {
    console.log(`⚠️ WebSocket Closed. Code: ${code}, Reason: ${reason}`);
    if (code !== 1000 && code !== 1005) {
        console.error("FAILED: Connection closed with error code.");
    }
});
