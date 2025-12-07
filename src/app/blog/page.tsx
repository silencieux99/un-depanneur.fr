import Link from "next/link";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { blogPosts } from "./data";
import { Card } from "@/components/ui/Card";

export default function BlogIndex() {
    return (
        <main className="min-h-screen bg-black text-white">
            <Navbar />

            <div className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
                <h1 className="text-4xl md:text-6xl font-bold mb-8 bg-gradient-to-r from-blue-200 to-white bg-clip-text text-transparent">
                    Conseils Auto & Dépannage
                </h1>
                <p className="text-gray-400 text-lg mb-12 max-w-2xl">
                    L'actualité de la route, nos conseils mécaniques et les tarifs en vigueur en Île-de-France.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blogPosts.map((post) => (
                        <Link key={post.slug} href={`/blog/${post.slug}`}>
                            <Card className="h-full hover:bg-white/5 transition-colors">
                                <span className="text-xs text-blue-400 font-mono mb-2 block">{post.date}</span>
                                <h2 className="text-xl font-bold mb-3">{post.title}</h2>
                                <p className="text-sm text-gray-500 line-clamp-3">{post.excerpt}</p>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            <Footer />
        </main>
    );
}
