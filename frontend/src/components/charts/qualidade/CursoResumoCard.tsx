import type { ReactNode } from "react";

import { Card } from "@/components/cards/Card";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { FaixaPill } from "@/components/charts/qualidade/FaixaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { faixaDe } from "@/lib/cpc";
import { opcaoCurso } from "@/lib/curso";
import { formatDecimal, formatInteger, toTitleCase } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";
import { cn } from "@/lib/utils";

/** Cabeçalho da sub-aba Por curso: seletor do curso (com busca) e a ficha da avaliação
 * mais recente (ano, área, CPC + faixa, Enade + faixa e a média nacional). */
export function CursoResumoCard({
    curso,
    cursos,
    onChange,
    className,
}: {
    curso: AvaliacaoCurso;
    cursos: AvaliacaoCurso[];
    onChange: (codigo: number) => void;
    className?: string;
}) {
    const CHART = useChartTheme();
    // a busca filtra por nome, código e grau (e, sem aparecer, pela área)
    const options = [...cursos]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((c) => ({
            ...opcaoCurso({ codigo: c.codigo, nome: c.nomeCurso, grau: c.grau }),
            busca: c.area ?? undefined,
        }));

    return (
        <Card className={cn("relative", className)}>
            {/* enfeite: os pontinhos dos 4 resumos da Visão do campus. Recortados
                numa camada própria (não no card): o overflow-hidden no card
                cortaria a lista do seletor de curso */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
            >
                {/* grade mais aberta que a dos resumos e o degradê indo mais
                    longe pra esquerda: o card é largo */}
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
                        {curso.area
                            ? `Área de avaliação: ${toTitleCase(curso.area)}`
                            : "Sem área de avaliação"}
                    </p>
                    <h2 className="mt-1 truncate text-[22px] leading-tight font-semibold tracking-[-0.02em]">
                        {curso.nome}
                    </h2>
                </div>
                {/* mesmo seletor com busca das Comparações */}
                <div className="w-full sm:w-80">
                    <CursoBusca
                        label="Curso"
                        cor={CHART.brand}
                        value={String(curso.codigo)}
                        options={options}
                        onChange={(v) => onChange(Number(v))}
                        placeholder="Buscar curso…"
                    />
                </div>
            </div>

            {/* itens distribuídos de ponta a ponta (o primeiro encosta na
                esquerda, o último na direita), cada valor alinhado à esquerda
                do rótulo; no celular, em duas colunas */}
            <dl className="relative mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:justify-between">
                <Item label="Avaliado em">{curso.ano ?? "—"}</Item>
                <Item label="CPC contínuo">
                    <span className="flex items-center gap-2">
                        {curso.cpc === null ? "—" : formatDecimal(curso.cpc)}
                        {curso.ano !== null && <FaixaPill faixa={curso.faixa} />}
                    </span>
                </Item>
                <Item label="Média nacional da área">
                    <span className="flex items-center gap-2">
                        {curso.cpcNacional === null
                            ? "—"
                            : formatDecimal(curso.cpcNacional)}
                        {curso.cpc !== null && curso.cpcNacional !== null && (
                            <DeltaPill size="sm" diff={curso.cpc - curso.cpcNacional} />
                        )}
                    </span>
                    {curso.cursosNacional !== null && (
                        <span className="text-text-muted block text-[11px] font-normal">
                            {formatInteger(curso.cursosNacional)} cursos em {curso.ano}
                        </span>
                    )}
                </Item>
                <Item label="Conceito Enade">
                    {/* faixa do Conceito Enade: mesmos cortes da do CPC */}
                    <span className="flex items-center gap-2">
                        {curso.enade === null ? "—" : formatDecimal(curso.enade)}
                        {curso.ano !== null && (
                            <FaixaPill
                                faixa={
                                    curso.enade === null ? null : faixaDe(curso.enade)
                                }
                            />
                        )}
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
