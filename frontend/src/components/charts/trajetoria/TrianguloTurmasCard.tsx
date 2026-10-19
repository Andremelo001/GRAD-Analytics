import { useState, type ReactNode } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { rampColor } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/charts/DataTable";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatPercent } from "@/lib/format";
import { pontoEm, type CursoTrajetoria } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

/** Triângulo das turmas (mapa de calor em escada): linhas são as turmas,
 * colunas os anos desde o ingresso e cada célula a evasão acumulada até ali.
 * As turmas recentes formam a escada — ainda não chegaram aos anos mais
 * altos —, o que mostra o que está em andamento sem precisar de aviso. Ler
 * uma coluna de cima pra baixo compara todas as turmas no mesmo ponto do
 * curso. O ponto em cada linha marca o fim do prazo daquela turma. Passar o
 * mouse destaca a linha e a coluna; clicar numa turma a escolhe nos outros
 * gráficos da página. */
export function TrianguloTurmasCard({
    curso,
    turmaAno,
    onTurma,
    className,
}: {
    curso: CursoTrajetoria;
    turmaAno: number;
    onTurma: (ano: number) => void;
    className?: string;
}) {
    const CHART = useChartTheme();
    const [hover, setHover] = useState<{ ano: number; anos: number } | null>(null);
    const maxAnos = Math.max(
        ...curso.turmas.flatMap((t) => t.pontos.map((p) => p.anos)),
        0
    );
    const colunas = Array.from({ length: maxAnos + 1 }, (_, i) => i);
    const maximo = Math.max(
        ...curso.turmas.flatMap((t) => t.pontos.map((p) => p.desistiu)),
        1
    );
    const cor = (v: number) => rampColor(CHART.evasao.acima, v / maximo);
    const sel = hover ?? undefined;
    const valorSel = sel
        ? pontoEm(
              curso.turmas.find((t) => t.ano === sel.ano)!,
              sel.anos
          )?.desistiu
        : undefined;

    return (
        <Card
            expansivel
            title="Triângulo das turmas"
            info="A desistência acumulada (TDA) de todas as turmas do curso: cada linha é uma turma, cada coluna um ano de curso. Clique numa turma para vê-la nos outros gráficos."
            subtitle="Taxa de Desistência Acumulada (TDA) de cada turma, ano a ano"
            className={className}
        >
            <div className="mt-4 flex min-h-[22px] flex-wrap items-center justify-between gap-3 text-[12px]">
                <p className="text-text-secondary">
                    {sel && valorSel !== undefined ? (
                        <>
                            <span className="text-ink font-semibold">
                                Turma {sel.ano}
                            </span>
                            , {sel.anos + 1}º ano:{" "}
                            <span className="text-ink font-semibold tabular-nums">
                                {formatPercent(valorSel, 0)}
                            </span>{" "}
                            já desistiram
                        </>
                    ) : (
                        "Passe o mouse numa célula para ver o valor"
                    )}
                </p>
                <span className="text-text-muted flex items-center gap-2 text-[11px]">
                    0%
                    <span
                        aria-hidden
                        className="h-2 w-24 rounded-full"
                        style={{
                            background: `linear-gradient(to right, ${CHART.evasao.acima.join(", ")})`,
                        }}
                    />
                    {formatPercent(maximo, 0)}
                    <span className="ml-2 flex items-center gap-1.5">
                        <span aria-hidden className="bg-ink h-1.5 w-1.5 rounded-full" />
                        fim do prazo
                    </span>
                </span>
            </div>

            <div
                className="mt-3 grid gap-[3px] overflow-x-auto"
                style={{
                    gridTemplateColumns: `44px repeat(${colunas.length}, minmax(26px, 1fr))`,
                }}
                onMouseLeave={() => setHover(null)}
                role="img"
                aria-label="Evasão acumulada por turma e ano de curso"
            >
                <span />
                {colunas.map((a) => (
                    <span
                        key={a}
                        className={cn(
                            "text-text-muted pb-1 text-center text-[10px] tabular-nums",
                            sel?.anos === a && "text-ink font-semibold"
                        )}
                    >
                        {a + 1}º
                    </span>
                ))}
                {curso.turmas.map((t) => (
                    <Linha
                        key={t.ano}
                        ano={t.ano}
                        ativa={t.ano === turmaAno}
                        madura={t.madura}
                        destacada={sel?.ano === t.ano}
                        onClick={() => onTurma(t.ano)}
                    >
                        {colunas.map((a) => {
                            const p = pontoEm(t, a);
                            const fimPrazo = t.prazo !== null && a === t.prazo - 1;
                            const naCruz = sel && (sel.ano === t.ano || sel.anos === a);
                            return (
                                <span
                                    key={a}
                                    onMouseEnter={() =>
                                        p && setHover({ ano: t.ano, anos: a })
                                    }
                                    onClick={() => onTurma(t.ano)}
                                    className={cn(
                                        "relative h-7 rounded-[4px] transition-opacity duration-150",
                                        p
                                            ? "cursor-pointer"
                                            : "border-empty border border-dashed",
                                        sel && p && !naCruz && "opacity-45"
                                    )}
                                    style={
                                        p ? { background: cor(p.desistiu) } : undefined
                                    }
                                >
                                    {fimPrazo && (
                                        <span
                                            aria-hidden
                                            className="bg-ink ring-surface absolute top-1 right-1 h-1.5 w-1.5 rounded-full ring-1"
                                        />
                                    )}
                                </span>
                            );
                        })}
                    </Linha>
                ))}
            </div>
            <NotaRodape>
                Células tracejadas: anos que a turma ainda não viveu (em andamento).
                Desistência inclui transferência para outro curso, inclusive dentro da
                UFC.
            </NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={["Turma", ...colunas.map((a) => `${a + 1}º ano`)]}
                    rows={curso.turmas.map((t) => [
                        String(t.ano),
                        ...colunas.map((a) => {
                            const p = pontoEm(t, a);
                            return p ? formatPercent(p.desistiu, 0) : "—";
                        }),
                    ])}
                />
            </div>
        </Card>
    );
}

/** Rótulo da turma (o ano) + as células dela; ``display: contents`` deixa
 * tudo na grade do pai. */
function Linha({
    ano,
    ativa,
    madura,
    destacada,
    onClick,
    children,
}: {
    ano: number;
    ativa: boolean;
    madura: boolean;
    destacada: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <div className="contents">
            <button
                type="button"
                onClick={onClick}
                aria-pressed={ativa}
                title={madura ? `Turma de ${ano}` : `Turma de ${ano} (em andamento)`}
                className={cn(
                    "focus-visible:ring-lime/60 flex h-7 items-center rounded-md pr-1 text-left text-[11.5px] tabular-nums outline-none focus-visible:ring-2",
                    ativa
                        ? "bg-ink text-surface justify-center font-semibold"
                        : destacada
                          ? "text-ink font-semibold"
                          : "text-text-secondary",
                    !madura && !ativa && "italic"
                )}
            >
                {ano}
            </button>
            {children}
        </div>
    );
}
