import { useMemo } from "react";

import { ComponentesHeatmapCard } from "@/components/charts/qualidade/ComponentesHeatmapCard";
import { CpcRankingCard } from "@/components/charts/qualidade/CpcRankingCard";
import { CpcSlopeCard } from "@/components/charts/qualidade/CpcSlopeCard";
import { QualidadeResumo } from "@/components/charts/qualidade/QualidadeResumo";
import { DataState } from "@/components/layout/DataState";
import { VisaoCampusEsqueleto } from "@/components/layout/Esqueleto";
import { buildAvaliacoes } from "@/lib/qualidade";
import type { DashboardData } from "@/types/dashboard";

export function VisaoCampusPage() {
    return (
        <DataState
            esqueleto={<VisaoCampusEsqueleto />}
            render={(data) => (
                <VisaoCampus key={data.escopo.codigo_municipio} data={data} />
            )}
        />
    );
}

/** Qualidade → Visão do campus: todos os cursos lado a lado. */
function VisaoCampus({ data }: { data: DashboardData }) {
    const avaliacoes = useMemo(() => buildAvaliacoes(data), [data]);
    return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
            <QualidadeResumo
                avaliacoes={avaliacoes}
                faixasNacional={data.medias_nacionais.campus.distribuicao_cpc_faixa}
            />
            <CpcRankingCard className="lg:col-span-6" avaliacoes={avaliacoes} />
            <CpcSlopeCard className="lg:col-span-6" avaliacoes={avaliacoes} />
            <ComponentesHeatmapCard
                className="lg:col-span-12"
                avaliacoes={avaliacoes}
            />
        </div>
    );
}
