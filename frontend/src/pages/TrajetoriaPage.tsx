import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { CampusAtual } from "@/components/layout/CampusSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubTabs } from "@/components/layout/SubTabs";
import { lembrarSubaba, ultimaSubaba } from "@/lib/ultima-subaba";

const SUB_ABAS = [
    { to: "panorama", label: "Panorama" },
    { to: "curso", label: "Por curso" },
    { to: "comparacoes", label: "Comparações" },
];

/** Aba Trajetória: o que acontece com as turmas depois que entram — quantas
 * se formam, quantas desistem e quando. Sub-abas com rota própria, como a
 * Qualidade (``/trajetoria/panorama``, ``/trajetoria/curso/:codigo``,
 * ``/trajetoria/comparacoes``). */
export function TrajetoriaPage() {
    const { pathname, search } = useLocation();
    const subAba = pathname.split("/")[2] ?? "";

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
                        Conclusão e evasão das turmas do UFC Campus <CampusAtual />
                    </>
                }
                tabs={(tom) => (
                    <SubTabs label="Seções da trajetória" items={SUB_ABAS} tom={tom} />
                )}
            />
            <div key={subAba} className="entrada">
                <Outlet />
            </div>
        </>
    );
}

/** ``/trajetoria`` sozinho (o link do menu): reabre a última sub-aba. */
export function VoltarSubabaTrajetoria() {
    return <Navigate to={ultimaSubaba("trajetoria")} replace />;
}
