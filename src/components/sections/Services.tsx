import { Card } from "@/components/ui/Card";
import { Battery, Car, Lock, Truck, Timer, ShieldCheck } from "lucide-react";

const services = [
    {
        icon: Battery,
        title: "Panne de Batterie",
        desc: "Démarrage par booster professionnel ou remplacement sur place.",
    },
    {
        icon: Truck,
        title: "Remorquage & Hissages",
        desc: "Transport sécurisé toutes distances en Île-de-France.",
    },
    {
        icon: Lock,
        title: "Ouverture de Porte",
        desc: "Clés perdues ou oubliées ? Ouverture sans dégâts garantie.",
    },
    {
        icon: Car,
        title: "Crevaison",
        desc: "Remplacement de roue ou réparation pneu sur le lieu de panne.",
    },
    {
        icon: Timer,
        title: "Intervention 30 min",
        desc: "Notre réseau de 50+ dépanneurs assure une arrivée express.",
    },
    {
        icon: ShieldCheck,
        title: "Assistance ou Devis",
        desc: "Tarifs transparents annoncés avant intervention. Aucune surprise.",
    },
];

export function Services() {
    return (
        <section className="py-12 px-4 max-w-5xl mx-auto relative z-10" id="services">
            <div className="text-center mb-8 space-y-2">
                <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-200 to-white bg-clip-text text-transparent">
                    Services Premium
                </h2>
                <p className="text-gray-400 max-w-lg mx-auto text-xs md:text-sm">
                    Une gamme complète de solutions de dépannage auto. Rapide, efficace, et technologique.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((s, i) => (
                    <Card key={i} className="group hover:-translate-y-1 p-4 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-blue-500/30 transition-all duration-300">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/40 transition-colors shadow-lg shadow-blue-500/10">
                            <s.icon className="w-5 h-5 text-blue-300" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1.5 tracking-wide">{s.title}</h3>
                        <p className="text-gray-300 text-xs font-medium leading-relaxed">{s.desc}</p>
                    </Card>
                ))}
            </div>
        </section>
    );
}
