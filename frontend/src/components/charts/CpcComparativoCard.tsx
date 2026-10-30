import { useMemo, useState } from "react";

import { Card } from "@/components/cards/Card";
import { CursoNacionalLinha, type Row } from "@/components/charts/CursoNacionalLinha";
import { Segmentado } from "@/components/charts/Segmentado";
import { toTitleCase } from "@/lib/format";
import type {
    Curso,
    EvolucaoCpcNacionalPonto,
    EvolucaoCpcPonto,
} from "@/types/dashboard";

/** O que o card compara: o CPC ou o Conceito Enade (o mesmo card, com a
 * série e os textos trocados). */
type Metrica = "cpc" | "enade";

const METRICAS: Record<
    Metrica,
    {
        nome: string;
        doCurso: (p: EvolucaoCpcPonto) => number | null;
        nacional: (n: EvolucaoCpcNacionalPonto) => number | null;
        cursos: (n: EvolucaoCpcNacionalPonto) => number;
    }
> = {
    cpc: {
        nome: "CPC",
        doCurso: (p) => p.cpc_continuo,
        nacional: (n) => n.cpc_continuo_medio_nacional,
        cursos: (n) => n.quantidade_cursos_considerados,
    },
    enade: {
        nome: "Conceito Enade",
        doCurso: (p) => p.conceito_enade_continuo,
        nacional: (n) => n.conceito_enade_medio_nacional,
        cursos: (n) => n.quantidade_cursos_enade,
    },
};

/** A última escolha do seletor: vale enquanto o painel está aberto, então
 * sair da aba e voltar mantém o indicador. */
let metricaEscolhida: Metrica = "cpc";

/** Um ano por linha, do primeiro ao último ano com avaliação (anos sem
 * ciclo do Enade ficam vazios — o espaçamento entre avaliações é real). O
 * valor do curso vem de ``curso_perfil.evolucao_cpc``; a média, dos cursos
 * da mesma área de avaliação (``medias_nacionais.evolucao_cpc``). */
function buildRows(
    codigo: number,
    evolucao: EvolucaoCpcPonto[],
    nacional: EvolucaoCpcNacionalPonto[],
    metrica: Metrica
): { area: string | null; rows: Row[] } {
    const m = METRICAS[metrica];
    const doCurso = evolucao.filter(
        (p) => p.codigo_curso === codigo && m.doCurso(p) !== null
    );
    const area = doCurso.at(-1)?.area_avaliacao ?? null;
    const daArea = nacional.filter(
        (n) => n.area_avaliacao === area && m.nacional(n) !== null
    );
    const anos = [...doCurso.map((p) => p.ano), ...daArea.map((n) => n.ano)];
    if (anos.length === 0) return { area, rows: [] };

    const rows: Row[] = [];
    for (let ano = Math.min(...anos); ano <= Math.max(...anos); ano++) {
        const media = daArea.find((n) => n.ano === ano);
        const doAno = doCurso.find((p) => p.ano === ano);
        rows.push({
            ano,
            curso: doAno ? m.doCurso(doAno) : null,
            nacional: media ? m.nacional(media) : null,
            cursosConsiderados: media ? m.cursos(media) : null,
        });
    }
    return { area, rows };
}

/** CPC (ou Conceito Enade, no seletor do card) contínuo do curso escolhido
 * x média nacional dos cursos da mesma área, ano a ano
 * (``CursoNacionalLinha``). */
export function CpcComparativoCard({
    evolucao,
    nacional,
    cursos,
    codigo,
    className,
}: {
    evolucao: EvolucaoCpcPonto[];
    nacional: EvolucaoCpcNacionalPonto[];
    cursos: Curso[];
    /** O curso exibido — o do seletor de curso do Início (no cabeçalho). */
    codigo: number | null;
    className?: string;
}) {
    const [metrica, setMetrica] = useState<Metrica>(() => metricaEscolhida);
    const { nome, doCurso } = METRICAS[metrica];
    const opcoes = cursos.filter((c) =>
        evolucao.some((p) => p.codigo_curso === c.codigo_curso && doCurso(p) !== null)
    );
    const semCpc = cursos.length - opcoes.length;

    const { area, rows } = useMemo(
        () =>
            codigo === null
                ? { area: null, rows: [] }
                : buildRows(codigo, evolucao, nacional, metrica),
        [codigo, evolucao, nacional, metrica]
    );
    const avaliado = rows.some((r) => r.curso !== null);

    return (
        <Card
            expansivel="tela"
            title={`${nome}: curso x média nacional`}
            info={`O ${nome} contínuo do curso escolhido em cada edição do Enade, contra a média nacional dos cursos da mesma área de avaliação na mesma edição. O seletor troca entre o CPC e o Conceito Enade.`}
            action={
                // duas opções: as duas à vista, como as sub-abas
                <Segmentado
                    label="Indicador"
                    value={metrica}
                    options={[
                        { value: "cpc", label: "CPC" },
                        { value: "enade", label: "Conceito Enade" },
                    ]}
                    onChange={(v) => {
                        metricaEscolhida = v;
                        setMetrica(v);
                    }}
                />
            }
            subtitle={
                area
                    ? `Média dos cursos de ${toTitleCase(area)} no Brasil`
                    : "Média dos cursos da mesma área no Brasil"
            }
            className={className}
        >
            {opcoes.length === 0 || !avaliado ? (
                <p className="text-text-secondary mt-6 text-[13px]">
                    {opcoes.length === 0
                        ? `Nenhum curso da cidade com ${nome} avaliado.`
                        : `${toTitleCase(cursos.find((c) => c.codigo_curso === codigo)?.nome_curso ?? "Este curso")} ainda não tem ${nome} avaliado (sem ciclo do Enade). Escolha outro curso no seletor acima.`}
                </p>
            ) : (
                <>
                    <CursoNacionalLinha
                        key={`${codigo}-${metrica}`}
                        rows={rows}
                        nome={nome}
                    />

                    {semCpc > 0 && (
                        <p className="text-text-muted mt-2 text-[11px]">
                            {semCpc} {semCpc === 1 ? "curso" : "cursos"} da cidade ainda
                            sem {nome} (sem ciclo do Enade) não{" "}
                            {semCpc === 1 ? "aparece" : "aparecem"} na lista.
                        </p>
                    )}
                </>
            )}
        </Card>
    );
}
