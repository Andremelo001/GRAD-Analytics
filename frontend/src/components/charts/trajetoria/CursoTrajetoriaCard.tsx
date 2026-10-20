import type { ReactNode } from "react";

import { Card } from "@/components/cards/Card";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { TurmaInline } from "@/components/charts/trajetoria/TurmaInline";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { opcaoCurso } from "@/lib/curso";
import { formatInteger, formatPercent, formatPoints } from "@/lib/format";
import {
    anosFinal,
    curvaNacional,
    evasaoPorAnoDoCurso,
    maduras,
    situacaoFinal,
    type CursoTrajetoria,
    type Turma,
} from "@/lib/trajetoria";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/types/dashboard";

/** Cabeçalho da sub-aba Por curso da Trajetória: o curso (com o seletor com
 * busca), a turma (ano de ingresso — a mesma dos cards da página) e os
 * números principais — prazo, ingressantes por turma, conclusão da turma
 * contra o Brasil e quanto da evasão é no 1º ano. Mesmo formato do cabeçalho
 * de Qualidade → Por curso. */
export function CursoTrajetoriaCard({
    data,
    curso,
    cursos,
    turma,
    onChange,
    onTurma,
    className,
}: {
    data: DashboardData;
    curso: CursoTrajetoria;
    cursos: CursoTrajetoria[];
    turma: Turma;
    onChange: (codigo: number) => void;
    onTurma: (ano: number) => void;
    className?: string;
}) {
    const CHART = useChartTheme();
    // conclusão da turma escolhida: madura, no ponto final (prazo + 2 anos);
    // em andamento, no último ano acompanhado — e o Brasil no mesmo ponto
    const ponto = turma.madura ? situacaoFinal(turma) : turma.pontos.at(-1);
    const final = ponto;
    const nacional = ponto
        ? curvaNacional(data, curso.area).get(
              turma.madura && turma.prazo !== null ? anosFinal(turma.prazo) : ponto.anos
          )
        : undefined;
    const mediaIngressantes =
        curso.turmas.length > 0
            ? curso.turmas.reduce((t, x) => t + x.ingressantes, 0) / curso.turmas.length
            : null;
    const primeiroAno = evasaoPorAnoDoCurso(maduras(curso))[0];

    return (
        <Card className={cn("relative", className)}>
            {/* enfeite: os mesmos pontinhos do cabeçalho de Qualidade → Por
                curso, numa camada recortada própria (a lista do seletor não
                pode ser cortada) */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
            >
                <span
                    className="pontilhado absolute inset-y-0 right-0 w-4/5"
                    style={{
                        backgroundSize: "18px 18px",
                        maskImage:
                            "linear-gradient(to left, black 10%, transparent 100%)",
                    }}
                />
            </span>
            <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-0 flex-1 basis-64">
                    <p className="text-text-muted text-[12px]">
                        {curso.area ? `Área: ${curso.area}` : "Sem área"} ·{" "}
                        {curso.turmas.length}{" "}
                        {curso.turmas.length === 1
                            ? "turma acompanhada"
                            : "turmas acompanhadas"}
                    </p>
                    <h2 className="mt-1 truncate text-[22px] leading-tight font-semibold tracking-[-0.02em]">
                        {curso.nome}
                    </h2>
                </div>
                {/* a turma, como frase (o seletor "inline" do Mapa da
                    Qualidade), ao lado do seletor de curso */}
                <div className="text-text-secondary flex h-10 items-center gap-1.5 self-start text-[13px] whitespace-nowrap sm:ml-auto">
                    Turma de
                    <TurmaInline
                        turmas={curso.turmas}
                        valor={turma.ano}
                        onChange={(a) => typeof a === "number" && onTurma(a)}
                    />
                </div>
                <div className="w-full sm:w-80">
                    <CursoBusca
                        label="Curso"
                        cor={CHART.brand}
                        value={String(curso.codigo)}
                        options={cursos.map((c) =>
                            opcaoCurso({
                                codigo: c.codigo,
                                nome: c.nomeCurso,
                                grau: c.grau,
                            })
                        )}
                        onChange={(v) => onChange(Number(v))}
                        placeholder="Buscar curso…"
                    />
                </div>
            </div>

            <dl className="relative mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:justify-between">
                <Item label="Prazo previsto">
                    {curso.prazo === null ? "—" : `${curso.prazo} anos`}
                </Item>
                <Item label="Ingressantes por turma">
                    {mediaIngressantes === null
                        ? "—"
                        : formatInteger(Math.round(mediaIngressantes))}
                </Item>
                <Item
                    label={`Conclusão · turma ${turma.ano}${turma.madura ? "" : " (em andamento)"}`}
                >
                    <span className="flex items-center gap-2">
                        {final ? formatPercent(final.concluiu, 0) : "—"}
                        {final && nacional && (
                            <DeltaPill
                                size="sm"
                                diff={final.concluiu - nacional.concluiu}
                                limiar={0.5}
                                format={(v) => formatPoints(v, 0)}
                            />
                        )}
                    </span>
                    {nacional && (
                        <span className="text-text-muted block text-[11px] font-normal">
                            Brasil: {formatPercent(nacional.concluiu, 0)}
                        </span>
                    )}
                </Item>
                <Item label="Evasão no 1º ano">
                    {primeiroAno === undefined
                        ? "—"
                        : formatPercent(100 * primeiroAno, 0)}
                    <span className="text-text-muted block text-[11px] font-normal">
                        de toda a evasão
                    </span>
                </Item>
            </dl>
        </Card>
    );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-text-muted text-[12px]">{label}</dt>
            <dd className="mt-1 text-[18px] leading-tight font-semibold tabular-nums">
                {children}
            </dd>
        </div>
    );
}
