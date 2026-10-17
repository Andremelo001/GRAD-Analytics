import { useMemo } from "react";

import { StatTile } from "@/components/cards/StatTile";
import { BrasilMapaCard } from "@/components/charts/BrasilMapaCard";
import { CpcComparativoCard } from "@/components/charts/CpcComparativoCard";
import { EvasaoHeatmapCard } from "@/components/charts/EvasaoHeatmapCard";
import { IngressantesTrendCard } from "@/components/charts/IngressantesTrendCard";
import { CampusSelect } from "@/components/layout/CampusSelect";
import { DataState } from "@/components/layout/DataState";
import { InicioEsqueleto } from "@/components/layout/Esqueleto";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatDecimal, formatPercent, formatPoints } from "@/lib/format";
import { buildAvaliacoes, resumoQualidade } from "@/lib/qualidade";
import { buildTrajetorias, indicadoresMaduros, serieMaduras } from "@/lib/trajetoria";
import type { DashboardData } from "@/types/dashboard";

export function HomePage() {
    return (
        <DataState
            // a saudação já aparece no carregamento (senão os cards subiriam
            // pro lugar dela e desceriam quando os dados chegassem)
            esqueleto={
                <>
                    <CabecalhoInicio />
                    <InicioEsqueleto />
                </>
            }
            render={(data) => <Home key={data.escopo.codigo_municipio} data={data} />}
        />
    );
}

/** A coluna de dois stat tiles (um embaixo do outro; lado a lado no tablet).
 * No desktop cada tile tem pelo menos a altura que tinha ao lado do card de
 * Ingressantes (176px): ao lado de um card mais baixo, ele estica o vizinho
 * em vez de encolher. */
const COLUNA_TILES =
    "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4 lg:auto-rows-[minmax(176px,auto)] lg:grid-cols-1 lg:gap-6";

function Home({ data }: { data: DashboardData }) {
    const { campus, cursos, curso_perfil: perfil } = data;

    // conclusão e evasão das turmas maduras (a mais recente de cada curso que
    // já teve o prazo e mais dois anos): a comparação justa — a turma mais
    // recente ainda não teve tempo de se formar. Mesma conta do Panorama da
    // Trajetória.
    const trajetorias = useMemo(() => buildTrajetorias(data), [data]);
    const maduros = useMemo(
        () => indicadoresMaduros(data, trajetorias),
        [data, trajetorias]
    );
    const turmas = maduros?.anos ?? [];
    const infoTurma = maduros
        ? `Turma madura mais recente de cada curso (${turmas.length > 1 ? `ingressos de ${turmas[0]} a ${turmas.at(-1)}` : `ingresso em ${turmas[0]}`}), dois anos depois do prazo do curso, contra os mesmos cursos no Brasil no mesmo ponto. A linha mostra a mesma taxa nas turmas maduras anteriores.`
        : "Ainda não há turma madura (todas em andamento).";

    const qualidade = useMemo(
        () =>
            resumoQualidade(
                buildAvaliacoes(data),
                data.medias_nacionais.campus.distribuicao_cpc_faixa
            ),
        [data]
    );

    return (
        <>
            <CabecalhoInicio />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
                {/* 1ª linha: ingressantes e presença no Brasil */}
                <IngressantesTrendCard
                    className="lg:col-span-8"
                    tendencia={campus.tendencia_ingressantes}
                    demanda={data.trajetoria_comparada.demanda_ingressantes}
                    nacional={data.medias_nacionais.ingressantes}
                    cursos={cursos}
                />
                <BrasilMapaCard
                    className="lg:col-span-4"
                    distribuicao={data.medias_nacionais.distribuicao_uf}
                    cursos={cursos}
                />

                {/* 2ª linha: os indicadores de qualidade ao lado do CPC */}
                <div className={COLUNA_TILES}>
                    <StatTile
                        label="CPC médio"
                        info="Média do CPC contínuo (0 a 5) da avaliação mais recente de cada curso, contra a média nacional dos cursos das mesmas áreas, no mesmo ano de avaliação. A linha mostra o CPC médio do campus ao fim de cada ano de Enade."
                        value={qualidade.cpcMedio}
                        nationalValue={qualidade.cpcNacional}
                        diff={
                            qualidade.cpcPareado !== null &&
                            qualidade.cpcNacional !== null
                                ? qualidade.cpcPareado - qualidade.cpcNacional
                                : null
                        }
                        format={(v) => formatDecimal(v)}
                        formatDiff={(v) => formatDecimal(Math.abs(v))}
                        limiar={0.005}
                        higherIsBetter
                        serie={qualidade.serieCpc}
                        serieLabel="CPC médio ao fim de cada ano de Enade"
                    />
                    <StatTile
                        label="Nas faixas 4 e 5"
                        info="Percentual dos cursos com CPC na faixa 4 ou 5 (avaliação mais recente de cada um), contra os cursos das mesmas áreas no Brasil. A linha mostra o percentual do campus ao fim de cada ano de Enade."
                        value={qualidade.pctAltas}
                        nationalValue={qualidade.pctAltasNacional}
                        format={(v) => formatPercent(v, 0)}
                        formatDiff={(v) => formatPoints(v, 0)}
                        limiar={0.5}
                        higherIsBetter
                        serie={qualidade.serieAltas}
                        serieLabel="Cursos nas faixas 4 e 5 ao fim de cada ano de Enade"
                    />
                </div>
                <CpcComparativoCard
                    className="lg:col-span-8"
                    evolucao={perfil.evolucao_cpc}
                    nacional={data.medias_nacionais.evolucao_cpc}
                    cursos={cursos}
                />

                {/* 3ª linha: a evasão anual e as taxas de trajetória */}
                <EvasaoHeatmapCard
                    className="lg:col-span-8"
                    cursos={cursos}
                    local={data.trajetoria_comparada.heatmap_evasao_anual}
                    nacional={data.medias_nacionais.heatmap_evasao_anual}
                />
                <div className={COLUNA_TILES}>
                    <StatTile
                        label="Taxa de conclusão"
                        info={infoTurma}
                        value={maduros?.concluiu ?? null}
                        nationalValue={maduros?.concluiuBrasil ?? null}
                        higherIsBetter
                        serie={serieMaduras(trajetorias, "concluiu")}
                        serieLabel="Conclusão por turma de ingresso"
                    />
                    <StatTile
                        label="Taxa de evasão"
                        info={infoTurma}
                        value={maduros?.desistiu ?? null}
                        nationalValue={maduros?.desistiuBrasil ?? null}
                        higherIsBetter={false}
                        serie={serieMaduras(trajetorias, "desistiu")}
                        serieLabel="Evasão por turma de ingresso"
                    />
                </div>
            </div>
        </>
    );
}

function CabecalhoInicio() {
    return (
        <PageHeader
            title="Olá, bem-vindo ao PROGRAD Analytics!"
            subtitle={
                <>
                    Acompanhe os indicadores da graduação do UFC Campus <CampusSelect />
                </>
            }
        />
    );
}
