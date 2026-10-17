import { Card } from "@/components/cards/Card";
import { DataTable } from "@/components/charts/DataTable";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { COMPONENTES, notaDe } from "@/lib/cpc";
import { formatDecimal } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";

/** Curso × média nacional (mesma área, mesmo ano) em cada componente, em
 * halteres numa escala de 0 a 5: ponto cheio = curso, vazado = Brasil, a
 * haste é a distância. Ordenado do mais abaixo da média ao mais acima. */
export function ComponentesDumbbellCard({
    curso,
    className,
}: {
    curso: AvaliacaoCurso;
    className?: string;
}) {
    const CHART = useChartTheme();
    const linhas = COMPONENTES.flatMap((c) => {
        const nota = notaDe(curso.perfil, c.key);
        if (nota === null) return [];
        const nacional = notaDe(curso.nacional, c.key);
        return [
            { c, nota, nacional, diff: nacional === null ? null : nota - nacional },
        ];
    }).sort((a, b) => (a.diff ?? Infinity) - (b.diff ?? Infinity));
    const pct = (v: number) => `${(v / 5) * 100}%`;

    return (
        <Card
            expansivel
            title="Curso × média nacional"
            subtitle={`Nota de cada componente e a média dos cursos da área em ${curso.ano}`}
            className={className}
        >
            <div className="text-text-muted mt-3 flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                    <span aria-hidden className="bg-ink h-2.5 w-2.5 rounded-full" />
                    curso
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full border-2"
                        style={{ borderColor: CHART.reference }}
                    />
                    média nacional
                </span>
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_76px] items-center gap-x-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_84px]">
                <span className="hidden sm:block" />
                <span className="text-text-muted relative mb-1 h-4 text-[10px]">
                    {[0, 1, 2, 3, 4, 5].map((t) => (
                        <span
                            key={t}
                            className="absolute -translate-x-1/2 tabular-nums"
                            style={{ left: pct(t) }}
                        >
                            {t}
                        </span>
                    ))}
                </span>
                <span />
                {linhas.map(({ c, nota, nacional, diff }) => {
                    const cor =
                        diff === null || diff >= 0 ? CHART.brand : CHART.critical;
                    return (
                        <div
                            key={c.key}
                            className="contents"
                            title={`${c.nome}: curso ${formatDecimal(nota)}${nacional === null ? "" : ` · média nacional ${formatDecimal(nacional)}`}`}
                        >
                            <span className="col-span-2 truncate pt-2 text-[12px] font-medium sm:col-span-1 sm:py-2">
                                {c.nome}
                            </span>
                            <span className="relative h-full min-h-7">
                                <span
                                    aria-hidden
                                    className="absolute inset-x-0 top-1/2 h-px"
                                    style={{ background: CHART.deemphasis }}
                                />
                                {nacional !== null && (
                                    <span
                                        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                                        style={{
                                            left: pct(Math.min(nota, nacional)),
                                            width: pct(Math.abs(nota - nacional)),
                                            background: cor,
                                        }}
                                    />
                                )}
                                {nacional !== null && (
                                    <span
                                        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                                        style={{
                                            left: pct(nacional),
                                            borderColor: CHART.reference,
                                            background: CHART.surface,
                                        }}
                                    />
                                )}
                                <span
                                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                                    style={{ left: pct(nota), background: CHART.ink }}
                                />
                            </span>
                            <span className="flex justify-end">
                                {diff === null ? (
                                    <span className="text-text-muted text-[11px]">
                                        sem média
                                    </span>
                                ) : (
                                    <DeltaPill size="sm" diff={diff} />
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="sr-only">
                <DataTable
                    columns={["Componente", "Curso", "Média nacional"]}
                    rows={linhas.map(({ c, nota, nacional }) => [
                        c.nome,
                        formatDecimal(nota),
                        nacional === null ? "—" : formatDecimal(nacional),
                    ])}
                />
            </div>
        </Card>
    );
}
