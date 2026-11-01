import { COMPONENTES, faixaNumero, type ComponenteKey } from "@/lib/cpc";
import { media } from "@/lib/qualidade";
import type { ResumoUnidades, ResumoCurso } from "@/types/dashboard";

export type Notas = Record<ComponenteKey, number | null>;

/** Nome curto de uma unidade, pra frases, botões e comparações: a sigla do
 * SIGAA com o município ("CCA (Fortaleza)"); sem unidade no SIGAA, só a
 * cidade ("Fortaleza", de "UFC em Fortaleza"). Nas listas de escolha vai o
 * rótulo inteiro (``nome``), com a localidade embaixo. */
export function nomeUnidade(unidade: {
    nome: string;
    sigla?: string | null;
    localidade?: string | null;
}): string {
    if (unidade.sigla)
        return unidade.localidade
            ? `${unidade.sigla} (${unidade.localidade})`
            : unidade.sigla;
    return unidade.nome.replace(/^UFC\s+(?:em|Unidade)\s+/i, "");
}

/** Uma unidade resumida pra comparação entre unidades: médias dos cursos com CPC
 * (avaliação mais recente de cada um) e as notas médias. */
export interface ResumoUnidade {
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

export function resumirUnidade(
    unidade: ResumoUnidades["unidades"][number]
): ResumoUnidade {
    const comCpc = unidade.cursos.filter(
        (c): c is ResumoCurso & { cpc_continuo: number } => c.cpc_continuo !== null
    );
    const faixas = [0, 0, 0, 0, 0, 0];
    for (const c of unidade.cursos) {
        if (c.ano === null) continue;
        const f = faixaNumero(c.cpc_faixa);
        faixas[f === null ? 5 : f - 1]++;
    }
    const comFaixa = faixas.slice(0, 5).reduce((a, b) => a + b, 0);
    return {
        slug: unidade.slug,
        nome: nomeUnidade(unidade),
        cursos: unidade.cursos,
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

/** Áreas que as duas unidades oferecem (com CPC nos dois): o melhor CPC de cada
 * unidade na área. */
export function areasEmComum(
    a: ResumoUnidade,
    b: ResumoUnidade
): { area: string; a: number; b: number }[] {
    const melhor = (r: ResumoUnidade) => {
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
