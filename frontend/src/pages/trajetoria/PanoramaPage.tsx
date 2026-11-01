import { useMemo } from "react";

import { EvasaoPorAnoCard } from "@/components/charts/trajetoria/EvasaoPorAnoCard";
import { SituacaoFinalCard } from "@/components/charts/trajetoria/SituacaoFinalCard";
import { TrajetoriaResumo } from "@/components/charts/trajetoria/TrajetoriaResumo";
import { DataState } from "@/components/layout/DataState";
import { VisaoUnidadeEsqueleto } from "@/components/layout/Esqueleto";
import { buildTrajetorias } from "@/lib/trajetoria";
import type { DashboardData } from "@/types/dashboard";

export function PanoramaPage() {
    return (
        <DataState
            esqueleto={<VisaoUnidadeEsqueleto />}
            render={(data) => <Panorama key={data.escopo.slug} data={data} />}
        />
    );
}

/** Trajetória → Panorama: como as turmas da unidade terminam e quando se
 * perdem alunos. */
function Panorama({ data }: { data: DashboardData }) {
    const cursos = useMemo(() => buildTrajetorias(data), [data]);
    if (cursos.length === 0) {
        return (
            <p className="text-text-secondary text-[14px]">
                Nenhum curso desta unidade tem turmas acompanhadas.
            </p>
        );
    }
    return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
            <TrajetoriaResumo data={data} cursos={cursos} />
            <SituacaoFinalCard className="lg:col-span-12" cursos={cursos} />
            <EvasaoPorAnoCard className="lg:col-span-12" cursos={cursos} />
        </div>
    );
}
