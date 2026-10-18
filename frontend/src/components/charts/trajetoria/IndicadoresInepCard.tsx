import { useRef, useState, type PointerEvent } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import type { ChartPalette } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/charts/DataTable";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import { formatPercent, formatPoints } from "@/lib/format";
import {
    indicadoresInep,
    indicadoresInepNacional,
    INDICADORES_INEP,
    type IndicadorInep,
    type PontoInep,
    type PontoTurma,
    type Turma,
} from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

// as três taxas acumuladas
const ORDEM: IndicadorInep[] = ["TAP", "TCA", "TDA"];

/** Pra cada indicador, se subir é bom (conclusão, permanência) ou ruim
 * (desistência) — a cor da diferença pro Brasil. */
const MAIOR_MELHOR: Record<IndicadorInep, boolean> = {
    TAP: true,
    TCA: true,
    TDA: false,
    TCAN: true,
    TADA: false,
};

/** Cor de cada indicador: conclusão na cor da série, desistência na de
 * alerta e permanência em tinta (o cinza do "cursando" some numa linha). */
function corIndicador(CHART: ChartPalette, ind: IndicadorInep): string {
    if (ind === "TCA" || ind === "TCAN") return CHART.brand;
    if (ind === "TDA" || ind === "TADA") return CHART.critical;
    return CHART.ink;
}

/** Altura mínima de cada mini linha (cresce com o card). */
const ALTURA = 76;
const PAD = { top: 6, right: 6, bottom: 6, left: 6 };

/** Indicadores do INEP (mini linhas lado a lado na largura toda; uma embaixo
 * da outra no celular): as três taxas acumuladas de trajetória — TAP, TCA e
 * TDA — da turma escolhida, ano a ano desde o ingresso, com a média nacional
 * tracejada. Passar o mouse num ano em qualquer uma marca o mesmo ano nas três
 * e mostra os valores (sem mouse, o último ano acompanhado). */
export function IndicadoresInepCard({
    turma,
    nacional,
    className,
}: {
    turma: Turma;
    nacional: Map<number, PontoTurma>;
    className?: string;
}) {
    const [hover, setHover] = useState<number | null>(null);
    const pontos = indicadoresInep(turma.pontos);
    const brasil = indicadoresInepNacional(nacional);
    const maxAnos = Math.max(pontos.at(-1)?.anos ?? 0, 1);
    const foco = pontos.find((p) => p.anos === hover) ?? pontos.at(-1);

    return (
        <Card
            expansivel="tela"
            title="Indicadores do INEP"
            info="As três taxas acumuladas do INEP para a turma (permanência TAP, conclusão TCA e desistência TDA), ano a ano, com a média nacional tracejada."
            subtitle={`Turma de ${turma.ano}, ${foco ? `${foco.anos + 1}º ano de curso` : ""} · tracejado: média nacional`}
            className={className}
        >
            <div
                className="mt-4 grid flex-1 grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-3"
                onMouseLeave={() => setHover(null)}
            >
                {ORDEM.map((ind) => (
                    <MiniLinha
                        key={ind}
                        ind={ind}
                        pontos={pontos}
                        brasil={brasil}
                        maxAnos={maxAnos}
                        foco={foco}
                        onFoco={setHover}
                    />
                ))}
            </div>
            <NotaRodape>
                Siglas e definições do INEP (passe o mouse no nome). Desistência inclui
                transferência para outro curso.
            </NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={["Ano de curso", ...ORDEM]}
                    rows={pontos.map((p) => [
                        `${p.anos + 1}º`,
                        ...ORDEM.map((ind) => formatPercent(p[ind], 0)),
                    ])}
                />
            </div>
        </Card>
    );
}

function MiniLinha({
    className,
    ind,
    pontos,
    brasil,
    maxAnos,
    foco,
    onFoco,
}: {
    className?: string;
    ind: IndicadorInep;
    pontos: PontoInep[];
    brasil: Map<number, PontoInep>;
    maxAnos: number;
    foco: PontoInep | undefined;
    onFoco: (anos: number) => void;
}) {
    const CHART = useChartTheme();
    const boxRef = useRef<HTMLDivElement>(null);
    const { width: W, height: Hbox } = useElementSize(boxRef);
    const H = Math.max(Hbox, ALTURA);
    const cor = corIndicador(CHART, ind);
    const nac = pontos.flatMap((p) => {
        const b = brasil.get(p.anos);
        return b ? [{ anos: p.anos, v: b[ind] }] : [];
    });
    const topo = Math.max(...pontos.map((p) => p[ind]), ...nac.map((n) => n.v), 1);
    const plotW = Math.max(W - PAD.left - PAD.right, 1);
    const plotH = H - PAD.top - PAD.bottom;
    const x = (anos: number) => PAD.left + (anos / maxAnos) * plotW;
    const y = (v: number) => PAD.top + (1 - v / topo) * plotH;
    const linha = (pts: { anos: number; v: number }[]) =>
        pts.length ? `M${pts.map((p) => `${x(p.anos)},${y(p.v)}`).join("L")}` : "";
    const valor = foco?.[ind];
    const valorBrasil = foco ? brasil.get(foco.anos)?.[ind] : undefined;
    const { nome, definicao } = INDICADORES_INEP[ind];

    function onPointer(e: PointerEvent<SVGRectElement>) {
        const r = e.currentTarget.getBoundingClientRect();
        const anos = Math.round(((e.clientX - r.left) / plotW) * maxAnos);
        onFoco(Math.min(Math.max(anos, 0), maxAnos));
    }

    return (
        <div className={cn("flex min-w-0 flex-col", className)}>
            <div className="flex items-baseline justify-between gap-2">
                <p
                    className="min-w-0 truncate text-[12px]"
                    title={`${nome} (${ind}): ${definicao}`}
                >
                    <span className="font-semibold">{ind}</span>{" "}
                    <span className="text-text-muted">{nome}</span>
                </p>
                <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[15px] font-semibold tabular-nums">
                        {valor === undefined ? "—" : formatPercent(valor, 0)}
                    </span>
                    {valor !== undefined && valorBrasil !== undefined && (
                        <DeltaPill
                            size="sm"
                            diff={valor - valorBrasil}
                            maiorMelhor={MAIOR_MELHOR[ind]}
                            limiar={0.5}
                            format={(v) => formatPoints(v, 0)}
                        />
                    )}
                </span>
            </div>
            <div
                ref={boxRef}
                className="relative mt-1 flex-1"
                style={{ minHeight: ALTURA }}
            >
                {W > 0 && (
                    <svg
                        width={W}
                        height={H}
                        className="absolute inset-0 touch-pan-y"
                        aria-hidden
                    >
                        <line
                            x1={PAD.left}
                            x2={PAD.left + plotW}
                            y1={y(0)}
                            y2={y(0)}
                            stroke={CHART.deemphasis}
                        />
                        <path
                            d={linha(nac)}
                            fill="none"
                            stroke={CHART.textMuted}
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                        />
                        <path
                            d={linha(pontos.map((p) => ({ anos: p.anos, v: p[ind] })))}
                            fill="none"
                            stroke={cor}
                            strokeWidth={2}
                            strokeLinejoin="round"
                        />
                        {foco && (
                            <g>
                                <line
                                    x1={x(foco.anos)}
                                    x2={x(foco.anos)}
                                    y1={PAD.top}
                                    y2={PAD.top + plotH}
                                    stroke={CHART.textMuted}
                                    strokeDasharray="2 3"
                                />
                                <circle
                                    cx={x(foco.anos)}
                                    cy={y(foco[ind])}
                                    r={4}
                                    fill={CHART.surface}
                                    stroke={cor}
                                    strokeWidth={2}
                                />
                            </g>
                        )}
                        <rect
                            x={PAD.left}
                            y={0}
                            width={plotW}
                            height={H}
                            fill="transparent"
                            onPointerMove={onPointer}
                            onPointerDown={onPointer}
                        />
                    </svg>
                )}
            </div>
        </div>
    );
}
