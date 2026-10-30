// As fontes dos dados do painel: as duas bases abertas do INEP que o backend
// baixa (as mesmas URLs de ``backend/app/core/config/settings.py``).

export type FonteId = "qualidade" | "trajetoria";

export const FONTES: Record<FonteId, { nome: string; orgao: string; url: string }> = {
    qualidade: {
        nome: "Indicadores de Qualidade da Educação Superior",
        orgao: "INEP · Dados abertos",
        url: "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior",
    },
    trajetoria: {
        nome: "Indicadores de Trajetória da Educação Superior",
        orgao: "INEP · Dados abertos",
        url: "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-trajetoria-da-educacao-superior",
    },
};

/** A fonte dos cards de uma rota, quando o card não diz a dele: a Qualidade
 * vem do CPC; a Trajetória, das turmas acompanhadas. Fora disso (páginas que
 * juntam as duas, como o Início — lá cada seção diz a sua, ver
 * ``FontesSecaoContext``), as duas. */
export function fontesDaRota(pathname: string): FonteId[] {
    const [aba] = pathname.split("/").filter(Boolean);
    if (aba === "qualidade") return ["qualidade"];
    if (aba === "trajetoria") return ["trajetoria"];
    return ["qualidade", "trajetoria"];
}
