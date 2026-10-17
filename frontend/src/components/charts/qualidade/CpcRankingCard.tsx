import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AMPLIADO_ROLA } from "@/components/cards/ampliado";
import { Card } from "@/components/cards/Card";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { FaixaPill } from "@/components/charts/qualidade/FaixaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatDecimal } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";
import { cn } from "@/lib/utils";

type Coluna = "nome" | "faixa" | "cpc" | "enade" | "idd" | "delta";

const COLUNAS: { key: Coluna; label: string; title?: string }[] = [
    { key: "nome", label: "Curso" },
    { key: "faixa", label: "Faixa" },
    { key: "cpc", label: "CPC" },
    { key: "enade", label: "Enade", title: "Conceito Enade contínuo" },
    { key: "idd", label: "IDD", title: "Nota padronizada do IDD (valor agregado)" },
    {
        key: "delta",
        label: "Variação",
        title: "Variação do CPC desde o ciclo anterior",
    },
];

const valor = (a: AvaliacaoCurso, coluna: Coluna): number | string | null => {
    switch (coluna) {
        case "nome":
            return a.nome;
        case "faixa":
            return a.faixa;
        case "cpc":
            return a.cpc;
        case "enade":
            return a.enade;
        case "idd":
            return a.perfil?.idd ?? null;
        case "delta":
            return a.cpc !== null && a.anterior ? a.cpc - a.anterior.cpc : null;
    }
};

/** Ranking dos cursos pela avaliação mais recente: faixa, CPC (barra de 0 a
 * 5 com um traço na média nacional da área no mesmo ano), Enade, IDD e a
 * variação desde o ciclo anterior. Cabeçalhos ordenam; a linha abre o curso
 * em "Por curso". Cursos sem CPC ficam no fim, apagados. */
export function CpcRankingCard({
    avaliacoes,
    className,
}: {
    avaliacoes: AvaliacaoCurso[];
    className?: string;
}) {
    const navigate = useNavigate();
    const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({
        coluna: "cpc",
        desc: true,
    });

    const { comNota, semNota } = useMemo(() => {
        const comNota = avaliacoes.filter((a) => a.cpc !== null);
        const semNota = avaliacoes
            .filter((a) => a.cpc === null)
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        const sentido = ordem.desc ? -1 : 1;
        comNota.sort((a, b) => {
            const va = valor(a, ordem.coluna);
            const vb = valor(b, ordem.coluna);
            if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
            const cmp =
                typeof va === "string"
                    ? va.localeCompare(String(vb), "pt-BR")
                    : va - (vb as number);
            return cmp * sentido || a.nome.localeCompare(b.nome, "pt-BR");
        });
        return { comNota, semNota };
    }, [avaliacoes, ordem]);

    function ordenar(coluna: Coluna) {
        setOrdem((o) =>
            o.coluna === coluna
                ? { coluna, desc: !o.desc }
                : { coluna, desc: coluna !== "nome" }
        );
    }

    return (
        <Card
            expansivel
            title="Ranking dos cursos"
            subtitle="Avaliação mais recente de cada curso · clique para ver os detalhes"
            className={className}
        >
            <div className="text-text-muted mt-3 flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                    <span aria-hidden className="bg-brand h-2 w-4 rounded-full" />
                    CPC do curso
                </span>
                <span className="flex items-center gap-1.5">
                    {/* mesma largura da marca do CPC: o traço vai numa trilha
                        (como na barra da tabela), senão ele parece um separador
                        entre as duas legendas */}
                    <span aria-hidden className="bg-page relative h-2 w-4 rounded-full">
                        <span className="bg-ink absolute -top-0.5 -bottom-0.5 left-1/2 w-0.5 -translate-x-1/2 rounded-full" />
                    </span>
                    média nacional da área
                </span>
            </div>

            <div
                className={cn(
                    "relative mt-3 [scrollbar-width:thin] overflow-auto",
                    // ampliado: a tabela ocupa a altura do card
                    "max-h-[392px]",
                    AMPLIADO_ROLA
                )}
            >
                <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-0 text-[13px]">
                    <colgroup>
                        <col />
                        <col className="w-[52px]" />
                        <col className="w-[28%]" />
                        <col className="w-[56px]" />
                        <col className="w-[48px]" />
                        <col className="w-[90px]" />
                    </colgroup>
                    <thead>
                        <tr>
                            {COLUNAS.map(({ key, label, title }) => {
                                const ativa = ordem.coluna === key;
                                const Icon = ordem.desc ? ChevronDown : ChevronUp;
                                return (
                                    <th
                                        key={key}
                                        scope="col"
                                        aria-sort={
                                            ativa
                                                ? ordem.desc
                                                    ? "descending"
                                                    : "ascending"
                                                : undefined
                                        }
                                        className="bg-surface sticky top-0 z-[1] border-b border-current/10 p-0 text-left font-normal"
                                    >
                                        <button
                                            type="button"
                                            title={title}
                                            onClick={() => ordenar(key)}
                                            className={cn(
                                                "focus-visible:ring-lime/60 flex w-full items-center gap-0.5 rounded-md py-2 pr-2 text-[11px] font-medium tracking-wide whitespace-nowrap uppercase outline-none focus-visible:ring-2",
                                                ativa ? "text-ink" : "text-text-muted"
                                            )}
                                        >
                                            {label}
                                            <Icon
                                                size={13}
                                                strokeWidth={2.5}
                                                aria-hidden
                                                className={cn(!ativa && "invisible")}
                                            />
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {comNota.map((a) => (
                            <tr
                                key={a.codigo}
                                onClick={() => navigate(`/qualidade/curso/${a.codigo}`)}
                                className="group hover:bg-page cursor-pointer"
                            >
                                <Td className="rounded-l-lg pl-2">
                                    <Link
                                        to={`/qualidade/curso/${a.codigo}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="block truncate font-medium outline-none focus-visible:underline"
                                        title={`${a.nome} — avaliado em ${a.ano}`}
                                    >
                                        {a.nome}
                                    </Link>
                                    <span className="text-text-muted block text-[11px]">
                                        {a.ano}
                                    </span>
                                </Td>
                                <Td>
                                    <FaixaPill faixa={a.faixa} />
                                </Td>
                                <Td>
                                    <CpcBar cpc={a.cpc!} nacional={a.cpcNacional} />
                                </Td>
                                <Td className="tabular-nums">
                                    {a.enade === null ? "—" : formatDecimal(a.enade)}
                                </Td>
                                <Td className="tabular-nums">
                                    {a.perfil?.idd == null
                                        ? "—"
                                        : formatDecimal(a.perfil.idd)}
                                </Td>
                                <Td className="rounded-r-lg">
                                    {a.anterior ? (
                                        <span
                                            title={`${a.anterior.ano}: ${formatDecimal(a.anterior.cpc)} → ${a.ano}: ${formatDecimal(a.cpc!)}`}
                                        >
                                            <DeltaPill
                                                size="sm"
                                                diff={a.cpc! - a.anterior.cpc}
                                            />
                                        </span>
                                    ) : (
                                        <span className="text-text-muted text-[11px]">
                                            1º ciclo
                                        </span>
                                    )}
                                </Td>
                            </tr>
                        ))}
                        {semNota.map((a) => (
                            <tr
                                key={a.codigo}
                                onClick={() => navigate(`/qualidade/curso/${a.codigo}`)}
                                className="hover:bg-page text-text-muted cursor-pointer"
                            >
                                <Td className="rounded-l-lg pl-2">
                                    <Link
                                        to={`/qualidade/curso/${a.codigo}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="block truncate outline-none focus-visible:underline"
                                        title={a.nome}
                                    >
                                        {a.nome}
                                    </Link>
                                    {a.ano !== null && (
                                        <span className="block text-[11px]">
                                            {a.ano}
                                        </span>
                                    )}
                                </Td>
                                <Td>
                                    {a.ano === null ? (
                                        <span className="pl-2">—</span>
                                    ) : (
                                        <FaixaPill faixa={null} />
                                    )}
                                </Td>
                                <Td className="rounded-r-lg text-[12px]" colSpan={4}>
                                    <span className="border-empty block rounded-md border border-dashed px-2 py-1">
                                        {a.ano === null
                                            ? "Ainda não avaliado"
                                            : "Sem conceito nesta avaliação"}
                                    </span>
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function Td({
    className,
    colSpan,
    children,
}: {
    className?: string;
    colSpan?: number;
    children: React.ReactNode;
}) {
    return (
        <td
            colSpan={colSpan}
            className={cn(
                "min-w-0 border-b border-current/5 py-2 pr-2 align-middle",
                className
            )}
        >
            {children}
        </td>
    );
}

/** CPC numa barra de 0 a 5, com o traço da média nacional. */
function CpcBar({ cpc, nacional }: { cpc: number; nacional: number | null }) {
    const CHART = useChartTheme();
    return (
        <span
            className="flex items-center gap-2"
            title={
                nacional === null
                    ? `CPC ${formatDecimal(cpc)}`
                    : `CPC ${formatDecimal(cpc)} · média nacional ${formatDecimal(nacional)}`
            }
        >
            <span className="w-9 shrink-0 font-semibold tabular-nums">
                {formatDecimal(cpc)}
            </span>
            <span className="bg-page relative block h-2 flex-1 rounded-full group-hover:bg-current/10">
                <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(cpc / 5) * 100}%`, background: CHART.brand }}
                />
                {nacional !== null && (
                    <span
                        className="bg-ink absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)]"
                        style={{ left: `${(nacional / 5) * 100}%` }}
                    />
                )}
            </span>
        </span>
    );
}
