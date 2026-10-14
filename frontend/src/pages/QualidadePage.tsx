import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { CampusSelect } from "@/components/layout/CampusSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubTabs } from "@/components/layout/SubTabs";
import { lembrarSubaba, ultimaSubaba } from "@/lib/ultima-subaba";
import { carregarMapa } from "@/pages/qualidade/mapa-loader";

const SUB_ABAS = [
    { to: "campus", label: "Visão do campus" },
    { to: "curso", label: "Por curso" },
    { to: "mapa", label: "Mapa" },
    { to: "comparacoes", label: "Comparações" },
];

/** Aba Qualidade: por que o CPC de cada curso é o que é, onde dá pra melhorar
 * e como ele se compara ao país. Dividida em sub-abas com rota própria
 * (``/qualidade/campus``, ``/qualidade/curso/:codigo``, ``/qualidade/mapa``,
 * ``/qualidade/comparacoes``); cada uma é uma
 * página filha, desenhada no ``Outlet``. */
export function QualidadePage() {
    // a sub-aba (campus, curso, mapa…) sem o código do curso: trocar de curso
    // em "Por curso" não reanima a página
    const { pathname, search } = useLocation();
    const subAba = pathname.split("/")[2] ?? "";

    // lembra onde está, pra reabrir aqui ao voltar de outra aba
    useEffect(() => {
        if (subAba) lembrarSubaba("qualidade", pathname + search);
    }, [subAba, pathname, search]);

    // baixa o código do Mapa quando o navegador ficar ocioso
    useEffect(() => {
        const ocioso =
            window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1500));
        ocioso(() => void carregarMapa());
    }, []);

    return (
        <>
            <PageHeader
                title="Qualidade dos cursos"
                subtitle={
                    <>
                        Conceitos do MEC (CPC) dos cursos do UFC Campus <CampusSelect />
                    </>
                }
                tabs={(tom) => (
                    <SubTabs label="Seções da qualidade" items={SUB_ABAS} tom={tom} />
                )}
            />
            <div key={subAba} className="entrada">
                <Outlet />
            </div>
        </>
    );
}

/** ``/qualidade`` sozinho (o link do menu): reabre a última sub-aba. */
export function VoltarSubaba() {
    return <Navigate to={ultimaSubaba("qualidade")} replace />;
}
