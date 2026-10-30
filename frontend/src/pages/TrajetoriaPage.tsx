import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { CampusAtual } from "@/components/layout/CampusSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubTabs } from "@/components/layout/SubTabs";
import { FiltroTopoContext } from "@/context/filtro-topo";
import { useFiltroTopo } from "@/hooks/useFiltroTopo";
import { lembrarSubaba, ultimaSubaba } from "@/lib/ultima-subaba";

const SUB_ABAS = [
    { to: "panorama", label: "Visão geral" },
    { to: "curso", label: "Por curso" },
    { to: "mapa", label: "Mapa" },
    { to: "comparacoes", label: "Comparações" },
];

/** Aba Trajetória: o que acontece com as turmas depois que entram — quantas
 * se formam, quantas desistem e quando. Sub-abas com rota própria, como a
 * Qualidade (``/trajetoria/panorama``, ``/trajetoria/curso/:codigo``,
 * ``/trajetoria/mapa``, ``/trajetoria/comparacoes``). */
export function TrajetoriaPage() {
    const { pathname, search } = useLocation();
    const subAba = pathname.split("/")[2] ?? "";
    // o seletor de curso do cabeçalho: Por curso e Mapa põem o seu ali
    const filtroTopo = useFiltroTopo();

    // lembra onde está, pra reabrir aqui ao voltar de outra aba
    useEffect(() => {
        if (subAba) lembrarSubaba("trajetoria", pathname + search);
    }, [subAba, pathname, search]);

    return (
        <>
            <PageHeader
                title="Trajetória dos estudantes"
                subtitle={
                    <>
                        Conclusão e evasão das turmas da UFC em <CampusAtual />
                    </>
                }
                tabs={(tom) => (
                    <SubTabs label="Seções da trajetória" items={SUB_ABAS} tom={tom} />
                )}
                filtrosSlot={filtroTopo.slot}
            />
            <FiltroTopoContext.Provider value={filtroTopo.contexto}>
                <div key={subAba} className="entrada">
                    <Outlet />
                </div>
            </FiltroTopoContext.Provider>
        </>
    );
}

/** ``/trajetoria`` sozinho (o link do menu): reabre a última sub-aba. */
export function VoltarSubabaTrajetoria() {
    return <Navigate to={ultimaSubaba("trajetoria")} replace />;
}
