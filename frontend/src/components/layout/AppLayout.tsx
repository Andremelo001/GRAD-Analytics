import { ArrowLeft, Settings, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import brasao from "@/assets/brasao.png";
import { PresentationBar } from "@/components/layout/PresentationBar";
import { PresentationToggle } from "@/components/layout/PresentationToggle";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { CourseSearch } from "@/components/search/CourseSearch";
import {
    PageHeaderSlotContext,
    PresentationTabsSlotContext,
} from "@/context/page-header-slot";
import { PresentationContext } from "@/context/presentation-context";
import { useNavegacaoPendente } from "@/hooks/useAbrirNoCampus";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import { cn } from "@/lib/utils";

// Mesma altura da faixa escura nos dois lugares em que ela é desenhada (atrás
// da página e dentro do topo fixo): assim as ondas se encaixam sem emenda.
const BAND_HEIGHT = "h-[325px] md:h-[291px] lg:h-[261px]";

// Faixa escura no topo que desce até cobrir o topo da primeira linha de cards;
// embaixo, o plano cinza. O topo fica preso ao rolar: em lg+ inteiro (logo +
// busca, saudação + abas — saudação e abas dividem a mesma linha); abaixo de
// lg só até as abas, e a saudação rola junto com a página (fixa, ela tomaria
// quase um terço da tela do celular). A saudação é o ``PageHeader`` da
// página, desenhado via portal (``PageHeaderSlotContext``) no slot certo: o
// de dentro do topo fixo (lg+) ou o de logo abaixo dele (telas menores).
//
// Configurações (a engrenagem ao lado do botão de apresentação) é uma tela à
// parte: o mesmo topo (faixa, logo e o título da página), mas sem a busca, as
// abas e os botões do topo; uma seta no canto superior esquerdo (onde fica o
// X do modo apresentação) volta pra página de onde se veio.
//
// Modo apresentação (botão ao lado do tema, Ctrl/⌘+K, Esc pra sair): a faixa
// e o topo sobem até sumir e os cards sobem junto — o topo recolhe a própria
// altura (margem negativa medida em tempo real) enquanto se desloca pra cima;
// um X no canto superior esquerdo sai do modo.
const TRANSICAO = "duration-500 ease-in-out motion-reduce:transition-none";

export function AppLayout() {
    const [stickySlot, setStickySlot] = useState<HTMLDivElement | null>(null);
    const [flowSlot, setFlowSlot] = useState<HTMLDivElement | null>(null);
    const [tabsSlot, setTabsSlot] = useState<HTMLDivElement | null>(null);
    const isLg = useMediaQuery("(min-width: 1024px)");
    const scrolled = useScrolled();
    const { pathname, search, state } = useLocation();
    const navigate = useNavigate();
    const configuracoes = pathname.startsWith("/configuracoes");
    // Configurações não tem cards pra apresentar: sem o botão nem o atalho
    const apresentavel = !configuracoes;
    // de onde se abriu a engrenagem (pra seta voltar pra lá); aberta direto
    // pelo link, volta pro início
    const voltarPara = (state as { de?: string } | null)?.de ?? "/";
    const { presenting, toggle, exit } = usePresentationMode(apresentavel);
    // cursos de outro campus (busca, "nos outros campi"): navega quando o
    // campus novo carrega
    useNavegacaoPendente();
    const topoRef = useRef<HTMLDivElement>(null);
    const topoAltura = useAltura(topoRef);
    // a faixa de trás é mais alta que o topo fixo: os dois sobem a altura
    // dela, no mesmo tempo, pra andarem juntos como um bloco só
    const faixaRef = useRef<HTMLDivElement>(null);
    const faixaAltura = useAltura(faixaRef);
    const aba = pathname.split("/")[1] ?? "";
    const subAba = pathname.split("/")[2] ?? "";

    // trocou de aba ou sub-aba com a página rolada: volta ao topo (a página
    // nova entra do começo, com o fade de ``.entrada``)
    useEffect(() => {
        if (window.scrollY > 0) window.scrollTo({ top: 0 });
    }, [aba, subAba]);

    return (
        <div className="relative min-h-dvh">
            <div
                ref={faixaRef}
                aria-hidden
                className={cn(
                    "bg-band absolute inset-x-0 top-0 overflow-hidden transition-[transform,opacity]",
                    TRANSICAO,
                    BAND_HEIGHT,
                    presenting && "opacity-0"
                )}
                // mesmo ``transform`` do topo fixo (a classe -translate-y-* do
                // Tailwind v4 usa a propriedade ``translate``, que a transição
                // não animava — a faixa saltava e se descolava do topo)
                style={
                    presenting
                        ? { transform: `translateY(-${faixaAltura}px)` }
                        : undefined
                }
            >
                <Waves />
            </div>

            <div
                ref={topoRef}
                data-topo-fixo
                inert={presenting}
                className={cn(
                    "sticky top-0 z-30 transition-[transform,margin,box-shadow,opacity,background-color,backdrop-filter]",
                    TRANSICAO,
                    // parado no topo: sólido; rolando (cards passando por baixo):
                    // vidro — fundo escuro translúcido com desfoque
                    scrolled && !presenting
                        ? "bg-band/80 shadow-[0_10px_30px_rgb(0_0_0/0.18)] backdrop-blur-xl backdrop-saturate-150"
                        : "bg-band",
                    // esmaece ao subir: o sublinhado da aba ativa passa 1px da
                    // borda e deixaria um fio no topo da tela
                    presenting && "opacity-0"
                )}
                style={
                    presenting
                        ? {
                              transform: `translateY(-${faixaAltura}px)`,
                              marginBottom: -topoAltura,
                          }
                        : undefined
                }
            >
                {/* ondas recortadas numa camada própria: o bloco não pode ter
                    overflow-hidden, senão corta a lista de resultados da busca */}
                <div aria-hidden className="absolute inset-0 overflow-hidden">
                    <div className={cn("absolute inset-x-0 top-0", BAND_HEIGHT)}>
                        <Waves />
                    </div>
                </div>

                <div
                    className={cn(
                        "relative mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 lg:pb-10",
                        // Configurações: o logo abre espaço pra seta de voltar
                        // (20px + 32px) quando a margem da página é estreita
                        configuracoes &&
                            "pl-[max(1rem,calc(64px_-_max(0px,(100vw_-_1200px)/2)))] sm:pl-[max(1.5rem,calc(64px_-_max(0px,(100vw_-_1200px)/2)))] lg:pl-[max(2rem,calc(64px_-_max(0px,(100vw_-_1200px)/2)))]"
                    )}
                >
                    <header className="flex h-16 items-center justify-between gap-3 sm:gap-4">
                        {/* Brasão (brasao.png, recortado do logo antigo, sem fundo) +
                            divisor + "Analytics" em texto branco, imitando o logo:
                            o texto do PNG é escuro e sumiria na faixa. */}
                        <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-3.5">
                            <img
                                src={brasao}
                                alt=""
                                width={172}
                                height={207}
                                className="h-9 w-auto sm:h-11 lg:h-12"
                            />
                            <span aria-hidden className="h-5 w-px bg-white/70 sm:h-6" />
                            <span className="text-[15px] leading-none font-bold tracking-[-0.01em] text-white sm:text-[17px] lg:text-[18px]">
                                <span className="sr-only">UFC — PROGRAD </span>
                                Analytics
                            </span>
                            {/* na tela de Configurações, nenhum botão do topo */}
                            {!configuracoes && (
                                <span className="flex items-center gap-2 sm:ml-2">
                                    <ThemeToggle />
                                    {/* no celular não aparece: o cabeçalho já está no
                                        limite de largura, e lá não há atalho de teclado */}
                                    <span className="hidden sm:flex">
                                        <PresentationToggle onClick={toggle} />
                                    </span>
                                    {/* só o ícone, sem a bolinha dos botões ao lado */}
                                    <Link
                                        to="/configuracoes"
                                        state={{ de: pathname + search }}
                                        aria-label="Configurações"
                                        title="Configurações"
                                        className="focus-visible:ring-lime/60 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/75 transition-colors outline-none hover:text-white focus-visible:ring-2"
                                    >
                                        <Settings
                                            size={19}
                                            strokeWidth={2}
                                            aria-hidden
                                        />
                                    </Link>
                                </span>
                            )}
                        </div>
                        {!configuracoes && <CourseSearch />}
                    </header>

                    <div className="relative text-white">
                        {!configuracoes && (
                            <div className="lg:absolute lg:top-6 lg:right-0">
                                <Sidebar />
                            </div>
                        )}
                        <div ref={setStickySlot} />
                    </div>
                </div>
            </div>

            {/* saudação fora do topo fixo, abaixo de lg (rola com a página);
                no modo apresentação recolhe (grid 1fr -> 0fr) */}
            <div
                inert={presenting}
                className={cn(
                    "grid transition-[grid-template-rows,opacity] lg:hidden",
                    TRANSICAO,
                    presenting ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
                )}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-5 pb-8 text-white sm:px-6">
                        <div ref={setFlowSlot} />
                    </div>
                </div>
            </div>

            <div
                className={cn(
                    "relative mx-auto w-full max-w-[1200px] px-4 pb-10 text-white transition-[padding] sm:px-6 lg:px-8",
                    TRANSICAO,
                    // apresentação: cards na altura do X (topo 20px) no desktop, com
                    // folga lateral mínima pro X (20px + 34px) quando a margem da
                    // página é estreita; no celular/tablet, logo abaixo do X
                    presenting &&
                        "pt-[62px] lg:px-[max(2rem,calc(62px_-_max(0px,(100vw_-_1200px)/2)))] lg:pt-5"
                )}
            >
                <main className="min-w-0">
                    {/* modo apresentação: frase + seletor de campus + logo num
                        card baixo, já que a saudação sobe junto com o topo */}
                    <PresentationBar presenting={presenting} />
                    {/* sub-abas da página (se houver) no modo apresentação: a
                        faixa escura, onde elas ficam normalmente, sobe junto
                        com o topo. Abre e fecha com a mesma animação da barra */}
                    <div
                        inert={!presenting}
                        aria-hidden={!presenting}
                        className={cn(
                            "grid transition-[grid-template-rows,opacity]",
                            TRANSICAO,
                            presenting
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0"
                        )}
                    >
                        <div className="min-h-0 overflow-hidden">
                            <div
                                ref={setTabsSlot}
                                // desce e sobe junto com a barra
                                className="pb-5 transition-transform duration-500 ease-in-out empty:hidden motion-reduce:transition-none lg:pb-6"
                                style={{
                                    transform: presenting
                                        ? "translateY(0)"
                                        : "translateY(-100%)",
                                }}
                            />
                        </div>
                    </div>
                    <PresentationContext.Provider value={presenting}>
                        <PresentationTabsSlotContext.Provider value={tabsSlot}>
                            <PageHeaderSlotContext.Provider
                                value={isLg ? stickySlot : flowSlot}
                            >
                                {/* reanima só ao trocar de aba principal; as sub-abas
                            têm a própria animação (QualidadePage) */}
                                <div key={aba} className="entrada">
                                    <Outlet />
                                </div>
                            </PageHeaderSlotContext.Provider>
                        </PresentationTabsSlotContext.Provider>
                    </PresentationContext.Provider>
                </main>
            </div>

            {configuracoes && (
                <button
                    type="button"
                    onClick={() => navigate(voltarPara)}
                    aria-label="Voltar"
                    title="Voltar"
                    // no lugar e no estilo do X do modo apresentação
                    className="bg-page text-text-secondary hover:text-ink ring-card-ring focus-visible:ring-lime/60 fixed top-5 left-5 z-40 flex h-8 w-8 items-center justify-center rounded-full shadow-[0_4px_16px_rgb(0_0_0/0.12)] ring-1 transition-colors outline-none focus-visible:ring-2"
                >
                    <ArrowLeft size={16} strokeWidth={2.25} aria-hidden />
                </button>
            )}

            <button
                type="button"
                onClick={exit}
                tabIndex={presenting ? 0 : -1}
                aria-hidden={!presenting}
                aria-label="Sair do modo apresentação"
                title="Sair do modo apresentação (Esc ou Ctrl+K)"
                className={cn(
                    // o mesmo X dos cards ampliados (cinza, ícone em tinta
                    // apagada); sobre o plano cinza, um contorno e uma sombra
                    // leves o destacam
                    "bg-page text-text-secondary hover:text-ink ring-card-ring focus-visible:ring-lime/60 fixed top-5 left-5 z-40 flex h-8 w-8 items-center justify-center rounded-full shadow-[0_4px_16px_rgb(0_0_0/0.12)] ring-1 transition-[opacity,transform,color] outline-none focus-visible:ring-2",
                    TRANSICAO,
                    presenting
                        ? "scale-100 opacity-100"
                        : "pointer-events-none scale-75 opacity-0"
                )}
            >
                <X size={16} strokeWidth={2.25} aria-hidden />
            </button>
        </div>
    );
}

/** Altura atual de um elemento (acompanha mudanças de tamanho). */
function useAltura(ref: RefObject<HTMLElement | null>): number {
    const [altura, setAltura] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) =>
            setAltura(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight)
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);
    return altura;
}

/** ``true`` depois que a página rolou — liga a sombra do topo fixo, que só
 * faz sentido quando há conteúdo passando por baixo dele. */
function useScrolled(): boolean {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return scrolled;
}

/** Linhas finas onduladas da faixa escura (decorativas), em dois feixes:
 * um saindo da esquerda e outro da direita, como no design de referência. */
function Waves() {
    const lines = Array.from({ length: 18 }, (_, i) => i);
    return (
        <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1440 380"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
        >
            <g stroke="white" strokeOpacity={0.07} strokeWidth={1}>
                {lines.map((i) => (
                    <path
                        key={`l${i}`}
                        d={`M -40 ${40 + i * 9} C 160 ${-20 + i * 6}, 300 ${260 + i * 4}, 620 ${300 + i * 7}`}
                    />
                ))}
                {lines.map((i) => (
                    <path
                        key={`r${i}`}
                        d={`M 900 ${-30 + i * 5} C 1100 ${120 + i * 8}, 1260 ${-10 + i * 6}, 1480 ${60 + i * 9}`}
                    />
                ))}
            </g>
        </svg>
    );
}
