import { useRef, useState, type PointerEvent } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { DataTable } from "@/components/charts/DataTable";
import { SeletorTurma } from "@/components/charts/trajetoria/SeletorTurma";
import {
    corSituacao,
    ROTULO_SITUACAO,
    SIGLA_SITUACAO,
    type Situacao,
} from "@/components/charts/trajetoria/situacao";
import { SiglaInep } from "@/components/charts/trajetoria/SiglaInep";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import { formatPercent } from "@/lib/format";
import type { CursoTrajetoria, PontoTurma, Turma } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

const PAD = { top: 10, right: 12, bottom: 28, left: 40 };
/** Empilhamento de baixo pra cima: quem concluiu na base, quem desistiu no
 * topo e quem ainda cursa no meio (a faixa que vai encolhendo). */
const PILHA: Situacao[] = ["concluiu", "cursando", "desistiu"];

const valor = (p: PontoTurma, s: Situacao) =>
    s === "cursando" ? Math.max(100 - p.concluiu - p.desistiu, 0) : p[s];

/** O caminho de uma turma: área empilhada de 100%, ano a ano desde o
 * ingresso — a faixa "cursando" encolhe e "concluiu" e "desistiu" crescem.
 * A linha tracejada marca o fim do prazo (quando a turma deveria se formar).
 * A turma é escolhida na linha do tempo (as em andamento ficam tracejadas e
 * a área termina onde o acompanhamento parou). Passar o mouse num ano mostra
 * os três valores dele. */
export function CaminhoTurmaCard({
    curso,
    turma,
    onTurma,
    className,
}: {
    curso: CursoTrajetoria;
    turma: Turma;
    onTurma: (ano: number) => void;
    className?: string;
}) {
    const CHART = useChartTheme();
    const boxRef = useRef<HTMLDivElement>(null);
    const { width: W, height: H } = useElementSize(boxRef);
    const [hover, setHover] = useState<number | null>(null);

    const pontos = turma.pontos;
    const maxAnos = Math.max(
        9,
        ...curso.turmas.flatMap((t) => t.pontos.map((p) => p.anos))
    );
    const plotW = Math.max(W - PAD.left - PAD.right, 1);
    const plotH = Math.max(H - PAD.top - PAD.bottom, 1);
    const x = (anos: number) => PAD.left + (anos / maxAnos) * plotW;
    const y = (pct: number) => PAD.top + (1 - pct / 100) * plotH;

    // limites acumulados de cada camada, ponto a ponto
    const camadas = PILHA.map((s, k) => {
        const baixo = pontos.map((p) =>
            PILHA.slice(0, k).reduce((t, o) => t + valor(p, o), 0)
        );
        const cima = pontos.map((p, i) => baixo[i] + valor(p, s));
        const ida = pontos.map((p, i) => `${x(p.anos)},${y(cima[i])}`);
        const volta = pontos.map((p, i) => `${x(p.anos)},${y(baixo[i])}`).reverse();
        return { s, d: `M${ida.join("L")}L${volta.join("L")}Z` };
    });

    const foco =
        hover === null
            ? pontos.at(-1)
            : (pontos.find((p) => p.anos === hover) ?? pontos.at(-1));

    function onPointer(e: PointerEvent<SVGRectElement>) {
        const r = e.currentTarget.getBoundingClientRect();
        const anos = Math.round(((e.clientX - r.left) / plotW) * maxAnos);
        setHover(Math.min(Math.max(anos, 0), pontos.at(-1)?.anos ?? 0));
    }

    return (
        <Card
            expansivel="tela"
            title="O caminho de uma turma"
            subtitle={`Turma de ${turma.ano}${turma.prazo ? ` · prazo de ${turma.prazo} anos` : ""}${turma.madura ? "" : " · em andamento"}`}
            className={className}
        >
            <div className="mt-4">
                <SeletorTurma
                    turmas={curso.turmas}
                    valor={turma.ano}
                    onChange={onTurma}
                />
            </div>
            {/* os valores do ano em foco (o último, sem mouse) */}
            {foco && (
                <p className="text-text-secondary mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px]">
                    <span className="text-ink font-semibold">{foco.anos + 1}º ano</span>
                    {(["concluiu", "desistiu", "cursando"] as Situacao[]).map((s) => (
                        <span key={s} className="flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="h-2.5 w-2.5 rounded-[3px]"
                                style={{ background: corSituacao(CHART, s) }}
                            />
                            {ROTULO_SITUACAO[s]} <SiglaInep sigla={SIGLA_SITUACAO[s]} />
                            :{" "}
                            <span className="text-ink font-semibold tabular-nums">
                                {formatPercent(valor(foco, s), 0)}
                            </span>
                        </span>
                    ))}
                </p>
            )}
            <div ref={boxRef} className="relative mt-3 min-h-[260px] flex-1">
                {W > 0 && H > 0 && pontos.length > 0 && (
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
                        {camadas.map((c) => (
                            <path
                                key={c.s}
                                d={c.d}
                                fill={corSituacao(CHART, c.s)}
                                fillOpacity={c.s === "cursando" ? 0.55 : 0.9}
                                stroke={CHART.surface}
                                strokeWidth={1.5}
                                strokeLinejoin="round"
                            />
                        ))}
                        {/* fim do prazo: quando a turma deveria se formar */}
                        {turma.prazo !== null && turma.prazo - 1 <= maxAnos && (
                            <g>
                                <line
                                    x1={x(turma.prazo - 1)}
                                    x2={x(turma.prazo - 1)}
                                    y1={PAD.top}
                                    y2={PAD.top + plotH}
                                    stroke={CHART.ink}
                                    strokeDasharray="4 4"
                                    strokeWidth={1.5}
                                />
                                <text
                                    x={x(turma.prazo - 1) + 6}
                                    y={PAD.top + 12}
                                    fontSize={11}
                                    fontWeight={600}
                                    fill={CHART.ink}
                                >
                                    fim do prazo
                                </text>
                            </g>
                        )}
                        {/* ano em foco */}
                        {foco && (
                            <line
                                x1={x(foco.anos)}
                                x2={x(foco.anos)}
                                y1={PAD.top}
                                y2={PAD.top + plotH}
                                stroke={CHART.surface}
                                strokeWidth={2}
                            />
                        )}
                        {Array.from({ length: maxAnos + 1 }, (_, a) => (
                            <text
                                key={a}
                                x={x(a)}
                                y={H - 8}
                                textAnchor={
                                    a === 0 ? "start" : a === maxAnos ? "end" : "middle"
                                }
                                fontSize={CHART.tickFont}
                                fontWeight={foco?.anos === a ? 700 : 400}
                                fill={foco?.anos === a ? CHART.ink : CHART.textMuted}
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
                            onPointerDown={onPointer}
                            onPointerLeave={() => setHover(null)}
                        />
                    </svg>
                )}
            </div>
            <p className="text-text-muted mt-1 text-center text-[11px]">ano de curso</p>
            <NotaRodape className={cn(!turma.madura && "text-ink")}>
                {turma.madura
                    ? "Desistência inclui transferência para outro curso, inclusive dentro da UFC."
                    : `Turma em andamento: ainda pode concluir ou desistir. Compare com as turmas maduras (sem tracejado).`}
            </NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={[
                        "Ano de curso",
                        "Concluíram",
                        "Desistiram",
                        "Ainda cursando",
                    ]}
                    rows={pontos.map((p) => [
                        `${p.anos + 1}º`,
                        formatPercent(p.concluiu, 0),
                        formatPercent(p.desistiu, 0),
                        formatPercent(valor(p, "cursando"), 0),
                    ])}
                />
            </div>
        </Card>
    );
}
