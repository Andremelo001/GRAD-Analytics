import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
    IlustracaoBoasVindas,
    IlustracaoBusca,
    IlustracaoComparacoes,
    IlustracaoDicas,
    IlustracaoInicio,
    IlustracaoQualidade,
    IlustracaoTrajetoria,
    IlustracaoUnidade,
} from "@/components/onboarding/ilustracoes";
import { marcarGuiaVisto } from "@/lib/guia";
import { cn } from "@/lib/utils";

interface Passo {
    titulo: string;
    ilustracao: () => ReactNode;
    texto: ReactNode;
    /** Itens curtos embaixo do texto (o que tem na aba, como usar). */
    itens?: ReactNode[];
}

const PASSOS: Passo[] = [
    {
        titulo: "Bem-vindo ao GRAD Analytics",
        ilustracao: IlustracaoBoasVindas,
        texto: (
            <>
                Os principais indicadores dos cursos de graduação da UFC reunidos em um
                só lugar, organizados em duas dimensões, <strong>qualidade</strong> e{" "}
                <strong>trajetória acadêmica</strong>, com base em dados públicos e
                oficiais do <strong>INEP</strong>.
            </>
        ),
        itens: [
            "Use as setas (ou ← → no teclado) pra passar pelos cards.",
            "Leva menos de um minuto.",
        ],
    },
    {
        titulo: "Escolha a unidade",
        ilustracao: IlustracaoUnidade,
        texto: (
            <>
                O painel mostra uma <strong>unidade acadêmica</strong> por vez: os
                centros, faculdades e institutos de Fortaleza e os campi do interior.
                Troque no seletor <strong>Unidade</strong>, no começo da linha das abas.
            </>
        ),
        itens: [
            "Clique no seletor e digite: ele encontra pelo nome, pela sigla ou pela cidade.",
            "Cada unidade aparece com o nome do SIGAA e a cidade embaixo.",
        ],
    },
    {
        titulo: "Início: o resumo da unidade",
        ilustracao: IlustracaoInicio,
        texto: (
            <>
                Uma página só, em três partes: <strong>Ingresso e conclusão</strong>,{" "}
                <strong>Qualidade</strong> e <strong>Trajetória</strong>. A barra de
                cima leva direto a cada uma.
            </>
        ),
        itens: [
            "No seletor da direita, troque “Todos os cursos” por um curso só.",
            "A linha roxa é sempre a média nacional dos cursos da mesma área.",
        ],
    },
    {
        titulo: "Qualidade dos cursos",
        ilustracao: IlustracaoQualidade,
        texto: (
            <>
                A nota que o MEC dá a cada curso, o <strong>CPC</strong> (faixas de 1 a
                5), de onde ela vem e como mudou ao longo das avaliações.
            </>
        ),
        itens: [
            <>
                <strong>Visão geral</strong>: todos os cursos lado a lado.
            </>,
            <>
                <strong>Por curso</strong>: as partes da nota e quanto falta pra próxima
                faixa.
            </>,
            <>
                <strong>Mapa</strong>: o mesmo curso pelo Brasil, estado por estado.
            </>,
            <>
                <strong>Comparações</strong>: duas unidades, ou dois cursos da mesma
                área.
            </>,
            <>
                <strong>Por que desde 2015</strong>: antes disso o INEP dava uma nota só
                pra todos os cursos da mesma área numa cidade, então não dá pra saber a
                de cada curso.
            </>,
        ],
    },
    {
        titulo: "Trajetória dos estudantes",
        ilustracao: IlustracaoTrajetoria,
        texto: (
            <>
                O caminho dos alunos desde a entrada: quantos continuam, se formam ou
                desistem, ano a ano. Tem as mesmas quatro partes da Qualidade.
            </>
        ),
        itens: [
            <>
                <strong>Turma madura</strong>: acompanhada até 2 anos depois do prazo do
                curso. Num curso de 4 anos, quem entrou em 2015 deveria se formar em
                2018; a turma é madura a partir de 2020.
            </>,
            <>
                <strong>Por que 2 anos</strong>: muita gente se forma com atraso. Antes
                disso ainda há muitos alunos cursando e a conclusão pareceria menor; por
                isso as taxas e as comparações usam só turmas maduras.
            </>,
        ],
    },
    {
        titulo: "Busca",
        ilustracao: IlustracaoBusca,
        texto: (
            <>
                Há dois jeitos de achar um curso. <strong>Dentro das abas</strong>, os
                seletores de curso (o da direita, na linha das abas, e os dos cards) têm
                busca: clique e digite parte do nome, do código ou do grau.{" "}
                <strong>No topo da página</strong>, o <strong>Pesquisar curso</strong>{" "}
                procura em todas as unidades.
            </>
        ),
        itens: [
            "Na busca do topo, escolha abrir o curso em Qualidade ou em Trajetória; se ele for de outra unidade, o painel troca sozinho.",
            "Nos seletores com busca, ↑ ↓ e Enter escolhem e Esc fecha. Acentos e maiúsculas não importam.",
        ],
    },
    {
        titulo: "Comparações",
        ilustracao: IlustracaoComparacoes,
        texto: (
            <>
                Qualidade e Trajetória têm a parte <strong>Comparações</strong>, com
                dois modos, escolhidos no botão do topo do card.
            </>
        ),
        itens: [
            <>
                <strong>Entre unidades</strong>: duas unidades da UFC lado a lado, com
                as médias dos indicadores dos cursos de cada uma e, na Qualidade, as
                áreas que as duas oferecem.
            </>,
            <>
                <strong>Entre cursos da mesma área</strong>: um curso da unidade (A)
                contra qualquer curso da mesma área no Brasil (B), que se acha pela
                instituição ou pela cidade.
            </>,
            "A comparação fica no endereço da página: dá pra copiar e mandar o link.",
        ],
    },
    {
        titulo: "Dicas pra aproveitar melhor",
        ilustracao: IlustracaoDicas,
        texto: (
            <>
                Todo card tem um <strong>i</strong> no canto: ele explica o que o card
                mostra e traz o link pra base do INEP de onde vieram os dados.
            </>
        ),
        itens: [
            "Clique num card pra vê-lo maior, no centro da tela (Esc fecha).",
            "Ctrl + K (⌘ + K no Mac) liga o modo apresentação, só com os gráficos.",
            "Na engrenagem: tema claro ou escuro, a unidade em que o painel abre e cores acessíveis.",
            "Pra rever este guia, clique no i ao lado da busca, no topo.",
        ],
    },
];

/** Guia de boas-vindas: um card no centro da tela, com o fundo desfocado (o
 * mesmo do card ampliado), que apresenta o painel em passos numerados — o que
 * é, a unidade, cada aba, a busca e as dicas —, cada um com uma ilustração
 * animada. Setas fora do card (dentro, embaixo, no celular), os números, as
 * setas do teclado; Esc, o X ou um clique fora fecham. Fechar marca o guia
 * como visto neste navegador (ver ``guiaJaVisto``). */
export function GuiaBoasVindas({ onClose }: { onClose: () => void }) {
    const tituloId = useId();
    const dialogoRef = useRef<HTMLDivElement>(null);
    const [passo, setPasso] = useState(0);
    // de que lado o card novo entra (da direita ao avançar)
    const [direcao, setDirecao] = useState<"direita" | "esquerda">("direita");
    const ultimo = passo === PASSOS.length - 1;
    const atual = PASSOS[passo];
    const Ilustracao = atual.ilustracao;

    function ir(destino: number) {
        if (destino < 0 || destino >= PASSOS.length || destino === passo) return;
        setDirecao(destino > passo ? "direita" : "esquerda");
        setPasso(destino);
    }

    function fechar() {
        marcarGuiaVisto();
        onClose();
    }

    // estado mais recente pros atalhos de teclado (o efeito monta uma vez só)
    const irRef = useRef(ir);
    const fecharRef = useRef(fechar);
    const passoRef = useRef(passo);
    useEffect(() => {
        irRef.current = ir;
        fecharRef.current = fechar;
        passoRef.current = passo;
    });

    useEffect(() => {
        // foco no guia (leitor de tela anuncia o título); ao fechar, volta pra
        // onde estava (o "i" do topo, se foi ele que abriu)
        const anterior = document.activeElement as HTMLElement | null;
        dialogoRef.current?.focus({ preventScroll: true });
        // a página atrás não rola com o guia aberto
        const overflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        const onKeyDown = (e: KeyboardEvent) => {
            // na captura, antes dos atalhos da página: Esc não sai do modo
            // apresentação, Ctrl+K não liga ele por trás do guia
            if (e.key === "Escape") fecharRef.current();
            else if (e.key === "ArrowRight") irRef.current(passoRef.current + 1);
            else if (e.key === "ArrowLeft") irRef.current(passoRef.current - 1);
            else if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            document.documentElement.style.overflow = overflow;
            anterior?.focus?.({ preventScroll: true });
        };
    }, []);

    const seta =
        "bg-surface text-ink ring-card-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[0_8px_24px_rgb(0_0_0/0.18)] ring-1 transition-[opacity,transform] outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-lime/70 disabled:pointer-events-none disabled:opacity-0";

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div
                aria-hidden
                onClick={fechar}
                className="guia-fundo absolute inset-0 bg-black/35 backdrop-blur-[6px]"
            />

            <div className="guia-abre relative flex items-center gap-4 lg:gap-6">
                {/* setas fora do card: do tablet pra cima (no celular, embaixo) */}
                <button
                    type="button"
                    aria-label="Card anterior"
                    onClick={() => ir(passo - 1)}
                    disabled={passo === 0}
                    className={cn(seta, "hidden md:flex")}
                >
                    <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
                </button>

                <div
                    ref={dialogoRef}
                    role="dialog"
                    aria-modal
                    aria-labelledby={tituloId}
                    tabIndex={-1}
                    className="bg-surface text-ink ring-card-ring relative flex max-h-[calc(100dvh-32px)] min-h-[min(670px,calc(100dvh-32px))] w-[min(580px,calc(100vw-32px))] flex-col overflow-x-hidden overflow-y-auto rounded-[28px] p-5 shadow-[0_24px_80px_rgb(0_0_0/0.3)] ring-1 outline-none sm:p-6 md:min-h-[min(590px,calc(100dvh-32px))]"
                >
                    <button
                        type="button"
                        aria-label="Fechar o guia"
                        onClick={fechar}
                        className="text-text-muted hover:text-ink focus-visible:ring-lime/60 absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full outline-none focus-visible:ring-2"
                    >
                        <X size={18} strokeWidth={2} aria-hidden />
                    </button>

                    {/* card atual: remonta a cada passo (as animações recomeçam).
                        Entra deslizando 28px de lado: o card corta o eixo x
                        (overflow-x-hidden), senão o overflow-y-auto dele vira
                        rolagem nos dois eixos e uma barra horizontal aparece no
                        pé do card durante a entrada.
                        O card tem altura mínima fixa e a navegação fica no pé:
                        trocar de passo não muda o tamanho nem mexe as setas */}
                    <div
                        key={passo}
                        className={
                            direcao === "direita"
                                ? "guia-entra-direita"
                                : "guia-entra-esquerda"
                        }
                    >
                        <div className="mb-4 flex items-center gap-2.5 pr-10">
                            <span className="bg-lime text-on-lime flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold">
                                {passo + 1}
                            </span>
                            <span className="text-text-muted text-[12px] font-medium">
                                de {PASSOS.length}
                            </span>
                        </div>

                        <Ilustracao />

                        <h2
                            id={tituloId}
                            className="mt-5 text-[20px] leading-tight font-bold tracking-[-0.01em] sm:text-[22px]"
                        >
                            {atual.titulo}
                        </h2>
                        <p className="text-text-secondary mt-2 text-[13.5px] leading-relaxed sm:text-[14px]">
                            {atual.texto}
                        </p>
                        {atual.itens && (
                            <ul className="mt-3 flex flex-col gap-1.5">
                                {atual.itens.map((item, i) => (
                                    <li
                                        key={i}
                                        className="text-text-secondary flex gap-2 text-[12.5px] leading-snug sm:text-[13px]"
                                    >
                                        <span
                                            aria-hidden
                                            className="bg-lime mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
                                        />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* celular: os números numa linha só, em cima; as setas e o
                        botão embaixo. Do sm pra cima, tudo numa linha */}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                        <button
                            type="button"
                            aria-label="Card anterior"
                            onClick={() => ir(passo - 1)}
                            disabled={passo === 0}
                            className={cn(seta, "h-9 w-9 shadow-none md:hidden")}
                        >
                            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
                        </button>

                        {/* os números: mostram onde se está e levam a qualquer card */}
                        <ol className="order-first flex w-full flex-wrap items-center justify-center gap-1.5 sm:order-none sm:w-auto sm:justify-start">
                            {PASSOS.map((p, i) => (
                                <li key={p.titulo}>
                                    <button
                                        type="button"
                                        aria-label={`Card ${i + 1}: ${p.titulo}`}
                                        aria-current={i === passo ? "step" : undefined}
                                        onClick={() => ir(i)}
                                        className={cn(
                                            "focus-visible:ring-lime/60 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11.5px] font-semibold transition-colors outline-none focus-visible:ring-2",
                                            i === passo
                                                ? "bg-lime text-on-lime"
                                                : "bg-page text-text-secondary hover:text-ink"
                                        )}
                                    >
                                        {i + 1}
                                    </button>
                                </li>
                            ))}
                        </ol>

                        <div className="flex items-center gap-2">
                            {!ultimo && (
                                <button
                                    type="button"
                                    onClick={fechar}
                                    className="text-text-muted hover:text-ink focus-visible:ring-lime/60 hidden rounded-full px-2 py-1.5 text-[12.5px] font-medium outline-none focus-visible:ring-2 sm:block"
                                >
                                    Pular
                                </button>
                            )}
                            {ultimo ? (
                                <button
                                    type="button"
                                    onClick={fechar}
                                    className="bg-ink text-surface focus-visible:ring-lime/70 rounded-full px-4 py-2 text-[13px] font-semibold outline-none hover:opacity-90 focus-visible:ring-2"
                                >
                                    Começar a explorar
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    aria-label="Próximo card"
                                    onClick={() => ir(passo + 1)}
                                    className={cn(
                                        seta,
                                        "h-9 w-9 shadow-none md:hidden"
                                    )}
                                >
                                    <ChevronRight
                                        size={18}
                                        strokeWidth={2.2}
                                        aria-hidden
                                    />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    aria-label="Próximo card"
                    onClick={() => ir(passo + 1)}
                    disabled={ultimo}
                    className={cn(seta, "hidden md:flex")}
                >
                    <ChevronRight size={22} strokeWidth={2.2} aria-hidden />
                </button>
            </div>
        </div>,
        document.body
    );
}
