"use client";

import { Phone } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
                scrolled ? "bg-[#030712]/80 backdrop-blur-xl border-white/5 py-4 shadow-xl" : "py-6 bg-transparent"
            )}
        >
            <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
                <Link href="/" className="relative z-50 flex items-center gap-1 group">
                    <span className="text-xl font-bold tracking-tight text-white">
                        un-depanneur<span className="text-blue-500">.fr</span>
                    </span>
                    <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse ml-0.5" />
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center space-x-8 text-xs font-bold uppercase tracking-widest text-gray-400">
                    <Link href="#services" className="hover:text-white transition-colors">Services</Link>
                    <Link href="#zones" className="hover:text-white transition-colors">Zones</Link>
                    <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
                </div>
            </div>
        </nav>
    );
}
