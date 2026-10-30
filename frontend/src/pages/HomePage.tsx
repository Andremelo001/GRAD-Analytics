import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";

import { StatTile } from "@/components/cards/StatTile";
import { BrasilMapaCard } from "@/components/charts/BrasilMapaCard";
import { CpcComparativoCard } from "@/components/charts/CpcComparativoCard";
import { EvasaoHeatmapCard } from "@/components/charts/EvasaoHeatmapCard";
import {
    ConcluintesCard,
    IngressantesCard,
    SERIE_CAMPUS,
} from "@/components/charts/SerieAnualCard";
import { CampusAtual } from "@/components/layout/CampusSelect";
import { DataState } from "@/components/layout/DataState";
import { SeletorCursoTopo } from "@/components/layout/FiltroTopo";
import {
    InicioCpcEsqueleto,
    InicioEvasaoEsqueleto,
    InicioIngressantesEsqueleto,
} from "@/components/layout/Esqueleto";
import { PageHeader } from "@/components/layout/PageHeader";
import { FontesSecaoContext } from "@/context/fontes-secao";
import { topoVisivel, useAlturaDisponivel } from "@/hooks/useAlturaDisponivel";
import { useDashboardData } from "@/hooks/useDashboardData";
import { opcaoCurso } from "@/lib/curso";
import { toTitleCase } from "@/lib/format";
import { SubTabs } from "@/components/layout/SubTabs";
import {
    buildTrajetorias,
    indicadoresMaduros,
    indicadoresMadurosCurso,
    serieMaduras,
} from "@/lib/trajetoria";
import type { FonteId } from "@/lib/fontes";
import type { DashboardData } from "@/types/dashboard";

/** As seções do Início, de cima pra baixo: a navbar interna rola até elas. */
const SECOES = [
    { to: "ingresso", label: "Ingresso e conclusão" },
    { to: "cpc", label: "Qualidade" },
    { to: "evasao", label: "Trajetória" },
];
const IDS = SECOES.map((s) => s.to);

/** Espaço entre o topo fixo e a seção à qual a navbar levou (px). */
const FOLGA_TOPO = 24;
/** Espaço embaixo de cada seção: o rodapé da página (pb-10 do AppLayout) e,
 * entre seções, o vão até a seguinte (``gap-10``) — a seguinte começa logo
 * abaixo do fim da tela. */
const MARGEM_SECAO = 40;

/** O curso escolhido no seletor do cabeçalho do Início (``null`` = o campus
 * inteiro): o mesmo pros cards de Ingresso e conclusão e de CPC. */
const CursoInicioContext = createContext<{
    curso: number | null;
    setCurso: (curso: number | null) => void;
}>({ curso: null, setCurso: () => {} });

/** O primeiro curso com CPC: o padrão da seção Qualidade, que precisa de um
 * curso (não tem a opção "Campus"). */
function cursoPadraoCpc(data: DashboardData): number | null {
    const comCpc = new Set(
        data.curso_perfil.evolucao_cpc
            .filter((p) => p.cpc_continuo !== null)
            .map((p) => p.codigo_curso)
    );
    return (
        data.cursos.find((c) => comCpc.has(c.codigo_curso))?.codigo_curso ??
        data.cursos[0]?.codigo_curso ??
        null
    );
}

/** A seção visível (a navbar interna a destaca) e ``ir``, que rola até uma.
 * Visível: a última cujo topo já passou de um terço da área sob o topo fixo
 * (ou a última de todas, no fim da página). Durante a rolagem de um clique,
 * fica na escolhida (senão a navbar passaria pelas do meio). */
function useSecaoAtiva() {
    const [ativa, setAtiva] = useState(IDS[0]);
    const indoPara = useRef<string | null>(null);
    const fimIda = useRef<number | undefined>(undefined);

    useEffect(() => {
        const medir = () => {
            if (indoPara.current) return;
            const topo = topoVisivel();
            const linha = topo + (window.innerHeight - topo) / 3;
            const fim =
                window.scrollY + window.innerHeight >=
                document.documentElement.scrollHeight - 2;
            let atual = IDS[0];
            for (const id of IDS) {
                const el = document.getElementById(`inicio-${id}`);
                if (el && el.getBoundingClientRect().top <= linha) atual = id;
            }
            setAtiva(fim && window.scrollY > 0 ? IDS[IDS.length - 1] : atual);
        };
        // a rolagem do clique terminou: volta a seguir a página
        const chegou = () => {
            window.clearTimeout(fimIda.current);
            indoPara.current = null;
            medir();
        };
        medir();
        window.addEventListener("scroll", medir, { passive: true });
        window.addEventListener("resize", medir);
        window.addEventListener("scrollend", chegou);
        return () => {
            window.clearTimeout(fimIda.current);
            window.removeEventListener("scroll", medir);
            window.removeEventListener("resize", medir);
            window.removeEventListener("scrollend", chegou);
        };
    }, []);

    const ir = useCallback((id: string) => {
        const el = document.getElementById(`inicio-${id}`);
        if (!el) return;
        setAtiva(id);
        indoPara.current = id;
        // a primeira, o começo da página; as outras, logo abaixo do topo fixo
        const top =
            id === IDS[0]
                ? 0
                : el.getBoundingClientRect().top +
                  window.scrollY -
                  topoVisivel() -
                  FOLGA_TOPO;
        const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top, behavior: suave ? "smooth" : "auto" });
        // sem o evento ``scrollend`` (Safari antigo) ou sem rolagem nenhuma
        window.clearTimeout(fimIda.current);
        fimIda.current = window.setTimeout(() => {
            indoPara.current = null;
        }, 1200);
    }, []);

    return { ativa, ir };
}

/** Aba Início: o panorama do campus numa página só, em três seções
 * (Ingresso e conclusão, Qualidade e Trajetória), uma embaixo da outra. A
 * navbar interna rola até cada seção e acompanha a rolagem (destaca a seção
 * visível). A saudação e a navbar ficam fixas; cada seção carrega com o
 * próprio esqueleto. */
export function HomePage() {
    const { data } = useDashboardData();
    const { ativa, ir } = useSecaoAtiva();
    // o curso vale pro campus em que foi escolhido: trocou de campus, volta
    // pro campus inteiro (os códigos de curso são outros)
    const [escolha, setEscolha] = useState<{
        municipio: number | null;
        curso: number | null;
    }>({ municipio: null, curso: null });
    const municipio = data?.escopo.codigo_municipio ?? null;
    const curso = escolha.municipio === municipio ? escolha.curso : null;
    const contexto = useMemo(
        () => ({
            curso,
            setCurso: (c: number | null) => setEscolha({ municipio, curso: c }),
        }),
        [curso, municipio]
    );

    return (
        <>
            <PageHeader
                title="Olá, bem-vindo ao GRAD Analytics!"
                subtitle={
                    <>
                        Acompanhe os indicadores da graduação da UFC em <CampusAtual />
                    </>
                }
                tabs={(tom) => (
                    <SubTabs
                        label="Seções do início"
                        items={SECOES}
                        tom={tom}
                        ativo={ativa}
                        onSelect={ir}
                    />
                )}
                // o curso, na ponta direita (o mesmo nas três seções)
                filtros={(tom) =>
                    data ? (
                        <SeletorCurso
                            data={data}
                            secao={ativa}
                            curso={curso}
                            onChange={contexto.setCurso}
                            tom={tom}
                        />
                    ) : null
                }
            />
            <CursoInicioContext.Provider value={contexto}>
                <div className="flex flex-col gap-5 lg:gap-10">
                    <Secao
                        id="ingresso"
                        label="Ingresso e conclusão"
                        fontes={["trajetoria"]}
                    >
                        <InicioIngresso />
                    </Secao>
                    <Secao id="cpc" label="Qualidade" fontes={["qualidade"]}>
                        <InicioCpc />
                    </Secao>
                    <Secao id="evasao" label="Trajetória" fontes={["trajetoria"]}>
                        <InicioEvasao />
                    </Secao>
                </div>
            </CursoInicioContext.Provider>
        </>
    );
}

/** Uma seção do Início: a âncora da navbar interna e a fonte dos cards. */
function Secao({
    id,
    label,
    fontes,
    children,
}: {
    id: string;
    label: string;
    fontes: FonteId[];
    children: ReactNode;
}) {
    return (
        <section id={`inicio-${id}`} aria-label={label}>
            <FontesSecaoContext.Provider value={fontes}>
                {children}
            </FontesSecaoContext.Provider>
        </section>
    );
}

/** O seletor de curso do cabeçalho (com busca): com a seção Ingresso e
 * conclusão ou a Trajetória à vista, "Campus" (o total) ou um curso; com a
 * Qualidade, só cursos (o padrão é o primeiro com CPC). */
function SeletorCurso({
    data,
    secao,
    curso,
    onChange,
    tom,
}: {
    data: DashboardData;
    secao: string;
    curso: number | null;
    onChange: (curso: number | null) => void;
    tom: "band" | "surface";
}) {
    const cpc = secao === "cpc";
    const cursos = data.cursos
        .map((c) =>
            opcaoCurso({
                codigo: c.codigo_curso,
                nome: toTitleCase(c.nome_curso),
                grau: c.grau_academico,
            })
        )
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    const valor = cpc
        ? String(curso ?? cursoPadraoCpc(data) ?? "")
        : curso === null
          ? SERIE_CAMPUS
          : String(curso);
    return (
        <SeletorCursoTopo
            tom={tom}
            value={valor}
            options={
                cpc
                    ? cursos
                    : [
                          {
                              value: SERIE_CAMPUS,
                              label: "Todos os cursos",
                              detalhe: "Todos os cursos da cidade somados",
                          },
                          ...cursos,
                      ]
            }
            onChange={(v) => onChange(v === SERIE_CAMPUS ? null : Number(v))}
        />
    );
}

/** A coluna de dois stat tiles (um embaixo do outro; lado a lado no tablet).
 * No desktop cada tile tem pelo menos a altura que tinha ao lado do card de
 * Ingressantes (176px): ao lado de um card mais baixo, ele estica o vizinho
 * em vez de encolher. */
const COLUNA_TILES =
    "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4 lg:auto-rows-[minmax(176px,auto)] lg:grid-cols-1 lg:gap-6";

/** A grade de uma seção na altura da tela (no desktop), como o Mapa da
 * Qualidade: os cards esticam até o fim da tela e a seção fica inteira à
 * vista sem rolar — a primeira desde onde está; as outras, sob o topo fixo
 * (onde a navbar interna as deixa). Tela baixa demais: um mínimo. */
function GradeNaTela({
    primeira = false,
    children,
}: {
    primeira?: boolean;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const altura = useAlturaDisponivel(ref, {
        margem: MARGEM_SECAO,
        minimo: 420,
        sobOTopo: primeira ? undefined : FOLGA_TOPO,
    });
    return (
        <div
            ref={ref}
            className="grid grid-cols-1 gap-5 lg:h-[var(--tela-h)] lg:grid-cols-12 lg:gap-6"
            style={
                altura > 0
                    ? ({ "--tela-h": `${altura}px` } as CSSProperties)
                    : undefined
            }
        >
            {children}
        </div>
    );
}

/** Início → Ingresso e conclusão: quantos entram e quantos se formam por
 * ano, contra a média nacional dos mesmos cursos. */
function InicioIngresso() {
    return (
        <DataState
            esqueleto={<InicioIngressantesEsqueleto />}
            render={(data) => (
                <Ingresso key={data.escopo.codigo_municipio} data={data} />
            )}
        />
    );
}

function Ingresso({ data }: { data: DashboardData }) {
    const { curso } = useContext(CursoInicioContext);
    const escolha = curso === null ? SERIE_CAMPUS : String(curso);
    return (
        <GradeNaTela primeira>
            <IngressantesCard className="lg:col-span-6" data={data} escolha={escolha} />
            <ConcluintesCard className="lg:col-span-6" data={data} escolha={escolha} />
        </GradeNaTela>
    );
}

/** Início → Qualidade: onde o curso existe no Brasil, ao lado do CPC do
 * curso contra a média nacional. */
function InicioCpc() {
    return (
        <DataState
            esqueleto={<InicioCpcEsqueleto />}
            render={(data) => <Cpc key={data.escopo.codigo_municipio} data={data} />}
        />
    );
}

function Cpc({ data }: { data: DashboardData }) {
    const { curso } = useContext(CursoInicioContext);
    const codigo = curso ?? cursoPadraoCpc(data);
    return (
        <GradeNaTela>
            <BrasilMapaCard
                className="lg:col-span-4"
                distribuicao={data.medias_nacionais.distribuicao_uf}
                cursos={data.cursos}
                codigo={codigo}
            />
            <CpcComparativoCard
                className="lg:col-span-8"
                evolucao={data.curso_perfil.evolucao_cpc}
                nacional={data.medias_nacionais.evolucao_cpc}
                cursos={data.cursos}
                codigo={codigo}
            />
        </GradeNaTela>
    );
}

/** Início → Trajetória: a evasão anual por curso e as taxas das turmas
 * maduras. */
function InicioEvasao() {
    return (
        <DataState
            esqueleto={<InicioEvasaoEsqueleto />}
            render={(data) => <Evasao key={data.escopo.codigo_municipio} data={data} />}
        />
    );
}

function Evasao({ data }: { data: DashboardData }) {
    const { curso } = useContext(CursoInicioContext);
    // conclusão e evasão das turmas maduras (as que já tiveram o prazo e mais
    // dois anos): a comparação justa — a turma mais recente ainda não teve
    // tempo de se formar. Campus: a mais recente de cada curso (mesma conta
    // do Panorama da Trajetória); curso escolhido: a média das turmas
    // maduras dele
    const trajetorias = useMemo(() => buildTrajetorias(data), [data]);
    const doCurso = trajetorias.find((t) => t.codigo === curso);
    const maduros = useMemo(
        () =>
            doCurso
                ? indicadoresMadurosCurso(data, doCurso)
                : indicadoresMaduros(data, trajetorias),
        [data, trajetorias, doCurso]
    );
    const serieDe = doCurso ? [doCurso] : trajetorias;
    const turmas = maduros?.anos ?? [];
    const periodo =
        turmas.length > 1
            ? `ingressos de ${turmas[0]} a ${turmas.at(-1)}`
            : `ingresso em ${turmas[0]}`;
    const infoTurma = !maduros
        ? doCurso
            ? "Este curso ainda não tem turma madura (todas em andamento)."
            : "Ainda não há turma madura (todas em andamento)."
        : doCurso
          ? `Média das turmas maduras do curso (${periodo}), pesada pelos ingressantes, dois anos depois do prazo, contra o mesmo curso no Brasil no mesmo ponto. A linha mostra a taxa de cada turma.`
          : `Turma madura mais recente de cada curso (${periodo}), dois anos depois do prazo do curso, contra os mesmos cursos no Brasil no mesmo ponto. A linha mostra a mesma taxa nas turmas maduras anteriores.`;

    return (
        <GradeNaTela>
            <EvasaoHeatmapCard
                className="lg:col-span-8"
                preencher
                selecionado={curso}
                cursos={data.cursos}
                local={data.trajetoria_comparada.heatmap_evasao_anual}
                nacional={data.medias_nacionais.heatmap_evasao_anual}
            />
            <div className={COLUNA_TILES}>
                <StatTile
                    label="Taxa de conclusão"
                    info={infoTurma}
                    value={maduros?.concluiu ?? null}
                    nationalValue={maduros?.concluiuBrasil ?? null}
                    higherIsBetter
                    serie={serieMaduras(serieDe, "concluiu")}
                    serieLabel="Conclusão por turma de ingresso"
                />
                <StatTile
                    label="Taxa de evasão"
                    info={infoTurma}
                    value={maduros?.desistiu ?? null}
                    nationalValue={maduros?.desistiuBrasil ?? null}
                    higherIsBetter={false}
                    serie={serieMaduras(serieDe, "desistiu")}
                    serieLabel="Evasão por turma de ingresso"
                />
            </div>
        </GradeNaTela>
    );
}
