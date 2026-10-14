import { useState } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { DataTable } from "@/components/charts/DataTable";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import {
    corSituacao,
    ROTULO_SITUACAO,
    SIGLA_SITUACAO,
    SITUACOES,
    type Situacao,
} from "@/components/charts/trajetoria/situacao";
import { SiglaInep } from "@/components/charts/trajetoria/SiglaInep";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatPercent } from "@/lib/format";
import { situacaoFinal, turmaMadura, type CursoTrajetoria } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

/** Quantos cursos aparecem antes da lista passar a rolar. */
const MAX_VISIVEIS = 8;

const TODOS = "todos";

/** Situação final por curso: uma barra 100% por curso (concluíram,
 * desistiram, ainda cursando) na turma madura mais recente de cada um, do
 * que mais conclui pro que menos conclui — a comparação justa entre cursos
 * (todos no mesmo ponto: prazo + 2 anos). Passar o mouse numa parte (ou na
 * legenda) destaca a mesma situação em todos os cursos e mostra os valores. */
export function SituacaoFinalCard({
    cursos,
    className,
}: {
    cursos: CursoTrajetoria[];
    className?: string;
}) {
    const CHART = useChartTheme();
    const [foco, setFoco] = useState<Situacao | null>(null);
    // filtro de busca (o mesmo seletor do cabeçalho de Por curso): todos os
    // cursos ou só um, com a posição dele entre os do campus
    const [escolha, setEscolha] = useState(TODOS);

    const linhas = cursos
        .flatMap((c) => {
            const t = turmaMadura(c);
            const p = t && situacaoFinal(t);
            if (!t || !p) return [];
            const cursando = Math.max(100 - p.concluiu - p.desistiu, 0);
            return [
                {
                    curso: c,
                    turma: t,
                    valores: { concluiu: p.concluiu, desistiu: p.desistiu, cursando },
                },
            ];
        })
        .sort((a, b) => b.valores.concluiu - a.valores.concluiu);
    const semMadura = cursos.length - linhas.length;
    const visiveis =
        escolha === TODOS
            ? linhas
            : linhas.filter((l) => String(l.curso.codigo) === escolha);
    const posicao = (codigo: number) =>
        linhas.findIndex((l) => l.curso.codigo === codigo) + 1;
    const destaque = foco ?? "concluiu";
    // com muitos cursos (Fortaleza), a lista rola dentro do card depois de
    // ~8 cursos, em vez de esticar o card (e o vizinho, que tem a mesma altura)
    const rola = visiveis.length > MAX_VISIVEIS;

    return (
        <Card
            title="Situação final por curso"
            subtitle="Turma madura de cada curso, dois anos depois do prazo"
            className={className}
            action={
                <div className="w-full sm:w-80">
                    <CursoBusca
                        label="Curso"
                        cor={CHART.brand}
                        value={escolha}
                        options={[
                            {
                                value: TODOS,
                                label: "Todos os cursos",
                                detalhe: `${linhas.length} cursos com turma madura`,
                            },
                            ...[...linhas]
                                .sort((a, b) =>
                                    a.curso.nome.localeCompare(b.curso.nome, "pt-BR")
                                )
                                .map((l) => ({
                                    value: String(l.curso.codigo),
                                    label: l.curso.nome,
                                    detalhe:
                                        [l.curso.grau, l.curso.modalidade]
                                            .filter(Boolean)
                                            .join(" · ") || undefined,
                                })),
                        ]}
                        onChange={setEscolha}
                        placeholder="Buscar curso…"
                    />
                </div>
            }
        >
            <ul
                className="mt-4 flex gap-x-4 gap-y-1 text-[12px]"
                onMouseLeave={() => setFoco(null)}
            >
                {SITUACOES.map((s) => (
                    <li
                        key={s}
                        onMouseEnter={() => setFoco(s)}
                        className={cn(
                            "text-text-secondary flex items-center gap-1.5 transition-opacity duration-200",
                            foco !== null && foco !== s && "opacity-40",
                            foco === s && "text-ink font-semibold"
                        )}
                    >
                        <span
                            aria-hidden
                            className="h-2.5 w-2.5 rounded-[3px]"
                            style={{ background: corSituacao(CHART, s) }}
                        />
                        {ROTULO_SITUACAO[s]}
                        <SiglaInep sigla={SIGLA_SITUACAO[s]} />
                    </li>
                ))}
            </ul>

            <ul
                className={cn(
                    "mt-4 flex flex-1 flex-col gap-3",
                    rola
                        ? "-mr-2 max-h-[420px] [scrollbar-width:thin] overflow-y-auto pr-2"
                        : "justify-around"
                )}
                onMouseLeave={() => setFoco(null)}
            >
                {visiveis.map(({ curso, turma, valores }) => (
                    <li key={curso.codigo}>
                        <div className="flex items-baseline justify-between gap-3 text-[12px]">
                            <span className="min-w-0 truncate font-medium">
                                {curso.nome}
                                <span className="text-text-muted ml-1.5 font-normal">
                                    turma {turma.ano}
                                    {/* só um curso no filtro: a posição dele no campus */}
                                    {escolha !== TODOS &&
                                        ` · ${posicao(curso.codigo)}º de ${linhas.length} em conclusão`}
                                </span>
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">
                                {formatPercent(valores[destaque], 0)}
                                <span className="text-text-muted ml-1 font-normal">
                                    {ROTULO_SITUACAO[destaque].toLowerCase()}
                                </span>
                            </span>
                        </div>
                        <div className="mt-1.5 flex h-4 items-center gap-[2px]">
                            {SITUACOES.map((s) =>
                                valores[s] <= 0 ? null : (
                                    <span
                                        key={s}
                                        onMouseEnter={() => setFoco(s)}
                                        title={`${ROTULO_SITUACAO[s]}: ${formatPercent(valores[s], 0)}`}
                                        className={cn(
                                            "cursor-pointer transition-[height,opacity] duration-200 first:rounded-l-full last:rounded-r-full",
                                            foco === s ? "h-4" : "h-3",
                                            foco !== null && foco !== s && "opacity-35"
                                        )}
                                        style={{
                                            flexGrow: valores[s],
                                            background: corSituacao(CHART, s),
                                        }}
                                    />
                                )
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            <NotaRodape>
                {semMadura > 0
                    ? `${semMadura} ${semMadura === 1 ? "curso ainda não tem" : "cursos ainda não têm"} turma madura (todas em andamento) e ${semMadura === 1 ? "fica" : "ficam"} de fora.`
                    : "Todos no mesmo ponto do curso: o prazo previsto e mais dois anos."}
            </NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={[
                        "Curso",
                        "Turma",
                        "Concluíram",
                        "Desistiram",
                        "Ainda cursando",
                    ]}
                    rows={linhas.map(({ curso, turma, valores }) => [
                        curso.nome,
                        String(turma.ano),
                        formatPercent(valores.concluiu, 0),
                        formatPercent(valores.desistiu, 0),
                        formatPercent(valores.cursando, 0),
                    ])}
                />
            </div>
        </Card>
    );
}
