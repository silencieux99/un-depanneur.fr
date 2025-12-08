"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2, CheckCircle2, User, Phone as PhoneIcon, AlertCircle } from "lucide-react";

type Message = {
    role: "user" | "model";
    parts: [{ text: string }];
};

type UserInfo = {
    name: string;
    phone: string;
    location: { lat: number; lng: number } | null;
};

export default function VoiceAssistant() {
    const [captureMode, setCaptureMode] = useState<"idle" | "form" | "chat">("idle");
    const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", phone: "", location: null });
    const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "success" | "error" | "denied">("idle");
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);

    // Refs for state access in callbacks/unmount
    const messagesRef = useRef<Message[]>([]);
    const userInfoRef = useRef<UserInfo>({ name: "", phone: "", location: null });
    const sessionActiveRef = useRef(false);

    const [transcript, setTranscript] = useState("");
    const [completed, setCompleted] = useState(false);
    const [mounted, setMounted] = useState(false);

    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    // Keep refs detailed synced with state
    useEffect(() => {
        userInfoRef.current = userInfo;
    }, [userInfo]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const sendTelegramRecap = async () => {
        console.log("Sending Telegram recap...", userInfoRef.current);
        if (!userInfoRef.current.name || !userInfoRef.current.phone) return;

        const payload = {
            userInfo: userInfoRef.current,
            history: messagesRef.current
        };

        try {
            // Use fetch with keepalive which is better supported for unloads than sendBeacon for JSON
            await fetch("/api/telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (error) {
            console.error("Failed to send Telegram recap", error);
            // Fallback to sendBeacon if fetch fails (rare case)
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon('/api/telegram', blob);
        }
    };

    // Initialization
    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const SpeechRecognition =
                (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = "fr-FR";

                recognition.onstart = () => setIsListening(true);
                recognition.onend = () => setIsListening(false);
                recognition.onerror = (e: any) => console.error("Speech error", e);

                recognition.onresult = (event: any) => {
                    let finalTranscript = "";
                    let interimTranscript = "";

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }

                    if (interimTranscript) setTranscript(interimTranscript);
                    if (finalTranscript) {
                        setTranscript(finalTranscript);
                        handleUserMessage(finalTranscript);
                    }
                };
                recognitionRef.current = recognition;
            }

            synthRef.current = window.speechSynthesis;
        }

        // Handle Unload / Visibility Change
        const handleUnload = () => {
            if (sessionActiveRef.current) {
                sendTelegramRecap();
            }
        };

        // Covering both unload and visibilitychange maximizes chances on mobile
        window.addEventListener("beforeunload", handleUnload);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === 'hidden' && sessionActiveRef.current) {
                sendTelegramRecap();
            }
        });

        return () => {
            window.removeEventListener("beforeunload", handleUnload);
            // Note: event listener referencing sessionActiveRef.current works because ref persists
        };

    }, []);

    // Session State Management & Cleanup
    useEffect(() => {
        if (captureMode === "idle") {
            // Cleanup media first
            try {
                recognitionRef.current?.stop();
            } catch (e) { }
            if (synthRef.current) synthRef.current.cancel();
            setIsListening(false);
            setIsSpeaking(false);

            // Send Recap Logic
            if (sessionActiveRef.current) {
                sendTelegramRecap();
                sessionActiveRef.current = false;
                setMessages([]);
                setTranscript("");
            }
        } else if (captureMode === "chat" && recognitionRef.current && !isListening) {
            // START SESSION
            console.log("Auto-starting microphone...");
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Auto-start mic failed (already active?):", e);
            }
        }
    }, [captureMode]);

    const triggerGeolocation = () => {
        setGeoStatus("locating");

        if (!("geolocation" in navigator)) {
            setGeoStatus("error");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserInfo(prev => ({
                    ...prev,
                    location: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }
                }));
                setGeoStatus("success");
            },
            (error) => {
                if (error.code !== 1) {
                    console.error("Geo error:", error.code, error.message);
                }
                if (error.code === 1) setGeoStatus("denied");
                else setGeoStatus("error");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const handleStart = () => {
        setCaptureMode("form");
        triggerGeolocation();
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userInfo.name && userInfo.phone) {
            sessionActiveRef.current = true; // Mark session as active
            setCaptureMode("chat");
            const locationTxt = userInfo.location ? `GPS: ${userInfo.location.lat},${userInfo.location.lng}` : "GPS: Non disponible";
            handleUserMessage(`[SYSTEM_INIT] Client: ${userInfo.name}, Tél: ${userInfo.phone}, ${locationTxt}. Début intervention.`);
        }
    };

    const speak = (text: string) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "fr-FR";
        utterance.pitch = 1;
        utterance.rate = 1.1;

        const voices = synthRef.current.getVoices();
        const frVoice = voices.find(v =>
            (v.name.includes("Google") && v.lang === "fr-FR") ||
            (v.name.includes("Amelie") && v.lang.includes("fr")) ||
            (v.lang === "fr-FR" && v.name.includes("Female"))
        ) || voices.find(v => v.lang === "fr-FR");

        if (frVoice) utterance.voice = frVoice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
    };

    const handleUserMessage = async (text: string) => {
        setIsProcessing(true);
        const userMsg: Message = { role: "user", parts: [{ text }] };

        const currentHistory = messagesRef.current;
        const newHistory = [...currentHistory, userMsg];

        setMessages(newHistory);
        messagesRef.current = newHistory;

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: messages,
                    message: text,
                    userInfo: userInfo // Use state directly here as we are in render cycle usually
                }),
            });

            const data = await res.json();

            if (data.response) {
                const aiMsg: Message = { role: "model", parts: [{ text: data.response }] };
                const updatedHistory = [...newHistory, aiMsg];
                setMessages(updatedHistory);
                messagesRef.current = updatedHistory;
                speak(data.response);
                if (data.completed) setCompleted(true);
            }
        } catch (error) {
            console.error("Error communicating with AI", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            // "Hang Up" logic -> Close conversation which triggers Effect -> sends Telegram
            setCaptureMode("idle");
        } else {
            setTranscript("");
            if (synthRef.current?.speaking) synthRef.current.cancel();
            try {
                recognitionRef.current?.start();
                setIsListening(true);
            } catch (e) {
                console.error("Mic start error", e);
            }
        }
    };

    return (
        <>
            <div className="w-full flex justify-center sticky bottom-6 md:relative md:bottom-auto z-40 px-4 md:px-0">
                {captureMode === "idle" && (
                    <motion.div
                        layout
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStart}
                        className="relative group bg-white/10 backdrop-blur-xl border border-white/30 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] p-2 cursor-pointer animate-[pulse_1.5s_ease-in-out_infinite]"
                    >
                        <span className="absolute inset-0 rounded-full border border-blue-400 opacity-60 animate-ping" />

                        <button className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-lg z-10">
                            <Volume2 className="w-8 h-8 animate-pulse text-blue-600" />
                        </button>

                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap hidden group-hover:block">
                            <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">Démarrer</span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* VOICE CHAT INTERFACE - PORTAL TO BODY */}
            {mounted && createPortal(
                <AnimatePresence>
                    {captureMode === "chat" && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-black h-[100dvh] py-8 md:py-12 px-6"
                        >
                            {/* Full black backdrop to prevent any bleed-through */}
                            <div className="absolute inset-0 bg-black z-0" />

                            {/* Blur overlay on top */}
                            <div className="absolute inset-0 backdrop-blur-xl bg-black/50 z-[1]" />

                            {/* Top Bar: Status & Close */}
                            <div className="w-full max-w-lg flex items-center justify-between relative z-20">
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    <div className={`w-2 h-2 rounded-full ${isListening ? "bg-red-500 animate-pulse" : isProcessing ? "bg-blue-500 animate-spin" : isSpeaking ? "bg-green-500" : "bg-slate-500"}`} />
                                    <span className="text-blue-400 font-medium tracking-widest text-xs md:text-sm uppercase">
                                        {isSpeaking ? "L'assistant parle" : isProcessing ? "Analyse..." : isListening ? "Écoute..." : "Pause"}
                                    </span>
                                </motion.div>

                                <button
                                    onClick={() => setCaptureMode("idle")}
                                    className="p-3 text-white hover:text-red-400 transition-colors bg-white/10 hover:bg-red-500/20 rounded-full relative z-30 border border-white/20"
                                >
                                    <AlertCircle className="w-6 h-6 rotate-45" />
                                </button>
                            </div>

                            {/* Middle: Visuals & Text */}
                            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg gap-8 md:gap-12 relative z-20">
                                {/* Waveform Visualizer */}
                                <div className="h-24 md:h-32 flex items-center justify-center gap-1.5 md:gap-2">
                                    {[...Array(9)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className={`w-2 md:w-3 rounded-full ${isSpeaking ? "bg-blue-500 shadow-[0_0_15px_#3b82f6]" : "bg-white/20"}`}
                                            animate={{
                                                height: isSpeaking
                                                    ? [20, 40 + Math.random() * 60, 20]
                                                    : isListening
                                                        ? [15, 25 + Math.random() * 30, 15]
                                                        : isProcessing
                                                            ? [15, 20, 15]
                                                            : 8,
                                                opacity: isSpeaking || isListening ? 1 : 0.3
                                            }}
                                            transition={{
                                                duration: isSpeaking ? 0.4 : 0.2,
                                                repeat: Infinity,
                                                repeatType: "mirror",
                                                delay: i * 0.05,
                                                ease: "easeInOut"
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Transcript / Subtitles */}
                                <div className="text-center w-full min-h-[80px]">
                                    <p className="text-xl md:text-3xl font-light text-white leading-relaxed line-clamp-4">
                                        "{transcript || (isSpeaking ? messages[messages.length - 1]?.parts[0].text : "...")}"
                                    </p>
                                </div>
                            </div>

                            {/* Bottom: Controls */}
                            <div className="w-full max-w-lg flex flex-col items-center gap-6 relative z-50">
                                <button
                                    onClick={toggleListening}
                                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 border border-white/10 relative overflow-hidden group cursor-pointer active:scale-95
                                        ${isListening
                                            ? "bg-red-600 text-white border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.6)]"
                                            : "bg-white/10 text-white hover:bg-white/20"
                                        }`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-t from-black/20 to-transparent ${isListening ? 'opacity-0' : 'opacity-100'}`} />
                                    {isListening ? <Mic className="w-10 h-10 animate-pulse" /> : <MicOff className="w-10 h-10 opacity-50" />}
                                </button>

                                <p className="text-xs text-white/30 text-center font-medium">
                                    {isListening ? "Appuyez pour raccrocher" : "Appuyez pour parler"}
                                </p>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* MODAL - PORTAL TO BODY */}
            {mounted && createPortal(
                <AnimatePresence>
                    {captureMode === "form" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                            onClick={() => setCaptureMode("idle")}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                transition={{ type: "spring", damping: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
                            >
                                {/* Header */}
                                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700/50">
                                    <h3 className="text-lg font-semibold text-white">Coordonnées Client</h3>
                                    <p className="text-sm text-slate-400 mt-0.5">Informations requises pour l'intervention</p>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Nom complet</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-white text-base focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                                                placeholder="Jean Dupont"
                                                value={userInfo.name}
                                                onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Téléphone</label>
                                        <div className="relative">
                                            <PhoneIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                            <input
                                                type="tel"
                                                required
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-white text-base focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                                                placeholder="06 12 34 56 78"
                                                value={userInfo.phone}
                                                onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* GPS Status */}
                                    <div className={`flex items-center gap-2.5 text-xs px-3 py-2.5 rounded-lg border transition-colors ${geoStatus === 'error' || geoStatus === 'denied'
                                        ? 'bg-amber-500/5 border-amber-500/20 text-amber-200'
                                        : geoStatus === 'success'
                                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'
                                            : 'bg-slate-800/30 border-slate-700/30 text-slate-400'
                                        }`}>
                                        {geoStatus === "locating" && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                                        {geoStatus === "success" && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                        {(geoStatus === "error" || geoStatus === "denied") && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}

                                        <span className="leading-tight">
                                            {geoStatus === "locating" && "Localisation en cours..."}
                                            {geoStatus === "success" && "Position GPS acquise"}
                                            {geoStatus === "denied" && (typeof window !== 'undefined' && !window.isSecureContext ? "GPS nécessite HTTPS (Sécurité)" : "GPS refusé (Vérifiez réglages)")}
                                            {geoStatus === "error" && "GPS indisponible (optionnel)"}
                                            {geoStatus === "idle" && "Acquisition GPS..."}
                                        </span>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-[0.98] text-sm"
                                    >
                                        Lancer l'assistance vocale
                                    </button>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
