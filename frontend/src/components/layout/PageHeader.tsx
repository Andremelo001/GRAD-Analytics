import { useContext, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";

import { CampusSelect } from "@/components/layout/CampusSelect";
import {
    PageHeaderSlotContext,
    PresentationTabsSlotContext,
} from "@/context/page-header-slot";

/** Saudação/título das páginas, em branco sobre a faixa escura. É desenhado
 * no topo fixo do ``AppLayout`` (via portal), junto com o logo, a busca e as
 * abas; em lg+ as abas ficam à direita desta linha, então o texto reserva
 * esse espaço. Fora do layout (sem slot), aparece no próprio lugar.
 *
 * ``tabs`` (ex.: as sub-abas da Qualidade) vem logo abaixo do subtítulo, com
 * o seletor de campus à esquerda (na mesma linha, numa pílula separada),
 * ainda dentro da faixa, com menos espaço até os cards. É uma função do tom:
 * ``"band"`` na faixa escura e ``"surface"`` no lugar que o layout reserva
 * abaixo da barra do modo apresentação (a faixa some nesse modo). */
export function PageHeader({
    title,
    subtitle,
    tabs,
    filtros,
    filtrosSlot,
}: {
    title: string;
    subtitle?: ReactNode;
    tabs?: (tom: "band" | "surface") => ReactNode;
    /** Seletores da página ao lado do de campus (ex.: o curso, no Início). */
    filtros?: (tom: "band" | "surface") => ReactNode;
    /** No lugar de ``filtros``: um lugar vazio ali, pra cada sub-aba pôr o
     * seu seletor (ou nenhum: aí some). Ver ``FiltroTopo``. */
    filtrosSlot?: (tom: "band" | "surface") => Ref<HTMLDivElement>;
}) {
    const slot = useContext(PageHeaderSlotContext);
    const slotApresentacao = useContext(PresentationTabsSlotContext);
    const header = (
        <header className="min-w-0 shrink-0">
            {/* em lg o menu fica à direita do título: o texto reserva o lado */}
            <div className="lg:max-w-[calc(100%-520px)]">
                <h1 className="text-[21px] leading-tight font-semibold tracking-[-0.02em] text-white lg:text-[24px]">
                    {title}
                </h1>
                {subtitle && (
                    <div className="mt-1.5 text-[13px] leading-snug text-white/65">
                        {subtitle}
                    </div>
                )}
            </div>
            {tabs && (
                // sub-abas na altura em que os cards do Início começam (mesmo
                // espaço que o Início deixa abaixo da saudação); embaixo, a
                // margem negativa aproxima os cards delas
                <div className="mt-8 -mb-4 lg:mt-10 lg:-mb-5">
                    <ComAbas
                        tabs={tabs}
                        filtros={filtros}
                        filtrosSlot={filtrosSlot}
                        tom="band"
                    />
                </div>
            )}
        </header>
    );
    return (
        <>
            {slot ? createPortal(header, slot) : header}
            {tabs &&
                slotApresentacao &&
                createPortal(
                    <ComAbas
                        tabs={tabs}
                        filtros={filtros}
                        filtrosSlot={filtrosSlot}
                        tom="surface"
                    />,
                    slotApresentacao
                )}
        </>
    );
}

/** O seletor de campus e, à direita dele, as sub-abas; os filtros da página
 * (ex.: o curso, no Início) na outra ponta, rentes à borda direita dos cards.
 * No celular: campus e filtros lado a lado e as sub-abas embaixo. */
function ComAbas({
    tabs,
    filtros,
    filtrosSlot,
    tom,
}: {
    tabs: (tom: "band" | "surface") => ReactNode;
    filtros?: (tom: "band" | "surface") => ReactNode;
    filtrosSlot?: (tom: "band" | "surface") => Ref<HTMLDivElement>;
    tom: "band" | "surface";
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:flex-nowrap">
            <CampusSelect tom={tom} />
            <div className="w-full max-sm:order-2 sm:w-auto">{tabs(tom)}</div>
            {/* celular: ao lado do campus (estica); sm+: na ponta direita */}
            {(filtros || filtrosSlot) && (
                <div
                    ref={filtrosSlot?.(tom)}
                    // vazio (sub-aba sem seletor): some
                    className="min-w-0 flex-1 basis-32 empty:hidden max-sm:order-1 sm:ml-auto sm:flex-none"
                >
                    {filtros?.(tom)}
                </div>
            )}
        </div>
    );
}
