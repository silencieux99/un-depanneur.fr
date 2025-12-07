import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
    return (
        <div
            className={cn(
                "glass rounded-2xl border border-white/10 p-6 shadow-xl transition-all duration-300 hover:border-white/20 hover:bg-white/10 backdrop-blur-xl",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
