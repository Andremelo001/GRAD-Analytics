import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { StatTile } from "@/components/cards/StatTile";
import { BrasilMapaCard } from "@/components/charts/BrasilMapaCard";
import { CpcComparativoCard } from "@/components/charts/CpcComparativoCard";
import { EvasaoHeatmapCard } from "@/components/charts/EvasaoHeatmapCard";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import {
    ConcluintesCard,
    IngressantesCard,
    SERIE_CAMPUS,
} from "@/components/charts/SerieAnualCard";
import { CampusAtual } from "@/components/layout/CampusSelect";
import { DataState } from "@/components/layout/DataState";
import {
    InicioCpcEsqueleto,
    InicioEvasaoEsqueleto,
    InicioIngressantesEsqueleto,
} from "@/components/layout/Esqueleto";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAlturaDisponivel } from "@/hooks/useAlturaDisponivel";
import { useChartTheme } from "@/hooks/useChartTheme";
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
import { lembrarSubaba, ultimaSubaba } from "@/lib/ultima-subaba";
import type { DashboardData } from "@/types/dashboard";

const SUB_ABAS = [
    { to: "ingresso", label: "Ingresso e conclusão" },
    { to: "cpc", label: "Qualidade" },
    { to: "evasao", label: "Trajetória" },
];

/** O curso escolhido no seletor do cabeçalho do Início (``null`` = o campus
 * inteiro): o mesmo pros cards de Ingresso e conclusão e de CPC. */
const CursoInicioContext = createContext<{
    curso: number | null;
    setCurso: (curso: number | null) => void;
}>({ curso: null, setCurso: () => {} });

/** O primeiro curso com CPC: o padrão da sub-aba CPC, que precisa de um
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

/** Aba Início: o panorama do campus em três sub-abas com rota própria, como
 * a Qualidade e a Trajetória (``/inicio/ingresso``, ``/inicio/cpc``,
 * ``/inicio/evasao``). A saudação e as sub-abas ficam fixas; cada sub-aba
 * carrega com o próprio esqueleto. */
export function HomePage() {
    const { pathname, search } = useLocation();
    const subAba = pathname.split("/")[2] ?? "";
    const { data } = useDashboardData();
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

    // lembra onde está, pra reabrir aqui ao voltar de outra aba
    useEffect(() => {
        if (subAba) lembrarSubaba("inicio", pathname + search);
    }, [subAba, pathname, search]);

    return (
        <>
            <PageHeader
                title="Olá, bem-vindo ao GRAD Analytics!"
                subtitle={
                    <>
                        Acompanhe os indicadores da graduação do UFC Campus{" "}
                        <CampusAtual />
                    </>
                }
                tabs={(tom) => (
                    <SubTabs label="Seções do início" items={SUB_ABAS} tom={tom} />
                )}
                // o curso, na ponta direita (o mesmo nas três sub-abas)
                filtros={(tom) =>
                    data ? (
                        <SeletorCurso
                            data={data}
                            subAba={subAba}
                            curso={curso}
                            onChange={contexto.setCurso}
                            tom={tom}
                        />
                    ) : null
                }
            />
            <CursoInicioContext.Provider value={contexto}>
                <div key={subAba} className="entrada">
                    <Outlet />
                </div>
            </CursoInicioContext.Provider>
        </>
    );
}

/** O seletor de curso do cabeçalho (com busca): em Ingresso e conclusão e
 * em Evasão, "Campus" (o total) ou um curso; em CPC, só cursos (o padrão é
 * o primeiro com CPC). */
function SeletorCurso({
    data,
    subAba,
    curso,
    onChange,
    tom,
}: {
    data: DashboardData;
    subAba: string;
    curso: number | null;
    onChange: (curso: number | null) => void;
    tom: "band" | "surface";
}) {
    const CHART = useChartTheme();
    const cpc = subAba === "cpc";
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
        <CursoBusca
            // pílula nos dois tons: escura na faixa, clara no modo
            // apresentação (como a barra de sub-abas ao lado)
            faixa
            superficie={tom === "surface"}
            cor={CHART.comparacao.a}
            label="Curso"
            placeholder="Buscar curso…"
            value={valor}
            options={
                cpc
                    ? cursos
                    : [
                          {
                              value: SERIE_CAMPUS,
                              label: "Campus",
                              detalhe: "Todos os cursos somados",
                          },
                          ...cursos,
                      ]
            }
            onChange={(v) => onChange(v === SERIE_CAMPUS ? null : Number(v))}
        />
    );
}

/** ``/`` ou ``/inicio`` sozinho (o link do menu): reabre a última sub-aba. */
export function VoltarSubabaInicio() {
    return <Navigate to={ultimaSubaba("inicio")} replace />;
}

/** A coluna de dois stat tiles (um embaixo do outro; lado a lado no tablet).
 * No desktop cada tile tem pelo menos a altura que tinha ao lado do card de
 * Ingressantes (176px): ao lado de um card mais baixo, ele estica o vizinho
 * em vez de encolher. */
const COLUNA_TILES =
    "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4 lg:auto-rows-[minmax(176px,auto)] lg:grid-cols-1 lg:gap-6";

/** A grade de uma sub-aba na altura da tela (no desktop), como o Mapa da
 * Qualidade: os cards esticam até o fim da tela e tudo fica à vista sem
 * rolar. Tela baixa demais: um mínimo, e aí rola. */
function GradeNaTela({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    // margem = o espaço do rodapé da página (pb-10 do AppLayout)
    const altura = useAlturaDisponivel(ref, { margem: 40, minimo: 420 });
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
export function InicioIngressoPage() {
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
        <GradeNaTela>
            <IngressantesCard className="lg:col-span-6" data={data} escolha={escolha} />
            <ConcluintesCard className="lg:col-span-6" data={data} escolha={escolha} />
        </GradeNaTela>
    );
}

/** Início → CPC: onde o curso existe no Brasil, ao lado do CPC do curso
 * contra a média nacional. */
export function InicioCpcPage() {
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

/** Início → Evasão: a evasão anual por curso e as taxas das turmas maduras. */
export function InicioEvasaoPage() {
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
