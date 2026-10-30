import { COMPONENTES, faixaNumero, type ComponenteKey } from "@/lib/cpc";
import { media } from "@/lib/qualidade";
import type { ResumoCampi, ResumoCurso } from "@/types/dashboard";

export type Notas = Record<ComponenteKey, number | null>;

export const nomeCampus = (nome: string) =>
    nome.replace(/^UFC\s+(?:em|Campus)\s+/i, "");

/** Um campus resumido pra comparação entre campi: médias dos cursos com CPC
 * (avaliação mais recente de cada um) e as notas médias. */
export interface ResumoCampus {
    slug: string;
    nome: string;
    cursos: ResumoCurso[];
    comCpc: (ResumoCurso & { cpc_continuo: number })[];
    cpcMedio: number | null;
    enadeMedio: number | null;
    iddMedio: number | null;
    /** % dos cursos com faixa (1-5) que estão na 4 ou na 5. */
    pctAltas: number | null;
    notas: Notas;
}

const numeros = (valores: (number | null | undefined)[]) =>
    valores.filter((v): v is number => v !== null && v !== undefined);

export function resumirCampus(campus: ResumoCampi["campi"][number]): ResumoCampus {
    const comCpc = campus.cursos.filter(
        (c): c is ResumoCurso & { cpc_continuo: number } => c.cpc_continuo !== null
    );
    const faixas = [0, 0, 0, 0, 0, 0];
    for (const c of campus.cursos) {
        if (c.ano === null) continue;
        const f = faixaNumero(c.cpc_faixa);
        faixas[f === null ? 5 : f - 1]++;
    }
    const comFaixa = faixas.slice(0, 5).reduce((a, b) => a + b, 0);
    return {
        slug: campus.slug,
        nome: nomeCampus(campus.nome),
        cursos: campus.cursos,
        comCpc,
        cpcMedio: media(comCpc.map((c) => c.cpc_continuo)),
        enadeMedio: media(numeros(comCpc.map((c) => c.conceito_enade_continuo))),
        iddMedio: media(numeros(comCpc.map((c) => c.idd))),
        pctAltas: comFaixa > 0 ? (100 * (faixas[3] + faixas[4])) / comFaixa : null,
        notas: Object.fromEntries(
            COMPONENTES.map((comp) => [
                comp.key,
                media(numeros(comCpc.map((c) => c.notas?.[comp.key]))),
            ])
        ) as Notas,
    };
}

/** Áreas que os dois campi oferecem (com CPC nos dois): o melhor CPC de cada
 * campus na área. */
export function areasEmComum(
    a: ResumoCampus,
    b: ResumoCampus
): { area: string; a: number; b: number }[] {
    const melhor = (r: ResumoCampus) => {
        const m = new Map<string, number>();
        for (const c of r.comCpc) {
            if (!c.area_avaliacao) continue;
            m.set(
                c.area_avaliacao,
                Math.max(m.get(c.area_avaliacao) ?? -1, c.cpc_continuo)
            );
        }
        return m;
    };
    const ma = melhor(a);
    const mb = melhor(b);
    return [...ma]
        .filter(([area]) => mb.has(area))
        .map(([area, cpc]) => ({ area, a: cpc, b: mb.get(area)! }))
        .sort((x, y) => x.area.localeCompare(y.area, "pt-BR"));
}
