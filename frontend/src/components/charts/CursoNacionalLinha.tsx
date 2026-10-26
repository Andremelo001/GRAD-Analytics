import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useState } from "react";
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

import { FocusMarker, YearTick } from "@/components/charts/ChartMarks";
import { DataTable } from "@/components/charts/DataTable";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatDecimal, formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Um ano da linha do tempo: o valor do curso e a média nacional da área
 * (``null`` = sem avaliação naquele ano). */
export interface Row {
    ano: number;
    curso: number | null;
    nacional: number | null;
    cursosConsiderados: number | null;
}

/** Eixo Y em passos de 0,5 com folga em volta das duas séries, dentro da
 * escala 0-5 (linha codifica posição, não precisa partir do zero). */
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

/** Curso x média nacional ano a ano, numa escala de 0 a 5 (CPC, Conceito
 * Enade, nota de um componente): o valor em foco com a diferença pra média,
 * a legenda e as duas linhas no estilo do gráfico de ingressantes — o ano em
 * foco ganha a pílula limão no eixo, anéis nas duas linhas e a etiqueta
 * escura com o valor do curso. Passar o mouse muda o foco (só anos
 * avaliados); sem mouse, a última avaliação do curso. ``nome`` entra nos
 * textos ("CPC do curso em 2021"). Quem usa garante ao menos um ano do
 * curso nas ``rows``. */
export function CursoNacionalLinha({
    rows,
    nome,
    alturaGrafico = "min-h-[250px] flex-1 lg:min-h-[160px]",
    emLinha = false,
}: {
    rows: Row[];
    nome: string;
    /** Classes de altura do gráfico. Padrão: cresce com o card (no Início,
     * ele fica na altura dos cards ao lado); empilhado, 250px. */
    alturaGrafico?: string;
    /** A média nacional na mesma linha do valor do curso (separada por "|")
     * e a legenda embaixo do gráfico, à esquerda. Padrão: a média numa linha
     * própria e a legenda à direita, em cima (o card do Início). */
    emLinha?: boolean;
}) {
    const CHART = useChartTheme();
    const [hover, setHover] = useState<number | null>(null);
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
    if (!foco) return null;
    const diff =
        foco.curso != null && foco.nacional !== null
            ? foco.curso - foco.nacional
            : null;
    const topo = Math.max(foco.curso ?? -Infinity, foco.nacional ?? -Infinity);

    const valor = (
        <div className="flex items-center gap-3">
            <p className="text-[26px] leading-none font-semibold tracking-[-0.02em]">
                {fmt(foco.curso)}
            </p>
            {diff !== null && <DiffBadge diff={diff} />}
            <p className="text-text-secondary min-w-0 truncate text-[13px] leading-snug">
                {foco.curso === null
                    ? `Curso sem avaliação em ${foco.ano}`
                    : `${nome} do curso em ${foco.ano}`}
            </p>
        </div>
    );
    const media = foco.nacional !== null && (
        <>
            Média nacional:{" "}
            <span className="text-ink font-semibold">{fmt(foco.nacional)}</span>
            {foco.cursosConsiderados !== null &&
                ` (${formatInteger(foco.cursosConsiderados)} cursos)`}
        </>
    );
    const legenda = (
        <ul className="flex items-center gap-4 text-[12px]">
            <li className="text-text-secondary flex items-center gap-1.5">
                <span aria-hidden className="bg-brand h-[3px] w-4 rounded-full" />
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
    );

    return (
        <>
            {emLinha ? (
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {valor}
                    {media && (
                        <p className="text-text-secondary text-[13px] leading-snug">
                            <span
                                aria-hidden
                                // no celular a média desce pra linha de baixo: sem o "|" sobrando
                                className="text-text-muted mr-3 hidden sm:inline"
                            >
                                |
                            </span>
                            {media}
                        </p>
                    )}
                </div>
            ) : (
                <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0">
                        {valor}
                        {/* sempre presente (vazia sem média), pra altura não mudar */}
                        <p className="text-text-secondary mt-2 min-h-[1lh] text-[13px] leading-snug">
                            {media}
                        </p>
                    </div>
                    {legenda}
                </div>
            )}

            <div className={cn("mt-2", alturaGrafico)}>
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
                                    active={Number(props.payload?.value) === foco.ano}
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
                                shape={(props: { cx?: number; cy?: number }) => (
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
                                shape={(props: { cx?: number; cy?: number }) => (
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

            {emLinha && <div className="mt-3">{legenda}</div>}

            <div className="sr-only">
                <DataTable
                    columns={["Ano", `${nome} do curso`, "Média nacional"]}
                    rows={avaliados.map((r) => [
                        String(r.ano),
                        fmt(r.curso),
                        fmt(r.nacional),
                    ])}
                />
            </div>
        </>
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
