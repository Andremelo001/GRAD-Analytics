import type { ReactNode } from "react";

import { Card } from "@/components/cards/Card";
import { ChartSelect } from "@/components/charts/ChartSelect";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { FaixaPill } from "@/components/charts/qualidade/FaixaPill";
import { faixaDe } from "@/lib/cpc";
import { formatDecimal, formatInteger, toTitleCase } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";
import { cn } from "@/lib/utils";

/** Cabeçalho da sub-aba Por curso: a ficha de uma avaliação do curso (ano,
 * área, CPC + faixa, Enade + faixa e a média nacional) — a mais recente, ou a
 * do ano escolhido no seletor do canto (``anos``, as edições do curso; com uma
 * só, um aviso no lugar). O curso se escolhe no seletor do cabeçalho da aba. */
export function CursoResumoCard({
    curso,
    anos,
    onAno,
    className,
}: {
    curso: AvaliacaoCurso;
    anos: number[];
    onAno: (ano: number) => void;
    className?: string;
}) {
    return (
        <Card className={cn("relative", className)}>
            {/* enfeite: os pontinhos dos 4 resumos da Visão da unidade. Recortados
                numa camada própria (não no card) */}
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
                {curso.ano !== null && (
                    <AnoAvaliacao anos={anos} valor={curso.ano} onChange={onAno} />
                )}
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

/** O ano da avaliação no meio de uma frase, como o seletor de turma da
 * Trajetória ("Avaliação de [2021 ▾]"); a mais recente primeiro. Com uma
 * avaliação só, o aviso de que ela é a única. */
function AnoAvaliacao({
    anos,
    valor,
    onChange,
}: {
    anos: number[];
    valor: number;
    onChange: (ano: number) => void;
}) {
    if (anos.length <= 1) {
        return (
            <div className="text-ink flex h-10 items-center self-start text-[13px] whitespace-nowrap sm:ml-auto">
                {valor} é a única avaliação disponível
            </div>
        );
    }
    const recente = Math.max(...anos);
    return (
        // o mesmo lugar e tamanho do "Turma de [2018 ▾]" da Trajetória
        <div className="text-text-secondary flex h-10 items-center gap-1.5 self-start text-[13px] whitespace-nowrap sm:ml-auto">
            Avaliação de
            <ChartSelect
                variant="inline"
                tone="surface"
                label="Ano da avaliação"
                alinhar="direita"
                value={String(valor)}
                options={[...anos]
                    .sort((a, b) => b - a)
                    .map((a) => ({
                        value: String(a),
                        label: a === recente ? `${a} · mais recente` : String(a),
                    }))}
                onChange={(v) => onChange(Number(v))}
            />
        </div>
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
