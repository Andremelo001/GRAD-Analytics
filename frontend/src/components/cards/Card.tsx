import { X } from "lucide-react";
import {
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type MouseEvent,
    type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";

import { PresentationContext } from "@/context/presentation-context";
import { cn } from "@/lib/utils";

/** Clique nesses elementos é do próprio controle (botão, seletor, link…):
 * não amplia o card. ``data-sem-expandir`` marca outros (ex.: o fundo do
 * mapa, que tira a seleção do estado). */
const INTERATIVOS =
    "button, a, input, select, textarea, label, summary, [role=button], [role=radio], [role=option], [role=listbox], [role=switch], [role=tab], [role=checkbox], [data-sem-expandir]";

/** O clique foi no card (pra ampliar) ou num controle dentro dele? Controles
 * conhecidos e qualquer coisa com cursor de mão (células e linhas clicáveis
 * dos gráficos) ficam de fora, e também quem está selecionando texto. */
function cliqueNoCard(evento: MouseEvent<HTMLElement>): boolean {
    const alvo = evento.target as Element | null;
    if (!alvo || !(alvo instanceof Element)) return false;
    if (alvo.closest(INTERATIVOS)) return false;
    if ((window.getSelection()?.toString() ?? "").length > 0) return false;
    for (
        let el: Element | null = alvo;
        el && el !== evento.currentTarget;
        el = el.parentElement
    ) {
        if (getComputedStyle(el).cursor === "pointer") return false;
    }
    return true;
}

// ampliado: no centro da tela, por cima de tudo (as classes do card que
// mexem em tamanho e posição — col-span, h-full… — perdem pra estas). A
// altura é a do conteúdo (sem sobra em branco), até caber na tela; os cards
// com gráfico que estica (``expansivel="tela"``) ganham uma altura fixa
// grande, e o gráfico cresce até ela
const AMPLIADO =
    "fixed! top-1/2! left-1/2! z-50! m-0! -translate-x-1/2! -translate-y-1/2! w-[min(1120px,calc(100vw-32px))]! max-w-none! h-auto! min-h-0! max-h-[calc(100dvh-32px)]! overflow-y-auto! shadow-[0_24px_80px_rgb(0_0_0/0.3)]!";
const AMPLIADO_TELA = "h-[min(720px,calc(100dvh-32px))]!";
// no modo apresentação: a largura toda (os outros cards somem atrás do fundo)
const AMPLIADO_APRESENTACAO =
    "w-[min(1440px,calc(100vw-48px))]! max-h-[calc(100dvh-48px)]!";
const AMPLIADO_APRESENTACAO_TELA = "h-[calc(100dvh-48px)]!";

/** Card branco dos painéis: cantos bem arredondados e sombra difusa, sem
 * borda. ``title``/``subtitle`` formam o cabeçalho (título forte, subtítulo
 * em tinta apagada) e ``action`` fica à direita dele (ex.: seletor de
 * curso). Sem ``title``, o card desenha só o conteúdo.
 *
 * ``expansivel``: clicar no card o amplia no centro da tela, com o fundo
 * desfocado (no modo apresentação, o card ocupa a tela e os outros somem);
 * com o mouse em cima, ele cresce um pouco e ganha sombra (o sinal de que
 * dá pra ampliar);
 * um X dentro dele, o Esc ou um clique fora fecham. É o mesmo card (não uma
 * cópia) que muda de lugar: o curso escolhido, o ano, o hover continuam; no
 * lugar dele fica um espaço do mesmo tamanho, pra página não se mexer.
 * Ampliado, o card tem a altura do conteúdo; com ``expansivel="tela"`` (cards
 * cujo gráfico estica pra preencher), uma altura grande fixa. */
/** A viagem do card entre o lugar dele e o centro (ms): devagar o bastante
 * pra se ver de onde ele sai e pra onde volta. */
const VIAGEM_MS = 420;
const VIAGEM_EASING = "cubic-bezier(0.22, 0.8, 0.24, 1)";

const semMovimento = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** ``transform`` que leva o retângulo ``para`` (onde o card está) ao ``de``
 * (de onde ele vem) — a técnica FLIP: o card já está no lugar final e anima
 * dessa posição até ``none``. */
function deslocamento(de: DOMRect, para: DOMRect): string {
    const dx = de.left + de.width / 2 - (para.left + para.width / 2);
    const dy = de.top + de.height / 2 - (para.top + para.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${de.width / para.width}, ${de.height / para.height})`;
}

/** O conteúdo some durante a viagem (só a "folha" do card se move — esticado
 * no meio do caminho, o conteúdo ficaria deformado) e reaparece no fim. */
function animarConteudo(el: HTMLElement, abrindo: boolean): Animation[] {
    const quadros = abrindo
        ? [
              { opacity: 0, offset: 0 },
              { opacity: 0, offset: 0.55 },
              { opacity: 1, offset: 1 },
          ]
        : [
              { opacity: 1, offset: 0 },
              { opacity: 0, offset: 0.3 },
              { opacity: 0, offset: 1 },
          ];
    return [...el.children].map((filho) =>
        filho.animate(quadros, {
            duration: VIAGEM_MS,
            easing: "linear",
            fill: abrindo ? "none" : "forwards",
        })
    );
}

/** Rola a página até o card ficar inteiro na área visível (abaixo do topo
 * fixo), centrado nela; se ele já está inteiro, não rola. Resolve quando a
 * rolagem termina. */
function mostrarInteiro(el: HTMLElement): Promise<void> {
    const MARGEM = 16;
    const r = el.getBoundingClientRect();
    const topoFixo = document.querySelector("[data-topo-fixo]");
    const cima = Math.max(topoFixo?.getBoundingClientRect().bottom ?? 0, 0) + MARGEM;
    const baixo = window.innerHeight - MARGEM;
    if (r.top >= cima && r.bottom <= baixo) return Promise.resolve();
    // cabe na área visível: centra; não cabe: alinha o topo do card
    const destino =
        r.height <= baixo - cima
            ? window.scrollY + r.top - (cima + (baixo - cima - r.height) / 2)
            : window.scrollY + r.top - cima;
    const alvo = Math.max(
        0,
        Math.min(destino, document.documentElement.scrollHeight - window.innerHeight)
    );
    if (Math.abs(alvo - window.scrollY) < 2) return Promise.resolve();
    return new Promise((resolve) => {
        let feito = false;
        const fim = () => {
            if (feito) return;
            feito = true;
            window.removeEventListener("scrollend", fim);
            window.clearTimeout(limite);
            resolve();
        };
        // ``scrollend`` onde existe; senão (Safari) um limite de tempo
        window.addEventListener("scrollend", fim);
        const limite = window.setTimeout(fim, 700);
        window.scrollTo({ top: alvo, behavior: semMovimento() ? "auto" : "smooth" });
        if (semMovimento()) fim();
    });
}

export function Card({
    title,
    subtitle,
    action,
    className,
    expansivel = false,
    children,
}: {
    title?: string;
    subtitle?: string;
    action?: ReactNode;
    className?: string;
    expansivel?: boolean | "tela";
    children: ReactNode;
}) {
    const ref = useRef<HTMLElement>(null);
    const fecharRef = useRef<HTMLButtonElement>(null);
    const lugarRef = useRef<HTMLDivElement>(null);
    const fundoRef = useRef<HTMLDivElement>(null);
    const fechandoRef = useRef(false);
    const abrindoRef = useRef(false);
    const [ampliado, setAmpliado] = useState<{ altura: number; de: DOMRect } | null>(
        null
    );
    const apresentando = useContext(PresentationContext);

    // abrindo: o card já está no centro; volta pro retângulo de onde saiu e
    // anima de lá até o centro, enquanto o fundo escurece
    useLayoutEffect(() => {
        const el = ref.current;
        if (!ampliado || !el || semMovimento()) return;
        const para = el.getBoundingClientRect();
        el.animate(
            [{ transform: deslocamento(ampliado.de, para) }, { transform: "none" }],
            {
                duration: VIAGEM_MS,
                easing: VIAGEM_EASING,
            }
        );
        animarConteudo(el, true);
        fundoRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: VIAGEM_MS,
            easing: "ease-out",
        });
    }, [ampliado]);

    /** Fecha com a viagem de volta: do centro até o lugar do card na grade
     * (o espaço reservado), com o fundo clareando; só então o card volta pro
     * fluxo da página. */
    function fechar() {
        const el = ref.current;
        const lugar = lugarRef.current;
        if (!ampliado || fechandoRef.current) return;
        if (!el || !lugar || semMovimento()) {
            setAmpliado(null);
            return;
        }
        fechandoRef.current = true;
        const atual = el.getBoundingClientRect();
        const viagem = el.animate(
            [
                { transform: "none" },
                { transform: deslocamento(lugar.getBoundingClientRect(), atual) },
            ],
            { duration: VIAGEM_MS, easing: VIAGEM_EASING, fill: "forwards" }
        );
        const fundo = fundoRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: VIAGEM_MS,
            easing: "ease-in",
            fill: "forwards",
        });
        const conteudo = animarConteudo(el, false);
        viagem.onfinish = () => {
            // o card volta pra grade na mesma hora em que a animação some
            // (sem um quadro dele parado no centro); o conteúdo reaparece
            // já no lugar, com um fade curto
            flushSync(() => setAmpliado(null));
            viagem.cancel();
            fundo?.cancel();
            for (const a of conteudo) a.cancel();
            for (const filho of el.children)
                filho.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: 160,
                    easing: "ease-out",
                });
            fechandoRef.current = false;
        };
    }

    useEffect(() => {
        if (!ampliado) return;
        fecharRef.current?.focus({ preventScroll: true });
        // a página atrás não rola enquanto o card está aberto
        const html = document.documentElement;
        const overflow = html.style.overflow;
        html.style.overflow = "hidden";
        // Esc fecha o card (e não sai do modo apresentação junto): escuta na
        // captura, antes do atalho do modo
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            // com a lista de um seletor aberta, o Esc fecha só a lista
            if (document.querySelector('[role="listbox"]')) return;
            e.stopImmediatePropagation();
            fecharRef.current?.click();
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            html.style.overflow = overflow;
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, [ampliado]);

    async function abrir(e: MouseEvent<HTMLElement>) {
        if (!expansivel || ampliado || abrindoRef.current || !ref.current) return;
        if (!cliqueNoCard(e)) return;
        abrindoRef.current = true;
        // card meio fora da tela: a página rola até ele (inteiro e no meio da
        // área visível) e só então ele abre — a viagem sai do lugar todo dele
        await mostrarInteiro(ref.current);
        abrindoRef.current = false;
        if (!ref.current) return;
        setAmpliado({
            altura: ref.current.offsetHeight,
            de: ref.current.getBoundingClientRect(),
        });
    }

    const botaoFechar = (
        <button
            ref={fecharRef}
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                fechar();
            }}
            aria-label="Fechar"
            title="Fechar (Esc)"
            className="bg-page text-text-secondary hover:text-ink focus-visible:ring-lime/60 flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2"
        >
            <X size={16} strokeWidth={2.25} aria-hidden />
        </button>
    );

    return (
        <>
            {ampliado && (
                <>
                    {/* o lugar do card na grade, enquanto ele está ampliado */}
                    <div
                        ref={lugarRef}
                        aria-hidden
                        className={cn(className, "invisible")}
                        style={{ height: ampliado.altura }}
                    />
                    {createPortal(
                        <div
                            ref={fundoRef}
                            aria-hidden
                            onClick={(e) => {
                                e.stopPropagation();
                                fechar();
                            }}
                            className={cn(
                                "fixed inset-0 z-[45]",
                                apresentando
                                    ? "bg-page"
                                    : "bg-black/35 backdrop-blur-[6px]"
                            )}
                        />,
                        document.body
                    )}
                </>
            )}
            <section
                ref={ref}
                onClick={abrir}
                data-card-expandido={ampliado ? "" : undefined}
                role={ampliado ? "dialog" : undefined}
                aria-modal={ampliado ? true : undefined}
                aria-label={ampliado ? title : undefined}
                className={cn(
                    "bg-surface text-ink ring-card-ring flex min-h-0 min-w-0 flex-col rounded-[18px] p-5 shadow-[0_4px_24px_rgb(0_0_0/0.05)] ring-1 lg:p-6",
                    // ``group/card``: o conteúdo se ajusta ampliado (ver ampliado.ts)
                    expansivel && "group/card",
                    // passar o mouse num card que amplia: ele cresce um tico e
                    // ganha sombra, saltando dos vizinhos (o cursor continua a
                    // seta). Cresce a partir do topo: a borda de cima fica
                    // parada e não esbarra no topo fixo da página
                    expansivel &&
                        !ampliado &&
                        "relative origin-top transition-[scale,box-shadow] duration-200 ease-out hover:z-[1] hover:scale-[1.012] hover:shadow-[0_14px_40px_rgb(0_0_0/0.12)] motion-reduce:transition-none motion-reduce:hover:scale-100",
                    className,
                    ampliado && AMPLIADO,
                    // sem ``title``: o 1º bloco (depois do X) abre espaço pro X
                    ampliado && !title && "[&>:nth-child(2)]:pr-11",
                    ampliado && expansivel === "tela" && AMPLIADO_TELA,
                    ampliado && apresentando && AMPLIADO_APRESENTACAO,
                    ampliado &&
                        apresentando &&
                        expansivel === "tela" &&
                        AMPLIADO_APRESENTACAO_TELA
                )}
            >
                {/* sem ``title`` (cabeçalho próprio, ex.: Presença no Brasil): o X
                    no canto, na altura da 1ª linha (o padding do card), e o
                    primeiro bloco do conteúdo abre espaço pra ele */}
                {ampliado && !title && (
                    <div className="absolute top-5 right-5 z-10 lg:top-6 lg:right-6">
                        {botaoFechar}
                    </div>
                )}
                {title && (
                    // ampliado: o X na mesma linha, centrado com a ação (seletor)
                    <div
                        className={cn(
                            ampliado && "flex items-start gap-3 sm:items-center"
                        )}
                    >
                        <div
                            className={cn(
                                "flex flex-wrap items-center justify-between gap-3",
                                ampliado && "min-w-0 flex-1"
                            )}
                        >
                            {/* flex-1 + basis-0: o título ocupa o que sobra
                                (subtítulo trunca) e a ação só desce de linha
                                quando nem os 12rem mínimos cabem — o tamanho do
                                texto não mexe no layout */}
                            <div className="min-w-48 flex-1 basis-0">
                                <h2 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                                    {title}
                                </h2>
                                {subtitle && (
                                    // uma linha só (texto inteiro no hover):
                                    // subtítulo que muda com a série escolhida
                                    // não pode mudar a altura
                                    <p
                                        className="text-text-muted mt-1 truncate text-[12px]"
                                        title={subtitle}
                                    >
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                            {action}
                        </div>
                        {ampliado && botaoFechar}
                    </div>
                )}
                {children}
            </section>
        </>
    );
}
