import { Phone, MapPin, CheckCircle } from "lucide-react";

export function Process() {
    return (
        <section className="py-24 px-6 max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Comment ça marche ?</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0" />

                <div className="text-center space-y-6 relative">
                    <div className="w-24 h-24 mx-auto glass rounded-full flex items-center justify-center border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)] bg-black">
                        <Phone className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">1. Demande</h3>
                    <p className="text-gray-400">
                        Dites simplement votre problème à notre assistant ou cliquez sur Urgence.
                    </p>
                </div>

                <div className="text-center space-y-6 relative">
                    <div className="w-24 h-24 mx-auto glass rounded-full flex items-center justify-center border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)] bg-black">
                        <MapPin className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">2. Géolocalisation</h3>
                    <p className="text-gray-400">
                        Nous localisons votre position précise instantanément.
                    </p>
                </div>

                <div className="text-center space-y-6 relative">
                    <div className="w-24 h-24 mx-auto glass rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)] bg-black">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">3. Arrivée</h3>
                    <p className="text-gray-400">
                        Un dépanneur est en route. Suivez son arrivée.
                    </p>
                </div>
            </div>
        </section>
    );
}
