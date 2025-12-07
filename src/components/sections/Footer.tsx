import Link from "next/link";

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black py-16 px-6 relative z-10">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="space-y-4">
                    <h3 className="text-xl font-bold tracking-widest text-white">
                        Un-Depanneur<span className="text-blue-500">.fr</span>
                    </h3>
                    <p className="text-gray-500 text-sm">
                        La solution de dépannage la plus rapide d'Île-de-France.
                    </p>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-6">Services</h4>
                    <ul className="space-y-3 text-sm text-gray-400">
                        <li><Link href="#" className="hover:text-blue-400">Batterie à plat</Link></li>
                        <li><Link href="#" className="hover:text-blue-400">Remorquage</Link></li>
                        <li><Link href="#" className="hover:text-blue-400">Ouverture de porte</Link></li>
                        <li><Link href="#" className="hover:text-blue-400">Crevaison</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-6">Zones</h4>
                    <ul className="space-y-3 text-sm text-gray-400">
                        <li><Link href="#" className="hover:text-blue-400">Paris (75)</Link></li>
                        <li><Link href="#" className="hover:text-blue-400">Hauts-de-Seine (92)</Link></li>
                        <li><Link href="#" className="hover:text-blue-400">Seine-Saint-Denis (93)</Link></li>
                        <li><Link href="#" className="hover:text-blue-400">Val-de-Marne (94)</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-6">Légal</h4>
                    <ul className="space-y-3 text-sm text-gray-400">
                        <li><Link href="#" className="hover:text-blue-400">Mentions Légales</Link></li>
                        <li><Link href="#" className="hover:text-blue-400">CGU</Link></li>
                        <li><Link href="/blog" className="hover:text-blue-400">Blog Conseils</Link></li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-white/5 text-center text-xs text-gray-600">
                &copy; {new Date().getFullYear()} Un-Depanneur.fr. Tous droits r&eacute;serv&eacute;s.
            </div>
        </footer>
    );
}
