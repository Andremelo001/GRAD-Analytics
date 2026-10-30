import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { normalizeForSearch } from "@/lib/format";
import { rolarDentro } from "@/lib/rolar";
import { cn } from "@/lib/utils";

export interface OpcaoCurso {
    value: string;
    label: string;
    /** Segunda linha, menor e mais clara (nos cursos: código, grau e turno —
     * ``opcaoCurso``). */
    detalhe?: string;
    /** Termos que a busca também encontra, sem aparecer (ex.: o nome inteiro
     * da instituição quando o rótulo mostra só a sigla). */
    busca?: string;
}

/** Quantas opções a lista mostra de uma vez (com 1.800 cursos numa área, a
 * busca é que leva ao curso). */
const MAX_VISIVEIS = 60;

/** Largura máxima da lista na versão compacta e margem até a tela (px). */
const LISTA_PILULA = 280;
const MARGEM_TELA = 16;

/** Onde a lista abre: logo abaixo do seletor, como a do ``ChartSelect``. A
 * lista vai num portal no <body> (dentro da saudação ou de um card ela seria
 * cortada pelo ``overflow`` deles ou ficaria por baixo dos cards seguintes).
 * No topo fixo ou num card ampliado, em coordenadas da tela (``fixed`` — fica
 * parada com o seletor); no resto, da página (``absolute`` — rola junto). */
interface Posicao {
    top: number;
    esquerda: number;
    direita: number;
    largura: number;
}

function posicao(seletor: DOMRect, fixo: boolean): Posicao {
    const [dx, dy] = fixo ? [0, 0] : [window.scrollX, window.scrollY];
    return {
        top: seletor.bottom + dy + 6,
        esquerda: seletor.left + dx,
        direita: document.documentElement.clientWidth - seletor.right - dx,
        largura: seletor.width,
    };
}

/** Seletor com busca (combobox) pra listas longas — os cursos de uma área no
 * Brasil inteiro. Fechado, mostra o escolhido (com um ponto da cor da série);
 * aberto, um campo de busca que filtra por nome e detalhe, sem acento.
 * Teclado: ↑/↓, Enter, Esc.
 *
 * ``compacto``: o mesmo desenho no tamanho do seletor pequeno dos cards
 * (``ChartSelect`` sm, 150px × 32px), pra caber no cabeçalho sem mudar a
 * altura do card; a lista fica mais larga que ele e abre pro lado que couber
 * na tela.
 *
 * ``estreito``: no compacto, menor (e sem o ponto) no desktop estreito (cards
 * lado a lado), pra caber na linha de um título com seletor.
 *
 * ``largo``: no compacto, mais largo (320px), pra rótulos longos caberem
 * inteiros (ex.: os componentes do CPC).
 *
 * ``superficie``: com ``faixa``, a mesma pílula em claro (na cor dos cards),
 * pro modo apresentação — como a barra de sub-abas e o seletor de campus lá.
 *
 * ``faixa``: a versão em pílula da faixa escura, ao lado do seletor de campus
 * (Início) — mesma altura e desenho da barra de sub-abas. */
export function CursoBusca({
    label,
    cor,
    value,
    options,
    onChange,
    placeholder = "Buscar…",
    compacto = false,
    faixa = false,
    superficie = false,
    estreito = false,
    largo = false,
}: {
    label: string;
    cor: string;
    value: string | null;
    options: OpcaoCurso[];
    onChange: (value: string) => void;
    placeholder?: string;
    compacto?: boolean;
    faixa?: boolean;
    superficie?: boolean;
    estreito?: boolean;
    largo?: boolean;
}) {
    const id = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listaRef = useRef<HTMLUListElement>(null);
    const [open, setOpen] = useState(false);
    const [busca, setBusca] = useState("");
    const [ativo, setAtivo] = useState(0);
    // compacto: a lista é mais larga que o botão e abre presa à direita dele;
    // se não couber na tela, presa à esquerda
    const [lado, setLado] = useState<"left" | "right">("right");
    const [caixa, setCaixa] = useState<Posicao | null>(null);
    const [fixo, setFixo] = useState(false);

    function medir() {
        const seletor = rootRef.current?.getBoundingClientRect();
        if (!seletor) return;
        const emFixo = !!rootRef.current?.closest(
            "[data-topo-fixo], [data-card-expandido]"
        );
        setFixo(emFixo);
        setCaixa(posicao(seletor, emFixo));
        if (compacto) {
            const largura = Math.min(LISTA_PILULA, window.innerWidth - 2 * MARGEM_TELA);
            setLado(seletor.right - MARGEM_TELA >= largura ? "right" : "left");
        }
    }

    function abrir() {
        setAtivo(0);
        medir();
        setOpen(true);
    }

    const selecionado = options.find((o) => o.value === value);
    const correspondentes = useMemo(() => {
        const termo = normalizeForSearch(busca);
        return termo
            ? options.filter((o) =>
                  normalizeForSearch(
                      `${o.label} ${o.detalhe ?? ""} ${o.busca ?? ""}`
                  ).includes(termo)
              )
            : options;
    }, [options, busca]);
    const filtradas = correspondentes.slice(0, MAX_VISIVEIS);
    const total = correspondentes.length;

    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus({ preventScroll: true });
        const fora = (e: PointerEvent) => {
            const alvo = e.target as Node;
            if (!rootRef.current?.contains(alvo) && !listaRef.current?.contains(alvo))
                setOpen(false);
        };
        // rolar a página não mexe em nada (a lista rola junto, ou fica parada
        // com o seletor no topo fixo); só remede se a janela mudar de tamanho
        document.addEventListener("pointerdown", fora);
        window.addEventListener("resize", medir);
        return () => {
            document.removeEventListener("pointerdown", fora);
            window.removeEventListener("resize", medir);
        };
        // medir lê só refs e props estáveis durante a abertura
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (open)
            rolarDentro(listaRef.current, document.getElementById(`${id}-${ativo}`));
    });

    function escolher(i: number) {
        const o = filtradas[i];
        if (o) onChange(o.value);
        setOpen(false);
        setBusca("");
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((i) => Math.min(i + 1, filtradas.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            escolher(ativo);
        } else if (e.key === "Escape") {
            // o Esc foi pra lista: não sai do modo apresentação junto
            e.preventDefault();
            setOpen(false);
            setBusca("");
        }
    }

    return (
        <div ref={rootRef} className="relative min-w-0">
            {open ? (
                <div
                    className={cn(
                        "ring-lime/60 flex items-center gap-2 ring-2",
                        faixa
                            ? cn(
                                  "h-[33px] w-full rounded-full px-4 sm:h-9 sm:w-[240px]",
                                  superficie ? "bg-surface" : "bg-white/[0.07]"
                              )
                            : compacto
                              ? cn(
                                    "bg-page h-8 w-[150px] max-w-full rounded-lg px-2.5",
                                    estreito && "lg:max-xl:w-[108px]",
                                    largo && "w-[320px]"
                                )
                              : "bg-page h-10 rounded-xl px-3"
                    )}
                >
                    <Search
                        size={compacto ? 13 : 15}
                        className="text-text-muted shrink-0"
                        aria-hidden
                    />
                    <input
                        ref={inputRef}
                        role="combobox"
                        aria-expanded
                        aria-controls={`${id}-lista`}
                        aria-activedescendant={
                            filtradas.length ? `${id}-${ativo}` : undefined
                        }
                        aria-label={label}
                        value={busca}
                        placeholder={placeholder}
                        onChange={(e) => {
                            setBusca(e.target.value);
                            setAtivo(0);
                        }}
                        onKeyDown={onKeyDown}
                        // 16px no celular: com letra menor, o navegador (Safari
                        // no iPhone) aproxima a tela ao focar o campo
                        className={cn(
                            "min-w-0 flex-1 bg-transparent text-[16px] outline-none",
                            faixa && !superficie
                                ? "text-white placeholder:text-white/45 sm:text-[13px]"
                                : "placeholder:text-text-muted",
                            faixa && superficie && "text-ink sm:text-[13px]",
                            !faixa && (compacto ? "sm:text-[12px]" : "sm:text-[13px]")
                        )}
                    />
                </div>
            ) : (
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-label={`${label}: ${selecionado?.label ?? "nenhum"}`}
                    onClick={abrir}
                    className={cn(
                        "focus-visible:ring-lime/60 flex min-w-0 items-center text-left outline-none focus-visible:ring-2",
                        faixa
                            ? cn(
                                  "h-[33px] w-full gap-2 rounded-full px-4 ring-1 sm:h-9 sm:w-[240px]",
                                  superficie
                                      ? "bg-surface text-ink ring-card-ring hover:bg-page shadow-[0_4px_24px_rgb(0_0_0/0.05)]"
                                      : "bg-white/[0.07] text-white ring-white/10 hover:bg-white/[0.12]"
                              )
                            : compacto
                              ? cn(
                                    "bg-page hover:bg-page/70 h-8 w-[150px] max-w-full gap-1.5 rounded-lg pr-2 pl-2.5",
                                    estreito &&
                                        "lg:max-xl:w-[108px] lg:max-xl:gap-1 lg:max-xl:pl-2",
                                    largo && "w-[320px]"
                                )
                              : "bg-page hover:bg-page/70 h-10 w-full gap-2.5 rounded-xl px-3"
                    )}
                >
                    <span
                        aria-hidden
                        className={cn(
                            "shrink-0 rounded-full",
                            compacto ? "h-2 w-2" : "h-2.5 w-2.5",
                            // estreito: sem o ponto, sobra espaço pro nome
                            estreito && "lg:max-xl:hidden"
                        )}
                        style={{ background: cor }}
                    />
                    <span className="min-w-0 flex-1">
                        <span
                            className={cn(
                                "block truncate",
                                faixa
                                    ? "text-[12px] font-semibold sm:text-[13px]"
                                    : compacto
                                      ? "text-[12px] font-medium"
                                      : "text-[13px] font-semibold",
                                estreito && "lg:max-xl:text-[11.5px]"
                            )}
                        >
                            {selecionado?.label ?? placeholder}
                        </span>
                    </span>
                    <ChevronDown
                        size={compacto || faixa ? 14 : 15}
                        className={cn(
                            "shrink-0",
                            faixa && !superficie ? "text-white/60" : "text-text-muted"
                        )}
                        aria-hidden
                    />
                </button>
            )}

            {open &&
                caixa &&
                createPortal(
                    <ul
                        ref={listaRef}
                        id={`${id}-lista`}
                        role="listbox"
                        aria-label={label}
                        className={cn(
                            "bg-popover text-ink max-h-80 overflow-y-auto rounded-xl p-1.5 text-left shadow-[0_16px_40px_rgb(0_0_0/0.18)]",
                            // camada: abaixo do topo fixo (z-30) ao rolar, como o
                            // resto da página; no topo fixo ou num card ampliado,
                            // por cima dele
                            fixo ? "fixed z-[60]" : "absolute z-20",
                            faixa
                                ? "w-[min(320px,calc(100vw-32px))]"
                                : compacto
                                  ? "w-[min(280px,calc(100vw-32px))]"
                                  : undefined
                        )}
                        style={{
                            top: caixa.top,
                            // faixa: presa à direita do seletor; compacto: do lado
                            // que couber; normal: na largura do seletor
                            ...(faixa || (compacto && lado === "right")
                                ? { right: caixa.direita }
                                : { left: caixa.esquerda }),
                            ...(!faixa && !compacto ? { width: caixa.largura } : {}),
                        }}
                        // a lista fica no <body>, mas o clique ainda sobe pela
                        // árvore do React: não deixa um card ao redor ampliar
                        onClick={(e) => e.stopPropagation()}
                    >
                        {filtradas.length === 0 && (
                            <li className="text-text-secondary px-3 py-2 text-[13px]">
                                Nenhum curso encontrado
                            </li>
                        )}
                        {filtradas.map((o, i) => (
                            <li
                                key={o.value}
                                id={`${id}-${i}`}
                                role="option"
                                aria-selected={o.value === value}
                                onPointerEnter={() => setAtivo(i)}
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => escolher(i)}
                                className={cn(
                                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2",
                                    i === ativo && "bg-page"
                                )}
                            >
                                <span className="min-w-0">
                                    <span
                                        className={cn(
                                            "block truncate text-[13px]",
                                            o.value === value && "font-semibold"
                                        )}
                                    >
                                        {o.label}
                                    </span>
                                    {o.detalhe && (
                                        <span className="text-text-muted block truncate text-[11px]">
                                            {o.detalhe}
                                        </span>
                                    )}
                                </span>
                                <Check
                                    size={15}
                                    strokeWidth={2.5}
                                    aria-hidden
                                    className={cn(
                                        "text-olive-text shrink-0",
                                        o.value !== value && "invisible"
                                    )}
                                />
                            </li>
                        ))}
                        {total > filtradas.length && (
                            <li className="text-text-muted px-3 py-2 text-[11px]">
                                Mostrando {filtradas.length} de {total}: digite para
                                refinar
                            </li>
                        )}
                    </ul>,
                    document.body
                )}
        </div>
    );
}
