import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AMPLIADO_FLEX, AMPLIADO_ROLA } from "@/components/cards/ampliado";
import { Card } from "@/components/cards/Card";
import { rampColor } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/charts/DataTable";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useTheme } from "@/hooks/useTheme";
import { COMPONENTES, notaDe, type Componente } from "@/lib/cpc";
import { formatDecimal } from "@/lib/format";
import { media, type AvaliacaoCurso } from "@/lib/qualidade";
import { cn } from "@/lib/utils";

/** Linhas (cursos) visíveis de uma vez; mais que isso, a grade rola. */
const LINHAS_VISIVEIS = 6;

const BLOCOS = ["Desempenho", "Docentes", "Percepção"] as const;

interface Hover {
    codigo: number;
    componente: Componente;
}

/** Cursos × os 9 componentes do CPC, na avaliação mais recente de cada curso.
 * Cor = diferença da nota do curso para a média nacional da mesma área no
 * mesmo ano (verde acima, vermelho abaixo, mais escuro quanto mais longe);
 * colunas agrupadas em Desempenho · Docentes · Percepção, com o peso de cada
 * uma no CPC. O número do topo segue o mouse; sem mouse, mostra o IDD (o
 * componente de maior peso) na média dos cursos. */
export function ComponentesHeatmapCard({
    avaliacoes,
    className,
}: {
    avaliacoes: AvaliacaoCurso[];
    className?: string;
}) {
    const CHART = useChartTheme();
    // as cores das células mudam com as cores acessíveis; o texto acompanha
    const { coresAcessiveis } = useTheme();
    const navigate = useNavigate();
    const [hover, setHover] = useState<Hover | null>(null);

    const linhas = useMemo(
        () =>
            avaliacoes
                .filter((a) => a.perfil && a.cpc !== null)
                .sort((a, b) => b.cpc! - a.cpc!),
        [avaliacoes]
    );

    const diffDe = (a: AvaliacaoCurso, c: Componente): number | null => {
        const nota = notaDe(a.perfil, c.key);
        const nacional = notaDe(a.nacional, c.key);
        return nota === null || nacional === null ? null : nota - nacional;
    };

    // limite de cada lado (múltiplo de 0,5): percentil 95, como na evasão
    const { abaixoMax, acimaMax } = useMemo(() => {
        const diffs = linhas.flatMap((a) =>
            COMPONENTES.flatMap((c) => {
                const nota = notaDe(a.perfil, c.key);
                const nacional = notaDe(a.nacional, c.key);
                return nota === null || nacional === null ? [] : [nota - nacional];
            })
        );
        const teto = (v: number) => Math.max(0.5, Math.ceil(v / 0.5) * 0.5);
        const p95 = (values: number[]) => {
            if (values.length === 0) return 0;
            const sorted = [...values].sort((a, b) => a - b);
            return sorted[
                Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))
            ];
        };
        return {
            abaixoMax: teto(p95(diffs.filter((d) => d < 0).map((d) => -d))),
            acimaMax: teto(p95(diffs.filter((d) => d > 0))),
        };
    }, [linhas]);

    const corDe = (diff: number | null): string | null => {
        if (diff === null) return null;
        // aqui acima da média é bom: verde (a rampa "abaixo" da evasão)
        return diff >= 0
            ? rampColor(CHART.evasao.abaixo, diff / acimaMax)
            : rampColor(CHART.evasao.acima, -diff / abaixoMax);
    };

    const hoverLinha = hover
        ? linhas.find((l) => l.codigo === hover.codigo)
        : undefined;
    const destaque =
        hover && hoverLinha
            ? {
                  nota: notaDe(hoverLinha.perfil, hover.componente.key),
                  nacional: notaDe(hoverLinha.nacional, hover.componente.key),
                  contexto: `${hoverLinha.nome} · ${hover.componente.nome}`,
              }
            : {
                  nota: media(
                      linhas.flatMap((l) => {
                          const v = notaDe(l.perfil, "idd");
                          return v === null ? [] : [v];
                      })
                  ),
                  nacional: media(
                      linhas.flatMap((l) => {
                          const v = notaDe(l.nacional, "idd");
                          return v === null ? [] : [v];
                      })
                  ),
                  contexto: `IDD (peso 35%) na média dos cursos`,
              };
    const diff =
        destaque.nota !== null && destaque.nacional !== null
            ? destaque.nota - destaque.nacional
            : null;

    return (
        <Card
            expansivel
            title="Componentes do CPC por curso"
            info="As notas dos componentes do CPC de cada curso na avaliação mais recente, coloridas pela diferença para a média nacional da área no mesmo ano."
            subtitle={`Nota de cada componente comparada à média nacional da área no mesmo ano: ${coresAcessiveis ? "azul acima, laranja abaixo" : "verde acima, vermelho abaixo"}`}
            className={className}
        >
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 sm:flex-nowrap">
                <div className="flex min-w-0 basis-full items-center gap-3 sm:flex-1 sm:basis-auto">
                    {destaque.nota === null ? (
                        <span
                            role="img"
                            aria-label="sem dado"
                            className="flex h-[26px] shrink-0 items-center"
                        >
                            <span className="bg-ink block h-[3px] w-6 rounded-full" />
                        </span>
                    ) : (
                        <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                            {formatDecimal(destaque.nota)}
                        </p>
                    )}
                    {diff !== null && <DeltaPill diff={diff} />}
                    <p className="text-text-secondary min-w-0 truncate text-[13px]">
                        <span className="text-ink font-semibold">
                            {destaque.contexto}
                        </span>
                        {destaque.nota === null
                            ? " | sem nota"
                            : destaque.nacional !== null &&
                              ` | média nacional ${formatDecimal(destaque.nacional)}`}
                    </p>
                </div>
                <ScaleLegend abaixoMax={abaixoMax} acimaMax={acimaMax} />
            </div>

            <div
                className={cn("relative mt-4", AMPLIADO_FLEX)}
                onMouseLeave={() => setHover(null)}
            >
                <div
                    className={cn(
                        // até 6 linhas + cabeçalho, depois rola: campus com
                        // poucos cursos não fica com espaço vazio
                        "-m-1 overflow-x-auto p-1",
                        // ampliado: a grade ocupa a altura do card
                        "max-h-[240px]",
                        AMPLIADO_ROLA,
                        linhas.length > LINHAS_VISIVEIS
                            ? "[scrollbar-width:thin] overflow-y-auto"
                            : "[scrollbar-width:none]"
                    )}
                >
                    <div
                        className="grid min-w-[680px] grid-cols-[112px_repeat(9,minmax(0,1fr))] items-center gap-[3px] sm:grid-cols-[minmax(112px,220px)_repeat(9,minmax(0,1fr))]"
                        role="img"
                        aria-label={`Mapa de calor dos 9 componentes do CPC de ${linhas.length} cursos, comparados à média nacional.`}
                    >
                        {/* cabeçalho preso no topo: blocos e componentes */}
                        <span className="bg-surface sticky top-0 left-0 z-[3] row-span-2 self-stretch shadow-[0_-4px_0_var(--surface),3px_0_0_var(--surface)]" />
                        {BLOCOS.map((bloco) => (
                            <span
                                key={bloco}
                                className="bg-surface text-text-muted sticky top-0 z-[2] col-span-3 self-stretch border-b border-current/15 pb-1 text-center text-[10px] font-medium tracking-wide uppercase shadow-[0_-4px_0_var(--surface)]"
                            >
                                {bloco}
                            </span>
                        ))}
                        {COMPONENTES.map((c) => (
                            <span
                                key={c.key}
                                title={`${c.nome} — peso ${c.peso * 100}% no CPC`}
                                className="bg-surface sticky top-[21px] z-[2] flex flex-col items-center self-stretch pt-1 pb-1.5 shadow-[0_0_0_2px_var(--surface)]"
                            >
                                <span
                                    className={cn(
                                        "rounded-md px-1.5 py-0.5 text-[11px] leading-tight whitespace-nowrap",
                                        hover?.componente.key === c.key
                                            ? "bg-lime text-on-lime font-bold"
                                            : "text-text-secondary font-medium"
                                    )}
                                >
                                    {c.curto}
                                </span>
                                <span className="text-text-muted text-[10px] tabular-nums">
                                    {(c.peso * 100).toLocaleString("pt-BR")}%
                                </span>
                            </span>
                        ))}

                        {linhas.map((linha) => (
                            <Row
                                key={linha.codigo}
                                linha={linha}
                                ativo={hover?.codigo === linha.codigo}
                                hoverKey={
                                    hover?.codigo === linha.codigo
                                        ? hover.componente.key
                                        : null
                                }
                                corDe={(c) => corDe(diffDe(linha, c))}
                                onHover={(componente) =>
                                    setHover({ codigo: linha.codigo, componente })
                                }
                                onOpen={() =>
                                    navigate(`/qualidade/curso/${linha.codigo}`)
                                }
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="sr-only">
                <DataTable
                    columns={[
                        "Curso",
                        ...COMPONENTES.map((c) => `${c.nome} (curso / Brasil)`),
                    ]}
                    rows={linhas.map((l) => [
                        l.nome,
                        ...COMPONENTES.map((c) => {
                            const nota = notaDe(l.perfil, c.key);
                            const nacional = notaDe(l.nacional, c.key);
                            return `${nota === null ? "—" : formatDecimal(nota)} / ${nacional === null ? "—" : formatDecimal(nacional)}`;
                        }),
                    ])}
                />
            </div>
        </Card>
    );
}

function Row({
    linha,
    ativo,
    hoverKey,
    corDe,
    onHover,
    onOpen,
}: {
    linha: AvaliacaoCurso;
    ativo: boolean;
    hoverKey: string | null;
    corDe: (c: Componente) => string | null;
    onHover: (c: Componente) => void;
    onOpen: () => void;
}) {
    return (
        <>
            <span
                className={cn(
                    "sticky left-0 z-[1] flex min-w-0 items-center self-stretch pr-3 text-[12px]",
                    ativo ? "text-ink font-semibold" : "text-text-secondary"
                )}
                title={`${linha.nome} — ${linha.ano}`}
            >
                <span className="truncate">{linha.nome}</span>
            </span>
            {COMPONENTES.map((c) => {
                const cor = corDe(c);
                return (
                    <span
                        key={c.key}
                        onMouseEnter={() => onHover(c)}
                        onClick={onOpen}
                        className={cn(
                            "h-[25px] cursor-pointer rounded-[5px]",
                            cor === null && "border-empty border border-dashed",
                            // por cima do cabeçalho fixo: o contorno passa 3px da célula e,
                            // na primeira linha, ficava cortado por ele
                            hoverKey === c.key &&
                                "ring-ink relative z-[4] ring-2 ring-offset-1"
                        )}
                        style={cor ? { background: cor } : undefined}
                    />
                );
            })}
        </>
    );
}

/** Vermelho (bem abaixo da média) → claro (perto) → verde (bem acima), com
 * um traço na média; + a marca de "sem nota". */
function ScaleLegend({ abaixoMax, acimaMax }: { abaixoMax: number; acimaMax: number }) {
    const CHART = useChartTheme();
    const zero = (abaixoMax / (abaixoMax + acimaMax)) * 100;
    const stops = [
        ...[...CHART.evasao.acima]
            .reverse()
            .map((cor, i, arr) => `${cor} ${(zero * i) / (arr.length - 1)}%`),
        ...CHART.evasao.abaixo.map(
            (cor, i, arr) => `${cor} ${zero + ((100 - zero) * i) / (arr.length - 1)}%`
        ),
    ];
    return (
        <div className="text-text-muted flex shrink-0 items-center gap-2 text-[11px] whitespace-nowrap">
            <span>−{formatDecimal(abaixoMax, 1)}</span>
            <span
                aria-hidden
                className="relative block h-2.5 w-24 rounded-full sm:w-36"
                style={{ background: `linear-gradient(to right, ${stops.join(", ")})` }}
            >
                <span
                    className="bg-ink absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full"
                    style={{ left: `${zero}%` }}
                />
            </span>
            <span>+{formatDecimal(acimaMax, 1)}</span>
            <span className="ml-1 flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="border-empty h-2.5 w-2.5 rounded-[3px] border border-dashed"
                />
                sem nota
            </span>
        </div>
    );
}
