import { Search } from "lucide-react";
import {
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { useDashboardData } from "@/hooks/useDashboardData";
import { useResumoCampi } from "@/hooks/useResumoCampi";
import { nomeCampus } from "@/lib/comparacao";
import { detalheCurso } from "@/lib/curso";
import {
    formatDecimal,
    formatPercent,
    normalizeForSearch,
    toTitleCase,
} from "@/lib/format";
import { anosFinal, pontosResumo } from "@/lib/trajetoria";
import { lembrarSubaba } from "@/lib/ultima-subaba";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 8;

type Aba = "qualidade" | "trajetoria";

/** Um curso de qualquer campus, pronto pra busca. */
interface Resultado {
    codigo: number;
    nome: string;
    grau: string | null;
    slug: string;
    campus: string;
    /** CPC da avaliação mais recente (``null`` = sem CPC). */
    cpc: number | null;
    /** Tem dados de trajetória (turmas acompanhadas)? */
    temTrajetoria: boolean;
    /** TCA da turma madura, dois anos depois do prazo (``null`` = sem turma
     * madura). */
    tca: number | null;
}

/** Pílula de busca da faixa escura: procura cursos de todos os campi (pelo
 * nome, código, grau ou campus). Cada resultado mostra o campus e, no curso
 * em destaque (mouse ou setas), duas opções: abrir em Qualidade (com o CPC)
 * ou em Trajetória (com a TCA). A escolhida abre na sub-aba Por curso — se o
 * curso é de outro campus, o painel troca pra ele antes — e a outra aba
 * também já fica nesse curso, pra quando o usuário for até ela. */
export function CourseSearch() {
    const navigate = useNavigate();
    const listId = useId();
    const { campus, setCampus, switching, data } = useDashboardData();
    const { resumo } = useResumoCampi();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [aba, setAba] = useState<Aba>("qualidade");
    // destino escolhido num curso de outro campus: só navega quando os dados
    // desse campus chegam (senão a página abriria com o campus anterior e
    // trocaria de curso)
    const pendente = useRef<{ slug: string; rota: string } | null>(null);

    const todos = useMemo<Resultado[]>(
        () =>
            (resumo?.campi ?? []).flatMap((cp) =>
                cp.cursos.map((c) => {
                    const t = c.trajetoria;
                    const final = t
                        ? pontosResumo(t).find(
                              (p) => p.anos === anosFinal(t.prazo_integralizacao)
                          )
                        : undefined;
                    return {
                        codigo: c.codigo_curso,
                        nome: toTitleCase(c.nome_curso),
                        grau: c.grau_academico ?? t?.grau_academico ?? null,
                        slug: cp.slug,
                        campus: nomeCampus(cp.nome),
                        cpc: c.cpc_continuo,
                        temTrajetoria: !!t || c.ano_ingresso_referencia !== null,
                        tca: final?.concluiu ?? null,
                    };
                })
            ),
        [resumo]
    );

    const results = useMemo(() => {
        const needle = normalizeForSearch(query);
        if (!needle) return [];
        return (
            todos
                .filter((r) =>
                    normalizeForSearch(`${r.nome} ${detalhe(r)}`).includes(needle)
                )
                // os do campus aberto primeiro; depois por nome e campus
                .sort(
                    (a, b) =>
                        Number(b.slug === campus) - Number(a.slug === campus) ||
                        a.nome.localeCompare(b.nome, "pt-BR") ||
                        a.campus.localeCompare(b.campus, "pt-BR")
                )
                .slice(0, MAX_RESULTS)
        );
    }, [todos, query, campus]);

    useEffect(() => {
        const destino = pendente.current;
        if (!destino || campus !== destino.slug || switching || !data) return;
        pendente.current = null;
        // depois dos efeitos da página: se a sub-aba Por curso já estava
        // aberta, ela troca sozinha pra um curso do campus novo (o da URL
        // antiga não existe nele) — a navegação da busca vem por último e vale
        const t = window.setTimeout(() => navigate(destino.rota), 0);
        return () => window.clearTimeout(t);
    }, [campus, switching, data, navigate]);

    const showList = open && query.trim().length > 0;

    function go(r: Resultado | undefined, destino: Aba) {
        if (!r) return;
        if (destino === "trajetoria" && !r.temTrajetoria) return;
        setQuery("");
        setOpen(false);
        const rotas: Record<Aba, string> = {
            qualidade: `/qualidade/curso/${r.codigo}`,
            trajetoria: `/trajetoria/curso/${r.codigo}`,
        };
        // a outra aba também abre nesse curso quando o usuário for até ela
        lembrarSubaba("qualidade", rotas.qualidade);
        if (r.temTrajetoria) lembrarSubaba("trajetoria", rotas.trajetoria);
        if (r.slug === campus) navigate(rotas[destino]);
        else {
            pendente.current = { slug: r.slug, rota: rotas[destino] };
            setCampus(r.slug);
        }
    }

    function onSubmit(event: FormEvent) {
        event.preventDefault();
        go(results[active] ?? results[0], aba);
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (!showList || results.length === 0) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % results.length);
            setAba("qualidade");
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index - 1 + results.length) % results.length);
            setAba("qualidade");
        } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            // ← → escolhem entre Qualidade e Trajetória no curso em destaque
            const r = results[active];
            if (!r?.temTrajetoria) return;
            event.preventDefault();
            setAba(event.key === "ArrowRight" ? "trajetoria" : "qualidade");
        } else if (event.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <form
            role="search"
            onSubmit={onSubmit}
            className="relative h-9 w-full max-w-[320px] min-w-0 lg:h-10"
        >
            <Search
                size={17}
                strokeWidth={2}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/50 sm:left-3.5 sm:h-4 sm:w-4"
            />
            <input
                type="search"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                    setAba("qualidade");
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
                placeholder="Pesquisar curso..."
                aria-label="Pesquisar curso em todos os campi"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                    showList && results.length > 0 ? `${listId}-${active}` : undefined
                }
                className="bg-band-soft focus-visible:ring-lime/40 h-full w-full rounded-full border border-white/10 pr-3 pl-9 text-[11.5px] text-white outline-none placeholder:text-white/45 focus-visible:ring-2 sm:pr-4 sm:pl-10 sm:text-[12.5px] [&::-webkit-search-cancel-button]:hidden"
            />

            {showList && (
                <ul
                    id={listId}
                    role="listbox"
                    className="text-ink bg-popover absolute top-[calc(100%+8px)] right-0 z-30 max-h-[min(480px,calc(100dvh-120px))] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-2xl p-1.5 shadow-[0_16px_40px_rgb(0_0_0/0.18)]"
                >
                    {results.length === 0 ? (
                        <li className="text-text-secondary px-3 py-2 text-[13px]">
                            {resumo
                                ? "Nenhum curso encontrado"
                                : "Carregando os cursos…"}
                        </li>
                    ) : (
                        results.map((r, index) => {
                            const ativo = index === active;
                            return (
                                <li
                                    key={`${r.slug}-${r.codigo}`}
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={ativo}
                                    // mousedown (não click): dispara antes do blur
                                    // do input. No nome, abre em Qualidade
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        go(r, "qualidade");
                                    }}
                                    onMouseEnter={() => {
                                        if (index !== active) setAba("qualidade");
                                        setActive(index);
                                    }}
                                    className={cn(
                                        "cursor-pointer rounded-xl px-3 py-2",
                                        ativo && "bg-page"
                                    )}
                                >
                                    {/* o mesmo formato dos seletores de curso:
                                        nome em cima; código, grau e campus embaixo */}
                                    <span className="block truncate text-[13px]">
                                        {r.nome}
                                    </span>
                                    <span className="text-text-muted block truncate text-[11px]">
                                        {detalhe(r)}
                                    </span>
                                    {/* no curso em destaque: pra onde ir */}
                                    {ativo && (
                                        <span className="mt-2 grid grid-cols-2 gap-1.5">
                                            <Opcao
                                                titulo="Qualidade"
                                                valor={
                                                    r.cpc === null
                                                        ? "sem CPC"
                                                        : `CPC ${formatDecimal(r.cpc)}`
                                                }
                                                escolhida={aba === "qualidade"}
                                                onHover={() => setAba("qualidade")}
                                                onEscolher={() => go(r, "qualidade")}
                                            />
                                            <Opcao
                                                titulo="Trajetória"
                                                valor={
                                                    !r.temTrajetoria
                                                        ? "sem dados"
                                                        : r.tca === null
                                                          ? "TCA em andamento"
                                                          : `TCA ${formatPercent(r.tca, 0)}`
                                                }
                                                escolhida={aba === "trajetoria"}
                                                desativada={!r.temTrajetoria}
                                                onHover={() => setAba("trajetoria")}
                                                onEscolher={() => go(r, "trajetoria")}
                                            />
                                        </span>
                                    )}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </form>
    );
}

/** "cód: 12344 · Bacharelado · Fortaleza". */
function detalhe(r: Resultado): string {
    return `${detalheCurso({ codigo: r.codigo, grau: r.grau })} · ${r.campus}`;
}

/** Uma das duas opções do curso em destaque (Qualidade / Trajetória). */
function Opcao({
    titulo,
    valor,
    escolhida,
    desativada = false,
    onHover,
    onEscolher,
}: {
    titulo: string;
    valor: string;
    escolhida: boolean;
    desativada?: boolean;
    onHover: () => void;
    onEscolher: () => void;
}) {
    return (
        <span
            role="button"
            aria-disabled={desativada}
            title={desativada ? "Curso sem dados de trajetória" : `Abrir em ${titulo}`}
            onMouseEnter={desativada ? undefined : onHover}
            onMouseDown={(event) => {
                // não deixa o clique cair na linha (que abriria em Qualidade)
                event.preventDefault();
                event.stopPropagation();
                if (!desativada) onEscolher();
            }}
            className={cn(
                "flex flex-col rounded-lg px-2.5 py-1.5 ring-1 transition-colors",
                desativada
                    ? "ring-card-ring text-text-muted cursor-not-allowed opacity-60"
                    : escolhida
                      ? "bg-surface ring-lime text-ink shadow-[0_2px_8px_rgb(0_0_0/0.06)]"
                      : "ring-card-ring text-text-secondary hover:text-ink"
            )}
        >
            <span className="text-[12px] font-semibold">{titulo}</span>
            <span className="text-[11px] tabular-nums">{valor}</span>
        </span>
    );
}
