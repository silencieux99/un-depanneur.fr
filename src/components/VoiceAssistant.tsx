"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2, CheckCircle2, User, Phone as PhoneIcon, AlertCircle } from "lucide-react";

type UserInfo = {
    name: string;
    phone: string;
    location: { lat: number; lng: number } | null;
};

// --- Audio Utils (Downsampling & Base64) ---
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

const SAMPLE_RATE = 16000; // Gemini prefers 16k input

export default function VoiceAssistant() {
    const [captureMode, setCaptureMode] = useState<"idle" | "form" | "chat">("idle");
    const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", phone: "", location: null });
    const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "success" | "error" | "denied">("idle");

    // UI States
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

    // Audio Queue for playback
    const audioQueueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const nextPlayTimeRef = useRef(0);

    // Sync Refs
    useEffect(() => { userInfoRef.current = userInfo; }, [userInfo]);

    // Init & Unload
    useEffect(() => {
        setMounted(true);

        const handleUnload = () => { if (sessionActiveRef.current) sendTelegramRecap("Session interrupted (Unload)"); };
        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, []);

    // Session Management Loop
    useEffect(() => {
        if (captureMode === "chat") {
            startSession();
        } else {
            stopSession();
        }
        // Cleanup on unmount handled by return of effect effectively?
        // For clean transition, we rely on stopSession logic
    }, [captureMode]);

    const sendTelegramRecap = async (reason?: string) => {
        if (!userInfoRef.current.name) return;
        const payload = {
            userInfo: userInfoRef.current,
            history: [{ role: 'system', parts: [{ text: `Session Live Audio ended. Reason: ${reason || 'Normal closure'}` }] }]
        };
        // Simple fire-and-forget logic for cleanup
        try {
            await fetch("/api/telegram", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload), keepalive: true
            });
        } catch { }
    };

    // --- Core Audio & WS Logic ---

    const startSession = async () => {
        setErrorMsg(null);
        setStatus("connecting");
        sessionActiveRef.current = true;

        try {
            // 1. WebSocket Connect
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/gemini`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WS Connected");
                setStatus("connected");
                // Init Audio Input immediately after connection
                initAudioInput();

                // Send User Context as text first
                const contextMsg = {
                    client_content: {
                        turns: [{
                            role: "user",
                            parts: [{ text: `[SYSTEM] Context: Client=${userInfoRef.current.name}, Phone=${userInfoRef.current.phone}, Loc=${JSON.stringify(userInfoRef.current.location)}. You are the Dispatch Operator. Urgent tone.` }]
                        }],
                        turn_complete: true
                    }
                };
                ws.send(JSON.stringify(contextMsg));
            };

            ws.onmessage = async (event) => {
                let data;
                if (event.data instanceof Blob) {
                    data = JSON.parse(await event.data.text());
                } else {
                    data = JSON.parse(event.data);
                }

                handleServerMessage(data);
            };

            ws.onerror = (e) => {
                console.error("WS Error", e);
                setErrorMsg("Erreur de connexion Live.");
                setStatus("disconnected");
            };

            ws.onclose = () => {
                console.log("WS Closed");
                if (status === "connecting" || status === "connected") {
                    setErrorMsg("Connexion interrompue.");
                    setStatus("disconnected");
                }
                // Do not auto-close, let user see error
                // if (captureMode === "chat") setCaptureMode("idle");
            };

        } catch (e) {
            console.error("Start Session Error", e);
            setErrorMsg("Impossible de démarrer l'audio.");
        }
    };

    const stopSession = () => {
        // Close WS
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Stop Mic
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }

        setStatus("disconnected");
        if (sessionActiveRef.current) {
            sendTelegramRecap("Hangup");
            sessionActiveRef.current = false;
        }
    };

    const initAudioInput = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("HTTPS requis pour l'accès micro (ou localhost).");
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true } });
            streamRef.current = stream;

            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext({ sampleRate: SAMPLE_RATE }); // Try to match
            audioCtxRef.current = ctx;

            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Use ScriptProcessor for raw data access (AudioWorklet is better but more complex to inline)
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                // Calculate volume for UI
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                setVolumeLevel(Math.sqrt(sum / inputData.length));

                // Send to WS
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    // Downsample handled by Context if supported, otherwise sending raw buffer (Gemini is robust but prefers 16k)
                    // Convert to 16-bit PCM
                    const pcmData = floatTo16BitPCM(inputData);
                    const base64Audio = arrayBufferToBase64(pcmData);

                    const msg = {
                        realtime_input: {
                            media_chunks: [{
                                mime_type: "audio/pcm",
                                data: base64Audio
                            }]
                        }
                    };
                    wsRef.current.send(JSON.stringify(msg));
                }
            };

            source.connect(processor);
            processor.connect(ctx.destination); // Required for script processor to run, but mute connection to avoid loopback?
            // Actually connecting to destination plays mic back to speakers! BAD!
            // We must NOT connect to destination to avoid self-hear loop usually.
            // But ScriptProcessor creates silence if not connected in some browsers.
            // Solution: Connect to a GainNode with gain 0 then to destination.

            const muteNode = ctx.createGain();
            muteNode.gain.value = 0;
            processor.connect(muteNode);
            muteNode.connect(ctx.destination);

            setStatus("listening");

        } catch (e) {
            console.error("Audio Input Error", e);
            setErrorMsg("Accès micro refusé.");
        }
    };

    const handleServerMessage = (data: any) => {
        // Handle Server Content (Audio)
        // Structure: data.serverContent.modelTurn.parts[].inlineData
        if (data.serverContent?.modelTurn?.parts) {
            setStatus("speaking");
            data.serverContent.modelTurn.parts.forEach((part: any) => {
                if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                    const base64 = part.inlineData.data;
                    const byteCharacters = atob(base64);
                    const byteNumbers = new Uint8Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const pcm16 = new Int16Array(byteNumbers.buffer);

                    // Convert Int16 PCM to Float32 for Web Audio
                    const float32 = new Float32Array(pcm16.length);
                    for (let i = 0; i < pcm16.length; i++) {
                        float32[i] = pcm16[i] / 32768;
                    }

                    queueAudio(float32);
                }
            });
        }

        // Handle turn complete -> back to listening visual
        if (data.serverContent?.turnComplete) {
            setStatus("listening");
        }
    };

    const queueAudio = (floatData: Float32Array) => {
        audioQueueRef.current.push(floatData);
        if (!isPlayingRef.current) {
            playQueue();
        }
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

        // Play chunk
        const buffer = audioCtxRef.current.createBuffer(1, chunk.length, 24000); // Gemini output is usually 24k
        buffer.getChannelData(0).set(chunk);

        const source = audioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);
        source.start(nextPlayTimeRef.current);

        // Accurate scheduling for gapless playback
        const duration = buffer.duration;
        const now = audioCtxRef.current.currentTime;
        // Schedule next
        nextPlayTimeRef.current = Math.max(now + duration, nextPlayTimeRef.current + duration);

        // Not ideal to wait recursively here but simple enough for POC
        source.onended = () => {
            playQueue();
        };
        // Or actually we should trigger playQueue immediately for next chunks if we use proper scheduling logic
        // But Scheduler is hard. Let's rely on onended for now (adds tiny gap)
    };

    // --- UI Handlers ---
    const triggerGeolocation = () => {
        setGeoStatus("locating");
        if (!("geolocation" in navigator)) { setGeoStatus("error"); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => { setUserInfo(p => ({ ...p, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } })); setGeoStatus("success"); },
            () => setGeoStatus("error"), { enableHighAccuracy: true }
        );
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userInfo.name && userInfo.phone) {
            setCaptureMode("chat"); // Triggers StartSession effect
        }
    };

    const toggleListening = () => {
        // Act as Hang Up Only
        setCaptureMode("idle");
    };

    return (
        <>
            <div className="w-full flex justify-center sticky bottom-6 md:relative md:bottom-auto z-40 px-4 md:px-0">
                {captureMode === "idle" && (
                    <motion.div layout whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setCaptureMode("form"); triggerGeolocation(); }} className="relative group bg-white/10 backdrop-blur-xl border border-white/30 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] p-2 cursor-pointer animate-[pulse_1.5s_ease-in-out_infinite]">
                        <span className="absolute inset-0 rounded-full border border-blue-400 opacity-60 animate-ping" />
                        <button className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-lg z-10"><Volume2 className="w-8 h-8 animate-pulse text-blue-600" /></button>
                    </motion.div>
                )}
            </div>

            {mounted && createPortal(
                <AnimatePresence>
                    {captureMode === "chat" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-black h-[100dvh] py-8 md:py-12 px-6">
                            <div className="absolute inset-0 bg-black z-0" />
                            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-black z-[1]" />

                            <div className="w-full max-w-lg flex justify-between relative z-20">
                                <span className="text-blue-400 font-mono text-xs uppercase tracking-widest">{status === "speaking" ? "ASSISTANT PARLE" : status === "listening" ? "ÉCOUTE..." : "CONNEXION..."}</span>
                                <button onClick={toggleListening}><AlertCircle className="w-6 h-6 text-white/50" /></button>
                            </div>

                            <div className="flex flex-col items-center justify-center gap-8 z-20">
                                {errorMsg ? (
                                    <div className="text-red-500 font-bold bg-red-900/20 p-4 rounded border border-red-500/30">{errorMsg}</div>
                                ) : (
                                    <>
                                        {/* Orb Visualizer */}
                                        <motion.div
                                            animate={{
                                                scale: status === "speaking" ? [1, 1.2, 1] : status === "listening" ? [1, 1 + volumeLevel * 4, 1] : 1,
                                                borderColor: status === "speaking" ? "rgba(59, 130, 246, 0.8)" : "rgba(255, 255, 255, 0.2)"
                                            }}
                                            transition={{ ease: "linear", duration: 0.1 }}
                                            className="w-40 h-40 rounded-full border-4 border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-md shadow-[0_0_60px_rgba(59,130,246,0.2)]"
                                        >
                                            <div className="w-20 h-20 rounded-full bg-blue-500/20 blur-xl" />
                                        </motion.div>
                                        <h2 className="text-white/80 text-lg font-light">Conversation en direct</h2>
                                    </>
                                )}
                            </div>

                            <div className="relative z-20 pb-8">
                                <button onClick={toggleListening} className="w-20 h-20 bg-red-600 rounded-full text-white shadow-xl flex items-center justify-center hover:bg-red-500 transition-colors">
                                    <MicOff className="w-8 h-8" />
                                </button>
                                <p className="text-center text-xs text-white/40 mt-4">Raccrocher</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body)}

            {mounted && createPortal(
                <AnimatePresence>
                    {captureMode === "form" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <motion.div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6" initial={{ y: 50 }} animate={{ y: 0 }}>
                                <h3 className="text-xl text-white font-bold mb-4">Urgence Dépannage</h3>
                                <form onSubmit={handleFormSubmit} className="space-y-4">
                                    <div><label className="text-xs text-slate-400">NOM</label><input type="text" required className="w-full bg-slate-800 text-white p-3 rounded border border-slate-700" value={userInfo.name} onChange={e => setUserInfo({ ...userInfo, name: e.target.value })} /></div>
                                    <div><label className="text-xs text-slate-400">TÉLÉPHONE</label><input type="tel" required className="w-full bg-slate-800 text-white p-3 rounded border border-slate-700" value={userInfo.phone} onChange={e => setUserInfo({ ...userInfo, phone: e.target.value })} /></div>
                                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg">LANCER APPEL LIVE</button>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>, document.body
            )}
        </>
    );
}
