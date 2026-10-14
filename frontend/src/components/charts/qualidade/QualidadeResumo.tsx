import { useState } from "react";

import { ItemLegenda, Tile } from "@/components/cards/Tile";
import { TextoAjustado } from "@/components/charts/TextoAjustado";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDecimal, formatPercent, formatPoints } from "@/lib/format";
import { comCpc, media, type AvaliacaoCurso } from "@/lib/qualidade";
import type { DistribuicaoCpcFaixaNacionalItem } from "@/types/dashboard";

/** Quatro indicadores do campus no topo da Visão do campus: CPC médio,
 * cursos por faixa, % nas faixas 4-5 e cursos sem CPC. */
export function QualidadeResumo({
    avaliacoes,
    faixasNacional,
}: {
    avaliacoes: AvaliacaoCurso[];
    faixasNacional: DistribuicaoCpcFaixaNacionalItem[];
}) {
    const CHART = useChartTheme();
    const avaliados = comCpc(avaliacoes);

    // CPC médio × média nacional das mesmas áreas, nos mesmos anos (pareado:
    // só cursos que têm as duas pontas)
    const pareados = avaliados.filter((a) => a.cpcNacional !== null);
    const cpcMedio = media(avaliados.map((a) => a.cpc));
    const cpcNacional = media(pareados.map((a) => a.cpcNacional!));
    const cpcPareado = media(pareados.map((a) => a.cpc));

    const porFaixa = [1, 2, 3, 4, 5].map(
        (f) => avaliacoes.filter((a) => a.faixa === f).length
    );
    const comFaixa = porFaixa.reduce((a, b) => a + b, 0);
    // tablet: tiles em 2 colunas (mais baixos) — rótulos e rosca menores
    const duasColunas = useMediaQuery("(min-width: 640px) and (max-width: 1023.98px)");
    const altas = porFaixa[3] + porFaixa[4];
    const pctAltas = comFaixa > 0 ? (100 * altas) / comFaixa : null;
    const pctAltasNacional = faixasNacional
        .filter((f) => f.cpc_faixa === "4" || f.cpc_faixa === "5")
        .reduce((total, f) => total + f.percentual_nacional, 0);
    const temNacional = faixasNacional.length > 0;

    const semCpc = avaliacoes.filter((a) => a.cpc === null);
    const nuncaAvaliados = semCpc.filter((a) => a.ano === null).length;
    const semConceito = semCpc.length - nuncaAvaliados;

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4 lg:gap-6">
            <Tile
                label="CPC médio"
                info="Média do CPC contínuo da avaliação mais recente de cada curso. A média nacional é a dos cursos das mesmas áreas, no mesmo ano de avaliação."
                value={cpcMedio === null ? "—" : formatDecimal(cpcMedio)}
                badge={
                    cpcPareado !== null && cpcNacional !== null ? (
                        <DeltaPill diff={cpcPareado - cpcNacional} />
                    ) : null
                }
                footer={
                    // uma linha só, como o rodapé do "Nas faixas 4 e 5": a letra
                    // diminui um pouco se o tile for estreito
                    <TextoAjustado maximo={12} minimo={10}>
                        {cpcNacional === null
                            ? "Sem média nacional para comparar"
                            : `Média nacional das mesmas áreas: ${formatDecimal(cpcNacional)}`}
                    </TextoAjustado>
                }
            />
            <Tile
                label="Cursos por faixa"
                info="Faixa do CPC (1 a 5) na avaliação mais recente de cada curso."
            >
                <FaixasConteudo porFaixa={porFaixa} total={comFaixa} />
            </Tile>
            <Tile
                label="Nas faixas 4 e 5"
                info="Percentual dos cursos com faixa 4 ou 5. No Brasil, entre os cursos das mesmas áreas (avaliação mais recente de cada um)."
                value={pctAltas === null ? "—" : formatPercent(pctAltas, 0)}
                badge={
                    pctAltas !== null && temNacional ? (
                        <DeltaPill
                            diff={pctAltas - pctAltasNacional}
                            limiar={0.5}
                            format={(v) => formatPoints(v, 0)}
                        />
                    ) : null
                }
                footer={
                    temNacional
                        ? `No Brasil, nas mesmas áreas: ${formatPercent(pctAltasNacional, 0)}`
                        : "Sem dado nacional para comparar"
                }
            />
            <Tile
                label="Cursos com CPC"
                info="Cursos com CPC na avaliação mais recente. Os demais ainda não passaram por avaliação (ex.: cursos novos, sem concluintes no Enade) ou ficaram sem conceito (SC). Passe o mouse na rosca para ver cada parte."
                value={`${avaliacoes.length - semCpc.length} de ${avaliacoes.length}`}
                lateral={
                    <CpcDonut
                        tamanho={duasColunas ? 60 : 76}
                        total={avaliacoes.length}
                        nunca={nuncaAvaliados}
                        sc={semConceito}
                    />
                }
                footer={
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:max-lg:gap-x-2 sm:max-lg:text-[10.5px]">
                        <ItemLegenda cor={CHART.brand}>
                            {/* em 2 colunas o tile é estreito: rótulos curtos (o
                                título já diz "Com CPC") */}
                            {duasColunas ? "Com" : "Com CPC"}:{" "}
                            <span className="text-ink font-semibold">
                                {avaliacoes.length - semCpc.length}
                            </span>
                        </ItemLegenda>
                        {semCpc.length > 0 && (
                            <ItemLegenda cor={CHART.reference}>
                                {duasColunas ? "Sem" : "Sem CPC"}:{" "}
                                <span className="text-ink font-semibold">
                                    {semCpc.length}
                                </span>
                            </ItemLegenda>
                        )}
                    </span>
                }
            />
        </div>
    );
}

/** Corpo do "Cursos por faixa": a legenda à esquerda, centrada na altura
 * do medidor, e o medidor à direita. O tamanho do medidor é só CSS — a
 * largura do tile menos a reserva da legenda mais longa ("Faixa 4: 46"),
 * até um teto por tela — então é o mesmo em todos os campi desde o primeiro
 * quadro (sem medir nada): trocar de campus muda só os números e os cortes. */
function FaixasConteudo({ porFaixa, total }: { porFaixa: number[]; total: number }) {
    const CHART = useChartTheme();
    return (
        // medidor preso embaixo (self-end): mesmo lugar em todo campus, mesmo
        // quando a legenda é mais alta que ele (tiles estreitos)
        <div className="flex gap-2.5">
            <span className="text-text-secondary flex flex-col gap-1 self-center text-[11px] leading-snug">
                {porFaixa.map((n, i) =>
                    n === 0 ? null : (
                        <span
                            key={i}
                            className="flex items-center gap-1.5 whitespace-nowrap"
                        >
                            <span
                                aria-hidden
                                className="h-2 w-2 rounded-[3px]"
                                style={{ background: CHART.faixa.ramp[i] }}
                            />
                            Faixa {i + 1}:{" "}
                            <span className="text-ink font-semibold">{n}</span>
                        </span>
                    )
                )}
            </span>
            {/* reserva de 88px pra legenda; teto: celular 170, tablet 128 (tiles
                mais baixos), desktop 140 */}
            <div className="ml-auto w-[clamp(72px,calc(100%-88px),170px)] shrink-0 self-end sm:max-lg:w-[clamp(72px,calc(100%-88px),128px)] lg:w-[clamp(72px,calc(100%-88px),140px)]">
                <FaixasGauge porFaixa={porFaixa} total={total} />
            </div>
        </div>
    );
}

/** Meio anel (medidor) com os cursos por faixa: um segmento por faixa que
 * tem curso, da 1 (esquerda) à 5 (direita), na rampa azul das faixas, com
 * um respiro entre eles. O total fica no centro. */
function FaixasGauge({ porFaixa, total }: { porFaixa: number[]; total: number }) {
    const CHART = useChartTheme();
    // faixa em foco (mouse ou toque): engrossa, as outras apagam e o centro
    // mostra a quantidade dela — como na rosca do card ao lado
    const [foco, setFoco] = useState<number | null>(null);
    // desenho em 128 de largura; o tamanho na tela vem do CSS de quem usa
    const W = 128;
    const R = W * 0.406; // raio até o meio do traço
    const T = W * 0.094; // espessura
    const escala = W / 128; // texto do centro acompanha o tamanho
    const cx = W / 2;
    const cy = R + T / 2 + 2;
    const H = cy + 4;
    const ponto = (a: number) => `${cx + R * Math.cos(a)},${cy - R * Math.sin(a)}`;
    const arco = (de: number, ate: number) =>
        `M${ponto(de)} A${R},${R} 0 0 1 ${ponto(ate)}`;
    const respiro = 3 / R; // ~3px entre os segmentos

    // ângulo onde cada faixa começa: π menos a fração acumulada das anteriores
    const antes = porFaixa.map((_, i) =>
        porFaixa.slice(0, i).reduce((a, b) => a + b, 0)
    );
    const segmentos =
        total === 0
            ? []
            : porFaixa.flatMap((n, i) =>
                  n === 0
                      ? []
                      : [
                            {
                                i,
                                n,
                                de: Math.PI - (antes[i] / total) * Math.PI,
                                ate: Math.PI - ((antes[i] + n) / total) * Math.PI,
                            },
                        ]
              );
    const ultimo = segmentos.length - 1;
    const ativa = segmentos.find((s) => s.i === foco);

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full overflow-visible"
            onMouseLeave={() => setFoco(null)}
            role="img"
            aria-label={`${total} ${total === 1 ? "curso" : "cursos"} com faixa: ${segmentos.map((s) => `faixa ${s.i + 1}, ${s.n}`).join("; ")}`}
        >
            {total === 0 ? (
                <path
                    d={arco(Math.PI, 0)}
                    fill="none"
                    stroke={CHART.deemphasis}
                    strokeWidth={T}
                />
            ) : (
                segmentos.map((s, k) => (
                    <path
                        key={s.i}
                        d={arco(
                            s.de - (k > 0 ? respiro / 2 : 0),
                            s.ate + (k < ultimo ? respiro / 2 : 0)
                        )}
                        fill="none"
                        stroke={CHART.faixa.ramp[s.i]}
                        strokeWidth={foco === s.i ? T + 4 : T}
                        opacity={foco !== null && foco !== s.i ? 0.35 : 1}
                        pointerEvents="stroke"
                        onMouseEnter={() => setFoco(s.i)}
                        onClick={() => setFoco(foco === s.i ? null : s.i)}
                        className="cursor-pointer transition-[opacity,stroke-width] duration-200"
                    />
                ))
            )}
            <text
                x={cx}
                y={cy - 16 * escala}
                textAnchor="middle"
                fontSize={22 * escala}
                fontWeight={600}
                letterSpacing="-0.02em"
                className="fill-ink tabular-nums"
            >
                {ativa ? ativa.n : total}
            </text>
            <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fontSize={Math.max(9, 10 * escala)}
                className="fill-text-muted"
            >
                {ativa
                    ? `${ativa.n === 1 ? "curso" : "cursos"} na faixa ${ativa.i + 1}`
                    : total === 1
                      ? "curso"
                      : "cursos"}
            </text>
        </svg>
    );
}

/** Rosca dos cursos do campus: com CPC (cor da série), nunca avaliados
 * (cinza) e sem conceito (SC, cor de alerta), com um respiro entre as partes.
 * No centro, o % com CPC; passar o mouse (ou tocar) numa parte mostra a
 * quantidade e o nome dela, e apaga as outras. */
function CpcDonut({
    total,
    nunca,
    sc,
    tamanho = 76,
}: {
    total: number;
    nunca: number;
    sc: number;
    tamanho?: number;
}) {
    const CHART = useChartTheme();
    const [foco, setFoco] = useState<string | null>(null);
    const S = tamanho;
    const T = Math.round(tamanho * 0.13);
    const R = (S - T) / 2;
    const c = S / 2;
    const volta = 2 * Math.PI * R;
    const respiro = 2.5;
    const com = total - nunca - sc;
    const partes = [
        // nome em linhas curtas: cabe dentro do anel
        { chave: "com", n: com, cor: CHART.brand, nome: ["com CPC"] },
        {
            chave: "nunca",
            n: nunca,
            cor: CHART.reference,
            nome: ["nunca", nunca === 1 ? "avaliado" : "avaliados"],
        },
        { chave: "sc", n: sc, cor: CHART.critical, nome: ["sem", "conceito"] },
    ].filter((p) => p.n > 0);
    // comprimento de cada parte no anel, com um mínimo (~9px): uma parte
    // pequena (ex.: 2 de 103) continua visível e dá pra passar o mouse nela
    const MINIMO = 9;
    const brutos = partes.map((p) => (p.n / Math.max(total, 1)) * volta);
    const pequenas = brutos.filter((b) => b < MINIMO);
    const resto = brutos.filter((b) => b >= MINIMO).reduce((t, b) => t + b, 0);
    const escala = resto > 0 ? (volta - pequenas.length * MINIMO) / resto : 1;
    const comprimentos = brutos.map((b) => (b < MINIMO ? MINIMO : b * escala));
    const inicio = comprimentos.map((_, k) =>
        comprimentos.slice(0, k).reduce((t, b) => t + b, 0)
    );
    const ativa = partes.find((p) => p.chave === foco);
    const pct = (n: number) => (total > 0 ? Math.round((100 * n) / total) : 0);
    const pequeno = tamanho < 70;

    return (
        <svg
            width={S}
            height={S}
            viewBox={`0 0 ${S} ${S}`}
            role="img"
            aria-label={`${com} de ${total} cursos com CPC (${pct(com)}%)${nunca ? `, ${nunca} nunca avaliados` : ""}${sc ? `, ${sc} sem conceito` : ""}`}
            onMouseLeave={() => setFoco(null)}
            className="overflow-visible"
        >
            <g transform={`rotate(-90 ${c} ${c})`}>
                {total === 0 ? (
                    <circle
                        cx={c}
                        cy={c}
                        r={R}
                        fill="none"
                        stroke={CHART.deemphasis}
                        strokeWidth={T}
                    />
                ) : (
                    partes.map((p, k) => {
                        const comprimento = comprimentos[k];
                        const visivel = Math.max(
                            comprimento - (partes.length > 1 ? respiro : 0),
                            1
                        );
                        const emFoco = foco === p.chave;
                        return (
                            <circle
                                key={p.chave}
                                cx={c}
                                cy={c}
                                r={R}
                                fill="none"
                                stroke={p.cor}
                                strokeWidth={emFoco ? T + 4 : T}
                                strokeDasharray={`${visivel} ${volta - visivel}`}
                                strokeDashoffset={-inicio[k]}
                                opacity={foco && !emFoco ? 0.35 : 1}
                                pointerEvents="stroke"
                                onMouseEnter={() => setFoco(p.chave)}
                                onClick={() => setFoco(emFoco ? null : p.chave)}
                                className="cursor-pointer transition-[opacity,stroke-width] duration-200"
                            />
                        );
                    })
                )}
            </g>
            {/* centro: o % com CPC, ou a parte em foco (quantidade e nome) */}
            {ativa ? (
                <>
                    <text
                        x={c}
                        y={c - (ativa.nome.length > 1 ? 5 : 2) + (pequeno ? 1 : 0)}
                        textAnchor="middle"
                        fontSize={pequeno ? 13 : 16}
                        fontWeight={600}
                        className="fill-ink tabular-nums"
                    >
                        {ativa.n}
                    </text>
                    {ativa.nome.map((linha, i) => (
                        <text
                            key={linha}
                            x={c}
                            y={
                                c +
                                (ativa.nome.length > 1 ? 6 : 9) +
                                i * (pequeno ? 8 : 9)
                            }
                            textAnchor="middle"
                            fontSize={pequeno ? 7 : 8.5}
                            className="fill-text-muted"
                        >
                            {linha}
                        </text>
                    ))}
                </>
            ) : (
                <text
                    x={c}
                    y={c}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={pequeno ? 13 : 15}
                    fontWeight={600}
                    className="fill-ink tabular-nums"
                >
                    {pct(com)}%
                </text>
            )}
        </svg>
    );
}
