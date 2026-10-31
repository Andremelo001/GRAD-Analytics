import { Info } from "lucide-react";
import { useState } from "react";

import { AMPLIADO_CRESCE } from "@/components/cards/ampliado";
import { Card } from "@/components/cards/Card";
import { CursoNacionalLinha, type Row } from "@/components/charts/CursoNacionalLinha";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { useChartTheme } from "@/hooks/useChartTheme";
import { COMPONENTES, type Componente, type ComponenteKey } from "@/lib/cpc";
import { formatPercent } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";
import { cn } from "@/lib/utils";
import type { PerfilRadarNacional } from "@/types/dashboard";

/** A última escolha do seletor: sair da página (ou trocar de curso) e voltar
 * mantém o componente. */
let componenteEscolhido: ComponenteKey = COMPONENTES[0].key;

/** FG e CE: até 2017 o INEP só divulgou a nota bruta; a padronizada (a que o
 * card mostra) começa em 2018. */
const SO_DESDE_2018: ReadonlySet<ComponenteKey> = new Set([
    "formacao_geral",
    "componente_especifico",
]);
const PADRONIZADA_FG_CE_DESDE = 2018;

/** O peso do componente no CPC: 0,075 -> "7,5%"; 0,15 -> "15%". */
function peso(c: Componente): string {
    const pct = Math.round(c.peso * 1000) / 10;
    return formatPercent(pct, Number.isInteger(pct) ? 0 : 1);
}

/** Um ano por linha, do primeiro ao último ano com avaliação (anos sem
 * ciclo do Enade ficam vazios), como no "CPC: curso x média nacional". A
 * nota do curso vem do histórico dele (``evolucao_cpc``); a média, dos
 * cursos da mesma área de avaliação no mesmo ano
 * (``medias_nacionais.perfil_radar`` — as notas são padronizadas dentro de
 * cada edição). */
function buildRows(
    curso: AvaliacaoCurso,
    nacional: PerfilRadarNacional[],
    chave: ComponenteKey
): Row[] {
    const doCurso = curso.historico.filter((p) => p[chave] != null);
    const area = curso.historico.at(-1)?.area_avaliacao ?? curso.area;
    const daArea = nacional.filter(
        (n) => n.area_avaliacao === area && n[chave] != null
    );
    const anos = [...doCurso.map((p) => p.ano), ...daArea.map((n) => n.ano)];
    if (anos.length === 0) return [];
    const rows: Row[] = [];
    for (let ano = Math.min(...anos); ano <= Math.max(...anos); ano++) {
        const media = daArea.find((n) => n.ano === ano);
        const doAno = doCurso.find((p) => p.ano === ano);
        rows.push({
            ano,
            curso: doAno?.[chave] ?? null,
            nacional: media?.[chave] ?? null,
            cursosConsiderados: media?.quantidade_cursos_considerados ?? null,
        });
    }
    return rows;
}

/** Linha do tempo de cada componente do CPC: a nota padronizada (0 a 5) do
 * curso em cada avaliação x a média nacional da área no mesmo ano, com um
 * seletor pro componente (no mesmo desenho do "CPC: curso x média
 * nacional" do Início). */
export function ComponentesTempoCard({
    curso,
    nacional,
    className,
}: {
    curso: AvaliacaoCurso;
    nacional: PerfilRadarNacional[];
    className?: string;
}) {
    const CHART = useChartTheme();
    const [chave, setChave] = useState<ComponenteKey>(() => componenteEscolhido);
    const componente = COMPONENTES.find((c) => c.key === chave)!;
    const rows = buildRows(curso, nacional, chave);
    const avaliado = rows.some((r) => r.curso !== null);
    // só avisa quando falta mesmo ponto por isso: o curso tem avaliação antes de 2018
    const anosSemPadronizada = SO_DESDE_2018.has(chave)
        ? [
              ...new Set(
                  curso.historico
                      .map((p) => p.ano)
                      .filter((ano) => ano < PADRONIZADA_FG_CE_DESDE)
              ),
          ].sort()
        : [];
    const semPadronizadaAntes = anosSemPadronizada.length > 0;
    const anosTexto = anosSemPadronizada.join(" e ");
    const avisoFgCe = `O INEP só divulga a nota padronizada de ${componente.nome.replace("Enade — ", "")} a partir de ${PADRONIZADA_FG_CE_DESDE}, por isso ${anosSemPadronizada.length > 1 ? "as avaliações" : "a avaliação"} de ${anosTexto} não ${anosSemPadronizada.length > 1 ? "aparecem" : "aparece"} aqui.`;

    return (
        <Card
            expansivel="tela"
            title="Componentes do CPC ao longo do tempo"
            info="A nota padronizada (0 a 5) do componente escolhido no seletor, em cada avaliação do curso, contra a média nacional dos cursos da mesma área de avaliação no mesmo ano. As notas são padronizadas dentro de cada edição do Enade: o que vale é a posição do curso em relação aos outros naquele ano. Formação geral e Componente específico só têm nota padronizada a partir de 2018: até 2017 o INEP divulgou apenas a nota bruta."
            subtitle={`${componente.nome} (peso ${peso(componente)} no CPC)`}
            action={
                // o mesmo seletor com busca dos cursos (o do "Evolução entre
                // ciclos"): o componente em cima, o peso e o bloco embaixo
                <CursoBusca
                    compacto
                    largo
                    label="Componente"
                    cor={CHART.brand}
                    value={chave}
                    options={COMPONENTES.map((c) => ({
                        value: c.key,
                        label: c.nome,
                        detalhe: `Peso ${peso(c)} · ${c.bloco}`,
                    }))}
                    onChange={(v) => {
                        componenteEscolhido = v as ComponenteKey;
                        setChave(componenteEscolhido);
                    }}
                    placeholder="Buscar componente…"
                />
            }
            className={className}
        >
            {avaliado ? (
                <>
                    <CursoNacionalLinha
                        key={`${curso.codigo}-${chave}`}
                        rows={rows}
                        nome="Nota"
                        alturaGrafico={cn("h-[280px]", AMPLIADO_CRESCE)}
                        emLinha
                    />
                    {semPadronizadaAntes && (
                        <p className="text-text-muted mt-2 flex gap-2 text-[11px] leading-snug">
                            <Info
                                size={13}
                                strokeWidth={2}
                                aria-hidden
                                className="mt-px shrink-0"
                            />
                            {avisoFgCe}
                        </p>
                    )}
                </>
            ) : (
                <p className="text-text-secondary mt-6 text-[13px]">
                    O curso não tem nota de {componente.nome} em nenhuma avaliação.
                    {semPadronizadaAntes
                        ? ` ${avisoFgCe}`
                        : " Escolha outro componente no seletor acima."}
                </p>
            )}
        </Card>
    );
}
