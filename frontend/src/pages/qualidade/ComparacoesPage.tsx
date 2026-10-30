import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { Card } from "@/components/cards/Card";
import {
    ComponentesEspelhoCard,
    CursosEmComumCard,
    LadoALadoCard,
    ParticipacaoComparadaCard,
} from "@/components/charts/qualidade/ComparacaoCards";
import {
    Ficha,
    SeletorCampus,
    Topo,
} from "@/components/charts/qualidade/ComparacaoTopo";
import { CursoBusca, type OpcaoCurso } from "@/components/charts/qualidade/CursoBusca";
import { FaixaPill } from "@/components/charts/qualidade/FaixaPill";
import { ModoToggle } from "@/components/charts/qualidade/ModoToggle";
import { DataState } from "@/components/layout/DataState";
import { CardEsqueleto, ComparacoesEsqueleto } from "@/components/layout/Esqueleto";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useQualidadeArea } from "@/hooks/useQualidadeArea";
import { useResumoCampi } from "@/hooks/useResumoCampi";
import { cursoDoPorCurso } from "@/lib/curso-por-curso";
import { detalheCurso } from "@/lib/curso";
import type { CursoArea } from "@/lib/area";
import {
    areasEmComum,
    nomeCampus,
    resumirCampus,
    type ResumoCampus,
} from "@/lib/comparacao";
import { formatDecimal, formatPercent, toTitleCase } from "@/lib/format";
import type { ResumoCampi, ResumoCurso } from "@/types/dashboard";

type Modo = "campi" | "cursos";

const MODOS: { value: Modo; label: string }[] = [
    { value: "campi", label: "Entre cidades" },
    { value: "cursos", label: "Entre cursos da mesma área" },
];

export function ComparacoesPage() {
    return (
        <DataState
            esqueleto={<ComparacoesEsqueleto />}
            render={() => <Comparacoes />}
        />
    );
}

/** Qualidade → Comparações: dois modos, "entre campi" (um campus da UFC
 * contra outro, nos indicadores agregados) e "entre cursos da mesma área" (um
 * curso da UFC contra qualquer curso da mesma área no Brasil). Modo e lados
 * ficam na URL (``?modo=…&a=…&b=…``). */
function Comparacoes() {
    const [params, setParams] = useSearchParams();
    const { resumo, erro } = useResumoCampi();
    const modo: Modo = params.get("modo") === "cursos" ? "cursos" : "campi";

    function atualizar(mudancas: Record<string, string | null>) {
        setParams(
            (atual) => {
                const prox = new URLSearchParams(atual);
                for (const [k, v] of Object.entries(mudancas)) {
                    if (v === null) prox.delete(k);
                    else prox.set(k, v);
                }
                return prox;
            },
            { replace: true }
        );
    }

    if (!resumo) {
        return erro ? (
            <p className="text-text-secondary text-[14px]">{erro}</p>
        ) : (
            <ComparacoesEsqueleto />
        );
    }

    const seletorModo = (
        <ModoToggle
            label="Tipo de comparação"
            value={modo}
            options={MODOS}
            onChange={(m) => atualizar({ modo: m, a: null, b: null })}
        />
    );

    return modo === "campi" ? (
        <ComparacaoCampi
            resumo={resumo}
            seletorModo={seletorModo}
            a={params.get("a")}
            b={params.get("b")}
            atualizar={atualizar}
        />
    ) : (
        <ComparacaoCursos
            resumo={resumo}
            seletorModo={seletorModo}
            a={params.get("a")}
            b={params.get("b")}
            atualizar={atualizar}
        />
    );
}

interface PropsModo {
    resumo: ResumoCampi;
    seletorModo: ReactNode;
    a: string | null;
    b: string | null;
    atualizar: (m: Record<string, string | null>) => void;
}

// --- entre campi -----------------------------------------------------------

function ComparacaoCampi({ resumo, seletorModo, a, b, atualizar }: PropsModo) {
    const { campus } = useDashboardData();
    const slugs = resumo.campi.map((c) => c.slug);
    const slugA = a && slugs.includes(a) ? a : (campus ?? slugs[0]);
    const slugB =
        b && slugs.includes(b) && b !== slugA
            ? b
            : (slugs.find((s) => s !== slugA) ?? slugA);
    const ra = useMemo(
        () => resumirCampus(resumo.campi.find((c) => c.slug === slugA)!),
        [resumo, slugA]
    );
    const rb = useMemo(
        () => resumirCampus(resumo.campi.find((c) => c.slug === slugB)!),
        [resumo, slugB]
    );
    const lados = { a: ra.nome, b: rb.nome };
    const fmt2 = (v: number) => formatDecimal(v);
    const comuns = areasEmComum(ra, rb);
    // edições do Enade por trás dos números (a mais recente de cada curso)
    const anos = [...ra.comCpc, ...rb.comCpc].map((c) => c.ano!).filter(Boolean);
    const edicoes =
        anos.length === 0
            ? null
            : Math.min(...anos) === Math.max(...anos)
              ? `Enade ${anos[0]}`
              : `Enade ${Math.min(...anos)}–${Math.max(...anos)}`;

    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <Topo
                seletorModo={seletorModo}
                seletorA={
                    <SeletorCampus
                        lado="a"
                        value={slugA}
                        campi={resumo.campi}
                        onChange={(v) =>
                            atualizar({ a: v, b: v === slugB ? slugA : slugB })
                        }
                    />
                }
                seletorB={
                    <SeletorCampus
                        lado="b"
                        value={slugB}
                        campi={resumo.campi.filter((c) => c.slug !== slugA)}
                        onChange={(v) => atualizar({ a: slugA, b: v })}
                    />
                }
                fichaA={fichaCampus(ra)}
                fichaB={fichaCampus(rb)}
            />
            {/* o conteúdo entra com a mesma animação das abas */}
            <div className="entrada grid grid-cols-1 items-start gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                <p className="text-text-muted -mt-1 text-[12px] lg:col-span-12">
                    {ra.nome} × {rb.nome}
                    {edicoes && ` · ${edicoes}`} · {comuns.length}{" "}
                    {comuns.length === 1 ? "área em comum" : "áreas em comum"}
                </p>
                {/* lado a lado com a mesma altura */}
                <div className="grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                    <LadoALadoCard
                        className="lg:col-span-5"
                        titulo="Indicadores da cidade"
                        info="As médias dos indicadores de qualidade dos cursos de cada cidade, na avaliação mais recente de cada curso. O ✓ marca a cidade à frente em cada linha."
                        subtitulo="Média dos cursos, na avaliação mais recente de cada um"
                        lados={lados}
                        linhas={[
                            {
                                label: "CPC médio",
                                a: ra.cpcMedio,
                                b: rb.cpcMedio,
                                formato: fmt2,
                            },
                            {
                                label: "Nas faixas 4 e 5",
                                a: ra.pctAltas,
                                b: rb.pctAltas,
                                formato: (v) => formatPercent(v, 0),
                            },
                            {
                                label: "Conceito Enade médio",
                                a: ra.enadeMedio,
                                b: rb.enadeMedio,
                                formato: fmt2,
                            },
                            {
                                label: "IDD médio",
                                a: ra.iddMedio,
                                b: rb.iddMedio,
                                formato: fmt2,
                            },
                            {
                                label: "Cursos com CPC",
                                a: ra.comCpc.length,
                                b: rb.comCpc.length,
                                formato: (v) => String(v),
                                neutro: true,
                            },
                        ]}
                        rodape="As áreas de cada cidade são diferentes: as médias resumem a posição dos cursos de cada cidade entre os pares da própria área."
                    />
                    <ComponentesEspelhoCard
                        className="lg:col-span-7"
                        titulo="Componentes do CPC"
                        subtitulo="Nota média dos cursos de cada cidade em cada componente"
                        info="A nota média dos cursos de cada cidade em cada componente do CPC (0 a 5), lado a lado."
                        lados={lados}
                        a={ra.notas}
                        b={rb.notas}
                    />
                </div>
                <CursosEmComumCard
                    className="lg:col-span-12"
                    lados={lados}
                    areas={comuns}
                />
            </div>
        </div>
    );
}

/** Ficha do campus, no formato da do curso (CPC com a faixa, e dois dados). */
function fichaCampus(r: ResumoCampus) {
    return (
        <Ficha
            itens={[
                ["CPC médio", r.cpcMedio === null ? "—" : formatDecimal(r.cpcMedio)],
                ["Cursos", r.cursos.length],
                ["com CPC", r.comCpc.length],
            ]}
        />
    );
}

// --- entre cursos da mesma área -------------------------------------------

interface CursoUfc {
    curso: ResumoCurso & { area_avaliacao: string; cpc_continuo: number };
    campus: string;
}

function ComparacaoCursos({ resumo, seletorModo, a, b, atualizar }: PropsModo) {
    const { campus } = useDashboardData();
    const ufc = useMemo<CursoUfc[]>(
        () =>
            resumo.campi.flatMap((c) =>
                c.cursos
                    .filter(
                        (k): k is CursoUfc["curso"] =>
                            k.area_avaliacao !== null && k.cpc_continuo !== null
                    )
                    .map((k) => ({ curso: k, campus: nomeCampus(c.nome) }))
            ),
        [resumo]
    );
    // o curso A é sempre do campus escolhido no painel (sem ele no resumo,
    // qualquer um da UFC); padrão: o de maior CPC
    const doCampus = resumo.campi.find((c) => c.slug === campus);
    const ufcCampus = useMemo(
        () =>
            doCampus
                ? ufc.filter((u) =>
                      doCampus.cursos.some(
                          (k) => k.codigo_curso === u.curso.codigo_curso
                      )
                  )
                : ufc,
        [ufc, doCampus]
    );
    const padraoA = [...ufcCampus].sort(
        (x, y) => y.curso.cpc_continuo - x.curso.cpc_continuo
    )[0];
    // o da URL; sem ele, o aberto no Por curso; senão o padrão
    const cursoA =
        ufcCampus.find((u) => String(u.curso.codigo_curso) === a) ??
        ufcCampus.find((u) => u.curso.codigo_curso === cursoDoPorCurso("qualidade")) ??
        padraoA;
    const area = cursoA?.curso.area_avaliacao ?? null;
    const { dados, erro } = useQualidadeArea(area);

    const opcoesA: OpcaoCurso[] = useMemo(
        () =>
            [...ufcCampus]
                .sort((x, y) =>
                    toTitleCase(x.curso.nome_curso).localeCompare(
                        toTitleCase(y.curso.nome_curso),
                        "pt-BR"
                    )
                )
                .map((u) => ({
                    value: String(u.curso.codigo_curso),
                    label: toTitleCase(u.curso.nome_curso),
                    detalhe: detalheCurso({
                        codigo: u.curso.codigo_curso,
                        grau: u.curso.grau_academico,
                    }),
                    busca: u.curso.area_avaliacao,
                })),
        [ufcCampus]
    );

    // a área inteira, na mesma modalidade do curso A (EaD é outro universo)
    const daArea = dados && dados.area === area ? dados : null;
    const linhaA = daArea?.cursos.find((c) => c.codigo === cursoA?.curso.codigo_curso);
    const pares = useMemo(
        () =>
            daArea
                ? daArea.cursos.filter(
                      (c) => c.cpc !== null && c.ead === (linhaA?.ead ?? false)
                  )
                : [],
        [daArea, linhaA]
    );
    const opcoesB: OpcaoCurso[] = useMemo(
        () =>
            [...pares]
                .filter((c) => c.codigo !== cursoA?.curso.codigo_curso)
                .map((c) => ({
                    value: String(c.codigo),
                    // o curso é o mesmo (a área): o que muda é a instituição
                    label: `${c.siglaIes ?? c.nomeIes} — ${c.nomeMunicipio}/${c.uf}`,
                    detalhe: detalheCurso({ codigo: c.codigo }),
                    busca: c.nomeIes,
                }))
                .sort((x, y) => x.label.localeCompare(y.label, "pt-BR")),
        [pares, cursoA]
    );
    // padrão de B: o maior CPC da área no Brasil (fora o próprio A)
    const cursoB =
        pares.find(
            (c) => String(c.codigo) === b && c.codigo !== cursoA?.curso.codigo_curso
        ) ??
        [...pares]
            .filter((c) => c.codigo !== cursoA?.curso.codigo_curso)
            .sort((x, y) => (y.cpc ?? 0) - (x.cpc ?? 0))[0];

    const CHART = useChartTheme();
    if (!cursoA) {
        return (
            <Card title="Comparações">
                <p className="text-text-secondary mt-3 text-[14px]">
                    Nenhum curso da UFC tem CPC para comparar.
                </p>
            </Card>
        );
    }

    const nomeB = (c: CursoArea) => `${c.siglaIes ?? c.nomeIes} · ${c.nomeMunicipio}`;
    const lados = {
        a: `UFC · ${cursoA.campus}`,
        b: cursoB ? nomeB(cursoB) : "—",
    };
    // "Indicadores do curso": só a instituição; com a mesma instituição dos
    // dois lados (ex.: UFC × UFC), a cidade fica pra diferenciar
    const siglaB = cursoB ? (cursoB.siglaIes ?? cursoB.nomeIes) : "—";
    const ladosInstituicao =
        siglaB.toUpperCase() === "UFC" ? lados : { a: "UFC", b: siglaB };
    const fichaArea = (c: CursoArea | undefined) =>
        c ? (
            <Ficha
                itens={[
                    [
                        "CPC",
                        <>
                            {c.cpc === null ? "—" : formatDecimal(c.cpc)}{" "}
                            <FaixaPill faixa={c.faixa} />
                        </>,
                    ],
                    [
                        "Rede",
                        c.publica === true
                            ? "pública"
                            : c.publica === false
                              ? "privada"
                              : "—",
                    ],
                    ["Cidade", `${c.nomeMunicipio}/${c.uf}`],
                ]}
            />
        ) : null;

    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <Topo
                seletorModo={seletorModo}
                seletorA={
                    <CursoBusca
                        label="Curso A (UFC)"
                        cor={CHART.comparacao.a}
                        value={String(cursoA.curso.codigo_curso)}
                        options={opcoesA}
                        onChange={(v) => atualizar({ a: v, b: null })}
                        placeholder="Buscar curso da UFC…"
                    />
                }
                seletorB={
                    <CursoBusca
                        label="Curso B (mesma área)"
                        cor={CHART.comparacao.b}
                        value={cursoB ? String(cursoB.codigo) : null}
                        options={opcoesB}
                        onChange={(v) =>
                            atualizar({ a: String(cursoA.curso.codigo_curso), b: v })
                        }
                        placeholder="Buscar por instituição ou cidade…"
                    />
                }
                fichaA={fichaArea(linhaA)}
                fichaB={fichaArea(cursoB)}
            />
            {/* o conteúdo entra com a mesma animação das abas */}
            <div className="entrada grid grid-cols-1 items-start gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                {!daArea ? (
                    erro ? (
                        <p className="text-text-secondary text-[14px] lg:col-span-12">
                            {erro}
                        </p>
                    ) : (
                        // os cards da comparação em blocos, enquanto a área baixa
                        <div
                            role="status"
                            aria-label="Carregando os cursos da área"
                            className="grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6"
                        >
                            <CardEsqueleto className="h-[360px] lg:col-span-5" />
                            <CardEsqueleto className="h-[360px] lg:col-span-7" />
                        </div>
                    )
                ) : !linhaA || !cursoB ? (
                    <Card
                        className="lg:col-span-12"
                        title="Sem comparação nesta edição"
                    >
                        <p className="text-text-secondary mt-3 max-w-prose text-[14px] leading-relaxed">
                            {!linhaA
                                ? `O curso A não tem CPC na edição mais recente da área (Enade ${daArea.ano}): as notas só são comparáveis dentro da mesma edição.`
                                : "Não há outro curso com CPC nesta área para comparar."}
                        </p>
                    </Card>
                ) : (
                    <>
                        <p className="text-text-muted -mt-1 text-[12px] lg:col-span-12">
                            {toTitleCase(daArea.area)} · Enade {daArea.ano} · cursos{" "}
                            {linhaA.ead ? "a distância" : "presenciais"}
                        </p>
                        {/* lado a lado com a mesma altura */}
                        <div className="grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                            <LadoALadoCard
                                className="lg:col-span-5"
                                titulo="Indicadores do curso"
                                info="CPC, faixa, IDD, componente específico do Enade e docentes doutores dos dois cursos, na mesma edição do Enade. O ✓ marca o curso à frente em cada linha."
                                subtitulo={`Avaliação do Enade ${daArea.ano}`}
                                lados={ladosInstituicao}
                                linhas={[
                                    {
                                        label: "CPC contínuo",
                                        a: linhaA.cpc,
                                        b: cursoB.cpc,
                                        formato: (v) => formatDecimal(v),
                                    },
                                    {
                                        label: "Faixa",
                                        a: linhaA.faixa,
                                        b: cursoB.faixa,
                                        formato: (v) => String(v),
                                    },
                                    {
                                        label: "IDD",
                                        a: linhaA.notas.idd,
                                        b: cursoB.notas.idd,
                                        formato: (v) => formatDecimal(v),
                                    },
                                    {
                                        label: "Enade: componente específico",
                                        a: linhaA.notas.componente_especifico,
                                        b: cursoB.notas.componente_especifico,
                                        formato: (v) => formatDecimal(v),
                                    },
                                    {
                                        label: "Docentes doutores",
                                        a: linhaA.notas.doutores,
                                        b: cursoB.notas.doutores,
                                        formato: (v) => formatDecimal(v),
                                    },
                                ]}
                            />
                            <ComponentesEspelhoCard
                                className="lg:col-span-7"
                                titulo="Componentes do CPC"
                                subtitulo="Nota de cada curso em cada componente"
                                info="As notas dos dois cursos em cada componente do CPC (0 a 5), lado a lado."
                                lados={lados}
                                a={linhaA.notas}
                                b={cursoB.notas}
                            />
                        </div>
                        <ParticipacaoComparadaCard
                            className="lg:col-span-12"
                            lados={lados}
                            a={linhaA.historico}
                            b={cursoB.historico}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
