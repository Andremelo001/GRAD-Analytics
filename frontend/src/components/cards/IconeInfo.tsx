import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/** O "i" do canto superior direito dos cards: o que o card mostra, no hover
 * (o ícone destaca e o cursor vira a interrogação). Num card que amplia, o
 * clique nele não amplia o card. */
export function IconeInfo({ texto, className }: { texto: string; className?: string }) {
    return (
        <span
            title={texto}
            aria-label={texto}
            role="img"
            data-sem-expandir
            className={cn(
                "text-text-muted hover:text-ink flex h-6 w-6 shrink-0 cursor-help items-center justify-center transition-colors",
                className
            )}
        >
            <Info size={15} strokeWidth={2} aria-hidden />
        </span>
    );
}
