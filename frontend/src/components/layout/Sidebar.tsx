import { useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useActiveIndicator } from "@/hooks/useActiveIndicator";
import { ABAS_COM_SUBABAS, ultimaSubaba } from "@/lib/ultima-subaba";
import { cn } from "@/lib/utils";

interface NavItem {
    to: string;
    label: string;
    end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { to: "/inicio", label: "Início" },
    { to: "/qualidade", label: "Qualidade" },
    { to: "/trajetoria", label: "Trajetória" },
];

/** Navegação principal em abas sobre a faixa escura: texto claro, a aba
 * ativa em branco com sublinhado limão sobre uma hairline contínua — o
 * sublinhado desliza até a aba escolhida. Abaixo de
 * lg (linha própria, largura toda) ficam centralizadas; em lg+ ficam à
 * direita da saudação. */
export function Sidebar() {
    const listRef = useRef<HTMLUListElement>(null);
    const { pathname } = useLocation();
    const navigate = useNavigate();
    // só a aba principal importa (/qualidade/mapa e /qualidade/curso são a
    // mesma aba): trocar de sub-aba não remede
    const indicador = useActiveIndicator(listRef, pathname.split("/")[1] ?? "");

    return (
        <nav
            aria-label="Navegação principal"
            className="-mx-1 [scrollbar-width:none] overflow-x-auto"
        >
            <ul
                ref={listRef}
                className="relative flex min-w-max justify-center border-b border-white/15 px-1 lg:justify-start"
            >
                <span
                    aria-hidden
                    className={cn(
                        "bg-lime absolute -bottom-px left-0 h-0.5",
                        indicador.animar &&
                            "transition-[transform,width] duration-300 ease-out motion-reduce:transition-none",
                        !indicador.visivel && "opacity-0"
                    )}
                    style={indicador.style}
                />
                {NAV_ITEMS.map(({ to, label, end }) => (
                    <li key={to}>
                        <NavLink
                            to={to}
                            end={end}
                            // abas com sub-abas (Qualidade, Trajetória) vão direto pra
                            // última sub-aba aberta: sem passar por /qualidade (que
                            // redireciona), as abas não desenham um quadro sem
                            // nenhuma ativa — nada pisca
                            onClick={
                                ABAS_COM_SUBABAS.includes(to.slice(1))
                                    ? (e) => {
                                          e.preventDefault();
                                          navigate(ultimaSubaba(to.slice(1)));
                                      }
                                    : undefined
                            }
                            className={({ isActive }) =>
                                cn(
                                    "relative block px-4 pb-[11px] text-[14px] whitespace-nowrap transition-colors duration-300 outline-none focus-visible:text-white sm:px-6 sm:text-[15px]",
                                    isActive
                                        ? "font-semibold text-white"
                                        : "text-white/50 hover:text-white/80"
                                )
                            }
                        >
                            {label}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
