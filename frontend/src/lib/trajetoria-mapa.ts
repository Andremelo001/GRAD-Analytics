import type { CursoTrajetoriaArea } from "@/hooks/useTrajetoriaArea";
import { formatPercent } from "@/lib/format";
import { INDICADORES_INEP, situacaoFinal } from "@/lib/trajetoria";

export type IndicadorMapa = "TAP" | "TCA" | "TDA";

/** Os indicadores do Mapa da Trajetória: a situação final da turma madura
 * de cada curso (``prazo + 1`` anos depois do ingresso), em % dos
 * ingressantes. Na desistência, menor é melhor (o ranking inverte). */
export const INDICADORES_MAPA: Record<
    IndicadorMapa,
    {
        /** No seletor, no KPI e na dica do mapa. */
        label: string;
        /** Nas frases ("cursos com …"). */
        nome: string;
        /** Título da lista dos melhores. */
        melhores: string;
        maiorMelhor: boolean;
        doCurso: (c: CursoTrajetoriaArea) => number | null;
    }
> = {
    TCA: {
        label: INDICADORES_INEP.TCA.nome,
        nome: "conclusão",
        melhores: "Maiores taxas de conclusão",
        maiorMelhor: true,
        doCurso: (c) => situacaoFinal(c.turma)?.concluiu ?? null,
    },
    TDA: {
        label: INDICADORES_INEP.TDA.nome,
        nome: "desistência",
        melhores: "Menores taxas de desistência",
        maiorMelhor: false,
        doCurso: (c) => situacaoFinal(c.turma)?.desistiu ?? null,
    },
    TAP: {
        label: INDICADORES_INEP.TAP.nome,
        nome: "permanência",
        melhores: "Maiores taxas de permanência",
        maiorMelhor: true,
        doCurso: (c) => situacaoFinal(c.turma)?.cursando ?? null,
    },
};

const CHAVES = Object.keys(INDICADORES_MAPA) as IndicadorMapa[];

/** Turmas menores que isso ficam fora da lista dos melhores: com poucos
 * ingressantes a taxa vai fácil a 0% ou 100% e não diz muito. */
export const MIN_INGRESSANTES_RANKING = 10;

/** Resumo de um conjunto de cursos (Brasil, um estado, um município). */
export interface ResumoTrajetoria {
    cursos: number;
    ingressantes: number;
    /** Média de cada indicador, pesada pelos ingressantes (turma maior pesa
     * mais), só nos cursos com valor. */
    medias: Record<IndicadorMapa, number | null>;
}

const porIndicador = <T>(f: (i: IndicadorMapa) => T) =>
    Object.fromEntries(CHAVES.map((i) => [i, f(i)])) as Record<IndicadorMapa, T>;

export function resumirTrajetoria(cursos: CursoTrajetoriaArea[]): ResumoTrajetoria {
    return {
        cursos: cursos.length,
        ingressantes: cursos.reduce((t, c) => t + c.turma.ingressantes, 0),
        medias: porIndicador((i) => {
            let soma = 0;
            let peso = 0;
            for (const c of cursos) {
                const v = INDICADORES_MAPA[i].doCurso(c);
                if (v === null || c.turma.ingressantes <= 0) continue;
                soma += v * c.turma.ingressantes;
                peso += c.turma.ingressantes;
            }
            return peso > 0 ? soma / peso : null;
        }),
    };
}

export function agruparTrajetoria<K>(
    cursos: CursoTrajetoriaArea[],
    chave: (c: CursoTrajetoriaArea) => K
) {
    const grupos = new Map<K, CursoTrajetoriaArea[]>();
    for (const c of cursos) {
        const k = chave(c);
        grupos.set(k, [...(grupos.get(k) ?? []), c]);
    }
    return grupos;
}

/** Melhores primeiro no indicador (sem valor no fim); na desistência, a
 * menor primeiro. */
export function rankingTrajetoria(
    cursos: CursoTrajetoriaArea[],
    indicador: IndicadorMapa
): CursoTrajetoriaArea[] {
    const { doCurso, maiorMelhor } = INDICADORES_MAPA[indicador];
    const chave = (c: CursoTrajetoriaArea) => {
        const v = doCurso(c);
        return v === null ? -Infinity : maiorMelhor ? v : -v;
    };
    return [...cursos].sort((a, b) => chave(b) - chave(a));
}

export const formatTaxa = (v: number | null) =>
    v === null ? "—" : formatPercent(v, 1);
