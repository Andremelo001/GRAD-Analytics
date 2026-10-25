import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AMPLIADO_ROLA } from "@/components/cards/ampliado";
import { Card } from "@/components/cards/Card";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatDecimal } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";
import { cn } from "@/lib/utils";

type Coluna = "nome" | "cpc" | "enade";

const COLUNAS: { key: Coluna; label: string; title?: string }[] = [
    { key: "nome", label: "Curso" },
    { key: "cpc", label: "CPC" },
    { key: "enade", label: "Conceito Enade", title: "Conceito Enade contínuo" },
];

const valor = (a: AvaliacaoCurso, coluna: Coluna): number | string | null => {
    switch (coluna) {
        case "nome":
            return a.nome;
        case "cpc":
            return a.cpc;
        case "enade":
            return a.enade;
    }
};

/** Ranking dos cursos pela avaliação mais recente: CPC e Conceito Enade
 * (cada um numa barra de 0 a 5 com um traço na média nacional da área no
 * mesmo ano). Cabeçalhos ordenam; a linha abre o curso em "Por
 * curso". Cursos sem CPC ficam no fim, apagados. */
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
            info="Os cursos do campus em ordem de CPC da avaliação mais recente, com o Conceito Enade. O traço nas barras do CPC e do Conceito Enade é a média nacional da área no mesmo ano. Clique numa coluna para reordenar e num curso para abrir os detalhes."
            subtitle="Avaliação mais recente de cada curso · clique para ver os detalhes"
            className={className}
        >
            <div className="text-text-muted mt-3 flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                    <span aria-hidden className="bg-brand h-2 w-4 rounded-full" />
                    valor do curso
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
                <table className="w-full min-w-[420px] table-fixed border-separate border-spacing-0 text-[13px]">
                    <colgroup>
                        <col />
                        <col className="w-[30%]" />
                        <col className="w-[30%]" />
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
                                    <NotaBar
                                        nome="CPC"
                                        valor={a.cpc!}
                                        nacional={a.cpcNacional}
                                    />
                                </Td>
                                <Td className="rounded-r-lg">
                                    {a.enade === null ? (
                                        <span className="text-text-muted">—</span>
                                    ) : (
                                        <NotaBar
                                            nome="Conceito Enade"
                                            valor={a.enade}
                                            nacional={
                                                a.nacional?.conceito_enade_continuo ??
                                                null
                                            }
                                        />
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
                                <Td className="rounded-r-lg text-[12px]" colSpan={2}>
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

/** Uma nota de 0 a 5 (CPC, Conceito Enade) numa barra, com o traço da média
 * nacional. */
function NotaBar({
    nome,
    valor,
    nacional,
}: {
    nome: string;
    valor: number;
    nacional: number | null;
}) {
    const CHART = useChartTheme();
    return (
        <span
            className="flex items-center gap-2"
            title={
                nacional === null
                    ? `${nome} ${formatDecimal(valor)}`
                    : `${nome} ${formatDecimal(valor)} · média nacional ${formatDecimal(nacional)}`
            }
        >
            <span className="w-9 shrink-0 font-semibold tabular-nums">
                {formatDecimal(valor)}
            </span>
            <span className="bg-page relative block h-2 flex-1 rounded-full group-hover:bg-current/10">
                <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(valor / 5) * 100}%`, background: CHART.brand }}
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
