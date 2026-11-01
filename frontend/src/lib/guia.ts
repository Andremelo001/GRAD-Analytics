// Guia de boas-vindas (components/onboarding/GuiaBoasVindas): se já foi
// visto neste navegador.

/** Chave no ``localStorage``: o guia já foi visto (e fechado) neste navegador. */
const GUIA_VISTO_STORAGE_KEY = "prograd-guia-visto";

/** O guia abre sozinho no primeiro acesso deste navegador. Armazenamento
 * bloqueado (aba anônima restrita): abre, mas não insiste a cada página —
 * quem decide é o estado do ``AppLayout``, que só lê isto uma vez. */
export function guiaJaVisto(): boolean {
    try {
        return localStorage.getItem(GUIA_VISTO_STORAGE_KEY) !== null;
    } catch {
        return false;
    }
}

export function marcarGuiaVisto() {
    try {
        localStorage.setItem(GUIA_VISTO_STORAGE_KEY, "1");
    } catch {
        // armazenamento bloqueado: só abre de novo no próximo acesso
    }
}
