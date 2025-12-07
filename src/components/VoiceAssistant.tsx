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
    const [transcript, setTranscript] = useState("");
    const [completed, setCompleted] = useState(false);
    const [mounted, setMounted] = useState(false);

    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

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

                let silenceTimer: NodeJS.Timeout;

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
    }, []);

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
        const frVoice = voices.find(v => v.lang.includes("fr") && v.name.includes("Google"));
        if (frVoice) utterance.voice = frVoice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
    };

    const handleUserMessage = async (text: string) => {
        setIsProcessing(true);
        const userMsg: Message = { role: "user", parts: [{ text }] };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: messages,
                    message: text,
                    userInfo: userInfo
                }),
            });

            const data = await res.json();

            if (data.response) {
                const aiMsg: Message = { role: "model", parts: [{ text: data.response }] };
                setMessages([...newHistory, aiMsg]);
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
            recognitionRef.current?.stop();
        } else {
            setTranscript(""); // Clear previous transcript
            if (synthRef.current?.speaking) synthRef.current.cancel();
            try {
                recognitionRef.current?.start();
            } catch (e) {
                console.error("Mic start error (already started?)", e);
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

                {captureMode === "chat" && (
                    <AnimatePresence>
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative group bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 rounded-[2rem] shadow-2xl flex items-center overflow-hidden w-full max-w-lg p-2 rounded-3xl ring-1 ring-blue-500/20"
                        >
                            <div className="relative z-10">
                                <button
                                    onClick={toggleListening}
                                    className={`w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300 border border-white/20 shadow-lg relative
                                ${isListening
                                            ? "bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                                            : isSpeaking
                                                ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                                                : "bg-white text-black hover:scale-105"
                                        }`}
                                >
                                    {isProcessing ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : isListening ? (
                                        <Mic className="w-6 h-6" />
                                    ) : isSpeaking ? (
                                        <Volume2 className="w-6 h-6 animate-pulse" />
                                    ) : (
                                        <MicOff className="w-6 h-6 opacity-70" />
                                    )}
                                </button>
                            </div>

                            <div className="flex-1 px-4">
                                <p className="text-sm font-medium text-white line-clamp-2">
                                    {isSpeaking
                                        ? messages[messages.length - 1]?.parts[0].text
                                        : transcript || (isProcessing ? "Analyse en cours..." : "Je vous écoute...")}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

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
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
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
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
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
