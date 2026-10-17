import { useRef, useState, type PointerEvent } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { DataTable } from "@/components/charts/DataTable";
import { LegendaLados } from "@/components/charts/qualidade/ComparacaoCards";
import {
    corSituacao,
    ROTULO_SITUACAO,
    SIGLA_SITUACAO,
    SITUACOES,
    type Situacao,
} from "@/components/charts/trajetoria/situacao";
import { SiglaInep } from "@/components/charts/trajetoria/SiglaInep";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import { formatPercent } from "@/lib/format";
import type { PontoTurma } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

/** Um lado da comparação (A ou B): o nome, um detalhe (ex.: "turma 2018"),
 * a situação final e a permanência ano a ano. */
export interface LadoTrajetoria {
    lado: "a" | "b";
    nome: string;
    detalhe?: string;
    final: PontoTurma | null;
    permanencia: { anos: number; TAP: number }[];
}

/** Situação final de cada lado: uma barra 100% por lado (no mesmo ponto —
 * prazo + 2 anos). Passar o mouse numa parte destaca a situação nos dois. */
export function SituacaoLadosCard({
    itens,
    subtitulo,
    rodape,
    className,
}: {
    itens: LadoTrajetoria[];
    subtitulo: string;
    rodape: string;
    className?: string;
}) {
    const CHART = useChartTheme();
    const [foco, setFoco] = useState<Situacao | null>(null);
    const destaque = foco ?? "concluiu";
    const linhas = itens.flatMap((c) => {
        const p = c.final;
        if (!p) return [];
        const cursando = Math.max(100 - p.concluiu - p.desistiu, 0);
        return [{ c, v: { concluiu: p.concluiu, desistiu: p.desistiu, cursando } }];
    });

    return (
        <Card
            expansivel
            title="Situação final"
            subtitle={subtitulo}
            className={className}
        >
            <ul
                className="mt-4 flex gap-x-4 gap-y-1 text-[12px]"
                onMouseLeave={() => setFoco(null)}
            >
                {SITUACOES.map((s) => (
                    <li
                        key={s}
                        onMouseEnter={() => setFoco(s)}
                        className={cn(
                            "text-text-secondary flex items-center gap-1.5 transition-opacity duration-200",
                            foco !== null && foco !== s && "opacity-40",
                            foco === s && "text-ink font-semibold"
                        )}
                    >
                        <span
                            aria-hidden
                            className="h-2.5 w-2.5 rounded-[3px]"
                            style={{ background: corSituacao(CHART, s) }}
                        />
                        {ROTULO_SITUACAO[s]}
                        <SiglaInep sigla={SIGLA_SITUACAO[s]} />
                    </li>
                ))}
            </ul>
            <ul
                className="mt-5 flex flex-1 flex-col justify-center gap-6"
                onMouseLeave={() => setFoco(null)}
            >
                {linhas.map(({ c, v }) => (
                    <li key={c.lado}>
                        <div className="flex items-baseline justify-between gap-3 text-[12px]">
                            <span className="flex min-w-0 items-center gap-1.5 font-medium">
                                <span
                                    aria-hidden
                                    className="h-2.5 w-2.5 shrink-0 self-center rounded-full"
                                    style={{ background: CHART.comparacao[c.lado] }}
                                />
                                <span className="truncate">{c.nome}</span>
                                {c.detalhe && (
                                    <span className="text-text-muted shrink-0 font-normal">
                                        {c.detalhe}
                                    </span>
                                )}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">
                                {formatPercent(v[destaque], 0)}
                                <span className="text-text-muted ml-1 font-normal">
                                    {ROTULO_SITUACAO[destaque].toLowerCase()}
                                </span>
                            </span>
                        </div>
                        <div className="mt-1.5 flex h-4 items-center gap-[2px]">
                            {SITUACOES.map((s) =>
                                v[s] <= 0 ? null : (
                                    <span
                                        key={s}
                                        onMouseEnter={() => setFoco(s)}
                                        className={cn(
                                            "cursor-pointer transition-[height,opacity] duration-200 first:rounded-l-full last:rounded-r-full",
                                            foco === s ? "h-4" : "h-3",
                                            foco !== null && foco !== s && "opacity-35"
                                        )}
                                        style={{
                                            flexGrow: v[s],
                                            background: corSituacao(CHART, s),
                                        }}
                                    />
                                )
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            <NotaRodape>{rodape}</NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={["", "Concluíram", "Desistiram", "Ainda cursando"]}
                    rows={linhas.map(({ c, v }) => [
                        c.nome,
                        formatPercent(v.concluiu, 0),
                        formatPercent(v.desistiu, 0),
                        formatPercent(v.cursando, 0),
                    ])}
                />
            </div>
        </Card>
    );
}

const PAD = { top: 14, right: 44, bottom: 28, left: 40 };

/** Permanência de cada lado: a % dos ingressantes que continua no curso a
 * cada ano (TAP), uma linha na cor de cada lado, com o nome no fim dela.
 * Passar o mouse destaca a linha mais perto. */
export function PermanenciaLadosCard({
    itens,
    subtitulo,
    rodape,
    className,
}: {
    itens: LadoTrajetoria[];
    subtitulo: string;
    rodape: string;
    className?: string;
}) {
    const CHART = useChartTheme();
    const boxRef = useRef<HTMLDivElement>(null);
    const { width: W, height: H } = useElementSize(boxRef);
    const [foco, setFoco] = useState<string | null>(null);

    const maxAnos = Math.max(
        ...itens.flatMap((c) => c.permanencia.map((p) => p.anos)),
        1
    );
    const plotW = Math.max(W - PAD.left - PAD.right, 1);
    const plotH = Math.max(H - PAD.top - PAD.bottom, 1);
    const x = (a: number) => PAD.left + (a / maxAnos) * plotW;
    const y = (v: number) => PAD.top + (1 - v / 100) * plotH;
    const caminho = (c: LadoTrajetoria) =>
        `M${c.permanencia.map((p) => `${x(p.anos)},${y(p.TAP)}`).join("L")}`;
    // rótulos no fim das linhas, afastados pra não se sobreporem
    const fins = itens
        .map((c) => ({
            c,
            yy: y(c.permanencia.at(-1)?.TAP ?? 0),
            xx: x(c.permanencia.at(-1)?.anos ?? 0),
        }))
        .sort((a, b) => a.yy - b.yy);
    for (let i = 1; i < fins.length; i++)
        fins[i].yy = Math.max(fins[i].yy, fins[i - 1].yy + 13);

    function onPointer(e: PointerEvent<SVGRectElement>) {
        const r = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - r.left + PAD.left;
        const py = e.clientY - r.top;
        let melhor: string | null = null;
        let dist = 16;
        for (const c of itens)
            for (const p of c.permanencia) {
                const d = Math.hypot(x(p.anos) - px, y(p.TAP) - py);
                if (d < dist) [dist, melhor] = [d, c.lado];
            }
        setFoco(melhor);
    }

    return (
        <Card
            expansivel="tela"
            title="Permanência ano a ano"
            subtitle={subtitulo}
            className={className}
            action={
                <div className="self-end">
                    <LegendaLados
                        lados={{
                            a: itens.find((c) => c.lado === "a")?.nome ?? "A",
                            b: itens.find((c) => c.lado === "b")?.nome ?? "B",
                        }}
                    />
                </div>
            }
        >
            <div ref={boxRef} className="relative mt-4 min-h-[260px] flex-1">
                {W > 0 && H > 0 && (
                    <svg width={W} height={H} className="absolute inset-0" aria-hidden>
                        {[0, 25, 50, 75, 100].map((t) => (
                            <g key={t}>
                                <line
                                    x1={PAD.left}
                                    x2={PAD.left + plotW}
                                    y1={y(t)}
                                    y2={y(t)}
                                    stroke={CHART.deemphasis}
                                    strokeOpacity={0.7}
                                />
                                <text
                                    x={PAD.left - 8}
                                    y={y(t) + 4}
                                    textAnchor="end"
                                    fontSize={CHART.tickFont}
                                    fill={CHART.textMuted}
                                >
                                    {t}%
                                </text>
                            </g>
                        ))}
                        {itens.map((c) => (
                            <path
                                key={c.lado}
                                d={caminho(c)}
                                fill="none"
                                stroke={CHART.comparacao[c.lado]}
                                strokeWidth={foco === c.lado ? 3 : 2.25}
                                strokeLinejoin="round"
                                opacity={foco !== null && foco !== c.lado ? 0.4 : 1}
                            />
                        ))}
                        {fins.map(({ c, yy, xx }) => (
                            <text
                                key={c.lado}
                                x={xx + 8}
                                y={yy + 4}
                                fontSize={11}
                                fontWeight={foco === c.lado ? 700 : 600}
                                fill={CHART.ink}
                            >
                                {formatPercent(c.permanencia.at(-1)?.TAP ?? 0, 0)}
                            </text>
                        ))}
                        {Array.from({ length: maxAnos + 1 }, (_, a) => (
                            <text
                                key={a}
                                x={x(a)}
                                y={H - 8}
                                textAnchor="middle"
                                fontSize={CHART.tickFont}
                                fill={CHART.textMuted}
                            >
                                {a + 1}º
                            </text>
                        ))}
                        <rect
                            x={PAD.left}
                            y={0}
                            width={plotW}
                            height={H}
                            fill="transparent"
                            onPointerMove={onPointer}
                            onPointerLeave={() => setFoco(null)}
                        />
                    </svg>
                )}
            </div>
            <NotaRodape>{rodape}</NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={["Ano de curso", ...itens.map((c) => c.nome)]}
                    rows={Array.from({ length: maxAnos + 1 }, (_, a) => [
                        `${a + 1}º`,
                        ...itens.map((c) => {
                            const p = c.permanencia.find((q) => q.anos === a);
                            return p ? formatPercent(p.TAP, 0) : "—";
                        }),
                    ])}
                />
            </div>
        </Card>
    );
}
