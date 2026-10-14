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

    return (
        <>
            <CabecalhoInicio />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
                <IngressantesTrendCard
                    className="lg:col-span-8"
                    tendencia={campus.tendencia_ingressantes}
                    demanda={data.trajetoria_comparada.demanda_ingressantes}
                    nacional={data.medias_nacionais.ingressantes}
                    cursos={cursos}
                />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
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

                <BrasilMapaCard
                    className="lg:col-span-4"
                    distribuicao={data.medias_nacionais.distribuicao_uf}
                    cursos={cursos}
                />
                <CpcComparativoCard
                    className="lg:col-span-8"
                    evolucao={perfil.evolucao_cpc}
                    nacional={data.medias_nacionais.evolucao_cpc}
                    cursos={cursos}
                />
                <EvasaoHeatmapCard
                    className="lg:col-span-12"
                    cursos={cursos}
                    local={data.trajetoria_comparada.heatmap_evasao_anual}
                    nacional={data.medias_nacionais.heatmap_evasao_anual}
                />
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
