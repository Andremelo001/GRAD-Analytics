import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { rolarDentro } from "@/lib/rolar";
import { cn } from "@/lib/utils";

/** Largura máxima da lista e margem mínima até a borda da tela (px). */
const LISTA_MAX = 280;
const MARGEM_TELA = 16;

/** Onde a lista abre: logo abaixo do botão. Na faixa fixa do topo, em
 * coordenadas da tela (``position: fixed`` — fica parada com o botão); no
 * resto, em coordenadas da página (``absolute`` no <body> — rola junto com
 * o botão, no mesmo quadro, sem precisar acompanhar a rolagem). */
interface Posicao {
    top: number;
    esquerda: number;
    direita: number;
    largura: number;
}

function posicao(botao: DOMRect, fixo: boolean): Posicao {
    const [dx, dy] = fixo ? [0, 0] : [window.scrollX, window.scrollY];
    return {
        top: botao.bottom + dy + 6,
        esquerda: botao.left + dx,
        direita: document.documentElement.clientWidth - botao.right - dx,
        largura: botao.width,
    };
}

interface Option {
    value: string;
    label: string;
}

/** Seletor em pílula escura dos cards (o "Weekly" do design de referência):
 * escolhe a série exibida no gráfico. A lista é um painel próprio (o
 * ``<select>`` nativo abre no estilo do sistema e não aceita CSS), no mesmo
 * estilo da lista da busca: painel branco, opção ativa em cinza-claro e a
 * selecionada com ✓. Teclado: ↑/↓, Home/End, Enter/Espaço, Esc. ``size="sm"``
 * é a versão compacta, pra cards estreitos. ``variant="inline"`` é a versão
 * que entra no meio de uma frase (texto em negrito com a seta, sem pílula; lista
 * alinhada à esquerda); ``busy`` troca a seta por um indicador de carga. */
export function ChartSelect({
    label,
    value,
    options,
    onChange,
    size = "md",
    variant = "pill",
    busy = false,
    tone = "band",
}: {
    label: string;
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    size?: "sm" | "md";
    variant?: "pill" | "inline";
    busy?: boolean;
    /** Cor do ``inline``: sobre a faixa escura (texto branco) ou sobre um card
     * (texto na cor de tinta do tema). */
    tone?: "band" | "surface";
}) {
    const sm = size === "sm";
    const inline = variant === "inline";
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [open, setOpen] = useState(false);
    // lado da lista: o padrão (inline: a partir da esquerda do botão; pílula:
    // da direita) troca quando não cabe na tela — no celular os seletores
    // descem pra esquerda do card e a lista sairia pela borda
    const [lado, setLado] = useState<"left" | "right">(inline ? "left" : "right");
    // a lista abre num portal no <body>, com posição fixa medida do botão:
    // dentro da faixa do topo (altura fixa, overflow escondido) ou de um card
    // ela seria cortada ou ficaria por baixo dos cards seguintes
    const [caixa, setCaixa] = useState<Posicao | null>(null);
    // camada da lista: abaixo da faixa fixa do topo (z-30) — ao rolar, a
    // lista passa por baixo dela como o resto da página —, exceto quando o
    // seletor está na própria faixa (o de campus), aí fica por cima
    const [naFaixa, setNaFaixa] = useState(false);
    const [active, setActive] = useState(0);

    const selectedIndex = Math.max(
        options.findIndex((o) => o.value === value),
        0
    );
    const selected = options[selectedIndex];
    const optionId = (index: number) => `${listId}-${index}`;

    function openList() {
        const botao = rootRef.current?.getBoundingClientRect();
        if (botao) {
            const fixo = !!rootRef.current?.closest(
                "[data-topo-fixo], [data-card-expandido]"
            );
            setNaFaixa(fixo);
            setCaixa(posicao(botao, fixo));
            const lista = Math.min(LISTA_MAX, window.innerWidth - 2 * MARGEM_TELA);
            const cabeDireita = window.innerWidth - botao.left - MARGEM_TELA >= lista;
            const cabeEsquerda = botao.right - MARGEM_TELA >= lista;
            const padrao = inline ? "left" : "right";
            setLado(
                padrao === "left"
                    ? cabeDireita || !cabeEsquerda
                        ? "left"
                        : "right"
                    : cabeEsquerda || !cabeDireita
                      ? "right"
                      : "left"
            );
        }
        setActive(selectedIndex);
        setOpen(true);
    }

    function close(focusButton: boolean) {
        setOpen(false);
        if (focusButton) buttonRef.current?.focus();
    }

    function choose(index: number) {
        const option = options[index];
        if (option && option.value !== value) onChange(option.value);
        close(true);
    }

    // aberto: foco vai pra lista (é ela que trata o teclado) e a opção ativa
    // fica visível; clique fora fecha sem escolher
    useEffect(() => {
        if (!open) return;
        // sem rolar nada: no celular o foco (e o scrollIntoView) rolava até a
        // faixa do topo — que tem overflow escondido —, empurrando o título e o
        // seletor pra cima
        listRef.current?.focus({ preventScroll: true });
        const onPointerDown = (event: PointerEvent) => {
            const alvo = event.target as Node;
            if (!rootRef.current?.contains(alvo) && !listRef.current?.contains(alvo))
                setOpen(false);
        };
        // rolar a página não mexe em nada (a lista já rola junto com o botão,
        // ou fica parada com ele na faixa do topo); só remede se a janela
        // mudar de tamanho
        const reposicionar = () => {
            const botao = rootRef.current?.getBoundingClientRect();
            if (botao)
                setCaixa(
                    posicao(
                        botao,
                        !!rootRef.current?.closest(
                            "[data-topo-fixo], [data-card-expandido]"
                        )
                    )
                );
        };
        document.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("resize", reposicionar);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("resize", reposicionar);
        };
    }, [open]);

    useEffect(() => {
        if (open)
            rolarDentro(listRef.current, document.getElementById(optionId(active)));
    });

    function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            openList();
        }
    }

    function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
        const last = options.length - 1;
        const moves: Record<string, () => void> = {
            ArrowDown: () => setActive((i) => Math.min(i + 1, last)),
            ArrowUp: () => setActive((i) => Math.max(i - 1, 0)),
            Home: () => setActive(0),
            End: () => setActive(last),
            Enter: () => choose(active),
            " ": () => choose(active),
            Escape: () => close(true),
        };
        if (event.key === "Tab") {
            setOpen(false);
            return;
        }
        const move = moves[event.key];
        if (move) {
            event.preventDefault();
            move();
        }
    }

    return (
        <div
            ref={rootRef}
            className={cn("relative min-w-0", inline && "inline-block align-baseline")}
        >
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={`${label}: ${selected?.label ?? ""}`}
                onClick={() => (open ? close(false) : openList())}
                onKeyDown={onButtonKeyDown}
                className={cn(
                    "focus-visible:ring-lime/60 outline-none focus-visible:ring-2",
                    inline
                        ? cn(
                              "group inline-flex items-center gap-1 rounded-sm font-semibold",
                              tone === "surface" ? "text-ink" : "text-white"
                          )
                        : cn(
                              "bg-pill text-pill-fg flex w-full items-center gap-2 font-medium",
                              sm
                                  ? "h-8 max-w-[150px] rounded-lg pr-2 pl-3 text-[12px]"
                                  : "h-9 max-w-[240px] rounded-xl pr-3 pl-4 text-[13px]"
                          )
                )}
            >
                {inline ? (
                    // no meio da frase: só o nome escolhido (largura do próprio nome)
                    <span>{selected?.label}</span>
                ) : (
                    // Todos os rótulos empilhados na mesma célula e só o escolhido
                    // visível: o botão fica com a largura do rótulo mais longo
                    // (como o <select> nativo) e não muda ao trocar de opção.
                    <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] text-left">
                        {options.map((option, index) => (
                            <span
                                key={option.value}
                                className={cn(
                                    "col-start-1 row-start-1 truncate",
                                    index !== selectedIndex && "invisible"
                                )}
                            >
                                {option.label}
                            </span>
                        ))}
                    </span>
                )}
                {busy ? (
                    <span
                        aria-hidden
                        className="border-t-lime h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current/25"
                    />
                ) : (
                    <ChevronDown
                        size={sm ? 14 : 15}
                        strokeWidth={2}
                        aria-hidden
                        className={cn(
                            "shrink-0 transition-transform",
                            open && "rotate-180"
                        )}
                    />
                )}
            </button>

            {open &&
                caixa &&
                createPortal(
                    <ul
                        ref={listRef}
                        id={listId}
                        role="listbox"
                        tabIndex={-1}
                        aria-label={label}
                        aria-activedescendant={optionId(active)}
                        onKeyDown={onListKeyDown}
                        className={cn(
                            // largura até 280px, mas nunca maior que a tela (16px
                            // de margem de cada lado)
                            "text-ink bg-popover max-h-72 w-max max-w-[min(280px,calc(100vw-32px))] overflow-y-auto rounded-xl p-1.5 text-left font-normal shadow-[0_16px_40px_rgb(0_0_0/0.18)] outline-none",
                            naFaixa ? "fixed z-[60]" : "absolute z-20"
                        )}
                        style={{
                            top: caixa.top,
                            minWidth: caixa.largura,
                            ...(lado === "left"
                                ? { left: caixa.esquerda }
                                : { right: caixa.direita }),
                        }}
                    >
                        {options.map((option, index) => {
                            const isSelected = index === selectedIndex;
                            return (
                                <li
                                    key={option.value}
                                    id={optionId(index)}
                                    role="option"
                                    aria-selected={isSelected}
                                    onPointerEnter={() => setActive(index)}
                                    onClick={() => choose(index)}
                                    className={cn(
                                        "flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-[13px]",
                                        index === active && "bg-page",
                                        isSelected && "font-semibold"
                                    )}
                                >
                                    <span className="truncate">{option.label}</span>
                                    <Check
                                        size={15}
                                        strokeWidth={2.5}
                                        aria-hidden
                                        className={cn(
                                            "text-olive-text shrink-0",
                                            !isSelected && "invisible"
                                        )}
                                    />
                                </li>
                            );
                        })}
                    </ul>,
                    document.body
                )}
        </div>
    );
}
