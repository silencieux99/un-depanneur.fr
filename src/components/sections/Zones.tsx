export function Zones() {
    const depts = [
        { code: "75", name: "Paris", delay: "20 min" },
        { code: "92", name: "Hauts-de-Seine", delay: "25 min" },
        { code: "93", name: "Seine-Saint-Denis", delay: "25 min" },
        { code: "94", name: "Val-de-Marne", delay: "30 min" },
        { code: "78", name: "Yvelines", delay: "45 min" },
        { code: "91", name: "Essonne", delay: "45 min" },
        { code: "95", name: "Val-d'Oise", delay: "45 min" },
        { code: "77", name: "Seine-et-Marne", delay: "50 min" },
    ];

    return (
        <section className="py-12 border-y border-white/5 bg-white/5" id="zones">
            <div className="max-w-5xl mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-xl md:text-2xl font-bold text-white">
                            Une couverture totale en <span className="text-blue-500">Île-de-France</span>.
                        </h2>
                        <p className="text-gray-400 text-xs md:text-sm">
                            Nos unités sont stationnées stratégiquement pour intervenir en un temps record, où que vous soyez.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            {depts.map((d) => (
                                <div key={d.code} className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition-colors backdrop-blur-sm">
                                    <span className="font-bold text-white tracking-wide">{d.name} <span className="text-blue-300 font-mono text-xs">({d.code})</span></span>
                                    <span className="text-emerald-300 text-xs font-bold bg-emerald-500/20 px-2 py-1 rounded shadow-sm">~{d.delay}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 w-full flex justify-center">
                        {/* Abstract Map Visual */}
                        <div className="relative w-[400px] h-[400px]">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-[80px]" />
                            <div className="relative z-10 grid grid-cols-2 gap-4 rotate-45 opacity-80">
                                <div className="w-32 h-32 bg-white/5 border border-white/20 backdrop-blur-md rounded-2xl animate-pulse" />
                                <div className="w-32 h-32 bg-blue-500/10 border border-blue-500/30 backdrop-blur-md rounded-2xl" />
                                <div className="w-32 h-32 bg-white/5 border border-white/20 backdrop-blur-md rounded-2xl" />
                                <div className="w-32 h-32 bg-white/5 border border-white/20 backdrop-blur-md rounded-2xl animate-pulse delay-75" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
