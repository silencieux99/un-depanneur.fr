"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Loader2, CheckCircle2, User, Phone, ShieldCheck, Activity, X } from "lucide-react";

// --- Configuration ---
const SAMPLE_RATE = 16000;

// --- Canvas Visualizer Component ---
const CanvasVisualizer = ({ mode, volume }: { mode: string, volume: number }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let phase = 0;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            ctx.clearRect(0, 0, width, height);

            // Settings responsive to mode/volume
            let amplitude = mode === 'listening' ? 50 + (volume * 400) : mode === 'speaking' ? 40 + (volume * 150) : 10;
            let speed = mode === 'speaking' ? 0.2 : 0.05;
            // Colors: Emerald (Listening), Blue (Speaking), Amber (Connecting)
            let colorStr = mode === 'speaking' ? '96, 165, 250' : mode === 'listening' ? '52, 211, 153' : '251, 191, 36';

            if (mode === 'connecting') { amplitude = 20; speed = 0.1; }

            phase += speed;

            // Draw 3 layers of waves for 3D depth effect
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.lineWidth = i === 1 ? 3 : 1; // Main line thicker
                ctx.strokeStyle = `rgba(${colorStr}, ${0.8 - (i * 0.2)})`;

                for (let x = 0; x < width; x++) {
                    // Complex wave math for organic "Siri/Jarvis" look
                    // Combines sine waves with different frequencies and phases
                    const y = centerY +
                        Math.sin((x * 0.008) + phase + (i * 0.5)) * amplitude * Math.sin(x / width * Math.PI) + // Main carrier
                        Math.sin((x * 0.02) + phase * 1.5) * (amplitude * 0.3); // Detail

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // Central Glow
            if (mode === 'speaking' || (mode === 'listening' && volume > 0.05)) {
                const gradient = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, 300);
                gradient.addColorStop(0, `rgba(${colorStr}, 0.15)`);
                gradient.addColorStop(1, `rgba(${colorStr}, 0)`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
            }

            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
        };
    }, [mode, volume]);

    return <canvas ref={canvasRef} className="absolute inset-0 z-0 w-full h-full" />;
};

// --- Audio Utils (Restored) ---
function floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

type UserInfo = {
    name: string;
    phone: string;
    location: { lat: number; lng: number } | null;
};

export default function VoiceAssistant() {
    const [captureMode, setCaptureMode] = useState<"idle" | "form" | "chat">("idle");
    const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", phone: "", location: null });
    const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "success" | "error" | "denied">("idle");

    // Status & UI
    const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "listening" | "speaking">("disconnected");
    const [volumeLevel, setVolumeLevel] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Refs
    const userInfoRef = useRef<UserInfo>({ name: "", phone: "", location: null });
    const sessionActiveRef = useRef(false);
    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Audio Queue
    const audioQueueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const nextPlayTimeRef = useRef(0);

    // Sync Refs
    useEffect(() => { userInfoRef.current = userInfo; }, [userInfo]);

    useEffect(() => {
        setMounted(true);
        const handleUnload = () => { if (sessionActiveRef.current) sendTelegramRecap("Interruption navigateur"); };
        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, []);

    useEffect(() => {
        if (captureMode === "chat") {
            startSession();
        } else {
            stopSession();
        }
    }, [captureMode]);

    const sendTelegramRecap = async (reason?: string) => {
        if (!userInfoRef.current.name) return;
        const payload = {
            userInfo: userInfoRef.current,
            history: [{ role: 'system', parts: [{ text: `Session terminée. Raison: ${reason || 'Fin appel'}` }] }]
        };
        try {
            await fetch("/api/telegram", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload), keepalive: true
            });
        } catch { }
    };

    // --- Core Session Hardware ---
    const startSession = async () => {
        setErrorMsg(null);
        setStatus("connecting");
        sessionActiveRef.current = true;

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/gemini`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus("connected");
                initAudioInput();

                // USER SCENARIO CONFIGURATION
                ws.send(JSON.stringify({
                    client_content: {
                        turns: [{
                            role: "user",
                            parts: [{
                                text: `[SYSTEM] Tu es Sarah, régulatrice d'urgence. Le client s'appelle ${userInfoRef.current.name}.
SCÉNARIO OBLIGATOIRE :
1. Dis d'abord : "Bonjour ${userInfoRef.current.name}, quel est votre problème ?"
2. Attends sa réponse.
3. RASSURE-LE, puis dis : "Ne vous inquiétez pas. Nous avons reçu votre géolocalisation. Le dépanneur le plus proche vous rappellera dans 5 minutes excates."
Donne des réponses courtes et rassurantes.` }]
                        }],
                        turn_complete: true
                    }
                }));
            };

            ws.onmessage = async (event) => {
                let data = event.data instanceof Blob ? JSON.parse(await event.data.text()) : JSON.parse(event.data);
                handleServerMessage(data);
            };

            ws.onerror = () => {
                setErrorMsg("Connexion impossible au serveur vocal.");
                setStatus("disconnected");
            };

            ws.onclose = () => {
                if (status === "connecting" || status === "connected") {
                    setErrorMsg("Appel interrompu.");
                    setStatus("disconnected");
                }
            };

        } catch (e) {
            setErrorMsg("Erreur d'initialisation.");
        }
    };

    const stopSession = () => {
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (scriptProcessorRef.current) { scriptProcessorRef.current.disconnect(); scriptProcessorRef.current = null; }
        if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
        if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }

        setStatus("disconnected");
        if (sessionActiveRef.current) {
            sendTelegramRecap("Raccroché");
            sessionActiveRef.current = false;
        }
    };

    const initAudioInput = async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error("Accès micro refusé.");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            streamRef.current = stream;

            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
            audioCtxRef.current = ctx;

            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                // Volume Meter Check
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                setVolumeLevel(rms); // Updates React State for Visualizer!

                // Send Audio to Gemini
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        realtime_input: {
                            media_chunks: [{ mime_type: "audio/pcm", data: arrayBufferToBase64(floatTo16BitPCM(inputData)) }]
                        }
                    }));
                }
            };

            const mute = ctx.createGain();
            mute.gain.value = 0;
            source.connect(processor);
            processor.connect(mute);
            mute.connect(ctx.destination);
            setStatus("listening");

        } catch (e) {
            setErrorMsg("Microphone inaccessible (HTTPS requis).");
        }
    };

    const handleServerMessage = (data: any) => {
        if (data.serverContent?.modelTurn?.parts) {
            setStatus("speaking");
            data.serverContent.modelTurn.parts.forEach((part: any) => {
                if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                    // Native Audio Output Only
                    const byteCharacters = atob(part.inlineData.data);
                    const byteNumbers = new Uint8Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                    const pcm16 = new Int16Array(byteNumbers.buffer);
                    const float32 = new Float32Array(pcm16.length);
                    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
                    queueAudio(float32);
                }
            });
        }
        if (data.serverContent?.turnComplete) {
            setStatus("listening");
        }
    };

    const queueAudio = (floatData: Float32Array) => {
        audioQueueRef.current.push(floatData);
        if (!isPlayingRef.current) playQueue();
    };

    const playQueue = async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setStatus("listening");
            return;
        }
        isPlayingRef.current = true;
        const chunk = audioQueueRef.current.shift();
        if (!chunk || !audioCtxRef.current) return;

        const buffer = audioCtxRef.current.createBuffer(1, chunk.length, 24000);
        buffer.getChannelData(0).set(chunk);

        const source = audioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);
        source.start(nextPlayTimeRef.current);

        const now = audioCtxRef.current.currentTime;
        nextPlayTimeRef.current = Math.max(now + buffer.duration, nextPlayTimeRef.current + buffer.duration);
        source.onended = () => playQueue();
    };

    // --- Modal Logic ---
    const triggerGeolocation = () => {
        setGeoStatus("locating");
        if (!navigator.geolocation) { setGeoStatus("error"); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => { setUserInfo(p => ({ ...p, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } })); setGeoStatus("success"); },
            () => setGeoStatus("error"),
            { enableHighAccuracy: true }
        );
    };

    const handleStart = () => {
        // iOS unlock audio context (silent)
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            osc.frequency.value = 1;
            osc.connect(ctx.destination);
            osc.start(0);
            osc.stop(0.1);
        }
        setCaptureMode("form");
        triggerGeolocation();
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userInfo.name && userInfo.phone) setCaptureMode("chat");
    };

    return (
        <>
            {/* Fab Button */}
            <div className="w-full flex justify-center sticky bottom-6 md:relative md:bottom-auto z-40 px-4 md:px-0">
                {captureMode === "idle" && (
                    <motion.div layout whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleStart} className="relative group bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.6)] p-3 cursor-pointer animate-[pulse_3s_ease-in-out_infinite]">
                        <div className="absolute inset-0 rounded-full border border-blue-400 opacity-20 animate-ping" />
                        <button className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-xl z-10">
                            <Volume2 className="w-8 h-8 text-blue-600" />
                        </button>
                    </motion.div>
                )}
            </div>

            {mounted && createPortal(
                <AnimatePresence>
                    {/* --- PREMIUM FORM MODAL --- */}
                    {captureMode === "form" && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                            onClick={() => setCaptureMode("idle")}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-sm bg-[#050510]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5"
                            >
                                <div className="px-8 pt-8 pb-6 text-center">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                                        <ShieldCheck className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <h3 className="text-xl font-medium text-white tracking-tight">Connexion Sécurisée</h3>
                                    <p className="text-sm text-slate-400 mt-2 font-light leading-relaxed">
                                        Veuillez vous identifier pour accéder au service d'assistance prioritaire.
                                    </p>
                                </div>

                                <form onSubmit={handleFormSubmit} className="px-8 pb-8 space-y-5">
                                    <div className="space-y-4">
                                        <div className="group relative">
                                            <User className="absolute left-0 top-3 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                            <input
                                                type="text" required placeholder="Votre Nom"
                                                className="w-full bg-transparent border-b border-white/10 py-2.5 pl-8 text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all font-light"
                                                value={userInfo.name} onChange={e => setUserInfo({ ...userInfo, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="group relative">
                                            <Phone className="absolute left-0 top-3 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                            <input
                                                type="tel" required placeholder="Numéro de Téléphone"
                                                className="w-full bg-transparent border-b border-white/10 py-2.5 pl-8 text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all font-light"
                                                value={userInfo.phone} onChange={e => setUserInfo({ ...userInfo, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Geo Status Minimalist */}
                                    <div className="flex items-center justify-center gap-2 py-2">
                                        {geoStatus === 'locating' && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                                        {geoStatus === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                        <span className={`text-xs ${geoStatus === 'success' ? 'text-emerald-500' : 'text-slate-500'}`}>
                                            {geoStatus === 'locating' ? 'Localisation en cours...' : geoStatus === 'success' ? 'Position sécurisée' : 'Localisation requise'}
                                        </span>
                                    </div>

                                    <button
                                        type="submit" disabled={!userInfo.name || !userInfo.phone}
                                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Établir la Connexion
                                    </button>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* --- FULLSCREEN AUDIO VISUALIZER --- */}
                    {captureMode === "chat" && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center overflow-hidden"
                        >
                            {/* Background Atmosphere */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black opacity-80" />

                            {/* Header (Minimal) */}
                            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-50">
                                <div>
                                    <div className="flex items-center gap-2 backdrop-blur-md bg-white/5 rounded-full px-4 py-1.5 border border-white/5">
                                        <Activity className={`w-4 h-4 ${status === 'connected' || status === 'listening' ? "text-emerald-500" : "text-amber-500"}`} />
                                        <span className="text-[10px] font-mono text-white/60 uppercase tracking-[0.2em] pt-0.5">
                                            {status === 'connected' ? 'CANAL SÉCURISÉ' : status === 'listening' ? 'ÉCOUTE ACTIVE' : status === 'speaking' ? 'TRANSMISSION IA' : 'INITIALISATION...'}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setCaptureMode("idle")} className="p-3 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* CANVAS VISUALIZER LAYER */}
                            <CanvasVisualizer mode={status} volume={volumeLevel} />

                            {/* Error Message Layer */}
                            {errorMsg && (
                                <div className="absolute z-50 text-red-300 font-light border border-red-500/20 bg-red-950/80 px-6 py-4 rounded-xl backdrop-blur-md max-w-xs text-center shadow-lg shadow-red-900/20">
                                    {errorMsg}
                                </div>
                            )}

                            {/* Bottom Control */}
                            <div className="absolute bottom-12 z-50 flex flex-col items-center gap-4">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setCaptureMode("idle")}
                                    className="w-20 h-20 rounded-full bg-red-500/10 backdrop-blur-md border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 shadow-[0_0_30px_rgba(220,38,38,0.2)]"
                                >
                                    <Phone className="w-8 h-8 rotate-[135deg]" />
                                </motion.button>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
