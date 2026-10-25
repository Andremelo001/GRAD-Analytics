import { chaveAreaAno, faixaNumero } from "@/lib/cpc";
import { toTitleCase } from "@/lib/format";
import type {
    Curso,
    DashboardData,
    EvolucaoCpcPonto,
    PerfilRadar,
    PerfilRadarNacional,
} from "@/types/dashboard";

/** Um ciclo do Enade com CPC calculado. */
export interface Ciclo {
    ano: number;
    cpc: number;
    faixa: number | null;
}

/** Um curso do campus na aba Qualidade: a avaliação mais recente (ano, CPC,
 * faixa, Enade, notas), a média nacional da mesma área no mesmo ano e o
 * ciclo anterior. ``ano === null`` = curso nunca avaliado. */
export interface AvaliacaoCurso {
    codigo: number;
    /** Nome de exibição (sem repetição: ver ``rotulosCursos``). */
    nome: string;
    /** O nome do curso como o INEP registra (nos seletores, com o código e
     * o grau embaixo). */
    nomeCurso: string;
    grau: string | null;
    area: string | null;
    ano: number | null;
    cpc: number | null;
    /** 1-5; null = sem conceito (SC, não reconhecido, sem avaliação). */
    faixa: number | null;
    enade: number | null;
    perfil: PerfilRadar | undefined;
    nacional: PerfilRadarNacional | undefined;
    cpcNacional: number | null;
    cursosNacional: number | null;
    anterior: Ciclo | null;
    /** Todas as edições do curso, da mais antiga à mais recente. */
    historico: EvolucaoCpcPonto[];
}

/** Nome de exibição de cada curso, sem repetição: o INEP registra cursos
 * diferentes com o mesmo nome no mesmo campus (turno, grau). Repetidos ganham
 * o grau quando ele os diferencia, e o código do curso quando nem isso basta. */
export function rotulosCursos(cursos: Curso[]): Map<number, string> {
    const chave = (c: Curso) => c.nome_curso.trim().toLocaleUpperCase("pt-BR");
    const grupos = new Map<string, Curso[]>();
    for (const c of cursos) grupos.set(chave(c), [...(grupos.get(chave(c)) ?? []), c]);
    const rotulos = new Map<number, string>();
    for (const grupo of grupos.values()) {
        const graus = new Set(grupo.map((c) => c.grau_academico));
        for (const c of grupo) {
            const partes = [toTitleCase(c.nome_curso)];
            if (graus.size > 1 && c.grau_academico) partes.push(c.grau_academico);
            const mesmoGrau = grupo.filter(
                (o) => graus.size === 1 || o.grau_academico === c.grau_academico
            );
            if (mesmoGrau.length > 1) partes.push(`cód. ${c.codigo_curso}`);
            rotulos.set(c.codigo_curso, partes.join(" · "));
        }
    }
    return rotulos;
}

export function buildAvaliacoes(data: DashboardData): AvaliacaoCurso[] {
    const rotulos = rotulosCursos(data.cursos);
    const { perfil_radar: perfis, evolucao_cpc: evolucao } = data.curso_perfil;
    const nacionalComp = new Map(
        data.medias_nacionais.perfil_radar.map((n) => [
            chaveAreaAno(n.area_avaliacao, n.ano),
            n,
        ])
    );
    const nacionalCpc = new Map(
        data.medias_nacionais.evolucao_cpc.map((n) => [
            chaveAreaAno(n.area_avaliacao, n.ano),
            n,
        ])
    );

    return data.cursos.map((curso) => {
        const perfil = perfis.find((p) => p.codigo_curso === curso.codigo_curso);
        const historico = evolucao
            .filter((e) => e.codigo_curso === curso.codigo_curso)
            .sort((a, b) => a.ano - b.ano);
        const nome = rotulos.get(curso.codigo_curso) ?? toTitleCase(curso.nome_curso);
        const nomeCurso = toTitleCase(curso.nome_curso);
        const grau = curso.grau_academico;
        if (!perfil) {
            return {
                codigo: curso.codigo_curso,
                nome,
                nomeCurso,
                grau,
                area: null,
                ano: null,
                cpc: null,
                faixa: null,
                enade: null,
                perfil: undefined,
                nacional: undefined,
                cpcNacional: null,
                cursosNacional: null,
                anterior: null,
                historico,
            };
        }
        const chave = chaveAreaAno(perfil.area_avaliacao, perfil.ano);
        const anterior = historico
            .filter((e) => e.ano < perfil.ano && e.cpc_continuo !== null)
            .at(-1);
        return {
            codigo: curso.codigo_curso,
            nome,
            nomeCurso,
            grau,
            area: perfil.area_avaliacao,
            ano: perfil.ano,
            cpc: perfil.cpc_continuo,
            faixa: faixaNumero(perfil.cpc_faixa),
            enade: perfil.conceito_enade_continuo,
            perfil,
            nacional: nacionalComp.get(chave),
            cpcNacional: nacionalCpc.get(chave)?.cpc_continuo_medio_nacional ?? null,
            cursosNacional:
                nacionalCpc.get(chave)?.quantidade_cursos_considerados ?? null,
            anterior: anterior
                ? {
                      ano: anterior.ano,
                      cpc: anterior.cpc_continuo!,
                      faixa: faixaNumero(anterior.cpc_faixa),
                  }
                : null,
            historico,
        };
    });
}

/** Cursos com CPC calculado na avaliação mais recente. */
export function comCpc(
    avaliacoes: AvaliacaoCurso[]
): (AvaliacaoCurso & { cpc: number; ano: number })[] {
    return avaliacoes.filter(
        (a): a is AvaliacaoCurso & { cpc: number; ano: number } =>
            a.cpc !== null && a.ano !== null
    );
}

export const media = (values: number[]): number | null =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

/** Os indicadores-resumo de qualidade do campus (os mesmos da Visão do
 * campus e dos cards do Início): CPC médio da avaliação mais recente de cada
 * curso e a média nacional das mesmas áreas nos mesmos anos (pareada: só
 * cursos com as duas pontas), e o % de cursos nas faixas 4 e 5 contra o
 * Brasil. As séries são o mesmo número "visto em cada ano": a avaliação mais
 * recente de cada curso até aquele ano. */
export interface ResumoQualidade {
    cpcMedio: number | null;
    cpcPareado: number | null;
    cpcNacional: number | null;
    pctAltas: number | null;
    pctAltasNacional: number | null;
    /** Conceito Enade contínuo médio (avaliação mais recente de cada curso)
     * e, pareado como o CPC, a média nacional das mesmas áreas e anos. */
    enadeMedio: number | null;
    enadePareado: number | null;
    enadeNacional: number | null;
    serieCpc: { ano: number; valor: number }[];
    serieAltas: { ano: number; valor: number }[];
}

export function resumoQualidade(
    avaliacoes: AvaliacaoCurso[],
    faixasNacional: { cpc_faixa: string; percentual_nacional: number }[]
): ResumoQualidade {
    const avaliados = comCpc(avaliacoes);
    const pareados = avaliados.filter((a) => a.cpcNacional !== null);
    const comEnade = avaliacoes.flatMap((a) =>
        a.enade === null ? [] : [{ enade: a.enade, nacional: a.nacional }]
    );
    const enadePares = comEnade.flatMap((a) => {
        const n = a.nacional?.conceito_enade_continuo;
        return n == null ? [] : [{ local: a.enade, nacional: n }];
    });
    const faixas = avaliacoes.map((a) => a.faixa).filter((f) => f !== null);
    const pct = (fs: number[]) =>
        fs.length > 0 ? (100 * fs.filter((f) => f >= 4).length) / fs.length : null;

    const anos = [
        ...new Set(avaliacoes.flatMap((a) => a.historico.map((h) => h.ano))),
    ].sort((x, y) => x - y);
    const serieCpc: { ano: number; valor: number }[] = [];
    const serieAltas: { ano: number; valor: number }[] = [];
    for (const ano of anos) {
        const ultimas = avaliacoes.flatMap((a) => {
            const h = a.historico.filter((e) => e.ano <= ano).at(-1);
            return h ? [h] : [];
        });
        const cpc = media(
            ultimas.flatMap((h) => (h.cpc_continuo === null ? [] : [h.cpc_continuo]))
        );
        const altas = pct(
            ultimas.flatMap((h) => {
                const f = faixaNumero(h.cpc_faixa);
                return f === null ? [] : [f];
            })
        );
        if (cpc !== null) serieCpc.push({ ano, valor: cpc });
        if (altas !== null) serieAltas.push({ ano, valor: altas });
    }

    return {
        cpcMedio: media(avaliados.map((a) => a.cpc)),
        cpcPareado: media(pareados.map((a) => a.cpc)),
        cpcNacional: media(pareados.map((a) => a.cpcNacional!)),
        pctAltas: pct(faixas),
        pctAltasNacional:
            faixasNacional.length > 0
                ? faixasNacional
                      .filter((f) => f.cpc_faixa === "4" || f.cpc_faixa === "5")
                      .reduce((total, f) => total + f.percentual_nacional, 0)
                : null,
        enadeMedio: media(comEnade.map((a) => a.enade)),
        enadePareado: media(enadePares.map((p) => p.local)),
        enadeNacional: media(enadePares.map((p) => p.nacional)),
        serieCpc,
        serieAltas,
    };
}
