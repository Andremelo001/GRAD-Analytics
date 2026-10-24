import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import {
    Line,
    LineChart,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Card } from "@/components/cards/Card";
import { FocusMarker, YearTick } from "@/components/charts/ChartMarks";
import { DataTable } from "@/components/charts/DataTable";
import { formatDecimal, formatInteger, toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
    Curso,
    EvolucaoCpcNacionalPonto,
    EvolucaoCpcPonto,
} from "@/types/dashboard";
import { useChartTheme } from "@/hooks/useChartTheme";

interface Row {
    ano: number;
    curso: number | null;
    nacional: number | null;
    cursosConsiderados: number | null;
}

/** Um ano por linha, do primeiro ao último ano com avaliação (anos sem
 * ciclo do Enade ficam vazios — o espaçamento entre avaliações é real). O
 * CPC do curso vem de ``curso_perfil.evolucao_cpc``; a média, dos cursos da
 * mesma área de avaliação (``medias_nacionais.evolucao_cpc``). */
function buildRows(
    codigo: number,
    evolucao: EvolucaoCpcPonto[],
    nacional: EvolucaoCpcNacionalPonto[]
): { area: string | null; rows: Row[] } {
    const doCurso = evolucao.filter(
        (p) => p.codigo_curso === codigo && p.cpc_continuo !== null
    );
    const area = doCurso.at(-1)?.area_avaliacao ?? null;
    const daArea = nacional.filter((n) => n.area_avaliacao === area);
    const anos = [...doCurso.map((p) => p.ano), ...daArea.map((n) => n.ano)];
    if (anos.length === 0) return { area, rows: [] };

    const rows: Row[] = [];
    for (let ano = Math.min(...anos); ano <= Math.max(...anos); ano++) {
        const media = daArea.find((n) => n.ano === ano);
        rows.push({
            ano,
            curso: doCurso.find((p) => p.ano === ano)?.cpc_continuo ?? null,
            nacional: media?.cpc_continuo_medio_nacional ?? null,
            cursosConsiderados: media?.quantidade_cursos_considerados ?? null,
        });
    }
    return { area, rows };
}

/** Eixo Y em passos de 0,5 com folga em volta das duas séries, dentro da
 * escala 0-5 do CPC (linha codifica posição, não precisa partir do zero). */
function buildTicks(rows: Row[]): number[] {
    const values = rows.flatMap((r) =>
        [r.curso, r.nacional].filter((v): v is number => v !== null)
    );
    if (values.length === 0) return [0, 5];
    const lo = Math.max(0, Math.floor(Math.min(...values) * 2) / 2 - 0.5);
    const hi = Math.min(5, Math.ceil(Math.max(...values) * 2) / 2 + 0.5);
    return Array.from(
        { length: Math.round((hi - lo) * 2) + 1 },
        (_, i) => lo + i * 0.5
    );
}

const fmt = (v: number | null) => (v === null ? "—" : formatDecimal(v));

/** CPC contínuo do curso escolhido x média nacional dos cursos da mesma
 * área, em duas linhas no estilo do gráfico de ingressantes: o ano em foco
 * ganha a pílula limão no eixo, anéis nas duas linhas e a etiqueta escura
 * com o valor do curso. Passar o mouse muda o foco (só anos avaliados). */
export function CpcComparativoCard({
    evolucao,
    nacional,
    cursos,
    codigo,
    className,
}: {
    evolucao: EvolucaoCpcPonto[];
    nacional: EvolucaoCpcNacionalPonto[];
    cursos: Curso[];
    /** O curso exibido — o do seletor de curso do Início (no cabeçalho). */
    codigo: number | null;
    className?: string;
}) {
    const CHART = useChartTheme();
    const opcoes = cursos.filter((c) =>
        evolucao.some(
            (p) => p.codigo_curso === c.codigo_curso && p.cpc_continuo !== null
        )
    );
    const semCpc = cursos.length - opcoes.length;
    const [hover, setHover] = useState<number | null>(null);

    const { area, rows } = useMemo(
        () =>
            codigo === null
                ? { area: null, rows: [] }
                : buildRows(codigo, evolucao, nacional),
        [codigo, evolucao, nacional]
    );
    const ticks = buildTicks(rows);
    const avaliados = rows.filter((r) => r.curso !== null || r.nacional !== null);
    const ultimoDoCurso = [...rows].reverse().find((r) => r.curso !== null);
    // foco: o ano avaliado mais perto do mouse; sem mouse, a última avaliação
    const foco =
        hover === null
            ? ultimoDoCurso
            : avaliados.reduce<Row | undefined>(
                  (best, r) =>
                      !best || Math.abs(r.ano - hover) < Math.abs(best.ano - hover)
                          ? r
                          : best,
                  undefined
              );
    const diff =
        foco?.curso != null && foco.nacional !== null
            ? foco.curso - foco.nacional
            : null;
    const topo =
        foco === undefined
            ? null
            : Math.max(foco.curso ?? -Infinity, foco.nacional ?? -Infinity);

    return (
        <Card
            expansivel="tela"
            title="CPC: curso x média nacional"
            info="O CPC contínuo do curso escolhido em cada edição do Enade, contra a média nacional dos cursos da mesma área de avaliação na mesma edição."
            subtitle={
                area
                    ? `Média dos cursos de ${toTitleCase(area)} no Brasil`
                    : "Média dos cursos da mesma área no Brasil"
            }
            className={className}
        >
            {opcoes.length === 0 || !foco ? (
                <p className="text-text-secondary mt-6 text-[13px]">
                    {opcoes.length === 0
                        ? "Nenhum curso do campus com CPC avaliado."
                        : `${toTitleCase(cursos.find((c) => c.codigo_curso === codigo)?.nome_curso ?? "Este curso")} ainda não tem CPC avaliado (sem ciclo do Enade). Escolha outro curso no seletor acima.`}
                </p>
            ) : (
                <>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3">
                                <p className="text-[26px] leading-none font-semibold tracking-[-0.02em]">
                                    {fmt(foco.curso)}
                                </p>
                                {diff !== null && <DiffBadge diff={diff} />}
                                <p className="text-text-secondary min-w-0 truncate text-[13px] leading-snug">
                                    {foco.curso === null
                                        ? `Curso sem avaliação em ${foco.ano}`
                                        : `CPC do curso em ${foco.ano}`}
                                </p>
                            </div>
                            {/* sempre presente (vazia sem média), pra altura não mudar */}
                            <p className="text-text-secondary mt-2 min-h-[1lh] text-[13px] leading-snug">
                                {foco.nacional !== null && (
                                    <>
                                        Média nacional:{" "}
                                        <span className="text-ink font-semibold">
                                            {fmt(foco.nacional)}
                                        </span>
                                        {foco.cursosConsiderados !== null &&
                                            ` (${formatInteger(foco.cursosConsiderados)} cursos)`}
                                    </>
                                )}
                            </p>
                        </div>
                        <ul className="flex items-center gap-4 text-[12px]">
                            <li className="text-text-secondary flex items-center gap-1.5">
                                <span
                                    aria-hidden
                                    className="bg-brand h-[3px] w-4 rounded-full"
                                />
                                Curso
                            </li>
                            <li className="text-text-secondary flex items-center gap-1.5">
                                <span
                                    aria-hidden
                                    className="h-[3px] w-4 rounded-full"
                                    style={{ background: CHART.reference }}
                                />
                                Média nacional
                            </li>
                        </ul>
                    </div>

                    {/* no desktop o card fica na altura dos dois tiles ao lado
                        (o gráfico cresce com ele); empilhado, 250px */}
                    <div className="mt-2 min-h-[250px] flex-1 lg:min-h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={rows}
                                margin={{ top: 48, right: 8, bottom: 0, left: 0 }}
                                onMouseMove={(state) => {
                                    const index = state?.activeTooltipIndex;
                                    if (index !== undefined && index !== null) {
                                        setHover(rows[Number(index)]?.ano ?? null);
                                    }
                                }}
                                onMouseLeave={() => setHover(null)}
                            >
                                <XAxis
                                    dataKey="ano"
                                    type="category"
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                    height={40}
                                    padding={{ left: 28, right: 28 }}
                                    tick={(props) => (
                                        <YearTick
                                            visible
                                            x={Number(props.x)}
                                            y={Number(props.y)}
                                            ano={Number(props.payload?.value)}
                                            active={
                                                Number(props.payload?.value) ===
                                                foco.ano
                                            }
                                        />
                                    )}
                                />
                                <YAxis
                                    domain={[ticks[0], ticks.at(-1)!]}
                                    ticks={ticks}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{
                                        fill: CHART.textMuted,
                                        fontSize: CHART.tickFont,
                                    }}
                                    tickFormatter={(v: number) => formatDecimal(v, 1)}
                                    width={36}
                                />
                                {/* invisível: só faz o gráfico reportar o índice sob o mouse */}
                                <Tooltip content={() => null} cursor={false} />
                                {topo !== null && (
                                    <ReferenceLine
                                        segment={[
                                            { x: foco.ano, y: topo },
                                            { x: foco.ano, y: ticks[0] },
                                        ]}
                                        stroke={CHART.textMuted}
                                        strokeDasharray="3 4"
                                    />
                                )}
                                <Line
                                    type="linear"
                                    dataKey="nacional"
                                    stroke={CHART.reference}
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    connectNulls
                                    dot={(props) => (
                                        <SeriesDot
                                            {...props}
                                            color={CHART.reference}
                                            focoAno={foco.ano}
                                        />
                                    )}
                                    activeDot={false}
                                    isAnimationActive={false}
                                />
                                <Line
                                    type="linear"
                                    dataKey="curso"
                                    stroke={CHART.brand}
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    connectNulls
                                    dot={(props) => (
                                        <SeriesDot
                                            {...props}
                                            color={CHART.brand}
                                            focoAno={foco.ano}
                                        />
                                    )}
                                    activeDot={false}
                                    isAnimationActive={false}
                                />
                                {foco.nacional !== null && (
                                    <ReferenceDot
                                        x={foco.ano}
                                        y={foco.nacional}
                                        shape={(props: {
                                            cx?: number;
                                            cy?: number;
                                        }) => (
                                            <FocusMarker
                                                cx={props.cx ?? 0}
                                                cy={props.cy ?? 0}
                                                ring={CHART.reference}
                                            />
                                        )}
                                    />
                                )}
                                {foco.curso !== null && (
                                    <ReferenceDot
                                        x={foco.ano}
                                        y={foco.curso}
                                        shape={(props: {
                                            cx?: number;
                                            cy?: number;
                                        }) => (
                                            <FocusMarker
                                                cx={props.cx ?? 0}
                                                cy={props.cy ?? 0}
                                                label={fmt(foco.curso)}
                                            />
                                        )}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {semCpc > 0 && (
                        <p className="text-text-muted mt-2 text-[11px]">
                            {semCpc} {semCpc === 1 ? "curso" : "cursos"} do campus ainda
                            sem CPC (sem ciclo do Enade) não{" "}
                            {semCpc === 1 ? "aparece" : "aparecem"} na lista.
                        </p>
                    )}

                    <div className="sr-only">
                        <DataTable
                            columns={["Ano", "CPC do curso", "Média nacional"]}
                            rows={avaliados.map((r) => [
                                String(r.ano),
                                fmt(r.curso),
                                fmt(r.nacional),
                            ])}
                        />
                    </div>
                </>
            )}
        </Card>
    );
}

/** Ponto de cada avaliação; some no ano em foco, onde o anel toma o lugar. */
function SeriesDot({
    cx,
    cy,
    value,
    payload,
    color,
    focoAno,
}: {
    cx?: number;
    cy?: number;
    value?: unknown;
    payload?: Row;
    color: string;
    focoAno: number;
}) {
    if (value == null || cx == null || cy == null || payload?.ano === focoAno) {
        return <g />;
    }
    return <circle cx={cx} cy={cy} r={3.5} fill={color} />;
}

/** Pílula da diferença curso - média: limão acima, vermelha abaixo. */
function DiffBadge({ diff }: { diff: number }) {
    const same = Math.abs(diff) < 0.005;
    const Icon = same ? Minus : diff > 0 ? ArrowUp : ArrowDown;
    return (
        <span
            className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] leading-none font-semibold",
                same
                    ? "bg-page text-text-secondary"
                    : diff > 0
                      ? "bg-good text-on-good"
                      : "bg-status-critical text-white"
            )}
        >
            {diff > 0 ? "+" : diff < 0 ? "−" : ""}
            {formatDecimal(Math.abs(diff))}
            <Icon size={13} strokeWidth={2.5} aria-hidden />
        </span>
    );
}
