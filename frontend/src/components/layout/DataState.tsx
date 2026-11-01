import type { ReactNode } from "react";

import { PaginaEsqueleto } from "@/components/layout/Esqueleto";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { DashboardData } from "@/types/dashboard";

/** Evita repetir o boilerplate de loading/erro em toda página — só chama
 * `render(data)` quando o JSON da unidade já carregou; antes disso desenha o
 * ``esqueleto`` da página (o desenho dela em blocos pulsando). Na troca de
 * unidade a página segue com os dados anteriores até os novos chegarem. */
export function DataState({
    render,
    esqueleto = <PaginaEsqueleto />,
}: {
    render: (data: DashboardData) => ReactNode;
    esqueleto?: ReactNode;
}) {
    const { data, loading, error } = useDashboardData();

    if (loading) return esqueleto;
    const erro = error && (
        <p className="text-status-critical bg-popover mb-4 rounded-xl border border-current/20 px-4 py-3 text-[14px] font-medium">
            Erro ao carregar os dados: {error}
        </p>
    );
    if (!data) return erro || null;
    // troca de unidade que falhou: avisa e mantém os dados que já estavam na tela
    return (
        <>
            {erro}
            {render(data)}
        </>
    );
}
