// Composição do CPC (Conceito Preliminar de Curso, nota técnica do INEP):
// média ponderada de 9 notas padronizadas (0-5). Conferido com os dados: a
// soma nota × peso bate com o ``cpc_continuo`` de todos os cursos (erro ≤ 0,001).

import type { PerfilRadar, PerfilRadarNacional } from "@/types/dashboard";

export type ComponenteKey =
    | "formacao_geral"
    | "componente_especifico"
    | "idd"
    | "doutores"
    | "mestres"
    | "regime_trabalho"
    | "organizacao_didatico_pedagogica"
    | "infraestrutura"
    | "oportunidade_ampliacao";

export type Bloco = "Desempenho" | "Docentes" | "Percepção";

export interface Componente {
    key: ComponenteKey;
    /** Nome curto (cabeçalho de coluna, eixo). */
    curto: string;
    nome: string;
    peso: number;
    bloco: Bloco;
}

/** Na ordem dos blocos: desempenho dos estudantes (Enade + IDD), corpo
 * docente e percepção dos estudantes (questionário). */
export const COMPONENTES: readonly Componente[] = [
    { key: "formacao_geral", curto: "FG", nome: "Enade — Formação geral", peso: 0.05, bloco: "Desempenho" },
    { key: "componente_especifico", curto: "CE", nome: "Enade — Componente específico", peso: 0.15, bloco: "Desempenho" },
    { key: "idd", curto: "IDD", nome: "IDD (valor agregado)", peso: 0.35, bloco: "Desempenho" },
    { key: "doutores", curto: "Doutores", nome: "Docentes doutores", peso: 0.15, bloco: "Docentes" },
    { key: "mestres", curto: "Mestres", nome: "Docentes mestres", peso: 0.075, bloco: "Docentes" },
    { key: "regime_trabalho", curto: "Regime", nome: "Regime de trabalho", peso: 0.075, bloco: "Docentes" },
    { key: "organizacao_didatico_pedagogica", curto: "Did.-ped.", nome: "Organização didático-pedagógica", peso: 0.075, bloco: "Percepção" },
    { key: "infraestrutura", curto: "Infra", nome: "Infraestrutura", peso: 0.05, bloco: "Percepção" },
    { key: "oportunidade_ampliacao", curto: "Oport.", nome: "Oportunidades de ampliação da formação", peso: 0.025, bloco: "Percepção" },
] as const; // prettier-ignore

/** Composição do Conceito Enade contínuo: só a prova dos concluintes, 25% de
 * formação geral e 75% de componente específico (notas padronizadas, 0-5).
 * Conferido com os dados: bate com o ``conceito_enade_continuo`` de todos os
 * cursos com as duas notas (erro ≤ 0,001). Até 2017 o INEP não divulgou as
 * duas padronizadas. */
export const COMPONENTES_ENADE: readonly Componente[] = [
    { key: "formacao_geral", curto: "FG", nome: "Formação geral", peso: 0.25, bloco: "Desempenho" },
    { key: "componente_especifico", curto: "CE", nome: "Componente específico", peso: 0.75, bloco: "Desempenho" },
] as const; // prettier-ignore

/** Limite inferior (CPC contínuo) de cada faixa: 2 ≥ 0,945 … 5 ≥ 3,945. */
export const FAIXA_LIMITES = [0.945, 1.945, 2.945, 3.945] as const;

/** Faixa 1-5 do CPC contínuo. */
export function faixaDe(cpc: number): number {
    return 1 + FAIXA_LIMITES.filter((limite) => cpc >= limite).length;
}

/** "4" -> 4; "SC" / "Curso não reconhecido…" -> null (sem conceito). */
export function faixaNumero(faixa: string | null): number | null {
    const n = Number(faixa);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Quanto falta de CPC contínuo pra próxima faixa (null na faixa 5). */
export function faltaParaProximaFaixa(cpc: number): number | null {
    const proximo = FAIXA_LIMITES[faixaDe(cpc) - 1];
    return proximo === undefined ? null : proximo - cpc;
}

/** Pontos de CPC que a nota trouxe (nota × peso). */
export function contribuicao(nota: number, componente: Componente): number {
    return nota * componente.peso;
}

/** Máximo que o componente pode trazer (nota 5 × peso). */
export function potencial(componente: Componente): number {
    return 5 * componente.peso;
}

export function notaDe(
    perfil: PerfilRadar | PerfilRadarNacional | undefined,
    key: ComponenteKey
): number | null {
    return perfil?.[key] ?? null;
}

/** Chave de junção curso × média nacional: as notas são padronizadas dentro
 * de cada edição do Enade, então só se compara na mesma área e ano. */
export function chaveAreaAno(area: string, ano: number): string {
    return `${area}|${ano}`;
}

/** Participação no Enade (% dos concluintes inscritos que fizeram a prova)
 * abaixo disso é sinalizada como baixa: o conceito representa menos a turma.
 * Corte do painel, não do INEP. */
export const PARTICIPACAO_BAIXA = 60;
