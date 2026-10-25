import type { ReactNode } from "react";

import { IconeInfo } from "@/components/cards/IconeInfo";
import { Card } from "@/components/cards/Card";
import { cn } from "@/lib/utils";

/** Tile de indicador dos topos das abas (Visão do campus, Panorama): rótulo
 * com ícone de informação, número grande (ou um conteúdo próprio), rodapé e,
 * opcionalmente, um visual pequeno no canto inferior direito; pontinhos de
 * enfeite à direita. */
export function Tile({
    label,
    info,
    value,
    badge,
    footer,
    lateral,
    children,
}: {
    label: string;
    info: string;
    /** Número grande; sem ele, o tile desenha ``children`` no lugar. */
    value?: string;
    badge?: ReactNode;
    footer?: ReactNode;
    /** Visual pequeno no canto inferior direito, ao lado do número e do
     * rodapé (ex.: a rosca do Sem CPC). */
    lateral?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <Card className="relative overflow-hidden">
            {/* enfeite: pontinhos à direita, sumindo pra esquerda */}
            <span
                aria-hidden
                className="pontilhado pointer-events-none absolute inset-y-0 right-0 w-3/5"
            />
            <div className="relative flex items-center justify-between gap-2">
                <p className="text-[14px] font-medium">{label}</p>
                <IconeInfo texto={info} className="-mr-1" />
            </div>
            {value !== undefined ? (
                <div className="relative mt-2.5 flex items-center gap-3">
                    <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                        {value}
                    </p>
                    {badge}
                </div>
            ) : (
                // com rodapé, o conteúdo fica no lugar do número (em cima);
                // sem, desce até o fim do tile
                <div
                    className={cn(
                        "relative",
                        footer !== undefined ? "mt-2.5" : "mt-auto pt-1"
                    )}
                >
                    {children}
                </div>
            )}
            {footer !== undefined && (
                <div
                    className={cn(
                        "text-text-secondary relative mt-auto pt-3 text-[12px] leading-snug",
                        lateral !== undefined && "pr-[84px] sm:max-lg:pr-[64px]"
                    )}
                >
                    {footer}
                </div>
            )}
            {lateral !== undefined && (
                <div className="absolute right-5 bottom-5 lg:right-6 lg:bottom-6">
                    {lateral}
                </div>
            )}
        </Card>
    );
}

/** Item de legenda: quadradinho da cor e o texto. */
export function ItemLegenda({ cor, children }: { cor: string; children: ReactNode }) {
    return (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-[3px]"
                style={{ background: cor }}
            />
            {children}
        </span>
    );
}
