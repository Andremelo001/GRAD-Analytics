import { createHashRouter, Navigate } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { CampusPage } from "@/pages/CampusPage";
import { ConfiguracoesPage } from "@/pages/ConfiguracoesPage";
import { CursoDetalhePage } from "@/pages/CursoDetalhePage";
import {
    HomePage,
    InicioCpcPage,
    InicioEvasaoPage,
    InicioIngressoPage,
    VoltarSubabaInicio,
} from "@/pages/HomePage";
import { QualidadePage, VoltarSubaba } from "@/pages/QualidadePage";
import { ComparacoesPage } from "@/pages/qualidade/ComparacoesPage";
import { MapaPageLazy } from "@/pages/qualidade/MapaPageLazy";
import { PorCursoPage } from "@/pages/qualidade/PorCursoPage";
import { VisaoCampusPage } from "@/pages/qualidade/VisaoCampusPage";
import { TrajetoriaPage, VoltarSubabaTrajetoria } from "@/pages/TrajetoriaPage";
import { ComparacoesTrajetoriaPage } from "@/pages/trajetoria/ComparacoesTrajetoriaPage";
import { PanoramaPage } from "@/pages/trajetoria/PanoramaPage";
import { PorCursoTrajetoriaPage } from "@/pages/trajetoria/PorCursoTrajetoriaPage";

// HashRouter (não BrowserRouter) de propósito: GitHub Pages é hospedagem
// estática pura — um refresh em /PROGRAD-Analytics/qualidade daria 404
// porque não existe esse arquivo no servidor. Com hash (/#/qualidade) o
// navegador nunca manda essa rota pro servidor, só pro JS local.
export const router = createHashRouter([
    {
        path: "/",
        element: <AppLayout />,
        children: [
            // / sozinho (a entrada do painel) reabre a última sub-aba do Início
            { index: true, element: <VoltarSubabaInicio /> },
            {
                path: "inicio",
                element: <HomePage />,
                children: [
                    { index: true, element: <VoltarSubabaInicio /> },
                    { path: "ingresso", element: <InicioIngressoPage /> },
                    { path: "cpc", element: <InicioCpcPage /> },
                    { path: "evasao", element: <InicioEvasaoPage /> },
                    {
                        path: "*",
                        element: <Navigate to="/inicio/ingresso" replace />,
                    },
                ],
            },
            {
                path: "qualidade",
                element: <QualidadePage />,
                children: [
                    // /qualidade sozinho (o link do menu) reabre a última sub-aba
                    { index: true, element: <VoltarSubaba /> },
                    { path: "campus", element: <VisaoCampusPage /> },
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
                    { path: "comparacoes", element: <ComparacoesTrajetoriaPage /> },
                    // sub-aba que não existe mais (ex.: /trajetoria/turmas, removida):
                    // abre o Panorama em vez de uma tela vazia
                    {
                        path: "*",
                        element: <Navigate to="/trajetoria/panorama" replace />,
                    },
                ],
            },
            { path: "campus", element: <CampusPage /> },
            { path: "cursos/:codigoCurso", element: <CursoDetalhePage /> },
            { path: "configuracoes", element: <ConfiguracoesPage /> },
        ],
    },
]);
