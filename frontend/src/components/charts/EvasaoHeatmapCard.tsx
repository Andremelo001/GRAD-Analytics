import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { AMPLIADO_FLEX, AMPLIADO_ROLA } from "@/components/cards/ampliado";
import { Card } from "@/components/cards/Card";
import { rampColor } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/charts/DataTable";
import { formatPercent, formatPoints, toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
    Curso,
    HeatmapEvasaoAnualCelula,
    HeatmapEvasaoNacionalCelula,
} from "@/types/dashboard";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useTheme } from "@/hooks/useTheme";

interface Celula {
    taxa: number | null;
    nacional: number | null;
}

interface Linha {
    codigo: number;
    nome: string;
    celulas: Map<number, Celula>;
}

function buildLinhas(
    cursos: Curso[],
    local: HeatmapEvasaoAnualCelula[],
    nacional: HeatmapEvasaoNacionalCelula[]
): { anos: number[]; linhas: Linha[] } {
    const media = new Map(
        nacional.map((n) => [
            `${n.nome_cine_area_geral}|${n.ano_referencia}`,
            n.taxa_desistencia_anual_media_nacional,
        ])
    );
    const anos = [...new Set(local.map((c) => c.ano_referencia))].sort((a, b) => a - b);
    const linhas = cursos
        .map((curso) => {
            const celulas = new Map<number, Celula>();
            for (const c of local) {
                if (c.codigo_curso !== curso.codigo_curso) continue;
                celulas.set(c.ano_referencia, {
                    taxa: c.taxa_desistencia_anual,
                    nacional:
                        media.get(`${c.nome_cine_area_geral}|${c.ano_referencia}`) ??
                        null,
                });
            }
            return {
                codigo: curso.codigo_curso,
                nome: toTitleCase(curso.nome_curso),
                celulas,
            };
        })
        .filter((l) => l.celulas.size > 0);
    return { anos, linhas };
}

/** Linhas (cursos) visíveis de uma vez; mais que isso, a grade rola. */
const LINHAS_VISIVEIS = 6;

const mean = (values: number[]) =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

/** Evasão anual por curso e ano (``trajetoria_comparada.heatmap_evasao_anual``)
 * num mapa de calor: linhas = cursos, colunas = anos, cor = diferença da
 * evasão do ano para a média nacional da área no mesmo ano (verde abaixo,
 * vermelho acima, mais escuro quanto maior a distância). O número do
 * topo segue o mouse: a célula sob ele (curso, ano, taxa e diferença para a
 * média nacional da área no mesmo ano — ``medias_nacionais.heatmap_evasao_anual``)
 * ou, sem mouse, a média dos cursos no ano mais recente. Com um curso
 * ``selecionado`` (o seletor do Início), a linha dele fica marcada, as outras
 * esmaecem e o número do topo passa a ser o dele. */
export function EvasaoHeatmapCard({
    cursos,
    local,
    nacional,
    preencher = false,
    selecionado = null,
    className,
}: {
    cursos: Curso[];
    local: HeatmapEvasaoAnualCelula[];
    nacional: HeatmapEvasaoNacionalCelula[];
    /** O card tem a altura da tela (Início → Evasão): a grade ocupa o card —
     * com poucos cursos as linhas crescem; com muitos, rola. */
    preencher?: boolean;
    /** Curso em destaque (``null`` = todos iguais). */
    selecionado?: number | null;
    className?: string;
}) {
    const CHART = useChartTheme();
    // as cores das células mudam com as cores acessíveis; o texto acompanha
    const { coresAcessiveis } = useTheme();
    const [hover, setHover] = useState<{ codigo: number; ano: number } | null>(null);
    const { anos, linhas } = useMemo(
        () => buildLinhas(cursos, local, nacional),
        [cursos, local, nacional]
    );
    // limite de cada lado da escala (múltiplo de 5 p.p.): acima e abaixo da
    // média têm amplitudes bem diferentes, então cada lado usa a sua. É o
    // percentil 95 de cada lado, não o máximo: poucos valores extremos (ex.:
    // Fortaleza, com ~100 cursos) não apagam o resto; os extremos saturam.
    const { abaixoMax, acimaMax } = useMemo(() => {
        const diffs = linhas.flatMap((l) =>
            [...l.celulas.values()].flatMap((c) =>
                c.taxa === null || c.nacional === null ? [] : [c.taxa - c.nacional]
            )
        );
        const teto = (v: number) => Math.max(5, Math.ceil(v / 5) * 5);
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

    const rolagem = useRef<HTMLDivElement>(null);
    const linhaSelecionada = linhas.find((l) => l.codigo === selecionado);
    // curso escolhido: a grade rola até a linha dele (centrada)
    useEffect(() => {
        const box = rolagem.current;
        const alvo = box?.querySelector<HTMLElement>(`[data-curso="${selecionado}"]`);
        if (!box || !alvo) return;
        const topo =
            alvo.getBoundingClientRect().top -
            box.getBoundingClientRect().top +
            box.scrollTop;
        box.scrollTo({
            top: topo - (box.clientHeight - alvo.offsetHeight) / 2,
            behavior: "smooth",
        });
    }, [selecionado]);

    // destaque do topo: a célula sob o mouse, o curso escolhido (no ano mais
    // recente) ou a média dos cursos no ano mais recente
    const ultimo = anos.at(-1);
    const celulaSelecionada =
        linhaSelecionada && ultimo !== undefined
            ? linhaSelecionada.celulas.get(ultimo)
            : undefined;
    const hoverLinha = hover
        ? linhas.find((l) => l.codigo === hover.codigo)
        : undefined;
    const hoverCelula = hover ? hoverLinha?.celulas.get(hover.ano) : undefined;
    const doUltimo = linhas
        .map((l) => (ultimo === undefined ? undefined : l.celulas.get(ultimo)))
        .filter((c): c is Celula => c !== undefined);
    const destaque =
        hover && hoverLinha
            ? {
                  taxa: hoverCelula?.taxa ?? null,
                  nacional: hoverCelula?.nacional ?? null,
                  contexto: `${hoverLinha.nome} · ${hover.ano}`,
              }
            : linhaSelecionada
              ? {
                    taxa: celulaSelecionada?.taxa ?? null,
                    nacional: celulaSelecionada?.nacional ?? null,
                    contexto: `${linhaSelecionada.nome} · ${ultimo}`,
                }
              : {
                    taxa: mean(
                        doUltimo.flatMap((c) => (c.taxa === null ? [] : [c.taxa]))
                    ),
                    nacional: mean(
                        doUltimo.flatMap((c) =>
                            c.nacional === null ? [] : [c.nacional]
                        )
                    ),
                    contexto: `Média dos cursos em ${ultimo}`,
                };
    const diff =
        destaque.taxa !== null && destaque.nacional !== null
            ? destaque.taxa - destaque.nacional
            : null;

    return (
        <Card
            expansivel
            title="Evasão anual por curso"
            info="A taxa de desistência de cada curso em cada ano, comparada à média nacional da área no mesmo ano. O número em destaque é a média dos cursos no ano mais recente (ou a célula sob o mouse)."
            subtitle={`Evasão de cada ano comparada à média nacional da área: ${coresAcessiveis ? "azul abaixo, laranja acima" : "verde abaixo, vermelho acima"}`}
            className={className}
        >
            {/* o destaque no tamanho do texto: se não couber ao lado da escala,
                a escala desce pra linha de baixo (o texto só corta se não
                couber nem sozinho, no celular) */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex max-w-full min-w-0 items-center gap-3">
                    {destaque.taxa === null ? (
                        // traço desenhado (não o caractere "—", que num corpo de
                        // 26px fica abaixo do centro da linha do texto ao lado),
                        // na mesma altura do número pra linha não mudar
                        <span
                            role="img"
                            aria-label="sem dado"
                            className="flex h-[26px] shrink-0 items-center"
                        >
                            <span className="bg-ink block h-[3px] w-6 rounded-full" />
                        </span>
                    ) : (
                        <p className="text-[26px] leading-none font-semibold tracking-[-0.02em]">
                            {formatPercent(destaque.taxa)}
                        </p>
                    )}
                    {diff !== null && <DiffBadge diff={diff} />}
                    <p className="text-text-secondary min-w-0 truncate text-[13px]">
                        {destaque.taxa === null ? (
                            <>{destaque.contexto} | sem turmas</>
                        ) : (
                            <>
                                <span className="text-ink font-semibold">
                                    {destaque.contexto}
                                </span>
                                {destaque.nacional !== null &&
                                    ` | média nacional ${formatPercent(destaque.nacional)}`}
                            </>
                        )}
                    </p>
                </div>
                <ScaleLegend abaixoMax={abaixoMax} acimaMax={acimaMax} />
            </div>

            <div
                className={cn(
                    "relative mt-4",
                    AMPLIADO_FLEX,
                    preencher && "flex min-h-0 flex-1 flex-col"
                )}
                onMouseLeave={() => setHover(null)}
            >
                {/* folga de 4px em volta (compensada na margem): um container com
                    rolagem também corta nas bordas, e o contorno da célula sob o
                    mouse passa 3px pra fora da grade. Com mais de 6 cursos
                    (ex.: Fortaleza) a grade rola na vertical na altura de 6
                    linhas, com o eixo dos anos preso embaixo — o card não cresce. */}
                <div
                    ref={rolagem}
                    className={cn(
                        // até 6 linhas, depois rola: campus com poucos cursos
                        // não fica com espaço vazio, e Fortaleza não estica o card
                        "-m-1 overflow-x-auto p-1",
                        // ampliado: a grade ocupa a altura do card
                        preencher
                            ? "min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto"
                            : "max-h-[201.5px]",
                        AMPLIADO_ROLA,
                        !preencher &&
                            (linhas.length > LINHAS_VISIVEIS
                                ? "[scrollbar-width:thin] overflow-y-auto"
                                : "[scrollbar-width:none]")
                    )}
                >
                    <div
                        // coluna dos nomes: 112px no celular (a grade rola dentro
                        // do card), até 200px a partir de sm; no desktop a grade
                        // cabe na largura do card (sem rolar pro lado)
                        className={cn(
                            "grid min-w-[660px] grid-cols-[112px_repeat(var(--anos),minmax(0,1fr))] items-center gap-[3px] sm:grid-cols-[minmax(112px,200px)_repeat(var(--anos),minmax(0,1fr))] lg:min-w-0",
                            // preenchendo: as linhas dividem a altura (mínimo
                            // de 25px; além disso, rola) e o eixo dos anos fica
                            // embaixo
                            preencher && "min-h-full"
                        )}
                        style={
                            {
                                "--anos": anos.length,
                                ...(preencher && {
                                    gridTemplateRows: `repeat(${linhas.length}, minmax(25px, 1fr)) auto`,
                                }),
                            } as CSSProperties
                        }
                        role="img"
                        aria-label={`Mapa de calor da evasão anual de ${linhas.length} cursos, de ${anos[0]} a ${ultimo}.`}
                    >
                        {linhas.map((linha) => (
                            <Row
                                key={linha.codigo}
                                linha={linha}
                                anos={anos}
                                ativo={hover?.codigo === linha.codigo}
                                marcada={selecionado === linha.codigo}
                                apagada={
                                    !!linhaSelecionada &&
                                    selecionado !== linha.codigo &&
                                    hover?.codigo !== linha.codigo
                                }
                                alta={preencher}
                                hoverAno={
                                    hover?.codigo === linha.codigo ? hover.ano : null
                                }
                                colorOf={(c) => {
                                    if (c?.taxa == null || c.nacional === null) {
                                        return null;
                                    }
                                    const diff = c.taxa - c.nacional;
                                    return diff >= 0
                                        ? rampColor(CHART.evasao.acima, diff / acimaMax)
                                        : rampColor(
                                              CHART.evasao.abaixo,
                                              -diff / abaixoMax
                                          );
                                }}
                                onHover={(ano) =>
                                    setHover({ codigo: linha.codigo, ano })
                                }
                            />
                        ))}
                        <span className="bg-surface sticky bottom-0 left-0 z-[3] self-stretch shadow-[0_4px_0_var(--surface),3px_0_0_var(--surface)]" />
                        {anos.map((ano) => (
                            <span
                                key={ano}
                                className="bg-surface sticky bottom-0 z-[2] flex justify-center self-stretch pt-[5px] shadow-[0_4px_0_var(--surface),3px_0_0_var(--surface)]"
                            >
                                <span
                                    className={cn(
                                        "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                                        hover?.ano === ano
                                            ? "bg-lime text-on-lime font-bold"
                                            : "text-text-muted"
                                    )}
                                >
                                    {/* desktop estreito (card ao lado dos tiles):
                                        o ano com dois dígitos, pra não encostar */}
                                    <span className="lg:max-xl:hidden">{ano}</span>
                                    <span className="hidden lg:max-xl:inline">
                                        ’{String(ano).slice(2)}
                                    </span>
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="sr-only">
                <DataTable
                    columns={["Curso", ...anos.map(String)]}
                    rows={linhas.map((l) => [
                        l.nome,
                        ...anos.map((ano) => {
                            const c = l.celulas.get(ano);
                            return c?.taxa == null ? "—" : formatPercent(c.taxa);
                        }),
                    ])}
                />
            </div>
        </Card>
    );
}

function Row({
    linha,
    anos,
    ativo,
    marcada = false,
    apagada = false,
    hoverAno,
    colorOf,
    onHover,
    alta = false,
}: {
    alta?: boolean;
    /** O curso escolhido no seletor: nome numa pílula limão. */
    marcada?: boolean;
    /** Há um curso escolhido e não é este: esmaece. */
    apagada?: boolean;
    linha: Linha;
    anos: number[];
    ativo: boolean;
    hoverAno: number | null;
    colorOf: (c: Celula | undefined) => string | null;
    onHover: (ano: number) => void;
}) {
    return (
        <>
            {/* Nome fixo à esquerda quando a grade rola no celular, sem fundo:
                só o texto, com as células passando por trás dele. */}
            <span
                data-curso={linha.codigo}
                className={cn(
                    "sticky left-0 z-[1] flex min-w-0 items-center self-stretch pr-3 text-[12px] transition-opacity",
                    ativo || marcada ? "text-ink font-semibold" : "text-text-secondary",
                    apagada && "opacity-45"
                )}
                title={linha.nome}
            >
                <span
                    className={cn(
                        "truncate",
                        marcada &&
                            "bg-lime text-on-lime -ml-1.5 rounded-md px-1.5 py-0.5"
                    )}
                >
                    {linha.nome}
                </span>
            </span>
            {anos.map((ano) => {
                const cor = colorOf(linha.celulas.get(ano));
                return (
                    <span
                        key={ano}
                        onMouseEnter={() => onHover(ano)}
                        className={cn(
                            alta ? "h-full min-h-[25px]" : "h-[25px]",
                            "rounded-[5px] transition-opacity",
                            apagada && "opacity-30",
                            cor === null && "border-empty border border-dashed",
                            // por cima do eixo fixo (mesmo motivo do mapa de calor dos
                            // componentes: o contorno passa 3px da célula)
                            hoverAno === ano &&
                                "ring-ink relative z-[4] ring-2 ring-offset-1"
                        )}
                        style={cor ? { background: cor } : undefined}
                    />
                );
            })}
        </>
    );
}

/** Barra da escala: verde (bem abaixo da média) → claro (perto dela) →
 * vermelho (bem acima), com um traço na média; + a marca de "sem turmas". */
function ScaleLegend({ abaixoMax, acimaMax }: { abaixoMax: number; acimaMax: number }) {
    const CHART = useChartTheme();
    const zero = (abaixoMax / (abaixoMax + acimaMax)) * 100;
    const stops = [
        ...[...CHART.evasao.abaixo]
            .reverse()
            .map((cor, i, arr) => `${cor} ${(zero * i) / (arr.length - 1)}%`),
        ...CHART.evasao.acima.map(
            (cor, i, arr) => `${cor} ${zero + ((100 - zero) * i) / (arr.length - 1)}%`
        ),
    ];
    return (
        <div className="text-text-muted flex shrink-0 items-center gap-2 text-[11px] whitespace-nowrap">
            <span>−{abaixoMax} p.p.</span>
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
            <span>+{acimaMax} p.p.</span>
            <span className="ml-1 flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="border-empty h-2.5 w-2.5 rounded-[3px] border border-dashed"
                />
                sem turmas
            </span>
        </div>
    );
}

/** Evasão - média nacional: limão se perdeu menos alunos que a média (bom),
 * vermelha se perdeu mais. */
function DiffBadge({ diff }: { diff: number }) {
    const same = Math.abs(diff) < 0.05;
    const Icon = same ? Minus : diff > 0 ? ArrowUp : ArrowDown;
    return (
        <span
            className={cn(
                "flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] leading-none font-semibold whitespace-nowrap",
                same
                    ? "bg-page text-text-secondary"
                    : diff < 0
                      ? "bg-good text-on-good"
                      : "bg-status-critical text-white"
            )}
        >
            {diff > 0 ? "+" : diff < 0 ? "−" : ""}
            {formatPoints(diff)}
            <Icon size={13} strokeWidth={2.5} aria-hidden />
        </span>
    );
}
