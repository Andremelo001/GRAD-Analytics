import { useMemo, useRef, useState } from "react";

import { Card } from "@/components/cards/Card";
import { DataTable } from "@/components/charts/DataTable";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { useChartTheme } from "@/hooks/useChartTheme";
import { opcaoCurso } from "@/lib/curso";
import { useElementSize } from "@/hooks/useElementSize";
import { FAIXA_LIMITES } from "@/lib/cpc";
import { formatDecimal } from "@/lib/format";
import { comCpc, type AvaliacaoCurso } from "@/lib/qualidade";

// margens iguais dos dois lados: o gráfico fica centralizado no card (à
// esquerda os valores do eixo, à direita os nomes das faixas)
const PAD = { top: 26, right: 58, bottom: 14, left: 58 };
/** Variação até isso conta como "estável". */
const ESTAVEL = 0.05;

type Direcao = "subiu" | "caiu" | "estavel";

const direcao = (diff: number): Direcao =>
    Math.abs(diff) < ESTAVEL ? "estavel" : diff > 0 ? "subiu" : "caiu";

/** CPC de cada curso no ciclo anterior → no mais recente (slope chart), sobre
 * a régua das faixas (à direita, limites tracejados): dá pra ver quem subiu,
 * quem caiu e quem trocou de faixa. Cada curso tem os próprios anos (as
 * áreas são avaliadas em anos diferentes), então as colunas são "ciclo
 * anterior" e "mais recente". Curso com um só ciclo vira um ponto vazado.
 * O seletor (canto superior direito) mostra só a linha de um curso (com
 * muitos cursos, como em Fortaleza, achar um pelo mouse é difícil); sem
 * seleção, passar o mouse destaca um curso e apaga os outros. Com um curso em
 * foco, o subtítulo vira "nome | CPC anterior – CPC atual". */
export function CpcSlopeCard({
    avaliacoes,
    className,
}: {
    avaliacoes: AvaliacaoCurso[];
    className?: string;
}) {
    const CHART = useChartTheme();
    const boxRef = useRef<HTMLDivElement>(null);
    // o gráfico ocupa a altura que o card tem (esticado à do ranking, ao lado)
    const { width, height: H } = useElementSize(boxRef);
    const [hover, setHover] = useState<number | null>(null);
    const [selecionado, setSelecionado] = useState<number | null>(null);
    // o curso em destaque: o do mouse, senão o escolhido no seletor
    const foco = hover ?? selecionado;

    const avaliados = useMemo(() => comCpc(avaliacoes), [avaliacoes]);
    // escolhido no seletor: só a linha dele (a escala continua a de todos,
    // pra não pular ao trocar de curso)
    const visiveis =
        selecionado === null
            ? avaliados
            : avaliados.filter((a) => a.codigo === selecionado);
    // o curso em destaque desenhado por último, por cima das outras linhas
    const pares = visiveis
        .filter((a) => a.anterior !== null)
        .sort((a, b) => Number(a.codigo === foco) - Number(b.codigo === foco));
    const unicos = visiveis.filter((a) => a.anterior === null);

    const valores = avaliados.flatMap((a) =>
        a.anterior ? [a.cpc, a.anterior.cpc] : [a.cpc]
    );
    const lo = Math.max(0, Math.floor((Math.min(...valores, 3) - 0.15) * 2) / 2);
    const hi = Math.min(5, Math.ceil((Math.max(...valores, 4) + 0.15) * 2) / 2);
    const plotH = H - PAD.top - PAD.bottom;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    const plotW = Math.max(width - PAD.left - PAD.right, 0);
    const xA = PAD.left + plotW * 0.12;
    const xB = PAD.left + plotW * 0.88;

    const faixas = [0, ...FAIXA_LIMITES, 5]
        .slice(0, -1)
        .map((inicio, i) => ({
            faixa: i + 1,
            de: Math.max(inicio, lo),
            ate: Math.min([...FAIXA_LIMITES, 5][i], hi),
        }))
        .filter((f) => f.ate > f.de);
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += 0.5) ticks.push(v);

    const cor = (d: Direcao) =>
        d === "subiu" ? CHART.brand : d === "caiu" ? CHART.critical : CHART.reference;
    const contagem = { subiu: 0, caiu: 0, estavel: 0 };
    for (const a of avaliados)
        if (a.anterior) contagem[direcao(a.cpc - a.anterior.cpc)]++;
    const ativo = foco === null ? undefined : avaliados.find((a) => a.codigo === foco);
    const opcoes = [
        { value: "todos", label: "Todos os cursos", detalhe: "Visão geral do campus" },
        ...[...avaliados]
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
            .map((a) =>
                opcaoCurso({ codigo: a.codigo, nome: a.nomeCurso, grau: a.grau })
            ),
    ];

    return (
        <Card
            expansivel="tela"
            title="Evolução entre ciclos"
            info="O CPC de cada curso no ciclo anterior do Enade e no mais recente, sobre as faixas: mostra quais cursos subiram, caíram ou mudaram de faixa. Escolha um curso no seletor para ver só a linha dele."
            subtitle={
                ativo
                    ? `${ativo.nome} | ${
                          ativo.anterior
                              ? `${formatDecimal(ativo.anterior.cpc)} – ${formatDecimal(ativo.cpc)}`
                              : `1º ciclo: ${formatDecimal(ativo.cpc)}`
                      }`
                    : "CPC no ciclo anterior e no mais recente, sobre as faixas"
            }
            className={className}
            action={
                // mesmo seletor com busca de Por curso e Comparações, no
                // tamanho do seletor pequeno: o cabeçalho do card não muda
                <CursoBusca
                    compacto
                    label="Curso"
                    cor={CHART.brand}
                    value={selecionado === null ? "todos" : String(selecionado)}
                    options={opcoes}
                    onChange={(v) => setSelecionado(v === "todos" ? null : Number(v))}
                    placeholder="Buscar curso…"
                />
            }
        >
            <div
                ref={boxRef}
                className="relative mt-4 h-[300px] min-w-0 lg:h-auto lg:min-h-[260px] lg:flex-1"
                onMouseLeave={() => setHover(null)}
            >
                {width > 0 && H > 0 && avaliados.length > 0 && (
                    <svg
                        width={width}
                        height={H}
                        className="absolute inset-0"
                        role="img"
                        aria-label={`CPC de ${contagem.subiu + contagem.caiu + contagem.estavel} cursos entre o ciclo anterior e o mais recente: ${contagem.subiu} subiram, ${contagem.caiu} caíram e ${contagem.estavel} ficaram estáveis.`}
                    >
                        {/* grade horizontal leve, como nos outros gráficos */}
                        {ticks.map((t) => (
                            <line
                                key={`g${t}`}
                                x1={PAD.left}
                                x2={PAD.left + plotW}
                                y1={y(t)}
                                y2={y(t)}
                                stroke={CHART.deemphasis}
                                strokeOpacity={0.7}
                            />
                        ))}
                        {/* os dois ciclos: um eixo vertical em cada ponta */}
                        {[xA, xB].map((x) => (
                            <line
                                key={x}
                                x1={x}
                                x2={x}
                                y1={PAD.top}
                                y2={PAD.top + plotH}
                                stroke={CHART.deemphasis}
                            />
                        ))}
                        {/* faixas: em vez de pintar o fundo, uma régua fina na
                            direita (na rampa azul das faixas) com o nome, e o
                            limite entre elas tracejado */}
                        {faixas.map((f) => {
                            const topo = y(f.ate);
                            const altura = y(f.de) - y(f.ate);
                            return (
                                <g key={f.faixa}>
                                    <rect
                                        x={PAD.left + plotW + 6}
                                        width={4}
                                        y={topo + 1}
                                        height={Math.max(altura - 2, 0)}
                                        rx={2}
                                        fill={CHART.faixa.ramp[f.faixa - 1]}
                                    />
                                    {altura > 16 && (
                                        <text
                                            x={PAD.left + plotW + 15}
                                            y={topo + altura / 2}
                                            dominantBaseline="middle"
                                            fontSize={CHART.tickFont}
                                            fill={CHART.textMuted}
                                        >
                                            Faixa {f.faixa}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                        {FAIXA_LIMITES.filter((l) => l > lo && l < hi).map((l) => (
                            <line
                                key={l}
                                x1={PAD.left}
                                x2={PAD.left + plotW}
                                y1={y(l)}
                                y2={y(l)}
                                stroke={CHART.reference}
                                strokeDasharray="4 4"
                                strokeWidth={1}
                            />
                        ))}
                        {ticks.map((t) => (
                            <text
                                key={t}
                                x={PAD.left - 8}
                                y={y(t)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize={CHART.tickFont}
                                fill={CHART.textMuted}
                            >
                                {formatDecimal(t, 1)}
                            </text>
                        ))}
                        {(
                            [
                                [xA, "Ciclo anterior"],
                                [xB, "Mais recente"],
                            ] as const
                        ).map(([x, label]) => (
                            <text
                                key={label}
                                x={x}
                                y={12}
                                textAnchor="middle"
                                fontSize={CHART.tickFont}
                                fill={CHART.textMuted}
                            >
                                {label}
                            </text>
                        ))}

                        {pares.map((a) => {
                            const d = direcao(a.cpc - a.anterior!.cpc);
                            const apagado = foco !== null && foco !== a.codigo;
                            return (
                                <g
                                    key={a.codigo}
                                    opacity={apagado ? 0.15 : 1}
                                    onMouseEnter={() => setHover(a.codigo)}
                                >
                                    <line
                                        x1={xA}
                                        x2={xB}
                                        y1={y(a.anterior!.cpc)}
                                        y2={y(a.cpc)}
                                        stroke="transparent"
                                        strokeWidth={12}
                                    />
                                    <line
                                        x1={xA}
                                        x2={xB}
                                        y1={y(a.anterior!.cpc)}
                                        y2={y(a.cpc)}
                                        stroke={cor(d)}
                                        strokeWidth={foco === a.codigo ? 3 : 2}
                                        strokeLinecap="round"
                                    />
                                    {[
                                        [xA, a.anterior!.cpc],
                                        [xB, a.cpc],
                                    ].map(([x, v]) => (
                                        <circle
                                            key={x}
                                            cx={x}
                                            cy={y(v)}
                                            r={4}
                                            fill={cor(d)}
                                            stroke={CHART.surface}
                                            strokeWidth={2}
                                        />
                                    ))}
                                </g>
                            );
                        })}
                        {unicos.map((a) => (
                            <circle
                                key={a.codigo}
                                cx={xB}
                                cy={y(a.cpc)}
                                r={4.5}
                                fill={CHART.surface}
                                stroke={CHART.reference}
                                strokeWidth={2}
                                opacity={foco !== null && foco !== a.codigo ? 0.15 : 1}
                                onMouseEnter={() => setHover(a.codigo)}
                            />
                        ))}
                        {ativo && (
                            <>
                                {ativo.anterior && (
                                    <ValorLabel
                                        x={xA - 10}
                                        y={y(ativo.anterior.cpc)}
                                        anchor="end"
                                        texto={formatDecimal(ativo.anterior.cpc)}
                                    />
                                )}
                                <ValorLabel
                                    x={xB + 10}
                                    y={y(ativo.cpc)}
                                    anchor="start"
                                    texto={formatDecimal(ativo.cpc)}
                                />
                            </>
                        )}
                    </svg>
                )}
            </div>

            <div className="sr-only">
                <DataTable
                    columns={["Curso", "Ciclo anterior", "Mais recente"]}
                    rows={avaliados.map((a) => [
                        a.nome,
                        a.anterior
                            ? `${a.anterior.ano}: ${formatDecimal(a.anterior.cpc)}`
                            : "—",
                        `${a.ano}: ${formatDecimal(a.cpc)}`,
                    ])}
                />
            </div>
        </Card>
    );
}

function ValorLabel({
    x,
    y,
    anchor,
    texto,
}: {
    x: number;
    y: number;
    anchor: "start" | "end";
    texto: string;
}) {
    const CHART = useChartTheme();
    const w = 36;
    const left = anchor === "start" ? x : x - w;
    return (
        <g pointerEvents="none">
            <rect x={left} y={y - 10} width={w} height={20} rx={6} fill={CHART.label} />
            <text
                x={left + w / 2}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fill={CHART.labelText}
            >
                {texto}
            </text>
        </g>
    );
}
