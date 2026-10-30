import { DataState } from "@/components/layout/DataState";

export function CampusPage() {
    return (
        <DataState
            render={(data) => (
                <div>
                    <h1 className="text-2xl font-bold">Visão geral</h1>
                    <p className="text-white/80">
                        {data.campus.kpis.total_cursos} curso(s) no total
                    </p>
                    {/* TODO: campus.kpis, campus.distribuicao_cpc_faixa,
              campus.tendencia_ingressantes e medias_nacionais.campus (comparação
              com o grupo de pares nacional) */}
                </div>
            )}
        />
    );
}
