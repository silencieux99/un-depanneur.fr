import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { blogPosts } from "../data";
import { notFound } from "next/navigation";

export function generateStaticParams() {
    return blogPosts.map((post) => ({
        slug: post.slug,
    }));
}

export default function BlogPost({ params }: { params: { slug: string } }) {
    const post = blogPosts.find((p) => p.slug === params.slug);

    if (!post) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <Navbar />

            <article className="pt-32 pb-24 px-6 max-w-3xl mx-auto">
                <header className="mb-12 text-center">
                    <span className="text-blue-400 font-mono text-sm">{post.date}</span>
                    <h1 className="text-3xl md:text-5xl font-bold mt-4 leading-tight">{post.title}</h1>
                </header>

                <div className="prose prose-invert prose-lg mx-auto">
                    <p className="text-gray-300 leading-relaxed">
                        {post.content}
                        <br /><br />
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
                </div>
            </article>

            <Footer />
        </main>
    );
}
