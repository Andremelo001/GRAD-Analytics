import { COMPONENTES, faixaDe, type ComponenteKey } from "@/lib/cpc";
import { siglaValida } from "@/lib/curso";
import { formatDecimal, toTitleCase } from "@/lib/format";
import { media } from "@/lib/qualidade";
import type { AreaArquivo } from "@/types/qualidade-area";

/** Uma edição do Enade de um curso (CPC e participação). */
export interface Edicao {
    ano: number;
    cpc: number | null;
    faixa: number | null;
    inscritos: number | null;
    participantes: number | null;
}

/** Um curso do Brasil numa área de avaliação (edição mais recente). */
export interface CursoArea {
    codigo: number;
    ies: number;
    nomeIes: string;
    siglaIes: string | null;
    publica: boolean | null;
    municipio: number;
    nomeMunicipio: string;
    uf: string;
    ead: boolean;
    cpc: number | null;
    faixa: number | null;
    /** Conceito Enade contínuo (0-5). */
    enade: number | null;
    notas: Record<ComponenteKey, number | null>;
    /** Da IES do painel (UFC). */
    destaque: boolean;
    /** Todas as edições do curso, da mais antiga à mais recente. */
    historico: Edicao[];
}

/** Desfaz o formato colunar do JSON da área. */
export function parseArea(arquivo: AreaArquivo): CursoArea[] {
    const col = Object.fromEntries(arquivo.colunas.map((c, i) => [c, i]));
    const ed = Object.fromEntries(arquivo.colunas_edicao.map((c, i) => [c, i]));
    return arquivo.cursos.flatMap((linha) => {
        const get = (nome: string) => linha[col[nome]];
        const ies = Number(get("codigo_ies"));
        const municipio = Number(get("codigo_municipio"));
        const [nomeIes, siglaIes, publica] = arquivo.ies[String(ies)] ?? [
            null,
            null,
            null,
        ];
        const [nomeMunicipio, uf] = arquivo.municipios[String(municipio)] ?? [
            null,
            null,
        ];
        if (!uf) return [];
        const notas = Object.fromEntries(
            COMPONENTES.map((c) => [c.key, get(c.key) as number | null])
        ) as Record<ComponenteKey, number | null>;
        return [
            {
                codigo: Number(get("codigo_curso")),
                ies,
                nomeIes: nomeIes ? toTitleCase(nomeIes) : "Instituição sem nome",
                siglaIes: siglaValida(siglaIes),
                publica,
                municipio,
                nomeMunicipio: nomeMunicipio ? toTitleCase(nomeMunicipio) : "—",
                uf,
                ead: Boolean(get("ead")),
                cpc: get("cpc_continuo") as number | null,
                faixa: get("cpc_faixa") as number | null,
                enade: (get("conceito_enade_continuo") ?? null) as number | null,
                notas,
                destaque: ies === arquivo.codigo_ies_destaque,
                historico: ((get("historico") ?? []) as (number | null)[][]).map(
                    (e) => ({
                        ano: e[ed.ano] as number,
                        cpc: e[ed.cpc_continuo],
                        faixa: e[ed.cpc_faixa],
                        inscritos: e[ed.n_concluintes_inscritos],
                        participantes: e[ed.n_concluintes_participantes],
                    })
                ),
            },
        ];
    });
}

export type Indicador = "cpc" | "idd" | "enade";

/** Os indicadores do Mapa: o valor contínuo (0-5) de cada curso e a faixa
 * dele (1-5). O CPC traz a faixa oficial; IDD e Conceito Enade usam os
 * mesmos cortes do INEP sobre o valor contínuo (a base não traz a faixa
 * deles). */
export const INDICADORES: Record<
    Indicador,
    {
        /** No seletor e no KPI ("CPC médio"). */
        label: string;
        /** Nas frases ("cursos com CPC"). */
        nome: string;
        /** "Melhores CPCs". */
        plural: string;
        doCurso: (c: CursoArea) => number | null;
        faixaDoCurso: (c: CursoArea) => number | null;
        valor: (r: ResumoArea) => number | null;
    }
> = {
    cpc: {
        label: "CPC médio",
        nome: "CPC",
        plural: "CPCs",
        doCurso: (c) => c.cpc,
        faixaDoCurso: (c) => c.faixa,
        valor: (r) => r.medias.cpc,
    },
    idd: {
        label: "IDD médio",
        nome: "IDD",
        plural: "IDDs",
        doCurso: (c) => c.notas.idd,
        faixaDoCurso: (c) => (c.notas.idd === null ? null : faixaDe(c.notas.idd)),
        valor: (r) => r.medias.idd,
    },
    enade: {
        label: "Conceito Enade médio",
        nome: "Conceito Enade",
        plural: "Conceitos Enade",
        doCurso: (c) => c.enade,
        faixaDoCurso: (c) => (c.enade === null ? null : faixaDe(c.enade)),
        valor: (r) => r.medias.enade,
    },
};

const CHAVES = Object.keys(INDICADORES) as Indicador[];

/** Resumo de um conjunto de cursos (Brasil, um estado, um município). */
export interface ResumoArea {
    cursos: number;
    /** Média de cada indicador (só os cursos com valor). */
    medias: Record<Indicador, number | null>;
    /** % dos cursos com faixa que estão na 4 ou na 5, por indicador. */
    pctAltas: Record<Indicador, number | null>;
    /** Quantos cursos em cada faixa, por indicador: índices 0-4 = faixas
     * 1-5, 5 = sem conceito. */
    faixas: Record<Indicador, number[]>;
    notas: Record<ComponenteKey, number | null>;
}

const valores = (cursos: CursoArea[], get: (c: CursoArea) => number | null) =>
    cursos.flatMap((c) => {
        const v = get(c);
        return v === null ? [] : [v];
    });

const porIndicador = <T>(f: (i: Indicador) => T) =>
    Object.fromEntries(CHAVES.map((i) => [i, f(i)])) as Record<Indicador, T>;

export function resumir(cursos: CursoArea[]): ResumoArea {
    const faixas = porIndicador((i) => {
        const n = [0, 0, 0, 0, 0, 0];
        for (const c of cursos) {
            const f = INDICADORES[i].faixaDoCurso(c);
            n[f === null ? 5 : f - 1]++;
        }
        return n;
    });
    return {
        cursos: cursos.length,
        medias: porIndicador((i) => media(valores(cursos, INDICADORES[i].doCurso))),
        pctAltas: porIndicador((i) => {
            const f = faixas[i];
            const comFaixa = f.slice(0, 5).reduce((a, b) => a + b, 0);
            return comFaixa > 0 ? (100 * (f[3] + f[4])) / comFaixa : null;
        }),
        faixas,
        notas: Object.fromEntries(
            COMPONENTES.map((comp) => [
                comp.key,
                media(valores(cursos, (c) => c.notas[comp.key])),
            ])
        ) as Record<ComponenteKey, number | null>,
    };
}

export function agrupar<K>(cursos: CursoArea[], chave: (c: CursoArea) => K) {
    const grupos = new Map<K, CursoArea[]>();
    for (const c of cursos) {
        const k = chave(c);
        grupos.set(k, [...(grupos.get(k) ?? []), c]);
    }
    return grupos;
}

export type Rede = "todas" | "publicas" | "privadas";

/** Rótulo curto de cada rede, pro seletor (o longo vai no subtítulo). */
export const REDES_CURTO: Record<Rede, string> = {
    todas: "Todas",
    publicas: "Públicas",
    privadas: "Privadas",
};

export const REDES: Record<Rede, string> = {
    todas: "Todas as redes",
    publicas: "Públicas",
    privadas: "Privadas",
};

export function filtrar(cursos: CursoArea[], rede: Rede, ead: boolean): CursoArea[] {
    return cursos.filter(
        (c) =>
            c.ead === ead &&
            (rede === "todas" ||
                (rede === "publicas" ? c.publica === true : c.publica === false))
    );
}

/** Melhores primeiro no indicador (sem valor no fim). */
export function ranking(cursos: CursoArea[], indicador: Indicador): CursoArea[] {
    const v = INDICADORES[indicador].doCurso;
    return [...cursos].sort((a, b) => (v(b) ?? -1) - (v(a) ?? -1));
}

/** Os três indicadores são notas de 0 a 5. */
export function formatIndicador(valor: number | null): string {
    return valor === null ? "—" : formatDecimal(valor);
}
