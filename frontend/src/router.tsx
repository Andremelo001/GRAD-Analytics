import { createHashRouter, Navigate } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { UnidadePage } from "@/pages/UnidadePage";
import { ConfiguracoesPage } from "@/pages/ConfiguracoesPage";
import { CursoDetalhePage } from "@/pages/CursoDetalhePage";
import { HomePage } from "@/pages/HomePage";
import { QualidadePage, VoltarSubaba } from "@/pages/QualidadePage";
import { ComparacoesPage } from "@/pages/qualidade/ComparacoesPage";
import { MapaPageLazy } from "@/pages/qualidade/MapaPageLazy";
import { PorCursoPage } from "@/pages/qualidade/PorCursoPage";
import { VisaoUnidadePage } from "@/pages/qualidade/VisaoUnidadePage";
import { TrajetoriaPage, VoltarSubabaTrajetoria } from "@/pages/TrajetoriaPage";
import { ComparacoesTrajetoriaPage } from "@/pages/trajetoria/ComparacoesTrajetoriaPage";
import { PanoramaPage } from "@/pages/trajetoria/PanoramaPage";
import { MapaTrajetoriaPageLazy } from "@/pages/trajetoria/MapaTrajetoriaPageLazy";
import { PorCursoTrajetoriaPage } from "@/pages/trajetoria/PorCursoTrajetoriaPage";

// HashRouter (não BrowserRouter) de propósito: GitHub Pages é hospedagem
// estática pura — um refresh em /GRAD-Analytics/qualidade daria 404
// porque não existe esse arquivo no servidor. Com hash (/#/qualidade) o
// navegador nunca manda essa rota pro servidor, só pro JS local.
export const router = createHashRouter([
    {
        path: "/",
        element: <AppLayout />,
        children: [
            // / sozinho (a entrada do painel): o Início
            { index: true, element: <Navigate to="/inicio" replace /> },
            { path: "inicio", element: <HomePage /> },
            // as antigas sub-abas do Início (hoje seções da mesma página)
            { path: "inicio/*", element: <Navigate to="/inicio" replace /> },
            {
                path: "qualidade",
                element: <QualidadePage />,
                children: [
                    // /qualidade sozinho (o link do menu) reabre a última sub-aba
                    { index: true, element: <VoltarSubaba /> },
                    { path: "unidade", element: <VisaoUnidadePage /> },
                    // nome antigo da sub-aba (links e a última sub-aba salva)
                    { path: "campus", element: <Navigate to="../unidade" replace /> },
                    { path: "curso/:codigo?", element: <PorCursoPage /> },
                    {
                        path: "mapa",
                        element: <MapaPageLazy />,
                    },
                    { path: "comparacoes", element: <ComparacoesPage /> },
                ],
            },
            {
                path: "trajetoria",
                element: <TrajetoriaPage />,
                children: [
                    // /trajetoria sozinho (o link do menu) reabre a última sub-aba
                    { index: true, element: <VoltarSubabaTrajetoria /> },
                    { path: "panorama", element: <PanoramaPage /> },
                    { path: "curso/:codigo?", element: <PorCursoTrajetoriaPage /> },
                    { path: "mapa", element: <MapaTrajetoriaPageLazy /> },
                    { path: "comparacoes", element: <ComparacoesTrajetoriaPage /> },
                    // sub-aba que não existe mais (ex.: /trajetoria/turmas, removida):
                    // abre o Panorama em vez de uma tela vazia
                    {
                        path: "*",
                        element: <Navigate to="/trajetoria/panorama" replace />,
                    },
                ],
            },
            { path: "unidade", element: <UnidadePage /> },
            { path: "campus", element: <Navigate to="/unidade" replace /> },
            { path: "cursos/:codigoCurso", element: <CursoDetalhePage /> },
            { path: "configuracoes", element: <ConfiguracoesPage /> },
        ],
    },
]);
