import { useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { Card } from "@/components/cards/Card";
import {
    Ficha,
    SeletorUnidade,
    Topo,
} from "@/components/charts/qualidade/ComparacaoTopo";
import { ChartSelect } from "@/components/charts/ChartSelect";
import { CursoBusca, type OpcaoCurso } from "@/components/charts/qualidade/CursoBusca";
import { ModoToggle } from "@/components/charts/qualidade/ModoToggle";
import {
    IndicadoresTrajetoriaCards,
    SituacaoPermanenciaCards,
} from "@/components/charts/trajetoria/ComparacaoTrajetoriaCards";
import { DataState } from "@/components/layout/DataState";
import { CardEsqueleto, ComparacoesEsqueleto } from "@/components/layout/Esqueleto";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useCursoEscolhido } from "@/hooks/useCursoEscolhido";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useResumoUnidades } from "@/hooks/useResumoUnidades";
import { useTrajetoriaArea, type CursoTrajetoriaArea } from "@/hooks/useTrajetoriaArea";
import { detalheCurso } from "@/lib/curso";
import { nomeUnidade } from "@/lib/comparacao";
import { formatPercent, toTitleCase } from "@/lib/format";
import {
    situacaoFinal,
    situacaoFinalMedia,
    turmaResumo,
    turmasResumo,
    type Turma,
} from "@/lib/trajetoria";
import type { ResumoUnidades, ResumoCurso } from "@/types/dashboard";

type Modo = "unidades" | "cursos";

const MODOS: { value: Modo; label: string }[] = [
    { value: "unidades", label: "Entre unidades" },
    { value: "cursos", label: "Entre cursos da mesma área" },
];

type Atualizar = (mudancas: Record<string, string | null>) => void;

export function ComparacoesTrajetoriaPage() {
    return (
        <DataState
            esqueleto={<ComparacoesEsqueleto />}
            render={(data) => <Comparacoes key={data.escopo.slug} />}
        />
    );
}

/** Trajetória → Comparações, no formato das Comparações da Qualidade: "entre
 * unidades" (uma unidade da UFC contra outra, nas turmas maduras de todos os
 * cursos), e "entre cursos da mesma área" (um curso da UFC contra
 * qualquer curso da mesma área CINE no Brasil). O seletor de turma (canto
 * superior direito do topo) escolhe a turma comparada: a mais recente de cada
 * curso (padrão) ou um ano de ingresso, entre as turmas maduras do lado A.
 * Modo, lados e turma ficam na URL (``?modo=…&a=…&b=…&turma=…``). */
function Comparacoes() {
    const [params, setParams] = useSearchParams();
    const { resumo, erro } = useResumoUnidades();
    const modo: Modo = params.get("modo") === "cursos" ? "cursos" : "unidades";

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
                    modo: m === "unidades" ? null : m,
                    a: null,
                    b: null,
                    turma: null,
                })
            }
        />
    );
    const props = {
        resumo,
        seletorModo,
        a: params.get("a"),
        b: params.get("b"),
        turma: Number(params.get("turma")) || null,
        atualizar,
    };

    return modo === "unidades" ? (
        <ComparacaoUnidades {...props} />
    ) : (
        <ComparacaoCursos {...props} />
    );
}

interface PropsModo {
    resumo: ResumoUnidades;
    seletorModo: ReactNode;
    a: string | null;
    b: string | null;
    /** Ano de ingresso da turma comparada (``?turma=``); ``null`` = a mais
     * recente de cada curso. */
    turma: number | null;
    atualizar: Atualizar;
}

type UnidadeResumo = ResumoUnidades["unidades"][number];

/** A turma de um curso do resumo: a do ano pedido (``null`` se ele não tem
 * turma madura nesse ano) ou, sem ano, a madura mais recente. */
function turmaDoCurso(c: ResumoCurso, ano: number | null): Turma | null {
    if (!c.trajetoria) return null;
    if (ano === null) return turmaResumo(c.trajetoria);
    return turmasResumo(c.trajetoria).find((t) => t.ano === ano) ?? null;
}

/** As turmas dos cursos de uma unidade do resumo (ver ``turmaDoCurso``). */
const turmasDaUnidade = (cp: UnidadeResumo, ano: number | null = null): Turma[] =>
    cp.cursos.flatMap((c) => {
        const t = turmaDoCurso(c, ano);
        return t ? [t] : [];
    });

/** Os anos com turma madura num conjunto de cursos e quantos cursos têm cada
 * um, do mais recente ao mais antigo (as opções do seletor de turma). */
function anosDeTurma(cursos: ResumoCurso[]): [number, number][] {
    const contagem = new Map<number, number>();
    for (const c of cursos)
        if (c.trajetoria)
            for (const t of turmasResumo(c.trajetoria))
                contagem.set(t.ano, (contagem.get(t.ano) ?? 0) + 1);
    return [...contagem].sort(([x], [y]) => y - x);
}

/** O ano mais perto de ``ano`` numa lista (empate: o mais recente). */
function maisProximo(ano: number, anos: number[]): number | null {
    return (
        [...anos].sort((x, y) => Math.abs(x - ano) - Math.abs(y - ano) || y - x)[0] ??
        null
    );
}

/** Opção do seletor de turma sem ano: a mais recente de cada curso. */
const MAIS_RECENTE = "recente";

/** Seletor de turma do topo das Comparações (canto superior direito): a mais
 * recente de cada curso ou um dos anos com turma madura do lado A — a base é
 * sempre o lado A; o B pode não ter a turma (aí a página avisa). */
function SeletorTurma({
    turma,
    anos,
    detalhe,
    atualizar,
}: {
    turma: number | null;
    anos: number[];
    /** A segunda linha de cada ano (ex.: quantos cursos têm a turma). */
    detalhe?: (ano: number) => string;
    atualizar: Atualizar;
}) {
    return (
        <ChartSelect
            label="Turma"
            value={turma === null ? MAIS_RECENTE : String(turma)}
            options={[
                {
                    value: MAIS_RECENTE,
                    label: "Turma mais recente",
                    descricao: "A madura mais recente de cada curso",
                },
                ...anos.map((ano) => ({
                    value: String(ano),
                    label: `Turma de ${ano}`,
                    descricao: detalhe?.(ano),
                })),
            ]}
            onChange={(v) => atualizar({ turma: v === MAIS_RECENTE ? null : v })}
        />
    );
}

/** O lado B sem a turma escolhida: o aviso, no lugar dos cards, e um atalho
 * pra turma mais próxima que os dois lados têm. */
function SemTurma({
    titulo,
    texto,
    sugestao,
    atualizar,
}: {
    titulo: string;
    texto: ReactNode;
    sugestao: number | null;
    atualizar: Atualizar;
}) {
    return (
        <Card className="lg:col-span-12" title={titulo}>
            <p className="text-text-secondary mt-3 text-[14px] leading-relaxed">
                {texto}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {sugestao !== null && (
                    <button
                        type="button"
                        onClick={() => atualizar({ turma: String(sugestao) })}
                        className="bg-ink text-surface focus-visible:ring-lime/70 rounded-full px-4 py-2 text-[13px] font-semibold outline-none hover:opacity-90 focus-visible:ring-2"
                    >
                        Comparar a turma de {sugestao}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => atualizar({ turma: null })}
                    className="bg-page text-ink focus-visible:ring-lime/60 rounded-full px-4 py-2 text-[13px] font-semibold outline-none hover:opacity-80 focus-visible:ring-2"
                >
                    Voltar à turma mais recente
                </button>
            </div>
        </Card>
    );
}

// --- entre unidades -----------------------------------------------------------

function ComparacaoUnidades({
    resumo,
    seletorModo,
    a,
    b,
    turma,
    atualizar,
}: PropsModo) {
    const { unidade } = useDashboardData();
    // só as unidades com alguma turma madura
    const unidades = resumo.unidades.filter((c) => turmasDaUnidade(c).length > 0);
    const slugs = unidades.map((c) => c.slug);
    const slugA =
        a && slugs.includes(a)
            ? a
            : unidade && slugs.includes(unidade)
              ? unidade
              : slugs[0];
    const slugB =
        b && slugs.includes(b) && b !== slugA
            ? b
            : (slugs.find((s) => s !== slugA) ?? slugA);
    const ca = unidades.find((c) => c.slug === slugA);
    const cb = unidades.find((c) => c.slug === slugB);
    if (!ca || !cb) {
        return (
            <Card title="Comparações">
                <p className="text-text-secondary mt-3 text-[14px]">
                    Nenhuma unidade tem turma madura para comparar.
                </p>
            </Card>
        );
    }
    // a turma: os anos com turma madura nos cursos da unidade A (a base);
    // um ano que A não tem (link antigo, outra unidade A) vale "mais recente"
    const anosA = anosDeTurma(ca.cursos);
    const comTurmaA = turmasDaUnidade(ca).length;
    const ano = turma !== null && anosA.some(([x]) => x === turma) ? turma : null;
    const ta = turmasDaUnidade(ca, ano);
    const tb = turmasDaUnidade(cb, ano);
    const lados = { a: nomeUnidade(ca), b: nomeUnidade(cb) };
    const ficha = (cp: UnidadeResumo, turmas: Turma[]) => {
        const final = situacaoFinalMedia(turmas);
        return (
            <Ficha
                itens={[
                    ["Cursos", cp.cursos.length],
                    [
                        ano === null ? "com turma madura" : `com a turma de ${ano}`,
                        turmas.length,
                    ],
                    ["Conclusão", final ? formatPercent(final.concluiu, 0) : "—"],
                ]}
            />
        );
    };
    const detalhe = (cp: UnidadeResumo) =>
        ano === null
            ? `${turmasDaUnidade(cp).length} cursos com turma madura`
            : `${turmasDaUnidade(cp, ano).length} cursos com a turma de ${ano}`;
    const anos = [...ta, ...tb].map((t) => t.ano);
    const [de, ate] = [Math.min(...anos), Math.max(...anos)];
    // B sem nenhum curso com a turma: o ano mais perto que os dois têm
    const anosB = new Set(anosDeTurma(cb.cursos).map(([x]) => x));
    const sugestao =
        ano === null
            ? null
            : maisProximo(
                  ano,
                  anosA.map(([x]) => x).filter((x) => anosB.has(x))
              );

    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <Topo
                seletorModo={seletorModo}
                seletorA={
                    <SeletorUnidade
                        lado="a"
                        value={slugA}
                        unidades={unidades}
                        detalhe={detalhe}
                        onChange={(v) =>
                            atualizar({ a: v, b: v === slugB ? slugA : slugB })
                        }
                    />
                }
                seletorB={
                    <SeletorUnidade
                        lado="b"
                        value={slugB}
                        unidades={unidades.filter((c) => c.slug !== slugA)}
                        detalhe={detalhe}
                        onChange={(v) => atualizar({ a: slugA, b: v })}
                    />
                }
                fichaA={ficha(ca, ta)}
                fichaB={ficha(cb, tb)}
                acao={
                    <SeletorTurma
                        turma={ano}
                        anos={anosA.map(([x]) => x)}
                        detalhe={(x) =>
                            `${anosA.find(([y]) => y === x)?.[1] ?? 0} de ${comTurmaA} cursos de ${lados.a}`
                        }
                        atualizar={atualizar}
                    />
                }
            />
            {/* o conteúdo entra com a mesma animação das abas */}
            <div className="entrada grid grid-cols-1 items-start gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                {ano !== null && tb.length === 0 ? (
                    <SemTurma
                        titulo={`Sem a turma de ${ano}`}
                        texto={`Nenhum curso de ${lados.b} tem a turma de ${ano} madura (que já teve tempo de se formar).`}
                        sugestao={sugestao}
                        atualizar={atualizar}
                    />
                ) : (
                    <>
                        <p className="text-text-muted -mt-1 text-[12px] lg:col-span-12">
                            {lados.a} × {lados.b} ·{" "}
                            {ano === null
                                ? `turmas maduras de ${de === ate ? de : `${de} a ${ate}`}`
                                : `turmas de ${ano}: ${ta.length} ${ta.length === 1 ? "curso" : "cursos"} × ${tb.length} ${tb.length === 1 ? "curso" : "cursos"}`}
                        </p>
                        <IndicadoresTrajetoriaCards
                            titulo="Indicadores da unidade"
                            lados={lados}
                            a={ta}
                            b={tb}
                            contarCursos
                            rodape={
                                ano === null
                                    ? "Cada unidade tem cursos diferentes: as médias resumem as turmas maduras dos cursos de cada uma, pesadas pelos ingressantes."
                                    : `Cada unidade tem cursos diferentes: as médias resumem as turmas de ${ano} dos cursos de cada uma que já tiveram tempo de se formar, pesadas pelos ingressantes.`
                            }
                        />
                        <SituacaoPermanenciaCards
                            lados={lados}
                            a={ta}
                            b={tb}
                            agregado
                        />
                    </>
                )}
            </div>
        </div>
    );
}

// --- entre cursos da mesma área ---------------------------------------------

interface CursoUfc {
    curso: ResumoCurso & { trajetoria: NonNullable<ResumoCurso["trajetoria"]> };
    unidade: string;
}

/** Ingressantes mínimos pro curso B padrão (o de maior conclusão). */
const MIN_INGRESSANTES_PADRAO = 30;

const conclusao = (c: CursoTrajetoriaArea) => situacaoFinal(c.turma)?.concluiu ?? 0;

function ComparacaoCursos({ resumo, seletorModo, a, b, turma, atualizar }: PropsModo) {
    const CHART = useChartTheme();
    const { unidade } = useDashboardData();
    const ufc = useMemo<CursoUfc[]>(
        () =>
            resumo.unidades.flatMap((c) =>
                c.cursos
                    .filter(
                        (k): k is CursoUfc["curso"] =>
                            !!k.trajetoria?.nome_cine_area_geral
                    )
                    .map((k) => ({ curso: k, unidade: nomeUnidade(c) }))
            ),
        [resumo]
    );
    // o curso A é sempre da unidade escolhida no painel (sem ele no resumo,
    // qualquer um da UFC); padrão: o primeiro
    const daUnidade = resumo.unidades.find((c) => c.slug === unidade);
    const ufcUnidade = useMemo(
        () =>
            daUnidade
                ? ufc.filter((u) =>
                      daUnidade.cursos.some(
                          (k) => k.codigo_curso === u.curso.codigo_curso
                      )
                  )
                : ufc,
        [ufc, daUnidade]
    );
    const padraoA = ufcUnidade[0];
    // o da URL (o seletor A, um link) vira o curso escolhido do painel; sem
    // ele, o escolhido; senão o padrão (sem virar escolha)
    const { curso: escolha, ultimo, escolher } = useCursoEscolhido();
    const daUrl = ufcUnidade.find((u) => String(u.curso.codigo_curso) === a);
    const cursoA =
        daUrl ??
        ufcUnidade.find((u) => u.curso.codigo_curso === (escolha ?? ultimo)) ??
        padraoA;
    useEffect(() => {
        if (daUrl) escolher(daUrl.curso.codigo_curso);
    }, [daUrl, escolher]);
    const area = cursoA?.curso.trajetoria.nome_cine_area_geral ?? null;
    const { dados, erro } = useTrajetoriaArea(area);

    const opcoesA: OpcaoCurso[] = useMemo(
        () =>
            [...ufcUnidade]
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
                        grau:
                            u.curso.grau_academico ?? u.curso.trajetoria.grau_academico,
                    }),
                    busca: u.curso.trajetoria.nome_cine_area_geral ?? undefined,
                })),
        [ufcUnidade]
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

    // a turma: os anos com turma madura do curso A (a base); um ano que A não
    // tem vale "mais recente". As turmas maduras de A e de B (qualquer curso
    // do Brasil) vêm do arquivo da área
    // (enquanto a área baixa, as de A vêm do resumo, que já chegou: o
    // seletor e a turma da URL valem desde o começo)
    const turmasA =
        linhaA?.turmas ?? (cursoA ? turmasResumo(cursoA.curso.trajetoria) : []);
    const ano = turma !== null && turmasA.some((t) => t.ano === turma) ? turma : null;
    const turmaA =
        linhaA && (ano === null ? linhaA.turma : turmasA.find((t) => t.ano === ano));
    const turmasB = cursoB?.turmas ?? [];
    const turmaB =
        cursoB && (ano === null ? cursoB.turma : turmasB.find((t) => t.ano === ano));
    const sugestao =
        ano === null
            ? null
            : maisProximo(
                  ano,
                  turmasA
                      .map((t) => t.ano)
                      .filter((x) => turmasB.some((t) => t.ano === x))
              );

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
        a: `UFC · ${cursoA.unidade}`,
        b: cursoB
            ? `${cursoB.siglaIes ?? cursoB.nomeIes} · ${cursoB.nomeMunicipio}`
            : "—",
    };
    // a ficha de cada lado, com a turma comparada (sem ela: a madura mais
    // recente do curso, só pra referência)
    const fichaArea = (c: CursoTrajetoriaArea | undefined, t: Turma | undefined) => {
        if (!c) return null;
        const final = situacaoFinal(t ?? c.turma);
        return (
            <Ficha
                itens={[
                    ["Conclusão", t && final ? formatPercent(final.concluiu, 0) : "—"],
                    ["Turma", t ? t.ano : `sem ${ano}`],
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
                fichaA={fichaArea(linhaA, turmaA)}
                fichaB={fichaArea(cursoB, turmaB)}
                acao={
                    <SeletorTurma
                        turma={ano}
                        anos={turmasA.map((t) => t.ano).reverse()}
                        detalhe={(x) =>
                            `${turmasA.find((t) => t.ano === x)?.ingressantes ?? "—"} ingressantes no curso A`
                        }
                        atualizar={atualizar}
                    />
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
                ) : linhaA && cursoB && ano !== null && !turmaB ? (
                    <SemTurma
                        titulo={`Sem a turma de ${ano}`}
                        texto={`${lados.b} não tem a turma de ${ano} madura (que já teve tempo de se formar). As turmas maduras dele são de ${turmasB.map((t) => t.ano).join(", ")}.`}
                        sugestao={sugestao}
                        atualizar={atualizar}
                    />
                ) : !linhaA || !turmaA || !cursoB || !turmaB ? (
                    <Card className="lg:col-span-12" title="Sem comparação">
                        <p className="text-text-secondary mt-3 text-[14px] leading-relaxed">
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
                            a={[turmaA]}
                            b={[turmaB]}
                            agregado={false}
                            rodape={
                                ano === null
                                    ? "Mesma área CINE, grau e modalidade. A turma madura de cada curso pode ser de um ano de ingresso diferente."
                                    : `Mesma área CINE, grau e modalidade, as duas turmas de ${ano}.`
                            }
                        />
                        <SituacaoPermanenciaCards
                            lados={lados}
                            a={[turmaA]}
                            b={[turmaB]}
                            agregado={false}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
