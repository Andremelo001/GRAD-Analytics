import { useRef, useState, type PointerEvent } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { DataTable } from "@/components/charts/DataTable";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import { formatPercent, formatPoints } from "@/lib/format";
import type { PontoTurma, Turma } from "@/lib/trajetoria";

const PAD = { top: 12, right: 12, bottom: 28, left: 40 };

type Pt = [number, number];

/** Polígonos da faixa entre as duas linhas, separados por sinal: onde o
 * curso fica acima da média nacional (segura mais alunos) e onde fica abaixo
 * — cortados exatamente nos cruzamentos. */
function faixas(curso: Pt[], brasil: Pt[]): { acima: boolean; d: string }[] {
    const out: { acima: boolean; d: string }[] = [];
    for (let i = 0; i < curso.length - 1; i++) {
        const [x0, a0] = curso[i];
        const [x1, a1] = curso[i + 1];
        const b0 = brasil[i][1];
        const b1 = brasil[i + 1][1];
        const d0 = b0 - a0; // y de tela: menor = mais alto
        const d1 = b1 - a1;
        const quad = (pts: Pt[]) => `M${pts.map((p) => p.join(",")).join("L")}Z`;
        if (d0 * d1 >= 0) {
            out.push({
                acima: d0 + d1 > 0,
                d: quad([
                    [x0, a0],
                    [x1, a1],
                    [x1, b1],
                    [x0, b0],
                ]),
            });
        } else {
            const t = d0 / (d0 - d1);
            const xc = x0 + t * (x1 - x0);
            const yc = a0 + t * (a1 - a0);
            out.push({
                acima: d0 > 0,
                d: quad([
                    [x0, a0],
                    [xc, yc],
                    [x0, b0],
                ]),
            });
            out.push({
                acima: d1 > 0,
                d: quad([
                    [xc, yc],
                    [x1, a1],
                    [x1, b1],
                ]),
            });
        }
    }
    return out;
}

/** Permanência × Brasil: a % da turma que continua no curso a cada ano desde
 * o ingresso, contra a média nacional dos mesmos cursos. A faixa entre as
 * linhas fica verde onde o curso segura mais alunos que o Brasil e vermelha
 * onde segura menos — mostra *quando* o curso se afasta da média. Passar o
 * mouse num ano mostra os dois valores e a diferença. */
export function PermanenciaCard({
    turma,
    nacional,
    className,
}: {
    turma: Turma;
    nacional: Map<number, PontoTurma>;
    className?: string;
}) {
    const CHART = useChartTheme();
    const boxRef = useRef<HTMLDivElement>(null);
    const { width: W, height: H } = useElementSize(boxRef);
    const [hover, setHover] = useState<number | null>(null);

    // anos com os dois valores (a média nacional pode não ir tão longe)
    const pares = turma.pontos.filter((p) => nacional.has(p.anos));
    const maxAnos = Math.max(pares.at(-1)?.anos ?? 1, 1);
    const plotW = Math.max(W - PAD.left - PAD.right, 1);
    const plotH = Math.max(H - PAD.top - PAD.bottom, 1);
    const x = (anos: number) => PAD.left + (anos / maxAnos) * plotW;
    const y = (pct: number) => PAD.top + (1 - pct / 100) * plotH;

    const linhaCurso: Pt[] = pares.map((p) => [x(p.anos), y(p.cursando)]);
    const linhaBrasil: Pt[] = pares.map((p) => [
        x(p.anos),
        y(nacional.get(p.anos)!.cursando),
    ]);
    const caminho = (pts: Pt[]) =>
        pts.length ? `M${pts.map((p) => p.join(",")).join("L")}` : "";

    const foco = hover === null ? pares.at(-1) : pares.find((p) => p.anos === hover);
    const focoBrasil = foco ? nacional.get(foco.anos) : undefined;

    function onPointer(e: PointerEvent<SVGRectElement>) {
        const r = e.currentTarget.getBoundingClientRect();
        const anos = Math.round(((e.clientX - r.left) / plotW) * maxAnos);
        setHover(Math.min(Math.max(anos, 0), maxAnos));
    }

    return (
        <Card
            expansivel="tela"
            title="Permanência × Brasil"
            info="A Taxa de Permanência (TAP) da turma, a parte que ainda está no curso, ano a ano, contra a média nacional dos mesmos cursos no mesmo ano de curso."
            subtitle={`Taxa de Permanência (TAP) da turma de ${turma.ano}`}
            className={className}
        >
            {foco && focoBrasil && (
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                        {formatPercent(foco.cursando, 0)}
                    </p>
                    <DeltaPill
                        diff={foco.cursando - focoBrasil.cursando}
                        limiar={0.5}
                        format={(v) => formatPoints(v, 0)}
                    />
                    <p className="text-text-secondary text-[12px]">
                        no {foco.anos + 1}º ano · Brasil:{" "}
                        <span className="text-ink font-semibold">
                            {formatPercent(focoBrasil.cursando, 0)}
                        </span>
                    </p>
                </div>
            )}
            <div className="text-text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                <span className="flex items-center gap-1.5">
                    <span aria-hidden className="bg-brand h-[3px] w-4 rounded-full" />
                    curso
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="w-4 border-t-2 border-dashed"
                        style={{ borderColor: CHART.textMuted }}
                    />
                    média nacional
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-2.5 w-3 rounded-[3px]"
                        style={{ background: CHART.brand, opacity: 0.35 }}
                    />
                    segura mais
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-2.5 w-3 rounded-[3px]"
                        style={{ background: CHART.critical, opacity: 0.35 }}
                    />
                    segura menos
                </span>
            </div>
            <div ref={boxRef} className="relative mt-2 min-h-[240px] flex-1">
                {W > 0 && H > 0 && pares.length > 1 && (
                    <svg
                        width={W}
                        height={H}
                        className="absolute inset-0 touch-pan-y select-none"
                        aria-hidden
                    >
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
                        {faixas(linhaCurso, linhaBrasil).map((f, i) => (
                            <path
                                key={i}
                                d={f.d}
                                fill={f.acima ? CHART.brand : CHART.critical}
                                fillOpacity={0.22}
                            />
                        ))}
                        <path
                            d={caminho(linhaBrasil)}
                            fill="none"
                            stroke={CHART.textMuted}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                        />
                        <path
                            d={caminho(linhaCurso)}
                            fill="none"
                            stroke={CHART.brand}
                            strokeWidth={2.5}
                            strokeLinejoin="round"
                        />
                        {foco && focoBrasil && (
                            <g>
                                <line
                                    x1={x(foco.anos)}
                                    x2={x(foco.anos)}
                                    y1={PAD.top}
                                    y2={PAD.top + plotH}
                                    stroke={CHART.textMuted}
                                    strokeDasharray="3 4"
                                />
                                <circle
                                    cx={x(foco.anos)}
                                    cy={y(focoBrasil.cursando)}
                                    r={4.5}
                                    fill={CHART.surface}
                                    stroke={CHART.textMuted}
                                    strokeWidth={2}
                                />
                                <circle
                                    cx={x(foco.anos)}
                                    cy={y(foco.cursando)}
                                    r={5}
                                    fill={CHART.surface}
                                    stroke={CHART.brand}
                                    strokeWidth={2.5}
                                />
                            </g>
                        )}
                        {pares.map((p) => (
                            <text
                                key={p.anos}
                                x={x(p.anos)}
                                y={H - 8}
                                textAnchor={
                                    p.anos === 0
                                        ? "start"
                                        : p.anos === maxAnos
                                          ? "end"
                                          : "middle"
                                }
                                fontSize={CHART.tickFont}
                                fontWeight={foco?.anos === p.anos ? 700 : 400}
                                fill={
                                    foco?.anos === p.anos ? CHART.ink : CHART.textMuted
                                }
                            >
                                {p.anos + 1}º
                            </text>
                        ))}
                        <rect
                            x={PAD.left}
                            y={0}
                            width={plotW}
                            height={H}
                            fill="transparent"
                            onPointerMove={onPointer}
                            onPointerDown={onPointer}
                            onPointerLeave={() => setHover(null)}
                        />
                    </svg>
                )}
                {pares.length <= 1 && (
                    <p className="text-text-secondary pt-4 text-[13px]">
                        Sem média nacional para esta área.
                    </p>
                )}
            </div>
            <NotaRodape>
                A média nacional junta todas as turmas dos mesmos cursos no Brasil, no
                mesmo ano de curso.
            </NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={["Ano de curso", "Curso", "Brasil"]}
                    rows={pares.map((p) => [
                        `${p.anos + 1}º`,
                        formatPercent(p.cursando, 0),
                        formatPercent(nacional.get(p.anos)!.cursando, 0),
                    ])}
                />
            </div>
        </Card>
    );
}
