import { createContext } from "react";

import type { UnidadeInfo, DashboardData } from "@/types/dashboard";

export interface DashboardDataContextValue {
    /** Dados da unidade selecionada (durante a troca, os da anterior). */
    data: DashboardData | null;
    /** Só a primeira carga — na troca de unidade os dados antigos seguem na tela. */
    loading: boolean;
    error: string | null;
    /** Unidades disponíveis (index.json). */
    unidades: UnidadeInfo[];
    /** Slug da unidade selecionada. */
    unidade: string | null;
    setUnidade: (slug: string) => void;
    /** ``true`` enquanto baixa o JSON de uma unidade recém-escolhida. */
    switching: boolean;
    /** Unidade ao abrir o painel (Configurações): ``ULTIMA_UNIDADE`` (a última
     * escolhida) ou o slug de uma unidade fixa. */
    unidadeAoAbrir: string;
    setUnidadeAoAbrir: (valor: string) => void;
}

/** Valor de ``unidadeAoAbrir`` que abre na última unidade escolhida (padrão). */
export const ULTIMA_UNIDADE = "ultimo";

export const DashboardDataContext = createContext<
    DashboardDataContextValue | undefined
>(undefined);
