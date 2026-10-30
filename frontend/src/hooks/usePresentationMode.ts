import { useCallback, useEffect, useRef, useState } from "react";

/** Duração da animação de entrar/sair (``duration-500`` no AppLayout). A tela
 * cheia só vem depois dela, pra animação ser vista inteira. */
const ANIMACAO_MS = 500;

/** Tela cheia só em telas grandes (mesmo ponto do layout de desktop, lg). */
const TELA_CHEIA_MIN = "(min-width: 1024px)";

/** Keyboard Lock API (Chrome/Edge; ainda fora do lib.dom do TypeScript). */
type ComTeclado = Navigator & {
    keyboard?: { lock?: (teclas: string[]) => Promise<void> };
};

/** Em tela cheia, o Esc é do navegador (sai da tela cheia antes de a página
 * saber): travado, ele chega à página — o 1º Esc fecha o card ampliado, o
 * seguinte sai do modo. Sair da tela cheia pelo navegador vira "segurar o
 * Esc" (o próprio navegador avisa). Sem a API (Firefox, Safari), nada muda:
 * ver ``onFullscreenChange``. */
function travarEsc() {
    (navigator as ComTeclado).keyboard?.lock?.(["Escape"]).catch(() => {});
}

/** Fecha o card ampliado, se houver (o X dele, com a animação de volta). */
function fecharCardAmpliado(): boolean {
    const fechar = document.querySelector<HTMLButtonElement>(
        '[data-card-expandido] button[aria-label="Fechar"]'
    );
    fechar?.click();
    return fechar !== null;
}

/** Modo apresentação: esconde o topo (faixa, logo, busca, saudação, abas),
 * deixa só os cards na tela e põe o navegador em tela cheia. Alterna com
 * Ctrl+K (⌘+K no Mac) e sai com Esc. Ao entrar, rola pro topo — a
 * apresentação começa pelos primeiros cards. A tela cheia entra só quando a
 * animação termina (o navegador ainda aceita o pedido por alguns segundos
 * depois do clique/tecla) e só a partir de 1024px de largura — em celular e
 * tablet o modo funciona sem ela. Ao sair, a faixa volta primeiro e só depois
 * sai da tela cheia. Sair da tela cheia pelo próprio
 * navegador também sai do modo (os dois andam juntos) — exceto com um card
 * ampliado: aí o Esc fecha só o card. Onde não há tela cheia (ex.: iPhone),
 * o modo funciona sem ela. */
export function usePresentationMode(disponivel = true) {
    const [presenting, setPresenting] = useState(false);
    // ``disponivel`` falso (ex.: página Configurações): o atalho não liga o
    // modo, e se ele estava ligado, sai
    const disponivelRef = useRef(disponivel);
    const presentingRef = useRef(false);
    const fullscreenTimer = useRef<number | undefined>(undefined);

    const set = useCallback((on: boolean) => {
        if (on === presentingRef.current) return;
        presentingRef.current = on;
        setPresenting(on);
        window.clearTimeout(fullscreenTimer.current);
        // a tela cheia muda só depois da animação — na entrada, a faixa sobe
        // e então entra em tela cheia; na saída, a faixa volta e então sai
        // (sem animação, com "reduzir movimento", muda na hora)
        const espera = window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : ANIMACAO_MS;
        if (on) {
            window.scrollTo({ top: 0, behavior: "smooth" });
            if (!window.matchMedia(TELA_CHEIA_MIN).matches) return;
            fullscreenTimer.current = window.setTimeout(() => {
                if (presentingRef.current) {
                    document.documentElement
                        .requestFullscreen?.()
                        .then(travarEsc)
                        .catch(() => {});
                }
            }, espera);
        } else if (document.fullscreenElement) {
            fullscreenTimer.current = window.setTimeout(() => {
                if (!presentingRef.current && document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
            }, espera);
        }
    }, []);

    const toggle = useCallback(() => {
        if (disponivelRef.current || presentingRef.current) set(!presentingRef.current);
    }, [set]);
    const exit = useCallback(() => set(false), [set]);

    useEffect(() => {
        disponivelRef.current = disponivel;
        if (!disponivel) set(false);
    }, [disponivel, set]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault(); // Ctrl+K do navegador (busca na barra)
                toggle();
            } else if (event.key === "Escape" && !event.defaultPrevented) {
                // Esc que já fechou uma lista de seletor (preventDefault) não
                // sai do modo; o do card ampliado nem chega aqui (o Card o
                // trata antes, na captura)
                exit();
            }
        };
        // saiu da tela cheia pelo navegador (Esc, F11…): sai do modo também —
        // mas, com um card ampliado, o Esc era pra ele (sem a Keyboard Lock
        // API, o navegador o usa pra sair da tela cheia): fecha só o card e
        // continua no modo, sem tela cheia; o próximo Esc sai do modo
        const onFullscreenChange = () => {
            if (document.fullscreenElement) return;
            if (presentingRef.current && fecharCardAmpliado()) return;
            exit();
        };
        window.addEventListener("keydown", onKeyDown);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        return () => {
            window.clearTimeout(fullscreenTimer.current);
            window.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("fullscreenchange", onFullscreenChange);
        };
    }, [toggle, exit]);

    return { presenting, toggle, exit };
}
