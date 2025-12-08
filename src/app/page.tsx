import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { Services } from "@/components/sections/Services";
import { Zones } from "@/components/sections/Zones";
import { Process } from "@/components/sections/Process";
import VoiceAssistant from "@/components/VoiceAssistant";

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden bg-[#030712] text-white flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      {/* Added pt-32 (was pt-20) to prevent header intersection */}
      <section className="relative pt-32 pb-12 px-4 flex flex-col items-center justify-center min-h-[70vh] overflow-hidden">

        {/* Background Effects (Dark Mode) */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Subtle blue glow top center */}
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[80px]" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
        </div>

        <div className="relative z-10 text-center space-y-6 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 py-1 px-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold tracking-widest uppercase text-blue-400 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Disponible 24/7 en Île-de-France
          </span>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
            Votre dépanneuse <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">en un clic.</span>
          </h1>

          <p className="text-sm md:text-base text-gray-400 max-w-lg mx-auto leading-relaxed font-medium">
            Service de dispatch officiel. Géolocalisation immédiate. <br className="hidden md:block" />
            Dépanneurs agréés prêts à intervenir.
          </p>

          <div className="pt-6 w-full flex flex-col items-center space-y-6">
            <VoiceAssistant />

            {/* HIGH VISIBILITY CTA - PURE WHITE & NEON GLOW */}
            <p className="text-sm md:text-base text-white font-black uppercase tracking-[0.2em] animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
              Appuyez pour parler au dispatcheur
            </p>
          </div>
        </div>
      </section>

      <div className="relative z-10 bg-[#030712] border-t border-white/5 shadow-[0_-50px_100px_rgba(0,0,0,1)]">
        <Services />
        <Process />
        <Zones />
      </div>

      <Footer />
    </main>
  );
}
