import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { Card } from "@/components/cards/Card";
import {
    Ficha,
    SeletorCampus,
    Topo,
} from "@/components/charts/qualidade/ComparacaoTopo";
import { CursoBusca, type OpcaoCurso } from "@/components/charts/qualidade/CursoBusca";
import { ModoToggle } from "@/components/charts/qualidade/ModoToggle";
import {
    IndicadoresTrajetoriaCards,
    SituacaoPermanenciaCards,
} from "@/components/charts/trajetoria/ComparacaoTrajetoriaCards";
import { DataState } from "@/components/layout/DataState";
import { CardEsqueleto, ComparacoesEsqueleto } from "@/components/layout/Esqueleto";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useResumoCampi } from "@/hooks/useResumoCampi";
import { useTrajetoriaArea, type CursoTrajetoriaArea } from "@/hooks/useTrajetoriaArea";
import { detalheCurso } from "@/lib/curso";
import { nomeCampus } from "@/lib/comparacao";
import { formatPercent, toTitleCase } from "@/lib/format";
import {
    buildTrajetorias,
    situacaoFinal,
    situacaoFinalMedia,
    turmaMadura,
    turmaNacional,
    turmaResumo,
    type Turma,
} from "@/lib/trajetoria";
import type { DashboardData, ResumoCampi, ResumoCurso } from "@/types/dashboard";

type Modo = "campi" | "cursos" | "brasil";

const MODOS: { value: Modo; label: string }[] = [
    { value: "campi", label: "Entre campi" },
    { value: "cursos", label: "Entre cursos da mesma área" },
    { value: "brasil", label: "Com o Brasil" },
];

type Atualizar = (mudancas: Record<string, string | null>) => void;

export function ComparacoesTrajetoriaPage() {
    return (
        <DataState
            esqueleto={<ComparacoesEsqueleto />}
            render={(data) => (
                <Comparacoes key={data.escopo.codigo_municipio} data={data} />
            )}
        />
    );
}

/** Trajetória → Comparações, no formato das Comparações da Qualidade: "entre
 * campi" (um campus da UFC contra outro, nas turmas maduras de todos os
 * cursos), "entre cursos da mesma área" (um curso da UFC contra qualquer
 * curso da mesma área CINE no Brasil) e "com o Brasil" (o campus contra a
 * média nacional dos mesmos cursos). Modo e lados ficam na URL
 * (``?modo=…&a=…&b=…``). */
function Comparacoes({ data }: { data: DashboardData }) {
    const [params, setParams] = useSearchParams();
    const { resumo, erro } = useResumoCampi();
    const modo: Modo =
        params.get("modo") === "cursos"
            ? "cursos"
            : params.get("modo") === "brasil"
              ? "brasil"
              : "campi";

    const atualizar: Atualizar = (mudancas) => {
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
    };

    if (!resumo) {
        return erro ? (
            <p className="text-text-secondary text-[14px]">{erro}</p>
        ) : (
            <ComparacoesEsqueleto />
        );
    }

    const seletorModo = (
        <ModoToggle
            label="Tipo de comparação da trajetória"
            value={modo}
            options={MODOS}
            onChange={(m) =>
                atualizar({
                    modo: m === "campi" ? null : m,
                    a: null,
                    b: null,
                })
            }
        />
    );
    const props = {
        resumo,
        seletorModo,
        a: params.get("a"),
        b: params.get("b"),
        atualizar,
    };

    return modo === "campi" ? (
        <ComparacaoCampi {...props} />
    ) : modo === "cursos" ? (
        <ComparacaoCursos {...props} />
    ) : (
        <ComparacaoBrasil data={data} resumo={resumo} seletorModo={seletorModo} />
    );
}

interface PropsModo {
    resumo: ResumoCampi;
    seletorModo: ReactNode;
    a: string | null;
    b: string | null;
    atualizar: Atualizar;
}

type CampusResumo = ResumoCampi["campi"][number];

/** As turmas maduras dos cursos de um campus do resumo. */
const turmasDoCampus = (cp: CampusResumo): Turma[] =>
    cp.cursos.flatMap((c) => (c.trajetoria ? [turmaResumo(c.trajetoria)] : []));

// --- entre campi -----------------------------------------------------------

function ComparacaoCampi({ resumo, seletorModo, a, b, atualizar }: PropsModo) {
    const { campus } = useDashboardData();
    // só os campi com alguma turma madura
    const campi = resumo.campi.filter((c) => turmasDoCampus(c).length > 0);
    const slugs = campi.map((c) => c.slug);
    const slugA =
        a && slugs.includes(a)
            ? a
            : campus && slugs.includes(campus)
              ? campus
              : slugs[0];
    const slugB =
        b && slugs.includes(b) && b !== slugA
            ? b
            : (slugs.find((s) => s !== slugA) ?? slugA);
    const ca = campi.find((c) => c.slug === slugA);
    const cb = campi.find((c) => c.slug === slugB);
    if (!ca || !cb) {
        return (
            <Card title="Comparações">
                <p className="text-text-secondary mt-3 text-[14px]">
                    Nenhum campus tem turma madura para comparar.
                </p>
            </Card>
        );
    }
    const ta = turmasDoCampus(ca);
    const tb = turmasDoCampus(cb);
    const lados = { a: nomeCampus(ca.nome), b: nomeCampus(cb.nome) };
    const ficha = (cp: CampusResumo, turmas: Turma[]) => {
        const final = situacaoFinalMedia(turmas);
        return (
            <Ficha
                itens={[
                    ["Cursos", cp.cursos.length],
                    ["com turma madura", turmas.length],
                    ["Conclusão", final ? formatPercent(final.concluiu, 0) : "—"],
                ]}
            />
        );
    };
    const detalhe = (cp: CampusResumo) =>
        `${turmasDoCampus(cp).length} cursos com turma madura`;
    const anos = [...ta, ...tb].map((t) => t.ano);
    const [de, ate] = [Math.min(...anos), Math.max(...anos)];

    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <Topo
                seletorModo={seletorModo}
                seletorA={
                    <SeletorCampus
                        lado="a"
                        value={slugA}
                        campi={campi}
                        detalhe={detalhe}
                        onChange={(v) =>
                            atualizar({ a: v, b: v === slugB ? slugA : slugB })
                        }
                    />
                }
                seletorB={
                    <SeletorCampus
                        lado="b"
                        value={slugB}
                        campi={campi.filter((c) => c.slug !== slugA)}
                        detalhe={detalhe}
                        onChange={(v) => atualizar({ a: slugA, b: v })}
                    />
                }
                fichaA={ficha(ca, ta)}
                fichaB={ficha(cb, tb)}
                onTrocar={() => atualizar({ a: slugB, b: slugA })}
            />
            {/* o conteúdo entra com a mesma animação das abas */}
            <div className="entrada grid grid-cols-1 items-start gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                <p className="text-text-muted -mt-1 text-[12px] lg:col-span-12">
                    {lados.a} × {lados.b} · turmas maduras de{" "}
                    {de === ate ? de : `${de} a ${ate}`}
                </p>
                <IndicadoresTrajetoriaCards
                    titulo="Indicadores do campus"
                    lados={lados}
                    a={ta}
                    b={tb}
                    contarCursos
                    rodape="Cada campus tem cursos diferentes: as médias resumem as turmas maduras dos cursos de cada um, pesadas pelos ingressantes."
                />
                <SituacaoPermanenciaCards lados={lados} a={ta} b={tb} agregado />
            </div>
        </div>
    );
}

// --- entre cursos da mesma área ---------------------------------------------

interface CursoUfc {
    curso: ResumoCurso & { trajetoria: NonNullable<ResumoCurso["trajetoria"]> };
    campus: string;
}

/** Ingressantes mínimos pro curso B padrão (o de maior conclusão). */
const MIN_INGRESSANTES_PADRAO = 30;

const conclusao = (c: CursoTrajetoriaArea) => situacaoFinal(c.turma)?.concluiu ?? 0;

function ComparacaoCursos({ resumo, seletorModo, a, b, atualizar }: PropsModo) {
    const CHART = useChartTheme();
    const { campus } = useDashboardData();
    const ufc = useMemo<CursoUfc[]>(
        () =>
            resumo.campi.flatMap((c) =>
                c.cursos
                    .filter(
                        (k): k is CursoUfc["curso"] =>
                            !!k.trajetoria?.nome_cine_area_geral
                    )
                    .map((k) => ({ curso: k, campus: nomeCampus(c.nome) }))
            ),
        [resumo]
    );
    // padrão de A: o primeiro curso do campus escolhido no painel
    const doCampus = resumo.campi.find((c) => c.slug === campus);
    const padraoA =
        ufc.find((u) =>
            doCampus?.cursos.some((k) => k.codigo_curso === u.curso.codigo_curso)
        ) ?? ufc[0];
    const cursoA = ufc.find((u) => String(u.curso.codigo_curso) === a) ?? padraoA;
    const area = cursoA?.curso.trajetoria.nome_cine_area_geral ?? null;
    const { dados, erro } = useTrajetoriaArea(area);

    const opcoesA: OpcaoCurso[] = useMemo(
        () =>
            [...ufc]
                .sort(
                    (x, y) =>
                        toTitleCase(x.curso.nome_curso).localeCompare(
                            toTitleCase(y.curso.nome_curso),
                            "pt-BR"
                        ) || x.campus.localeCompare(y.campus, "pt-BR")
                )
                .map((u) => ({
                    value: String(u.curso.codigo_curso),
                    label: `${toTitleCase(u.curso.nome_curso)} — ${u.campus}`,
                    detalhe: detalheCurso({
                        codigo: u.curso.codigo_curso,
                        grau:
                            u.curso.grau_academico ?? u.curso.trajetoria.grau_academico,
                    }),
                    busca: u.curso.trajetoria.nome_cine_area_geral ?? undefined,
                })),
        [ufc]
    );

    // a área inteira, no mesmo grau e modalidade do curso A
    const daArea = dados && dados.area === area ? dados : null;
    const linhaA = daArea?.cursos.find((c) => c.codigo === cursoA?.curso.codigo_curso);
    const pares = useMemo(
        () =>
            daArea && linhaA
                ? daArea.cursos.filter(
                      (c) =>
                          c.ead === linhaA.ead &&
                          c.grau === linhaA.grau &&
                          c.codigo !== linhaA.codigo
                  )
                : [],
        [daArea, linhaA]
    );
    const opcoesB: OpcaoCurso[] = useMemo(
        () =>
            pares
                .map((c) => ({
                    value: String(c.codigo),
                    // o curso é o mesmo (a área): o que muda é a instituição
                    label: `${c.siglaIes ?? c.nomeIes} — ${c.nomeMunicipio}${c.uf ? `/${c.uf}` : ""}`,
                    detalhe: detalheCurso({ codigo: c.codigo, grau: c.grau }),
                    busca: c.nomeIes,
                }))
                .sort((x, y) => x.label.localeCompare(y.label, "pt-BR")),
        [pares]
    );
    // padrão de B: outro curso da UFC na área, se houver; senão a maior
    // conclusão da área no Brasil entre as turmas de tamanho razoável (turma
    // muito pequena dá 0% ou 100% e não serve de referência)
    const cursoB =
        pares.find((c) => String(c.codigo) === b) ??
        pares.find((c) => c.destaque) ??
        [...pares]
            .filter((c) => c.turma.ingressantes >= MIN_INGRESSANTES_PADRAO)
            .sort((x, y) => conclusao(y) - conclusao(x))[0] ??
        pares[0];

    if (!cursoA) {
        return (
            <Card title="Comparações">
                <p className="text-text-secondary mt-3 text-[14px]">
                    Nenhum curso da UFC tem turma madura para comparar.
                </p>
            </Card>
        );
    }

    const lados = {
        a: `UFC · ${cursoA.campus}`,
        b: cursoB
            ? `${cursoB.siglaIes ?? cursoB.nomeIes} · ${cursoB.nomeMunicipio}`
            : "—",
    };
    const ufcB = cursoB
        ? ufc.find((u) => u.curso.codigo_curso === cursoB.codigo)
        : undefined;
    const fichaArea = (c: CursoTrajetoriaArea | undefined) => {
        if (!c) return null;
        const final = situacaoFinal(c.turma);
        return (
            <Ficha
                itens={[
                    ["Conclusão", final ? formatPercent(final.concluiu, 0) : "—"],
                    ["Turma", c.turma.ano],
                    [
                        "Rede",
                        c.publica === true
                            ? "pública"
                            : c.publica === false
                              ? "privada"
                              : "—",
                    ],
                ]}
            />
        );
    };

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
                podeTrocar={ufcB !== undefined}
                onTrocar={() =>
                    ufcB &&
                    atualizar({
                        a: String(ufcB.curso.codigo_curso),
                        b: String(cursoA.curso.codigo_curso),
                    })
                }
            />
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
                            <CardEsqueleto className="h-[420px] lg:col-span-5" />
                            <CardEsqueleto className="h-[420px] lg:col-span-7" />
                        </div>
                    )
                ) : !linhaA || !cursoB ? (
                    <Card className="lg:col-span-12" title="Sem comparação">
                        <p className="text-text-secondary mt-3 max-w-prose text-[14px] leading-relaxed">
                            {!linhaA
                                ? "O curso A ainda não tem turma madura na área: nenhuma turma teve tempo de se formar."
                                : "Não há outro curso desta área, no mesmo grau e modalidade, com turma madura para comparar."}
                        </p>
                    </Card>
                ) : (
                    <>
                        <p className="text-text-muted -mt-1 text-[12px] lg:col-span-12">
                            {daArea.area}
                            {linhaA.grau && ` · ${linhaA.grau.toLowerCase()}`} · cursos{" "}
                            {linhaA.ead ? "a distância" : "presenciais"} ·{" "}
                            {pares.length + 1} com turma madura no Brasil
                        </p>
                        <IndicadoresTrajetoriaCards
                            titulo="Indicadores do curso"
                            lados={lados}
                            a={[linhaA.turma]}
                            b={[cursoB.turma]}
                            agregado={false}
                            rodape="Mesma área CINE, grau e modalidade. A turma madura de cada curso pode ser de um ano de ingresso diferente."
                        />
                        <SituacaoPermanenciaCards
                            lados={lados}
                            a={[linhaA.turma]}
                            b={[cursoB.turma]}
                            agregado={false}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

// --- com o Brasil ----------------------------------------------------------

function ComparacaoBrasil({
    data,
    resumo,
    seletorModo,
}: {
    data: DashboardData;
    resumo: ResumoCampi;
    seletorModo: ReactNode;
}) {
    const { campus } = useDashboardData();
    const cp = resumo.campi.find((c) => c.slug === campus);
    const nome = cp ? nomeCampus(cp.nome) : toTitleCase(data.escopo.municipio);
    const cursos = useMemo(() => buildTrajetorias(data), [data]);
    // a turma madura de cada curso e a média nacional dos mesmos cursos (mesma
    // área CINE, no mesmo ponto), com o peso do curso do campus
    const pares = cursos.flatMap((c) => {
        const t = turmaMadura(c);
        const n = t && turmaNacional(data, c, t);
        return t && n ? [{ campus: t, brasil: n }] : [];
    });
    const lados = { a: nome, b: "Brasil" };
    const a = pares.map((p) => p.campus);
    const b = pares.map((p) => p.brasil);
    const anos = a.map((t) => t.ano);
    const [de, ate] = [Math.min(...anos), Math.max(...anos)];
    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <Card className="lg:col-span-12">
                <div className="-mx-1 max-w-full [scrollbar-width:none] overflow-x-auto px-1">
                    {seletorModo}
                </div>
            </Card>
            <div className="entrada grid grid-cols-1 items-start gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                {pares.length === 0 ? (
                    <p className="text-text-secondary text-[14px] lg:col-span-12">
                        Nenhum curso deste campus tem turma madura com média nacional
                        para comparar.
                    </p>
                ) : (
                    <>
                        {/* a mesma frase de contexto dos outros modos */}
                        <p className="text-text-muted -mt-1 text-[12px] lg:col-span-12">
                            {nome} × Brasil · turmas maduras de{" "}
                            {de === ate ? de : `${de} a ${ate}`} · {pares.length}{" "}
                            {pares.length === 1 ? "curso" : "cursos"} com média nacional
                        </p>
                        <IndicadoresTrajetoriaCards
                            titulo="Indicadores do campus"
                            lados={lados}
                            a={a}
                            b={b}
                            rodape={`Brasil: média nacional dos mesmos cursos (mesma área CINE), com o peso de cada curso do campus. ${pares.length} ${pares.length === 1 ? "curso" : "cursos"} com média nacional.`}
                        />
                        <SituacaoPermanenciaCards lados={lados} a={a} b={b} agregado />
                    </>
                )}
            </div>
        </div>
    );
}
