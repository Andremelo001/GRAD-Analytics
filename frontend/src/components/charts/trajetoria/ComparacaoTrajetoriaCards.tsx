import type { ReactNode } from "react";

import {
    EspelhoCard,
    LadoALadoCard,
    type Lados,
} from "@/components/charts/qualidade/ComparacaoCards";
import {
    PermanenciaLadosCard,
    SituacaoLadosCard,
    type LadoTrajetoria,
} from "@/components/charts/trajetoria/LadosTrajetoriaCards";
import { formatDecimal, formatPercent } from "@/lib/format";
import {
    anuaisPorAno,
    indicadoresTurmas,
    permanenciaPorAno,
    situacaoFinalMedia,
    type Turma,
} from "@/lib/trajetoria";

const pct = (v: number) => formatPercent(v, 0);

/** As duas linhas de cards na mesma grade (11 : 13): os da esquerda
 * (indicadores, situação final) com a mesma largura, e os da direita
 * (desistência, permanência) também. */
const GRADE =
    "grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-[minmax(0,11fr)_minmax(0,13fr)] lg:gap-6";

/** Os dois cards do topo das Comparações da Trajetória, no formato dos da
 * Qualidade: os indicadores lado a lado (situação final das turmas maduras,
 * conclusão no prazo, desistência no 1º ano e tempo até concluir) e a
 * desistência de cada ano do curso em barras espelhadas. ``a`` e ``b`` são
 * as turmas maduras de cada lado (a mais recente de cada curso). */
export function IndicadoresTrajetoriaCards({
    lados,
    a,
    b,
    titulo,
    contarCursos = false,
    agregado = true,
    rodape,
}: {
    lados: Lados;
    a: Turma[];
    b: Turma[];
    titulo: string;
    /** Mostra quantos cursos entram em cada lado (só entre campi: do lado
     * Brasil, são os mesmos cursos). */
    contarCursos?: boolean;
    /** Cada lado junta vários cursos (médias pesadas); ``false``: um curso. */
    agregado?: boolean;
    rodape: ReactNode;
}) {
    const ia = indicadoresTurmas(a);
    const ib = indicadoresTurmas(b);
    const anuaisA = new Map(anuaisPorAno(a).map((p) => [p.anos, p.TADA]));
    const anuaisB = new Map(anuaisPorAno(b).map((p) => [p.anos, p.TADA]));
    const anos = [...new Set([...anuaisA.keys(), ...anuaisB.keys()])].sort(
        (x, y) => x - y
    );
    // escala comum aos dois lados, arredondada pra cima de 5 em 5 pontos
    const maior = Math.max(...anuaisA.values(), ...anuaisB.values(), 5);
    const maximo = Math.ceil(maior / 5) * 5;

    return (
        // lado a lado com a mesma altura
        <div className={GRADE}>
            <LadoALadoCard
                titulo={titulo}
                subtitulo="Turma madura mais recente de cada curso"
                info="Situação final das turmas maduras (conclusão TCA, desistência TDA, permanência TAP), conclusão no prazo, desistência no 1º ano e tempo até concluir, lado a lado. O ✓ marca o lado à frente em cada linha."
                lados={lados}
                linhas={[
                    {
                        label: "Concluíram (TCA)",
                        a: ia.concluiu,
                        b: ib.concluiu,
                        formato: pct,
                    },
                    {
                        label: "Desistiram (TDA)",
                        a: ia.desistiu,
                        b: ib.desistiu,
                        formato: pct,
                        maiorMelhor: false,
                    },
                    {
                        label: "Ainda cursando (TAP)",
                        a: ia.cursando,
                        b: ib.cursando,
                        formato: pct,
                        neutro: true,
                    },
                    {
                        label: "Concluíram no prazo",
                        a: ia.noPrazo,
                        b: ib.noPrazo,
                        formato: pct,
                    },
                    {
                        label: "Desistiram no 1º ano",
                        a: ia.desistiu1Ano,
                        b: ib.desistiu1Ano,
                        formato: pct,
                        maiorMelhor: false,
                    },
                    {
                        label: "Tempo até concluir",
                        a: ia.tempo,
                        b: ib.tempo,
                        formato: (v) => `${formatDecimal(v, 1)} anos`,
                        maiorMelhor: false,
                    },
                    ...(contarCursos
                        ? [
                              {
                                  label: "Cursos com turma madura",
                                  a: ia.cursos,
                                  b: ib.cursos,
                                  formato: (v: number) => String(v),
                                  neutro: true,
                              },
                          ]
                        : []),
                ]}
                rodape={rodape}
            />
            <EspelhoCard
                titulo="Desistência a cada ano do curso"
                info="A Taxa de Desistência Anual (TADA) em cada ano do curso, lado a lado: em que anos cada lado perde mais alunos."
                subtitulo="% dos ingressantes que desistiram em cada ano (TADA)"
                lados={lados}
                coluna="Ano do curso"
                linhas={anos.map((n) => ({
                    key: String(n),
                    nome: `${n + 1}º ano`,
                    curto: `${n + 1}º`,
                    a: anuaisA.get(n) ?? null,
                    b: anuaisB.get(n) ?? null,
                }))}
                maximo={maximo}
                formato={(v) => formatPercent(v, 1)}
                maiorMelhor={false}
                rodape={
                    agregado
                        ? "Médias pesadas pelos ingressantes, até dois anos depois do prazo de cada curso: nos últimos anos entram só os cursos mais longos. Desistência inclui transferência para outro curso."
                        : "Até dois anos depois do prazo de cada curso. Desistência inclui transferência para outro curso."
                }
            />
        </div>
    );
}

/** A segunda linha das comparações A × B: situação final e permanência ano a
 * ano de cada lado. ``agregado``: cada lado é um campus (média das turmas
 * maduras dos cursos, pesada pelos ingressantes); senão, um curso. */
export function SituacaoPermanenciaCards({
    lados,
    a,
    b,
    agregado,
}: {
    lados: Lados;
    a: Turma[];
    b: Turma[];
    agregado: boolean;
}) {
    const lado = (l: "a" | "b", turmas: Turma[]): LadoTrajetoria => ({
        lado: l,
        nome: lados[l],
        detalhe:
            !agregado && turmas.length === 1 ? `turma ${turmas[0].ano}` : undefined,
        final: situacaoFinalMedia(turmas),
        permanencia: permanenciaPorAno(turmas),
    });
    const itens = [lado("a", a), lado("b", b)];
    return (
        <div className={GRADE}>
            <SituacaoLadosCard
                itens={itens}
                subtitulo={
                    agregado
                        ? "Média das turmas maduras dos cursos, dois anos depois do prazo"
                        : "Turma madura de cada curso, dois anos depois do prazo"
                }
                rodape="Desistência inclui transferência para outro curso, inclusive dentro da mesma instituição."
            />
            <PermanenciaLadosCard
                itens={itens}
                subtitulo="Taxa de Permanência (TAP): % dos ingressantes ainda no curso"
                rodape={
                    agregado
                        ? "Média pesada pelos ingressantes: nos últimos anos entram só os cursos mais longos."
                        : "Cada curso tem a própria turma madura (os anos de ingresso podem ser diferentes)."
                }
            />
        </div>
    );
}
