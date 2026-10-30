import { ExternalLink, Info } from "lucide-react";
import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import { FontesSecaoContext } from "@/context/fontes-secao";
import { FONTES, fontesDaRota, type FonteId } from "@/lib/fontes";
import { cn } from "@/lib/utils";

/** Largura do painel e margem mínima até a borda da tela (px). */
const LARGURA = 300;
const MARGEM_TELA = 16;

interface Posicao {
    top: number;
    /** O topo do ícone menos a folga: a base do painel quando ele abre pra
     * cima. */
    base: number;
    /** Espaço na tela abaixo e acima do ícone (px). */
    abaixo: number;
    acima: number;
    esquerda: number;
    direita: number;
}

/** Logo abaixo do ícone (ou logo acima, ver ``acima``), como a lista dos
 * seletores: em coordenadas da tela dentro de um card ampliado (``fixed``),
 * senão da página (``absolute`` no <body>, rola junto com o card). */
function posicao(icone: DOMRect, fixo: boolean): Posicao {
    const [dx, dy] = fixo ? [0, 0] : [window.scrollX, window.scrollY];
    return {
        top: icone.bottom + dy + 6,
        base: icone.top + dy - 6,
        abaixo: window.innerHeight - icone.bottom - 6 - MARGEM_TELA,
        acima: icone.top - 6 - MARGEM_TELA,
        esquerda: icone.left + dx,
        direita: document.documentElement.clientWidth - icone.right - dx,
    };
}

/** O "i" do canto superior direito dos cards. Clicar abre um painel pequeno
 * ao lado dele (no estilo da lista dos seletores de curso) com o que o card
 * mostra e a fonte dos dados, com o link para a base do INEP. A fonte vem de
 * ``fontes`` ou, sem ela, da seção da página (``FontesSecaoContext``) ou da
 * aba aberta (ver ``fontesDaRota``). Fecha com
 * outro clique no ícone, um clique fora ou o Esc. Num card que amplia, o
 * clique nele (e no painel) não amplia o card. */
export function IconeInfo({
    texto,
    titulo,
    fontes,
    className,
}: {
    texto: string;
    /** O título do card, no topo do painel. */
    titulo?: string;
    fontes?: FonteId[];
    className?: string;
}) {
    const { pathname } = useLocation();
    const secao = useContext(FontesSecaoContext);
    const lista = fontes ?? secao ?? fontesDaRota(pathname);
    const id = useId();
    const botaoRef = useRef<HTMLButtonElement>(null);
    const painelRef = useRef<HTMLDivElement>(null);
    const [aberto, setAberto] = useState(false);
    const [caixa, setCaixa] = useState<Posicao | null>(null);
    const [fixo, setFixo] = useState(false);
    // abre pra esquerda do ícone (ele fica no canto direito do card); se não
    // couber, pra direita
    const [lado, setLado] = useState<"left" | "right">("right");
    // abre pra baixo; se não couber até o fim da tela (card no pé da tela) e
    // houver mais espaço em cima, pra cima. Medido antes de pintar: o painel
    // não aparece embaixo e pula
    const [paraCima, setParaCima] = useState(false);
    useLayoutEffect(() => {
        const painel = painelRef.current;
        if (!aberto || !caixa || !painel) return;
        const altura = painel.offsetHeight;
        setParaCima(altura > caixa.abaixo && caixa.acima > caixa.abaixo);
    }, [aberto, caixa]);

    function medir() {
        const icone = botaoRef.current?.getBoundingClientRect();
        if (!icone) return;
        const emFixo = !!botaoRef.current?.closest(
            "[data-topo-fixo], [data-card-expandido]"
        );
        setFixo(emFixo);
        setCaixa(posicao(icone, emFixo));
        const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM_TELA);
        setLado(icone.right - MARGEM_TELA >= largura ? "right" : "left");
    }

    function fechar(focarIcone: boolean) {
        setAberto(false);
        if (focarIcone) botaoRef.current?.focus({ preventScroll: true });
    }

    useEffect(() => {
        if (!aberto) return;
        painelRef.current?.focus({ preventScroll: true });
        const onPointerDown = (e: PointerEvent) => {
            const alvo = e.target as Node;
            if (!botaoRef.current?.contains(alvo) && !painelRef.current?.contains(alvo))
                setAberto(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            // só o painel fecha (não o card ampliado, nem o modo apresentação)
            e.stopImmediatePropagation();
            fechar(true);
        };
        document.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("resize", medir);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("resize", medir);
        };
    }, [aberto]);

    return (
        <>
            <button
                ref={botaoRef}
                type="button"
                aria-label={titulo ? `Sobre: ${titulo}` : "Sobre este card"}
                aria-expanded={aberto}
                aria-controls={aberto ? id : undefined}
                data-sem-expandir
                onClick={(e) => {
                    e.stopPropagation();
                    if (aberto) fechar(false);
                    else {
                        medir();
                        setAberto(true);
                    }
                }}
                className={cn(
                    "focus-visible:ring-lime/60 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2",
                    aberto ? "text-ink" : "text-text-muted hover:text-ink",
                    className
                )}
            >
                <Info size={15} strokeWidth={2} aria-hidden />
            </button>

            {aberto &&
                caixa &&
                createPortal(
                    <div
                        ref={painelRef}
                        id={id}
                        role="dialog"
                        aria-label={titulo ? `Sobre: ${titulo}` : "Sobre este card"}
                        tabIndex={-1}
                        data-popover-info
                        // o painel fica no <body>, mas o clique ainda sobe pela
                        // árvore do React até o card: não deixa ele ampliar
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            "text-ink bg-popover w-[min(300px,calc(100vw-32px))] rounded-xl p-4 text-left shadow-[0_16px_40px_rgb(0_0_0/0.18)] outline-none",
                            fixo ? "fixed z-[60]" : "absolute z-20"
                        )}
                        style={{
                            ...(paraCima
                                ? { top: caixa.base, transform: "translateY(-100%)" }
                                : { top: caixa.top }),
                            ...(lado === "right"
                                ? { right: caixa.direita }
                                : { left: caixa.esquerda }),
                        }}
                    >
                        {titulo && (
                            <p className="text-[13px] leading-snug font-semibold">
                                {titulo}
                            </p>
                        )}
                        <p
                            className={cn(
                                "text-text-secondary text-[12.5px] leading-relaxed",
                                titulo && "mt-1.5"
                            )}
                        >
                            {texto}
                        </p>
                        <div className="border-card-ring mt-3 border-t pt-3">
                            <p className="text-text-muted text-[10.5px] font-medium tracking-wide uppercase">
                                {lista.length > 1
                                    ? "Fontes dos dados"
                                    : "Fonte dos dados"}
                            </p>
                            <ul className="mt-2 flex flex-col gap-2">
                                {lista.map((f) => (
                                    <li key={f}>
                                        <a
                                            href={FONTES[f].url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group focus-visible:ring-lime/60 -mx-1.5 flex items-start gap-2 rounded-lg px-1.5 py-1 outline-none hover:bg-[var(--page)] focus-visible:ring-2"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[12px] leading-snug font-medium group-hover:underline">
                                                    {FONTES[f].nome}
                                                </span>
                                                <span className="text-text-muted block text-[11px]">
                                                    {FONTES[f].orgao}
                                                </span>
                                            </span>
                                            <ExternalLink
                                                size={13}
                                                strokeWidth={2}
                                                aria-hidden
                                                className="text-text-muted mt-0.5 shrink-0"
                                            />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
