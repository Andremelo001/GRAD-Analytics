import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";
import { useId } from "react";

import { Card } from "@/components/cards/Card";
import { formatPercent, formatPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChartTheme } from "@/hooks/useChartTheme";

export interface StatTilePoint {
    ano: number;
    valor: number;
}

/** Stat tile compacto: rótulo · valor · pílula com a diferença para a média
 * nacional · frase de contexto, e uma sparkline no canto inferior direito
 * (a série histórica da mesma taxa).
 *
 * ``higherIsBetter`` decide o tom: conclusão acima da média é bom (limão),
 * evasão acima da média é ruim (vermelho). O tom nunca vai sozinho — seta e
 * texto carregam o significado. Por padrão são taxas (%, diferença em p.p.);
 * ``format``/``formatDiff`` trocam a unidade (ex.: CPC de 0 a 5). */
export function StatTile({
    label,
    info,
    value,
    nationalValue,
    higherIsBetter,
    serie,
    serieLabel,
    diff: diffDado,
    format = (v) => formatPercent(v),
    formatDiff = (v) => formatPoints(v),
    limiar = 0.05,
    className,
}: {
    label: string;
    info: string;
    value: number | null;
    nationalValue: number | null;
    higherIsBetter: boolean;
    serie: StatTilePoint[];
    serieLabel: string;
    /** A diferença pro Brasil, quando não é ``value - nationalValue`` (ex.:
     * comparação pareada, só com os itens que têm as duas pontas). */
    diff?: number | null;
    format?: (v: number) => string;
    /** Diferença sem sinal (o sinal vem do texto e da seta). */
    formatDiff?: (v: number) => string;
    /** Abaixo disso (em módulo), "igual à média". */
    limiar?: number;
    className?: string;
}) {
    const CHART = useChartTheme();
    const diff =
        diffDado !== undefined
            ? diffDado
            : value !== null && nationalValue !== null
              ? value - nationalValue
              : null;
    const same = diff !== null && Math.abs(diff) < limiar;
    const above = diff !== null && diff > 0;
    const good = diff !== null && !same && above === higherIsBetter;
    const tone = diff === null || same ? "neutral" : good ? "good" : "bad";
    const Arrow = same ? Minus : above ? ArrowUp : ArrowDown;

    return (
        <Card className={cn("relative overflow-hidden", className)}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-medium">{label}</p>
                <span
                    title={info}
                    aria-label={info}
                    className="text-text-muted -mr-1 flex h-6 w-6 items-center justify-center"
                >
                    <Info size={15} strokeWidth={2} aria-hidden />
                </span>
            </div>

            <div className="mt-2.5 flex items-center gap-3">
                <p className="text-[26px] leading-none font-semibold tracking-[-0.02em]">
                    {value === null ? "—" : format(value)}
                </p>
                {diff !== null && (
                    <span
                        className={cn(
                            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] leading-none font-semibold",
                            tone === "good" && "bg-good text-on-good",
                            tone === "bad" && "bg-status-critical text-white",
                            tone === "neutral" && "bg-page text-text-secondary"
                        )}
                    >
                        {formatDiff(diff)}
                        <Arrow size={13} strokeWidth={2.5} aria-hidden />
                    </span>
                )}
            </div>

            {diff !== null && nationalValue !== null && (
                <p className="relative z-[1] mt-3 max-w-[56%] text-[13px] leading-snug">
                    <span
                        className={cn(
                            "font-semibold",
                            tone === "good" && "text-olive-text",
                            tone === "bad" && "text-status-critical-text",
                            tone === "neutral" && "text-text-secondary"
                        )}
                    >
                        {same ? "=" : above ? "+" : "−"} {formatDiff(diff)}
                    </span>{" "}
                    {same ? "igual à" : above ? "acima da" : "abaixo da"} média nacional
                    ({format(nationalValue)})
                </p>
            )}

            <Sparkline
                serie={serie}
                label={serieLabel}
                format={format}
                color={tone === "bad" ? CHART.critical : CHART.brand}
            />
        </Card>
    );
}

/** Sparkline encostada no canto inferior direito do card (sai pela borda,
 * como no design): linha de 2px com a área esmaecida embaixo (o mesmo
 * degradê do gráfico de Ingressantes). Sem eixos: é contexto, não leitura
 * exata. */
function Sparkline({
    serie,
    label,
    format,
    color,
}: {
    serie: StatTilePoint[];
    label: string;
    format: (v: number) => string;
    color: string;
}) {
    const gradId = useId();
    if (serie.length < 2) return null;

    const W = 160;
    const H = 72;
    const values = serie.map((p) => p.valor);
    const min = Math.min(...values);
    const span = Math.max(...values) - min;
    const points = serie.map((p, i) => ({
        x: (i / (serie.length - 1)) * W,
        // série constante: a linha no meio, não colada no fundo
        y: span === 0 ? H / 2 : 8 + (1 - (p.valor - min) / span) * (H - 16),
    }));
    const line = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
    const area = `${line} L${W},${H} L0,${H} Z`;
    const first = serie[0];
    const last = serie.at(-1)!;

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute right-0 bottom-0 h-[72px] w-[44%]"
            role="img"
            aria-label={`${label}: de ${format(first.valor)} em ${first.ano} a ${format(last.valor)} em ${last.ano}`}
        >
            <title>
                {serie.map((p) => `${p.ano}: ${format(p.valor)}`).join(" · ")}
            </title>
            <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradId})`} />
            <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
