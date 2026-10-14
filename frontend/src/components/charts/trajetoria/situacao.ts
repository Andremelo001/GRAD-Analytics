import type { ChartPalette } from "@/components/charts/chart-theme";

/** As três situações de um aluno numa turma, na ordem em que aparecem nas
 * barras e legendas da Trajetória. */
export const SITUACOES = ["concluiu", "desistiu", "cursando"] as const;
export type Situacao = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
    concluiu: "Concluíram",
    desistiu: "Desistiram",
    cursando: "Ainda cursando",
};

/** Cores fixas das situações em toda a aba: concluiu na cor da série,
 * desistiu na cor de alerta e cursando em cinza (nas cores acessíveis, azul e
 * laranja — vêm da paleta do tema). */
export function corSituacao(CHART: ChartPalette, s: Situacao): string {
    return s === "concluiu"
        ? CHART.brand
        : s === "desistiu"
          ? CHART.critical
          : CHART.reference;
}

/** O indicador do INEP de cada situação (acumulado até o ano de
 * referência): concluíram = TCA, desistiram = TDA, ainda cursando = TAP. */
export const SIGLA_SITUACAO: Record<Situacao, "TCA" | "TDA" | "TAP"> = {
    concluiu: "TCA",
    desistiu: "TDA",
    cursando: "TAP",
};
