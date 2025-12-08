const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Charger les variables d'env locales si en dev
if (dev) {
    require('dotenv').config({ path: '.env.local' });
}

const PORT = 3000;

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const { pathname } = parse(request.url);

        if (pathname === '/ws/gemini') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    wss.on('connection', (ws) => {
        console.log('Client connected to Gemini Proxy');

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.error("No API Key found");
            ws.close(1008, "API Key missing");
            return;
        }

        // Connexion à Gemini Live API
        // Modèle demandé : gemini-2.5-flash-live (hypothétique, on utilise le standard v1alpha host)
        // L'URL standard pour le live multi-modal
        const targetUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        let googleWs = null;

        try {
            googleWs = new WebSocket(targetUrl);
        } catch (e) {
            console.error("Failed to create Google WS", e);
            ws.close();
            return;
        }

        googleWs.on('open', () => {
            console.log('Connected to Google Gemini Live');
            // Envoyer la configuration initiale si nécessaire
            const setupMsg = {
                setup: {
                    model: "models/gemini-2.0-flash-exp", // Utilisons le modèle expérimental Flash 2.0 qui supporte le Bidi (le plus proche de "2.5" demandé et disponible en live)
                    generationConfig: {
                        responseModalities: ["AUDIO"] // On veut que l'audio en retour pour le live
                    }
                }
            };
            googleWs.send(JSON.stringify(setupMsg));
        });

        googleWs.on('message', (data) => {
            // Relayer la réponse Google vers le Client
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        googleWs.on('error', (error) => {
            console.error('Google WS Error:', error);
            if (ws.readyState === WebSocket.OPEN) ws.close(1011, "Upstream Error");
        });

        googleWs.on('close', () => {
            console.log('Google WS Closed');
            if (ws.readyState === WebSocket.OPEN) ws.close();
        });

        // Relayer les messages Client vers Google
        ws.on('message', (message) => {
            if (googleWs && googleWs.readyState === WebSocket.OPEN) {
                googleWs.send(message);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            if (googleWs && googleWs.readyState === WebSocket.OPEN) {
                googleWs.close();
            }
        });
    });

    server.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${PORT} with WebSocket support`);
    });
});
