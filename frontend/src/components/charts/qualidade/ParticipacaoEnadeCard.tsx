import { Info, TriangleAlert } from "lucide-react";

import { Card } from "@/components/cards/Card";
import { useChartTheme } from "@/hooks/useChartTheme";
import { PARTICIPACAO_BAIXA } from "@/lib/cpc";
import { formatPercent } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";

/** Cada edição do Enade do curso: quantos concluintes
 * inscritos fizeram a prova. Participação baixa deixa o conceito menos
 * representativo da turma — sinalizada com ícone e texto. Em lg o card tem a
 * altura do vizinho ("Curso × média nacional"): a lista rola por dentro se
 * precisar, e o rodapé explica o corte. */
export function ParticipacaoEnadeCard({
    curso,
    className,
}: {
    curso: AvaliacaoCurso;
    className?: string;
}) {
    const CHART = useChartTheme();
    const ciclos = [...curso.historico].reverse();

    return (
        <Card
            expansivel
            title="Participação no Enade"
            subtitle="Concluintes inscritos que fizeram a prova, em cada edição"
            className={className}
        >
            {ciclos.length === 0 ? (
                <p className="text-text-muted mt-4 text-[13px]">
                    O curso ainda não teve concluintes avaliados pelo Enade.
                </p>
            ) : (
                <div className="relative mt-4 lg:min-h-[120px] lg:flex-1">
                    <ul className="flex [scrollbar-width:thin] flex-col gap-4 lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-2">
                        {ciclos.map((c) => {
                            const taxa = c.taxa_participacao;
                            const baixa = taxa !== null && taxa < PARTICIPACAO_BAIXA;
                            return (
                                <li key={c.ano} className="text-[13px]">
                                    <div className="flex items-center gap-3">
                                        <span className="w-10 font-semibold tabular-nums">
                                            {c.ano}
                                        </span>
                                        <span className="ml-auto flex items-center gap-1.5 font-semibold tabular-nums">
                                            {baixa && (
                                                <TriangleAlert
                                                    size={14}
                                                    strokeWidth={2.25}
                                                    className="text-status-critical-text"
                                                    aria-hidden
                                                />
                                            )}
                                            {taxa === null
                                                ? "—"
                                                : formatPercent(taxa, 0)}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-3">
                                        <span className="bg-page relative h-2 flex-1 overflow-hidden rounded-full">
                                            {taxa !== null && (
                                                <span
                                                    className="absolute inset-y-0 left-0 rounded-full"
                                                    style={{
                                                        width: `${Math.min(taxa, 100)}%`,
                                                        background: baixa
                                                            ? CHART.critical
                                                            : CHART.brand,
                                                    }}
                                                />
                                            )}
                                        </span>
                                        <span className="text-text-muted w-28 shrink-0 text-right text-[11px] tabular-nums">
                                            {c.n_concluintes_inscritos === null
                                                ? "sem dado"
                                                : `${c.n_concluintes_participantes ?? 0} de ${c.n_concluintes_inscritos} inscritos`}
                                        </span>
                                    </div>
                                    {baixa && (
                                        <p className="text-status-critical-text mt-1 text-[11px] font-medium">
                                            Participação baixa: o conceito representa
                                            menos a turma
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            <p className="text-text-muted mt-auto flex gap-2 pt-4 text-[11px] leading-snug">
                <Info
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                    className="mt-px shrink-0"
                />
                Participação abaixo de {PARTICIPACAO_BAIXA}% é sinalizada: com menos
                concluintes fazendo a prova, o conceito Enade (e o CPC) representa menos
                a turma. O corte é do painel, não do INEP.
            </p>
        </Card>
    );
}
