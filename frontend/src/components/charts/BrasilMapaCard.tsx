import { useMemo, useRef, useState, type MouseEvent } from "react";

import brazilDots from "@/assets/brazil-dots.json";
import { Card } from "@/components/cards/Card";
import { DataTable } from "@/components/charts/DataTable";
import { formatDecimal, formatInteger, formatPercent, toTitleCase } from "@/lib/format";
import { UF_NOMES } from "@/lib/uf";
import type {
    Curso,
    DistribuicaoUfCurso,
    DistribuicaoUfEstado,
} from "@/types/dashboard";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useElementSize } from "@/hooks/useElementSize";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Matriz de pontos gerada por scripts/build-brazil-dots.mjs (malha do IBGE):
// [coluna, linha, sigla da UF] numa grade de ``columns`` x ``rows``.
const MAPA = brazilDots as unknown as {
    columns: number;
    rows: number;
    dots: [number, number, string][];
};
const DOT_BY_CELL = new Map(MAPA.dots.map(([c, r, uf]) => [`${c},${r}`, uf]));

interface Bin {
    max: number;
    label: string;
    color: string;
}

/** Até 4 faixas de quantidade de cursos (quartis dos estados que oferecem o
 * curso). Com poucos valores distintos, cada valor vira uma faixa. As cores
 * vêm da rampa ordinal, espalhadas quando há menos de 4 faixas. */
function buildBins(counts: number[], ramp: readonly string[]): Bin[] {
    const sorted = counts.filter((n) => n > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const distinct = [...new Set(sorted)];
    const quantile = (q: number) =>
        sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    const maxes =
        distinct.length <= 4
            ? distinct
            : [
                  ...new Set([
                      quantile(0.25),
                      quantile(0.5),
                      quantile(0.75),
                      sorted.at(-1)!,
                  ]),
              ];
    return maxes.map((max, i) => {
        const min = i === 0 ? sorted[0] : maxes[i - 1] + 1;
        const step =
            maxes.length === 1
                ? ramp.length - 1
                : Math.round((i * (ramp.length - 1)) / (maxes.length - 1));
        return {
            max,
            label:
                min === max
                    ? formatInteger(max)
                    : `${formatInteger(min)}–${formatInteger(max)}`,
            color: ramp[step],
        };
    });
}

/** Presença do curso no Brasil (``medias_nacionais.distribuicao_uf``) num
 * mapa de pontos: cada estado é pintado pela quantidade de cursos-pares com
 * turma no ano mais recente; passar o mouse mostra os números do estado. */
export function BrasilMapaCard({
    distribuicao,
    cursos,
    codigo,
    className,
}: {
    distribuicao: DistribuicaoUfCurso[];
    cursos: Curso[];
    /** O curso exibido — o do seletor de curso do Início (no cabeçalho). */
    codigo: number | null;
    className?: string;
}) {
    const CHART = useChartTheme();
    // o ponto, na legenda: "UFC em Quixadá"
    const local = useDashboardData().data?.escopo.municipio ?? "UFC";
    const [hover, setHover] = useState<{
        uf: string;
        x: number;
        y: number;
        width: number;
    } | null>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    // no desktop o card tem a altura da tela (Início → CPC) ou do card
    // ampliado: o mapa cabe no espaço entre o cabeçalho e a legenda — limitado
    // pela altura, não só pela largura (senão, em tela baixa, sai do card)
    const areaRef = useRef<HTMLDivElement>(null);
    const area = useElementSize(areaRef);
    const lg = useMediaQuery("(min-width: 1024px)");
    const larguraMapa =
        lg && area.height > 0
            ? Math.min(330, area.width, (area.height * MAPA.columns) / MAPA.rows)
            : undefined;

    const item = distribuicao.find((d) => d.codigo_curso === codigo);
    const estados = useMemo(
        () => new Map((item?.estados ?? []).map((e) => [e.sigla_uf, e])),
        [item]
    );
    const bins = useMemo(
        () =>
            buildBins(
                [...estados.values()].map((e) => e.quantidade_cursos),
                CHART.presenca.ramp
            ),
        [estados, CHART.presenca.ramp]
    );
    const colorOf = (uf: string) => {
        const n = estados.get(uf)?.quantidade_cursos ?? 0;
        return n > 0
            ? (bins.find((b) => n <= b.max)?.color ?? CHART.brand)
            : CHART.presenca.none;
    };

    const comOferta = [...estados.values()].filter((e) => e.quantidade_cursos > 0);
    const total = comOferta.reduce((sum, e) => sum + e.quantidade_cursos, 0);
    const ufCampus = item?.sigla_uf_campus ?? null;
    const campus = ufCampus ? estados.get(ufCampus) : undefined;
    const posicao = campus
        ? comOferta.filter((e) => e.quantidade_cursos > campus.quantidade_cursos)
              .length + 1
        : null;
    const pino = useMemo(() => centroid(ufCampus), [ufCampus]);
    const nomeCurso = toTitleCase(
        cursos.find((c) => c.codigo_curso === codigo)?.nome_curso ?? ""
    );

    function onMove(event: MouseEvent<SVGSVGElement>) {
        const svg = event.currentTarget.getBoundingClientRect();
        const box = boxRef.current?.getBoundingClientRect();
        const c = Math.floor(((event.clientX - svg.left) / svg.width) * MAPA.columns);
        const r = Math.floor(((event.clientY - svg.top) / svg.height) * MAPA.rows);
        const uf = DOT_BY_CELL.get(`${c},${r}`);
        setHover(
            uf && box
                ? {
                      uf,
                      x: event.clientX - box.left,
                      y: event.clientY - box.top,
                      width: box.width,
                  }
                : null
        );
    }

    return (
        <Card
            expansivel="tela"
            className={className}
            // a quantidade de cursos vem das turmas acompanhadas; o CPC, da
            // Qualidade
            fontes={["trajetoria", "qualidade"]}
            tituloInfo="Presença no Brasil"
            info={`Onde o curso escolhido é oferecido no Brasil: cada estado pintado pela quantidade de cursos presenciais da mesma área${item ? ` (${item.nome_cine_area_geral ?? "—"}) com turma em ${item.ano_ingresso ?? "—"}` : ""}. O ponto marca a UFC na cidade escolhida.${item ? ` CPC: avaliação de ${item.ano_cpc ?? "—"}.` : ""}`}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="flex shrink-0 items-center gap-1.5 text-[14px] font-medium whitespace-nowrap">
                    Presença no Brasil
                </p>
            </div>

            <div className="mt-2.5 flex items-center gap-3">
                <p className="text-[26px] leading-none font-semibold tracking-[-0.02em]">
                    {formatInteger(total)}
                </p>
                <span className="bg-lime text-on-lime rounded-lg px-2.5 py-1.5 text-[12px] leading-none font-semibold">
                    {comOferta.length} {comOferta.length === 1 ? "estado" : "estados"}
                </span>
            </div>
            <p className="mt-3 truncate text-[13px] leading-snug">
                {campus && campus.quantidade_cursos > 0 && posicao !== null ? (
                    <>
                        {ufCampus}:{" "}
                        <span className="text-olive-text font-semibold">
                            {formatInteger(campus.quantidade_cursos)}{" "}
                            {campus.quantidade_cursos === 1 ? "curso" : "cursos"}
                        </span>{" "}
                        | {posicao}º estado com mais cursos
                    </>
                ) : (
                    <span className="text-text-secondary">
                        cursos de {nomeCurso} no país
                    </span>
                )}
            </p>

            <div
                ref={areaRef}
                className="mt-4 flex justify-center lg:min-h-0 lg:flex-1 lg:items-center"
            >
                <div
                    ref={boxRef}
                    className="relative w-full max-w-[330px]"
                    style={
                        larguraMapa !== undefined ? { width: larguraMapa } : undefined
                    }
                >
                    <svg
                        viewBox={`0 0 ${MAPA.columns} ${MAPA.rows}`}
                        className="block h-auto w-full"
                        role="img"
                        aria-label={`Mapa do Brasil: ${nomeCurso} em ${comOferta.length} estados, ${formatInteger(total)} cursos.`}
                        onMouseMove={onMove}
                        onMouseLeave={() => setHover(null)}
                    >
                        {MAPA.dots.map(([c, r, uf]) => (
                            <circle
                                key={`${c},${r}`}
                                cx={c + 0.5}
                                cy={r + 0.5}
                                r={0.36}
                                fill={colorOf(uf)}
                                opacity={hover && hover.uf !== uf ? 0.35 : 1}
                            />
                        ))}
                        {pino && (
                            <g aria-hidden>
                                <circle
                                    cx={pino.x}
                                    cy={pino.y}
                                    r={1.35}
                                    fill={CHART.ink}
                                    stroke={CHART.surface}
                                    strokeWidth={0.5}
                                />
                                <circle
                                    cx={pino.x}
                                    cy={pino.y}
                                    r={0.45}
                                    fill={CHART.lime}
                                />
                            </g>
                        )}
                    </svg>
                    {hover && (
                        <StateTooltip
                            uf={hover.uf}
                            estado={estados.get(hover.uf)}
                            x={hover.x}
                            y={hover.y}
                            width={hover.width}
                        />
                    )}
                </div>
            </div>

            {/* Legenda em duas linhas fixas (faixas em cima, "sem oferta" e
                campus embaixo): o nº de faixas muda com o curso (1 a 4) e não
                pode mudar a altura do card. */}
            <div className="text-text-secondary mt-auto flex shrink-0 flex-col items-center gap-1.5 pt-4 text-[11px]">
                <ul className="flex h-4 items-center gap-3 whitespace-nowrap">
                    {bins.map((b) => (
                        <li key={b.label} className="flex items-center gap-1.5">
                            <LegendDot color={b.color} />
                            {b.label}
                        </li>
                    ))}
                </ul>
                <ul className="flex h-4 items-center gap-3 whitespace-nowrap">
                    <li className="flex items-center gap-1.5">
                        <LegendDot color={CHART.presenca.none} />
                        Sem oferta
                    </li>
                    {pino && (
                        <li className="flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="bg-ink ring-lime h-2.5 w-2.5 rounded-full ring-2 ring-inset"
                            />
                            {local}
                        </li>
                    )}
                </ul>
            </div>

            <div className="sr-only">
                <DataTable
                    columns={[
                        "Estado",
                        "Cursos",
                        "Ingressantes",
                        "Evasão média",
                        "CPC médio",
                    ]}
                    rows={[...estados.values()].map((e) => [
                        UF_NOMES[e.sigla_uf] ?? e.sigla_uf,
                        formatInteger(e.quantidade_cursos),
                        e.qt_ingressante === null
                            ? "—"
                            : formatInteger(e.qt_ingressante),
                        e.taxa_desistencia_media === null
                            ? "—"
                            : formatPercent(e.taxa_desistencia_media),
                        e.cpc_continuo_medio === null
                            ? "—"
                            : formatDecimal(e.cpc_continuo_medio),
                    ])}
                />
            </div>
        </Card>
    );
}

function LegendDot({ color }: { color: string }) {
    return (
        <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: color }}
        />
    );
}

/** Centro (em unidades da grade) dos pontos de uma UF — onde vai o pino. */
function centroid(uf: string | null): { x: number; y: number } | null {
    if (!uf) return null;
    const pts = MAPA.dots.filter(([, , s]) => s === uf);
    if (pts.length === 0) return null;
    return {
        x: pts.reduce((sum, [c]) => sum + c, 0) / pts.length + 0.5,
        y: pts.reduce((sum, [, r]) => sum + r, 0) / pts.length + 0.5,
    };
}

/** Tooltip escuro do estado sob o mouse, acima do cursor e preso às bordas
 * do mapa. */
function StateTooltip({
    uf,
    estado,
    x,
    y,
    width,
}: {
    uf: string;
    estado: DistribuicaoUfEstado | undefined;
    x: number;
    y: number;
    width: number;
}) {
    const half = 88;
    const left = Math.min(Math.max(x, half), Math.max(width - half, half));
    const linhas: [string, string][] = estado
        ? [
              ["Cursos", formatInteger(estado.quantidade_cursos)],
              [
                  "Ingressantes",
                  estado.qt_ingressante === null
                      ? "—"
                      : formatInteger(estado.qt_ingressante),
              ],
              [
                  "Evasão média",
                  estado.taxa_desistencia_media === null
                      ? "—"
                      : formatPercent(estado.taxa_desistencia_media),
              ],
              [
                  "CPC médio",
                  estado.cpc_continuo_medio === null
                      ? "—"
                      : `${formatDecimal(estado.cpc_continuo_medio)} (${estado.quantidade_cursos_cpc})`,
              ],
          ]
        : [];

    return (
        <div
            className="bg-pill text-pill-fg pointer-events-none absolute z-10 w-[176px] -translate-x-1/2 -translate-y-full rounded-xl px-3 py-2.5 shadow-[0_12px_28px_rgb(0_0_0/0.25)]"
            style={{ left, top: y - 12 }}
        >
            <p className="text-[12px] font-semibold">{UF_NOMES[uf] ?? uf}</p>
            {linhas.length === 0 ? (
                <p className="text-pill-fg/60 mt-1 text-[11px]">
                    Sem oferta deste curso
                </p>
            ) : (
                <dl className="mt-1.5 flex flex-col gap-1 text-[11px]">
                    {linhas.map(([rotulo, valor]) => (
                        <div key={rotulo} className="flex justify-between gap-3">
                            <dt className="text-pill-fg/60">{rotulo}</dt>
                            <dd className="font-semibold tabular-nums">{valor}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
