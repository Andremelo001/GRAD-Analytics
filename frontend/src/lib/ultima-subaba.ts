/** Última sub-aba aberta em cada aba com sub-abas (Início, Qualidade,
 * Trajetória):
 * o caminho com a busca, ex.: ``/qualidade/curso/123`` ou
 * ``/qualidade/comparacoes?modo=cursos``. Ao voltar pra aba (o link do menu
 * aponta pra ``/qualidade``), o painel reabre onde estava em vez de cair
 * sempre na primeira sub-aba. Só na memória da página: recarregar começa de
 * novo pela primeira. */
const ultimas = new Map<string, string>();

/** Primeira sub-aba de cada aba (pra quando ainda não há memória). */
const PADRAO: Record<string, string> = {
    inicio: "/inicio/ingresso",
    qualidade: "/qualidade/campus",
    trajetoria: "/trajetoria/panorama",
};

/** As abas que têm sub-abas (o link do menu vai direto pra última). */
export const ABAS_COM_SUBABAS = Object.keys(PADRAO);

export function lembrarSubaba(aba: string, caminho: string) {
    ultimas.set(aba, caminho);
}

export function ultimaSubaba(aba: string): string {
    return ultimas.get(aba) ?? PADRAO[aba] ?? `/${aba}`;
}
