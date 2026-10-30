import { useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useActiveIndicator } from "@/hooks/useActiveIndicator";
import { cn } from "@/lib/utils";

/** Sub-abas de uma aba (ex.: Qualidade → Visão do campus / Por curso / …),
 * em pílulas sobre a faixa escura, logo abaixo da saudação (``PageHeader``,
 * prop ``tabs``): a ativa em limão, as outras em branco apagado. A pílula
 * limão desliza até a sub-aba escolhida. Cada uma é uma rota, então dá pra
 * compartilhar o link de uma sub-aba. Com ``onSelect``, os itens são botões
 * (seções da mesma página, ex.: o Início): ``ativo`` diz qual destacar. No
 * celular, se não couberem, rolam na horizontal. */
export function SubTabs({
    label,
    items,
    tom = "band",
    ativo,
    onSelect,
}: {
    label: string;
    items: { to: string; label: string }[];
    /** ``band``: sobre a faixa escura; ``surface``: sobre o plano claro da
     * página (modo apresentação), em pílula branca como os cards. */
    tom?: "band" | "surface";
    /** A seção destacada (com ``onSelect``). */
    ativo?: string;
    /** Itens como botões, não rotas: chamado com o ``to`` do clicado. */
    onSelect?: (to: string) => void;
}) {
    const listRef = useRef<HTMLUListElement>(null);
    const { pathname } = useLocation();
    const indicador = useActiveIndicator(listRef, ativo ?? pathname);

    return (
        <nav
            aria-label={label}
            className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
            <ul
                ref={listRef}
                className={cn(
                    // celular: largura toda, alinhada às bordas dos cards de baixo
                    // (o que sobra se divide entre as pílulas); sm+: do conteúdo
                    "relative flex w-full gap-0.5 rounded-full p-1 ring-1 sm:w-max sm:gap-1",
                    tom === "band"
                        ? "bg-white/[0.07] ring-white/10"
                        : "bg-surface ring-card-ring shadow-[0_4px_24px_rgb(0_0_0/0.05)]"
                )}
            >
                <span
                    aria-hidden
                    className={cn(
                        "bg-lime absolute top-1 bottom-1 left-0 rounded-full",
                        indicador.animar &&
                            "transition-[transform,width] duration-300 ease-out motion-reduce:transition-none",
                        !indicador.visivel && "opacity-0"
                    )}
                    style={indicador.style}
                />
                {items.map(({ to, label }) => {
                    const classe = (isActive: boolean) =>
                        cn(
                            "focus-visible:ring-lime/60 block rounded-full px-[5px] py-1 text-center text-[10px] whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-2 min-[360px]:px-2 min-[360px]:text-[11px] min-[390px]:text-[11.5px] sm:px-4 sm:text-[13px]",
                            isActive
                                ? "text-on-lime font-semibold"
                                : tom === "band"
                                  ? "text-white/60 hover:text-white"
                                  : "text-text-secondary hover:text-ink"
                        );
                    return (
                        <li key={to} className="relative flex-auto sm:flex-none">
                            {onSelect ? (
                                <button
                                    type="button"
                                    // o mesmo atributo do NavLink ativo: é o
                                    // que o destaque deslizante procura
                                    aria-current={to === ativo ? "page" : undefined}
                                    onClick={() => onSelect(to)}
                                    className={cn("w-full", classe(to === ativo))}
                                >
                                    {label}
                                </button>
                            ) : (
                                <NavLink
                                    to={to}
                                    className={({ isActive }) => classe(isActive)}
                                >
                                    {label}
                                </NavLink>
                            )}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
