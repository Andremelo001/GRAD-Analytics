import { lazy, Suspense } from "react";

import { MapaEsqueleto } from "@/components/layout/Esqueleto";

// Como o Mapa da Qualidade: a malha do Brasil (~190 KB) só é baixada quando
// a sub-aba abre.
const MapaTrajetoriaPage = lazy(() =>
    import("@/pages/trajetoria/MapaTrajetoriaPage").then((m) => ({
        default: m.MapaTrajetoriaPage,
    }))
);

export function MapaTrajetoriaPageLazy() {
    return (
        <Suspense fallback={<MapaEsqueleto />}>
            <MapaTrajetoriaPage />
        </Suspense>
    );
}
