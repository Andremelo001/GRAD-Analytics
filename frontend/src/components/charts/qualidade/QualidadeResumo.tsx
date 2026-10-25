import { useState } from "react";

import { ItemLegenda, Tile } from "@/components/cards/Tile";
import { TextoAjustado } from "@/components/charts/TextoAjustado";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDecimal, toTitleCase } from "@/lib/format";
import { resumoQualidade, type AvaliacaoCurso } from "@/lib/qualidade";
import type { DistribuicaoCpcFaixaNacionalItem } from "@/types/dashboard";

/** Quatro indicadores do campus no topo da Visão do campus: CPC médio,
 * o curso que mais melhorou, Conceito Enade médio e cursos sem CPC. */
export function QualidadeResumo({
    avaliacoes,
    faixasNacional,
}: {
    avaliacoes: AvaliacaoCurso[];
    faixasNacional: DistribuicaoCpcFaixaNacionalItem[];
}) {
    const CHART = useChartTheme();
    // CPC e Conceito Enade médios contra o Brasil (pareados: só os cursos
    // com média nacional da área no mesmo ano)
    const {
        cpcMedio,
        cpcPareado,
        cpcNacional,
        enadeMedio,
        enadePareado,
        enadeNacional,
    } = resumoQualidade(avaliacoes, faixasNacional);

    const avanco = maiorAvanco(avaliacoes);
    // tablet: tiles em 2 colunas (mais baixos) — rótulos e rosca menores
    const duasColunas = useMediaQuery("(min-width: 640px) and (max-width: 1023.98px)");

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
                    // uma linha só: a letra diminui um pouco se o tile for
                    // estreito
                    <TextoAjustado maximo={12} minimo={10}>
                        {cpcNacional === null
                            ? "Sem média nacional para comparar"
                            : `Média nacional das mesmas áreas: ${formatDecimal(cpcNacional)}`}
                    </TextoAjustado>
                }
            />
            <Tile
                label="Maior avanço no CPC"
                info="O curso cujo CPC contínuo mais subiu do ciclo anterior do Enade para a avaliação mais recente (só cursos com CPC nos dois ciclos)."
                footer={
                    avanco && (
                        <TextoAjustado maximo={12} minimo={10}>
                            {formatDecimal(avanco.anterior!.cpc)} em{" "}
                            {avanco.anterior!.ano} → {formatDecimal(avanco.cpc!)} em{" "}
                            {avanco.ano}
                        </TextoAjustado>
                    )
                }
            >
                {avanco ? (
                    <>
                        {/* como o número e a pílula dos outros tiles: o nome
                            numa linha só (inteiro no hover) e o aumento ao
                            lado; o grau embaixo, menor */}
                        <div className="flex items-center gap-3">
                            <p
                                className="min-w-0 truncate text-[17px] leading-tight font-semibold tracking-[-0.01em]"
                                title={avanco.nome}
                            >
                                {toTitleCase(avanco.nomeCurso)}
                            </p>
                            <DeltaPill diff={avanco.cpc! - avanco.anterior!.cpc} />
                        </div>
                        {avanco.grau && (
                            <p className="text-text-secondary truncate text-[11px] leading-tight">
                                {avanco.grau}
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-text-secondary text-[13px] leading-snug">
                        Nenhum curso com CPC maior que no ciclo anterior.
                    </p>
                )}
            </Tile>
            <Tile
                label="Conceito Enade médio"
                info="Média do Conceito Enade contínuo (o desempenho dos concluintes na prova) da avaliação mais recente de cada curso. A média nacional é a dos cursos das mesmas áreas, no mesmo ano de avaliação."
                value={enadeMedio === null ? "—" : formatDecimal(enadeMedio)}
                badge={
                    enadePareado !== null && enadeNacional !== null ? (
                        <DeltaPill diff={enadePareado - enadeNacional} />
                    ) : null
                }
                footer={
                    <TextoAjustado maximo={12} minimo={10}>
                        {enadeNacional === null
                            ? "Sem média nacional para comparar"
                            : `Média nacional das mesmas áreas: ${formatDecimal(enadeNacional)}`}
                    </TextoAjustado>
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

/** O curso cujo CPC mais subiu entre o ciclo anterior e o mais recente;
 * ``null`` se nenhum subiu (ou nenhum tem os dois ciclos). */
function maiorAvanco(avaliacoes: AvaliacaoCurso[]): AvaliacaoCurso | null {
    let melhor: AvaliacaoCurso | null = null;
    let maior = 0;
    for (const a of avaliacoes) {
        if (a.cpc === null || !a.anterior) continue;
        const diff = a.cpc - a.anterior.cpc;
        if (diff > maior) {
            maior = diff;
            melhor = a;
        }
    }
    return melhor;
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
