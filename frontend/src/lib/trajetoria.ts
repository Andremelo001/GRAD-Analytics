import { toTitleCase } from "@/lib/format";
import { rotulosCursos } from "@/lib/qualidade";
import type { DashboardData, TrajetoriaResumo } from "@/types/dashboard";

/** Anos de folga além do prazo pra uma turma contar como "madura" (já teve
 * tempo de se formar, inclusive com atraso) — o mesmo do backend
 * (``course_profile.ANOS_ALEM_DO_PRAZO``). Só turmas maduras entram nas
 * comparações; as outras aparecem como "em andamento". */
export const ANOS_ALEM_DO_PRAZO = 2;

/** Um ano da turma (``anos`` desde o ingresso: 0 = o ano em que entrou),
 * em % dos ingressantes. ``outros`` = falecidos e arredondamento. */
export interface PontoTurma {
    anos: number;
    cursando: number;
    concluiu: number;
    desistiu: number;
}

/** Uma turma (coorte) de um curso. ``prazo`` = duração prevista dela (pode
 * mudar entre turmas do mesmo curso). */
export interface Turma {
    ano: number;
    prazo: number | null;
    ingressantes: number;
    pontos: PontoTurma[];
    /** Já foi acompanhada até ``prazo + ANOS_ALEM_DO_PRAZO`` anos. */
    madura: boolean;
    /** Último ano acompanhado e quantos ainda cursavam nele (contagem exata
     * do INEP; ``null`` sem o dado). */
    ultimoAno: number | null;
    cursandoAgora: number | null;
}

export interface CursoTrajetoria {
    codigo: number;
    /** Nome de exibição (sem repetição: ver ``rotulosCursos``). */
    nome: string;
    /** O nome do curso como o INEP registra (nos seletores). */
    nomeCurso: string;
    /** Área CINE (o curso em si), a chave da média nacional. */
    area: string | null;
    /** Grau acadêmico (Bacharelado, Licenciatura, Tecnológico) e modalidade
     * (Presencial, A distância) — o INEP não informa o turno. */
    grau: string | null;
    modalidade: string | null;
    prazo: number | null;
    /** Da mais antiga à mais recente. */
    turmas: Turma[];
}

/** Ponto da "situação final" de uma turma: ``prazo + 1`` anos depois do
 * ingresso (dois anos de folga) — o mesmo ponto pra todo curso, como no
 * backend. */
export const anosFinal = (prazo: number) => prazo + ANOS_ALEM_DO_PRAZO - 1;

export function pontoEm(turma: Turma, anos: number): PontoTurma | undefined {
    return turma.pontos.find((p) => p.anos === anos);
}

/** A situação final de uma turma madura (no ponto ``anosFinal``). */
export function situacaoFinal(turma: Turma): PontoTurma | undefined {
    return turma.prazo === null ? undefined : pontoEm(turma, anosFinal(turma.prazo));
}

/** Os cursos do campus com as turmas acompanhadas (curva de sobrevivência +
 * ingressantes e prazo de cada turma), na ordem dos nomes. */
export function buildTrajetorias(data: DashboardData): CursoTrajetoria[] {
    const rotulos = rotulosCursos(data.cursos);
    const perfil = data.curso_perfil;
    const funil = new Map(
        perfil.funil_coortes.map((f) => [`${f.codigo_curso}-${f.ano_ingresso}`, f])
    );
    const porCurso = new Map<number, Map<number, PontoTurma[]>>();
    const areas = new Map<number, string | null>();
    for (const p of perfil.curva_sobrevivencia) {
        if (
            p.taxa_permanencia === null ||
            p.taxa_conclusao_acumulada === null ||
            p.taxa_desistencia_acumulada === null
        )
            continue;
        const turmas = porCurso.get(p.codigo_curso) ?? new Map<number, PontoTurma[]>();
        porCurso.set(p.codigo_curso, turmas);
        areas.set(p.codigo_curso, p.nome_cine_area_geral);
        const pontos = turmas.get(p.ano_ingresso) ?? [];
        turmas.set(p.ano_ingresso, pontos);
        pontos.push({
            anos: p.anos_desde_ingresso,
            cursando: p.taxa_permanencia,
            concluiu: p.taxa_conclusao_acumulada,
            desistiu: p.taxa_desistencia_acumulada,
        });
    }

    return data.cursos
        .filter((c) => porCurso.has(c.codigo_curso))
        .map((c) => {
            const turmas = [...porCurso.get(c.codigo_curso)!.entries()]
                .map(([ano, pontos]): Turma => {
                    const f = funil.get(`${c.codigo_curso}-${ano}`);
                    const prazo = f?.prazo_integralizacao ?? c.prazo_integralizacao;
                    const ordenados = pontos.sort((a, b) => a.anos - b.anos);
                    const ultimo = ordenados.at(-1)?.anos ?? 0;
                    return {
                        ano,
                        prazo,
                        ingressantes: f?.qt_ingressante ?? 0,
                        pontos: ordenados,
                        madura: prazo !== null && ultimo >= anosFinal(prazo),
                        ultimoAno: f?.ano_referencia ?? null,
                        cursandoAgora: f?.qt_permanencia ?? null,
                    };
                })
                .sort((a, b) => a.ano - b.ano);
            return {
                codigo: c.codigo_curso,
                nome: rotulos.get(c.codigo_curso) ?? c.nome_curso,
                nomeCurso: toTitleCase(c.nome_curso),
                area: areas.get(c.codigo_curso) ?? null,
                grau: c.grau_academico,
                modalidade: c.modalidade_ensino,
                prazo: c.prazo_integralizacao,
                turmas,
            };
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** A turma madura mais recente do curso. */
export function turmaMadura(curso: CursoTrajetoria): Turma | undefined {
    return curso.turmas.filter((t) => t.madura).at(-1);
}

export const maduras = (curso: CursoTrajetoria) => curso.turmas.filter((t) => t.madura);

/** Média de ``valor`` pelas turmas, pesada pelos ingressantes de cada uma
 * (turma maior pesa mais); ``null`` sem turma com valor. */
export function mediaPonderada(
    turmas: Turma[],
    valor: (t: Turma) => number | undefined
): number | null {
    let soma = 0;
    let peso = 0;
    for (const t of turmas) {
        const v = valor(t);
        if (v === undefined || t.ingressantes <= 0) continue;
        soma += v * t.ingressantes;
        peso += t.ingressantes;
    }
    return peso > 0 ? soma / peso : null;
}

/** Situação final média das turmas maduras (pesada pelos ingressantes). */
export function situacaoFinalMedia(turmas: Turma[]): PontoTurma | null {
    const ok = turmas.filter((t) => situacaoFinal(t));
    if (ok.length === 0) return null;
    const m = (campo: "cursando" | "concluiu" | "desistiu") =>
        mediaPonderada(ok, (t) => situacaoFinal(t)![campo]) ?? 0;
    return {
        anos: -1,
        cursando: m("cursando"),
        concluiu: m("concluiu"),
        desistiu: m("desistiu"),
    };
}

/** Em que ano do curso a evasão acontece: pra cada ano (1º, 2º…), a fração
 * de toda a evasão das turmas maduras (até o ponto final) que aconteceu
 * nele — soma 1. Pesa as turmas pelos ingressantes (conta alunos, não %). */
export function evasaoPorAnoDoCurso(turmas: Turma[]): number[] {
    const alunos: number[] = [];
    for (const t of turmas) {
        if (t.prazo === null) continue;
        let anterior = 0;
        for (const p of t.pontos) {
            if (p.anos > anosFinal(t.prazo)) break;
            const novo = Math.max(p.desistiu - anterior, 0);
            anterior = p.desistiu;
            alunos[p.anos] = (alunos[p.anos] ?? 0) + (novo / 100) * t.ingressantes;
        }
    }
    const total = alunos.reduce((a, b) => a + (b ?? 0), 0);
    return total > 0 ? Array.from(alunos, (v) => (v ?? 0) / total) : [];
}

/** Quando quem concluiu se formou, em relação ao prazo, nas turmas maduras
 * (% dos ingressantes, pesado): no prazo, com 1 e com 2 anos de atraso, e
 * quem não concluiu até o ponto final. */
export interface ConclusaoPrazo {
    noPrazo: number;
    atraso1: number;
    atraso2: number;
    naoConcluiu: number;
}

export function conclusaoNoPrazo(turmas: Turma[]): ConclusaoPrazo | null {
    const ok = turmas.filter((t) => t.prazo !== null && situacaoFinal(t));
    if (ok.length === 0) return null;
    const ate = (t: Turma, anos: number) =>
        [...t.pontos].reverse().find((p) => p.anos <= anos)?.concluiu ?? 0;
    const m = (f: (t: Turma) => number) => mediaPonderada(ok, f) ?? 0;
    const noPrazo = m((t) => ate(t, t.prazo! - 1));
    const ate1 = m((t) => ate(t, t.prazo!));
    const ate2 = m((t) => ate(t, t.prazo! + 1));
    return {
        noPrazo,
        atraso1: ate1 - noPrazo,
        atraso2: ate2 - ate1,
        naoConcluiu: 100 - ate2,
    };
}

/** Tempo médio (anos de curso) de quem concluiu nas turmas maduras, até o
 * ponto final — ex.: 5,4 anos num curso de 5. */
export function tempoMedioConclusao(turmas: Turma[]): number | null {
    let soma = 0;
    let alunos = 0;
    for (const t of turmas) {
        if (t.prazo === null || !situacaoFinal(t)) continue;
        let anterior = 0;
        for (const p of t.pontos) {
            if (p.anos > anosFinal(t.prazo)) break;
            const novo = Math.max(p.concluiu - anterior, 0) * t.ingressantes;
            anterior = p.concluiu;
            soma += novo * (p.anos + 1);
            alunos += novo;
        }
    }
    return alunos > 0 ? soma / alunos : null;
}

/** Média nacional da área (curva de permanência), por anos desde o
 * ingresso. */
export function curvaNacional(
    data: DashboardData,
    area: string | null
): Map<number, PontoTurma> {
    const mapa = new Map<number, PontoTurma>();
    if (!area) return mapa;
    for (const p of data.medias_nacionais.curva_sobrevivencia) {
        if (p.nome_cine_area_geral !== area) continue;
        mapa.set(p.anos_desde_ingresso, {
            anos: p.anos_desde_ingresso,
            cursando: p.taxa_permanencia_media_nacional,
            concluiu: p.taxa_conclusao_acumulada_media_nacional,
            desistiu: p.taxa_desistencia_acumulada_media_nacional,
        });
    }
    return mapa;
}

/** A curva da turma madura do resumo dos campi, no formato das turmas. */
export function pontosResumo(t: TrajetoriaResumo): PontoTurma[] {
    return t.curva.map(([anos, cursando, concluiu, desistiu]) => ({
        anos,
        cursando,
        concluiu,
        desistiu,
    }));
}

/** Conclusão e evasão das turmas maduras do campus (a mais recente de cada
 * curso, no ponto final — prazo + 2 anos), pesadas pelos ingressantes, e a
 * média nacional dos mesmos cursos no mesmo ponto. É a comparação justa:
 * turmas recentes ainda não tiveram tempo de se formar. Usado no Início e no
 * Panorama da Trajetória (os números batem). */
export interface IndicadoresMaduros {
    concluiu: number;
    desistiu: number;
    concluiuBrasil: number | null;
    desistiuBrasil: number | null;
    /** Anos de ingresso das turmas comparadas (a mais recente madura de cada
     * curso). */
    anos: number[];
}

export function indicadoresMaduros(
    data: DashboardData,
    cursos: CursoTrajetoria[]
): IndicadoresMaduros | null {
    const ultimas = cursos.flatMap((c) => {
        const t = turmaMadura(c);
        return t ? [{ curso: c, turma: t }] : [];
    });
    const turmas = ultimas.map((u) => u.turma);
    const final = situacaoFinalMedia(turmas);
    if (!final) return null;
    const brasil = (campo: "concluiu" | "desistiu") =>
        mediaPonderada(turmas, (t) => {
            const u = ultimas.find((x) => x.turma === t)!;
            return curvaNacional(data, u.curso.area).get(anosFinal(t.prazo!))?.[campo];
        });
    return {
        concluiu: final.concluiu,
        desistiu: final.desistiu,
        concluiuBrasil: brasil("concluiu"),
        desistiuBrasil: brasil("desistiu"),
        anos: [...new Set(turmas.map((t) => t.ano))].sort(),
    };
}

/** Os mesmos indicadores de um curso só: a média de todas as turmas maduras
 * dele (pesada pelos ingressantes), contra a média nacional da área no mesmo
 * ponto. ``null`` sem turma madura. */
export function indicadoresMadurosCurso(
    data: DashboardData,
    curso: CursoTrajetoria
): IndicadoresMaduros | null {
    const turmas = maduras(curso);
    const final = situacaoFinalMedia(turmas);
    if (!final) return null;
    const nacional = curvaNacional(data, curso.area);
    const brasil = (campo: "concluiu" | "desistiu") =>
        mediaPonderada(turmas, (t) => nacional.get(anosFinal(t.prazo!))?.[campo]);
    return {
        concluiu: final.concluiu,
        desistiu: final.desistiu,
        concluiuBrasil: brasil("concluiu"),
        desistiuBrasil: brasil("desistiu"),
        anos: turmas.filter((t) => situacaoFinal(t)).map((t) => t.ano),
    };
}

/** A mesma taxa (situação final) por ano de ingresso, só com turmas maduras
 * e pesada pelos ingressantes: a linha dos cards do Início. */
export function serieMaduras(
    cursos: CursoTrajetoria[],
    campo: "concluiu" | "desistiu"
): { ano: number; valor: number }[] {
    const porAno = new Map<number, Turma[]>();
    for (const c of cursos)
        for (const t of c.turmas)
            if (t.madura) porAno.set(t.ano, [...(porAno.get(t.ano) ?? []), t]);
    return [...porAno.entries()]
        .flatMap(([ano, turmas]) => {
            const v = mediaPonderada(turmas, (t) => situacaoFinal(t)?.[campo]);
            return v === null ? [] : [{ ano, valor: v }];
        })
        .sort((a, b) => a.ano - b.ano);
}

/** Quantos alunos de uma turma, na situação do último ano acompanhado:
 * concluíram e desistiram vêm das taxas acumuladas × ingressantes (o INEP só
 * dá a contagem do ano); ainda cursando é a contagem exata. ``outros`` =
 * falecidos e arredondamento. */
export interface ContagemTurma {
    entraram: number;
    concluiram: number;
    desistiram: number;
    cursando: number;
    outros: number;
}

export function contagemTurma(t: Turma): ContagemTurma {
    const p = t.pontos.at(-1);
    const entraram = t.ingressantes;
    if (!p || entraram <= 0)
        return { entraram, concluiram: 0, desistiram: 0, cursando: 0, outros: 0 };
    const concluiram = Math.round((entraram * p.concluiu) / 100);
    const desistiram = Math.round((entraram * p.desistiu) / 100);
    const cursando = t.cursandoAgora ?? Math.round((entraram * p.cursando) / 100);
    return {
        entraram,
        concluiram,
        desistiram,
        cursando,
        outros: Math.max(entraram - concluiram - desistiram - cursando, 0),
    };
}

export function somarContagens(turmas: Turma[]): ContagemTurma {
    return turmas.map(contagemTurma).reduce(
        (a, b) => ({
            entraram: a.entraram + b.entraram,
            concluiram: a.concluiram + b.concluiram,
            desistiram: a.desistiram + b.desistiram,
            cursando: a.cursando + b.cursando,
            outros: a.outros + b.outros,
        }),
        { entraram: 0, concluiram: 0, desistiram: 0, cursando: 0, outros: 0 }
    );
}

/** Os indicadores de trajetória do INEP, com a sigla e a definição oficiais
 * (usados nos títulos, legendas e textos de informação da aba). */
export type IndicadorInep = "TAP" | "TCA" | "TDA" | "TCAN" | "TADA";

export const INDICADORES_INEP: Record<
    IndicadorInep,
    { nome: string; definicao: string }
> = {
    TAP: {
        nome: "Taxa de Permanência",
        definicao:
            "Percentual de ingressantes com vínculo ativo no curso no ano de referência.",
    },
    TCA: {
        nome: "Taxa de Conclusão Acumulada",
        definicao:
            "Percentual de ingressantes que concluíram o curso até o ano de referência.",
    },
    TDA: {
        nome: "Taxa de Desistência Acumulada",
        definicao:
            "Percentual de ingressantes que desistiram do curso até o ano de referência.",
    },
    TCAN: {
        nome: "Taxa de Conclusão Anual",
        definicao:
            "Percentual de ingressantes que concluíram o curso no ano de referência.",
    },
    TADA: {
        nome: "Taxa de Desistência Anual",
        definicao:
            "Percentual de ingressantes que desistiram do curso no ano de referência.",
    },
};

/** Um ano da turma com os 5 indicadores do INEP (% dos ingressantes). As
 * taxas anuais (TCAN, TADA) são o quanto a acumulada cresceu naquele ano —
 * a mesma definição do INEP (percentual dos ingressantes no ano). */
export interface PontoInep {
    anos: number;
    TAP: number;
    TCA: number;
    TDA: number;
    TCAN: number;
    TADA: number;
}

export function indicadoresInep(pontos: PontoTurma[]): PontoInep[] {
    let concluiu = 0;
    let desistiu = 0;
    return [...pontos]
        .sort((a, b) => a.anos - b.anos)
        .map((p) => {
            const ponto = {
                anos: p.anos,
                TAP: p.cursando,
                TCA: p.concluiu,
                TDA: p.desistiu,
                TCAN: Math.max(p.concluiu - concluiu, 0),
                TADA: Math.max(p.desistiu - desistiu, 0),
            };
            concluiu = p.concluiu;
            desistiu = p.desistiu;
            return ponto;
        });
}

/** Os 5 indicadores da média nacional, por anos desde o ingresso. */
export function indicadoresInepNacional(
    nacional: Map<number, PontoTurma>
): Map<number, PontoInep> {
    return new Map(indicadoresInep([...nacional.values()]).map((p) => [p.anos, p]));
}

/** A turma madura do resumo dos campi como uma ``Turma`` (pra reusar as
 * contas das turmas do campus aberto). */
export function turmaResumo(t: TrajetoriaResumo): Turma {
    return {
        ano: t.ano_ingresso,
        prazo: t.prazo_integralizacao,
        // sem o dado, peso 1 (as médias pesadas ignoram turma de peso 0)
        ingressantes: t.ingressantes || 1,
        pontos: pontosResumo(t),
        madura: true,
        ultimoAno: null,
        cursandoAgora: null,
    };
}

/** Os indicadores de um conjunto de turmas maduras (pesados pelos
 * ingressantes), pra pôr lado a lado: situação final (TCA, TDA, TAP), quem
 * concluiu no prazo, quem desistiu já no 1º ano e o tempo até concluir. */
export interface IndicadoresTurmas {
    concluiu: number | null;
    desistiu: number | null;
    cursando: number | null;
    noPrazo: number | null;
    desistiu1Ano: number | null;
    tempo: number | null;
    cursos: number;
}

export function indicadoresTurmas(turmas: Turma[]): IndicadoresTurmas {
    const final = situacaoFinalMedia(turmas);
    return {
        concluiu: final?.concluiu ?? null,
        desistiu: final?.desistiu ?? null,
        cursando: final?.cursando ?? null,
        noPrazo: conclusaoNoPrazo(turmas)?.noPrazo ?? null,
        desistiu1Ano: mediaPonderada(
            turmas.filter((t) => situacaoFinal(t)),
            (t) => pontoEm(t, 0)?.desistiu
        ),
        tempo: tempoMedioConclusao(turmas),
        cursos: turmas.length,
    };
}

/** As taxas anuais (TADA e TCAN) de cada ano do curso, até o ponto final de
 * cada turma, pesadas pelos ingressantes das turmas que chegam naquele ano. */
export function anuaisPorAno(
    turmas: Turma[]
): { anos: number; TADA: number; TCAN: number }[] {
    const porAno = new Map<number, { TADA: number; TCAN: number; peso: number }>();
    for (const t of turmas) {
        if (t.prazo === null || t.ingressantes <= 0) continue;
        for (const p of indicadoresInep(t.pontos)) {
            if (p.anos > anosFinal(t.prazo)) break;
            const soma = porAno.get(p.anos) ?? { TADA: 0, TCAN: 0, peso: 0 };
            soma.TADA += p.TADA * t.ingressantes;
            soma.TCAN += p.TCAN * t.ingressantes;
            soma.peso += t.ingressantes;
            porAno.set(p.anos, soma);
        }
    }
    return [...porAno.entries()]
        .sort(([a], [b]) => a - b)
        .map(([anos, s]) => ({ anos, TADA: s.TADA / s.peso, TCAN: s.TCAN / s.peso }));
}

/** A Taxa de Permanência (TAP) de cada ano do curso, até o ponto final de
 * cada turma, pesada pelos ingressantes das turmas que chegam naquele ano
 * (com uma turma só, é a curva dela). */
export function permanenciaPorAno(turmas: Turma[]): { anos: number; TAP: number }[] {
    const porAno = new Map<number, { soma: number; peso: number }>();
    for (const t of turmas) {
        if (t.prazo === null || t.ingressantes <= 0) continue;
        for (const p of t.pontos) {
            if (p.anos > anosFinal(t.prazo)) break;
            const s = porAno.get(p.anos) ?? { soma: 0, peso: 0 };
            s.soma += p.cursando * t.ingressantes;
            s.peso += t.ingressantes;
            porAno.set(p.anos, s);
        }
    }
    return [...porAno.entries()]
        .sort(([a], [b]) => a - b)
        .map(([anos, s]) => ({ anos, TAP: s.soma / s.peso }));
}
