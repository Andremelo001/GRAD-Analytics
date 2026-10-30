import { createContext } from "react";

import type { FonteId } from "@/lib/fontes";

/** A fonte dos cards de uma seção de página que junta as duas bases (ex.: o
 * Início, com Ingresso, Qualidade e Trajetória na mesma rota): o "i" dos
 * cards usa esta em vez da fonte da rota. ``null`` fora de uma seção. */
export const FontesSecaoContext = createContext<FonteId[] | null>(null);
