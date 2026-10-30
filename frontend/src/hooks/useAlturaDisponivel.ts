import { useEffect, useState, type RefObject } from "react";

/** Distância do topo do elemento (na página, sem a rolagem) até o fim da
 * tela, menos ``margem`` — pra um bloco caber inteiro na tela sem rolar (ex.:
 * o Mapa da Qualidade). Nunca menos que ``minimo`` (tela muito baixa: aí
 * rola). Recalcula quando a janela ou a página mudam de tamanho (o topo fixo
 * crescendo) e no fim de cada animação da página: no modo apresentação o topo
 * sobe e o bloco junto, mas a página continua da altura da tela (nada muda
 * de tamanho pro ResizeObserver ver). */
export function useAlturaDisponivel(
    ref: RefObject<HTMLElement | null>,
    { margem = 24, minimo = 520 }: { margem?: number; minimo?: number } = {}
): number {
    const [altura, setAltura] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const medir = () => {
            // offsetTop somado (não getBoundingClientRect): não sofre com a
            // animação de entrada (translateY) nem com a rolagem
            let topo = 0;
            for (
                let n: HTMLElement | null = el;
                n;
                n = n.offsetParent as HTMLElement | null
            ) {
                topo += n.offsetTop;
            }
            setAltura(Math.max(minimo, Math.floor(window.innerHeight - topo - margem)));
        };
        medir();
        const observer = new ResizeObserver(medir);
        observer.observe(document.documentElement);
        window.addEventListener("resize", medir);
        document.addEventListener("transitionend", medir);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", medir);
            document.removeEventListener("transitionend", medir);
        };
    }, [ref, margem, minimo]);
    return altura;
}
