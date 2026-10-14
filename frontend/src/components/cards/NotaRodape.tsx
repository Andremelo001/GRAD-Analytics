import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Nota no rodapé de um card (ícone de informação + texto apagado): o mesmo
 * formato das notas de "Quanto falta para a próxima faixa" e Comparações. */
export function NotaRodape({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <p
            className={cn(
                "text-text-muted mt-auto flex gap-2 pt-4 text-[11px] leading-snug",
                className
            )}
        >
            <Info size={13} strokeWidth={2} aria-hidden className="mt-px shrink-0" />
            <span>{children}</span>
        </p>
    );
}
