import { Card } from "@/components/cards/Card";
import { Tile } from "@/components/cards/Tile";
import { DataTable } from "@/components/charts/DataTable";
import { IngressantesCard, SERIE_UNIDADE } from "@/components/charts/SerieAnualCard";
import { DataState } from "@/components/layout/DataState";
import { formatInteger, formatPercent, formatPoints } from "@/lib/format";
import type { DashboardData } from "@/types/dashboard";

export function UnidadePage() {
    return <DataState render={(data) => <VisaoGeral data={data} />} />;
}

function comparacao(value: number | null, nacional: number | null): string {
    if (nacional === null)
        return "Sem média disponível para o grupo de pares nacional.";
    const referencia = `Grupo de pares nacional: ${formatPercent(nacional)}`;
    if (value === null) return referencia;
    const diff = value - nacional;
    if (Math.abs(diff) < 0.05) return `${referencia} · igual à média`;
    return `${referencia} · ${formatPoints(diff)} ${diff > 0 ? "acima" : "abaixo"} da média`;
}

function VisaoGeral({ data }: { data: DashboardData }) {
    const { kpis, distribuicao_cpc_faixa: distribuicao } = data.unidade;
    const nacional = data.medias_nacionais.unidade;
    const totalComFaixa = distribuicao.reduce(
        (total, item) => total + item.quantidade_cursos,
        0
    );
    const quantidades = new Map(
        distribuicao.map((item) => [item.cpc_faixa, item.quantidade_cursos])
    );
    const percentuais = new Map(
        nacional.distribuicao_cpc_faixa.map((item) => [
            item.cpc_faixa,
            item.percentual_nacional,
        ])
    );
    const faixas = [...new Set([...quantidades.keys(), ...percentuais.keys()])].sort(
        (a, b) => a.localeCompare(b, "pt-BR", { numeric: true })
    );
    const taxas = [
        {
            label: "Taxa média de conclusão",
            value: kpis.taxa_conclusao_media,
            nacional: nacional.kpis.taxa_conclusao_media_nacional,
        },
        {
            label: "Taxa média de desistência",
            value: kpis.taxa_desistencia_media,
            nacional: nacional.kpis.taxa_desistencia_media_nacional,
        },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-ink text-2xl font-bold">Visão geral</h1>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <Tile
                    label="Total de cursos"
                    info="Quantidade total de cursos da unidade."
                    value={formatInteger(kpis.total_cursos)}
                />
                <Tile
                    label="Ingressantes no último ano"
                    info="Total de alunos que ingressaram no último ano disponível na trajetória da unidade."
                    value={
                        kpis.total_ingressantes_ultimo_ano === null
                            ? "Sem dados"
                            : formatInteger(kpis.total_ingressantes_ultimo_ano)
                    }
                />
                {taxas.map((taxa) => (
                    <Tile
                        key={taxa.label}
                        label={taxa.label}
                        info="Média simples das taxas acumuladas dos cursos com dados disponíveis, usando a turma e o acompanhamento mais recentes de cada curso."
                        value={
                            taxa.value === null
                                ? "Sem dados"
                                : formatPercent(taxa.value)
                        }
                        footer={comparacao(taxa.value, taxa.nacional)}
                    />
                ))}
            </div>
            <p className="text-text-secondary text-sm">
                Comparação com o grupo de pares nacional:{" "}
                {formatInteger(nacional.kpis.quantidade_cursos_considerados)} curso(s)
                considerados nas taxas médias.
            </p>
            <Card
                title="Distribuição por faixa do CPC"
                subtitle="Unidade × grupo de pares nacional"
                info="Contagem de cursos por faixa na avaliação mais recente. O percentual da unidade considera apenas cursos com faixa informada, permitindo comparar a distribuição com a dos pares nacionais."
            >
                {faixas.length === 0 ? (
                    <p className="text-text-muted mt-4 text-sm">
                        Sem dados de faixas do CPC.
                    </p>
                ) : (
                    <div className="mt-4 overflow-x-auto">
                        <DataTable
                            columns={[
                                "Faixa CPC",
                                "Cursos da unidade",
                                "Unidade (%)",
                                "Pares nacionais (%)",
                            ]}
                            rows={faixas.map((faixa) => {
                                const quantidade = quantidades.get(faixa) ?? 0;
                                const percentualNacional =
                                    percentuais.get(faixa) ??
                                    (percentuais.size > 0 ? 0 : null);
                                return [
                                    faixa,
                                    totalComFaixa > 0
                                        ? formatInteger(quantidade)
                                        : "Sem dados",
                                    totalComFaixa > 0
                                        ? formatPercent(
                                              (quantidade / totalComFaixa) * 100
                                          )
                                        : "Sem dados",
                                    percentualNacional === null
                                        ? "Sem dados"
                                        : formatPercent(percentualNacional),
                                ];
                            })}
                        />
                    </div>
                )}
            </Card>
            <IngressantesCard data={data} escolha={SERIE_UNIDADE} />
        </div>
    );
}
