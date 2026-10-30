import { useState } from "react";

import type { Tom } from "@/components/layout/FiltroTopo";

/** O lugar do seletor no cabeçalho (o ``filtrosSlot`` do ``PageHeader``) e o
 * contexto pras sub-abas: os ``ref`` são estáveis (os ``set`` do estado). */
export function useFiltroTopo() {
    const [band, setBand] = useState<HTMLElement | null>(null);
    const [surface, setSurface] = useState<HTMLElement | null>(null);
    return {
        contexto: { band, surface },
        slot: (tom: Tom) => (tom === "band" ? setBand : setSurface),
    };
}
