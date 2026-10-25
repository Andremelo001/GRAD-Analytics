import {
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from "react";

/** Posição do destaque deslizante de uma barra de abas: mede o link ativo
 * (``aria-current="page"``, que o ``NavLink`` põe sozinho) dentro de
 * ``container`` e devolve ``left``/``width`` pra um elemento absoluto que
 * desliza até ele. Na primeira medida não anima (senão o destaque viria
 * deslizando do canto); depois, ``animar`` liga a transição. Remede quando
 * ``chave`` muda (troca de rota) e quando a barra muda de tamanho.
 * ``ativo`` troca o seletor do item ativo (ex.: ``[aria-checked="true"]``
 * num controle segmentado, que não é rota). */
export function useActiveIndicator(
    container: RefObject<HTMLElement | null>,
    chave: string,
    ativo = '[aria-current="page"]'
): { style: CSSProperties; visivel: boolean; animar: boolean } {
    const [medida, setMedida] = useState<{ left: number; width: number } | null>(null);
    const [animar, setAnimar] = useState(false);
    // o destaque só desliza de uma aba pra outra: quando ainda não havia aba
    // ativa (ex.: voltar pra Qualidade passa por /qualidade antes de abrir a
    // sub-aba lembrada), ele aparece direto no lugar, sem vir do canto
    const ultimaRef = useRef<{ left: number; width: number } | null>(null);
    const [surgiu, setSurgiu] = useState(true);

    useLayoutEffect(() => {
        const el = container.current;
        if (!el) return;
        const medir = () => {
            const atual = el.querySelector<HTMLElement>(ativo);
            // pela tela, não por offsetLeft: o link pode estar dentro de um
            // ``li`` posicionado (a medida seria relativa a ele)
            const caixa = el.getBoundingClientRect();
            const alvo = atual?.getBoundingClientRect();
            const nova = alvo
                ? { left: alvo.left - caixa.left - el.clientLeft, width: alvo.width }
                : null;
            setSurgiu(ultimaRef.current === null);
            ultimaRef.current = nova;
            setMedida(nova);
        };
        medir();
        const observer = new ResizeObserver(medir);
        observer.observe(el);
        // as abas também: com a barra de largura fixa (celular), elas mudam de
        // tamanho sem a barra mudar (ex.: a fonte termina de carregar)
        for (const aba of el.querySelectorAll("a, button")) observer.observe(aba);
        // depois do primeiro quadro desenhado, as próximas mudanças animam
        const frame = requestAnimationFrame(() => setAnimar(true));
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [container, chave, ativo]);

    return {
        style: medida
            ? { transform: `translateX(${medida.left}px)`, width: medida.width }
            : {},
        visivel: medida !== null,
        animar: animar && !surgiu,
    };
}
