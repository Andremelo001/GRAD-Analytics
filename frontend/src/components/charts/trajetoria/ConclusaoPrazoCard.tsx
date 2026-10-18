import { useState } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { DataTable } from "@/components/charts/DataTable";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatDecimal, formatPercent } from "@/lib/format";
import {
    conclusaoNoPrazo,
    maduras,
    tempoMedioConclusao,
    type ConclusaoPrazo,
    type CursoTrajetoria,
} from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

const FAIXAS: { chave: keyof ConclusaoPrazo; rotulo: string; concluiu: boolean }[] = [
    { chave: "noPrazo", rotulo: "No prazo", concluiu: true },
    { chave: "atraso1", rotulo: "Com 1 ano de atraso", concluiu: true },
    { chave: "atraso2", rotulo: "Com 2 anos de atraso", concluiu: true },
    { chave: "naoConcluiu", rotulo: "Não concluiu", concluiu: false },
];

/** Conclusão no prazo e com atraso: das turmas maduras do curso (% dos
 * ingressantes, pesado pelas turmas), quantos se formaram no prazo previsto,
 * com 1 e com 2 anos de atraso, e quantos não concluíram até dois anos depois
 * do prazo. O traço em cada barra é a média do campus, pra comparar. Passar
 * o mouse numa linha a destaca. */
export function ConclusaoPrazoCard({
    curso,
    cursos,
    className,
}: {
    curso: CursoTrajetoria;
    cursos: CursoTrajetoria[];
    className?: string;
}) {
    const CHART = useChartTheme();
    const [foco, setFoco] = useState<string | null>(null);
    const valores = conclusaoNoPrazo(maduras(curso));
    const campus = conclusaoNoPrazo(cursos.flatMap(maduras));
    const tempo = tempoMedioConclusao(maduras(curso));
    const qtdMaduras = maduras(curso).length;

    return (
        <Card
            expansivel
            title="Conclusão no prazo"
            info="Nas turmas maduras, quantos concluíram dentro do prazo, com um ou dois anos de atraso, ou não concluíram até dois anos depois do prazo."
            subtitle={`Taxa de Conclusão Acumulada (TCA) das ${qtdMaduras} turmas maduras, por ano de atraso`}
            className={className}
        >
            {!valores ? (
                <p className="text-text-secondary mt-4 text-[13px]">
                    Este curso ainda não tem turma madura.
                </p>
            ) : (
                <>
                    <div className="mt-4 flex items-baseline gap-2">
                        <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                            {formatPercent(valores.noPrazo, 0)}
                        </p>
                        <p className="text-text-secondary text-[13px]">
                            se formam no prazo
                            {curso.prazo ? ` de ${curso.prazo} anos` : ""}
                        </p>
                    </div>
                    <ul
                        className="mt-5 flex flex-1 flex-col justify-around gap-4"
                        onMouseLeave={() => setFoco(null)}
                    >
                        {FAIXAS.map((f) => {
                            const v = valores[f.chave];
                            const c = campus?.[f.chave];
                            const cor = f.concluiu ? CHART.brand : CHART.reference;
                            return (
                                <li
                                    key={f.chave}
                                    onMouseEnter={() => setFoco(f.chave)}
                                    className={cn(
                                        "transition-opacity duration-200",
                                        foco !== null &&
                                            foco !== f.chave &&
                                            "opacity-40"
                                    )}
                                >
                                    <div className="flex items-baseline justify-between gap-3 text-[12px]">
                                        <span className="font-medium">{f.rotulo}</span>
                                        <span className="font-semibold tabular-nums">
                                            {formatPercent(v, 0)}
                                        </span>
                                    </div>
                                    <div className="bg-page relative mt-1.5 h-3 rounded-full">
                                        <span
                                            className="absolute inset-y-0 left-0 rounded-full"
                                            style={{
                                                width: `${Math.max(Math.min(v, 100), 0)}%`,
                                                background: cor,
                                                opacity:
                                                    f.chave === "noPrazo" ? 1 : 0.75,
                                            }}
                                        />
                                        {c !== undefined && (
                                            <span
                                                aria-hidden
                                                title={`Campus: ${formatPercent(c, 0)}`}
                                                className="bg-ink absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full"
                                                style={{
                                                    left: `${Math.max(Math.min(c, 100), 0)}%`,
                                                }}
                                            />
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="text-text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="bg-ink h-3 w-0.5 rounded-full"
                            />
                            média do campus
                        </span>
                        {tempo !== null && (
                            <span>
                                Quem conclui leva, em média,{" "}
                                <span className="text-ink font-semibold">
                                    {formatDecimal(tempo, 1)} anos
                                </span>
                            </span>
                        )}
                    </div>
                </>
            )}
            <NotaRodape>
                Só turmas maduras (acompanhadas até dois anos depois do prazo); quem
                concluiu depois disso conta como "não concluiu".
            </NotaRodape>
            <div className="sr-only">
                {valores && (
                    <DataTable
                        columns={["Situação", "Curso", "Campus"]}
                        rows={FAIXAS.map((f) => [
                            f.rotulo,
                            formatPercent(valores[f.chave], 0),
                            campus ? formatPercent(campus[f.chave], 0) : "—",
                        ])}
                    />
                )}
            </div>
        </Card>
    );
}
