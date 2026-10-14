import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { formatDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Diferença numa nota 0-5 (CPC, componente) em pílula: limão quando sobe /
 * fica acima (azul nas cores acessíveis), vermelha quando cai / fica abaixo, neutra até ±``limiar``. O
 * sinal e a seta vão escritos — a cor nunca vai sozinha. */
export function DeltaPill({
    diff,
    size = "md",
    limiar = 0.005,
    format = (v) => formatDecimal(v),
    maiorMelhor = true,
}: {
    diff: number;
    size?: "sm" | "md";
    limiar?: number;
    format?: (absoluto: number) => string;
    /** ``false`` pra medidas em que subir é ruim (ex.: desistência): o sinal
     * e a seta seguem a diferença, mas a cor boa vai pra quando cai. */
    maiorMelhor?: boolean;
}) {
    const same = Math.abs(diff) < limiar;
    const Icon = same ? Minus : diff > 0 ? ArrowUp : ArrowDown;
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1 leading-none font-semibold whitespace-nowrap tabular-nums",
                size === "sm"
                    ? "rounded-md px-1.5 py-1 text-[11px]"
                    : "rounded-lg px-2.5 py-1.5 text-[12px]",
                same
                    ? "bg-page text-text-secondary"
                    : diff > 0 === maiorMelhor
                      ? "bg-good text-on-good"
                      : "bg-status-critical text-white"
            )}
        >
            {same ? "" : diff > 0 ? "+" : "−"}
            {format(Math.abs(diff))}
            <Icon size={size === "sm" ? 11 : 13} strokeWidth={2.5} aria-hidden />
        </span>
    );
}
