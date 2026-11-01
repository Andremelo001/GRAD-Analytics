/** Última sub-aba aberta em cada aba com sub-abas (Qualidade, Trajetória):
 * o caminho com a busca, ex.: ``/qualidade/curso/123`` ou
 * ``/qualidade/comparacoes?modo=cursos``. Ao voltar pra aba (o link do menu
 * aponta pra ``/qualidade``), o painel reabre onde estava em vez de cair
 * sempre na primeira sub-aba. Só na memória da página: recarregar começa de
 * novo pela primeira. */
const ultimas = new Map<string, string>();

/** Primeira sub-aba de cada aba (pra quando ainda não há memória). */
const PADRAO: Record<string, string> = {
    qualidade: "/qualidade/unidade",
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

/** Tira o curso das sub-abas lembradas (``/qualidade/curso/123`` ->
 * ``/qualidade/curso``; ``?curso=``; ``?a=``/``?b=`` das Comparações entre
 * cursos), pra voltar pelo menu abrir o curso escolhido agora em vez do que
 * estava na URL (``lib/curso-escolhido.ts`` chama ao trocar de curso).
 * Comparação entre unidades fica como está: lá ``a``/``b`` são unidades. */
export function esquecerCursoDasSubabas() {
    for (const [aba, caminho] of ultimas) {
        const [rota, busca = ""] = caminho.split("?");
        const params = new URLSearchParams(busca);
        params.delete("curso");
        if (params.get("modo") === "cursos") {
            params.delete("a");
            params.delete("b");
        }
        const resto = params.toString();
        ultimas.set(
            aba,
            rota.replace(/\/curso\/[^/]+$/, "/curso") + (resto ? `?${resto}` : "")
        );
    }
}
