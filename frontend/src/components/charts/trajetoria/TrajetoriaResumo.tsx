import { Tile } from "@/components/cards/Tile";
import { TextoAjustado } from "@/components/charts/TextoAjustado";
import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatDecimal, formatPercent, formatPoints } from "@/lib/format";
import {
    evasaoPorAnoDoCurso,
    indicadoresMaduros,
    picoEvasao,
    tempoMedioConclusao,
    type CursoTrajetoria,
    type Turma,
} from "@/lib/trajetoria";
import type { DashboardData } from "@/types/dashboard";

/** Quatro indicadores no topo do Panorama: conclusão das turmas maduras
 * (contra o Brasil), o ano do curso em que a evasão mais acontece (o mesmo
 * destaque do campus em "Em que ano do curso a evasão acontece"), o tempo médio até
 * concluir e quantas turmas ainda estão em andamento. As turmas maduras são
 * a mais recente de cada curso que já teve tempo de se formar. */
export function TrajetoriaResumo({
    data,
    cursos,
}: {
    data: DashboardData;
    cursos: CursoTrajetoria[];
}) {
    const CHART = useChartTheme();
    // a mesma conta dos cards do Início (os números batem)
    const maduros = indicadoresMaduros(data, cursos);
    const final = maduros ? { concluiu: maduros.concluiu } : null;
    const nacional = maduros?.concluiuBrasil ?? null;

    const todasMaduras = cursos.flatMap((c) => c.turmas.filter((t) => t.madura));
    const porAno = evasaoPorAnoDoCurso(todasMaduras);
    const pico = picoEvasao(porAno);
    const tempo = tempoMedioConclusao(todasMaduras);
    const prazos = [
        ...new Set(cursos.map((c) => c.prazo).filter((p) => p !== null)),
    ].sort();

    const todas = cursos.flatMap((c) => c.turmas);
    const andamento = todas.filter((t: Turma) => !t.madura).length;

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4 lg:gap-6">
            <Tile
                label="Conclusão"
                info="Taxa de Conclusão Acumulada (TCA) da turma madura mais recente de cada curso (a que já teve o prazo do curso e mais dois anos): percentual de ingressantes que concluíram. Comparada com os mesmos cursos no Brasil, no mesmo ponto."
                value={final ? formatPercent(final.concluiu, 0) : "—"}
                badge={
                    final && nacional !== null ? (
                        <DeltaPill
                            diff={final.concluiu - nacional}
                            limiar={0.5}
                            format={(v) => formatPoints(v, 0)}
                        />
                    ) : null
                }
                footer={
                    <TextoAjustado maximo={12} minimo={10}>
                        {nacional === null
                            ? "Sem média nacional para comparar"
                            : `Média nacional dos mesmos cursos: ${formatPercent(nacional, 0)}`}
                    </TextoAjustado>
                }
            />
            <Tile
                label="Ano com mais evasão"
                info="O ano do curso em que a evasão das turmas maduras mais acontece: a Taxa de Desistência Anual (TADA) desse ano como parte de toda a desistência (TDA) até dois anos depois do prazo. É o destaque do campus em “Em que ano do curso a evasão acontece”. No 1º ano, pede acolhimento de calouros; mais tarde, atenção ao meio e ao fim do curso."
                value={pico === null ? "—" : formatPercent(100 * pico.fracao, 0)}
                footer={
                    pico === null
                        ? "Sem evasão nas turmas maduras"
                        : `de toda a evasão acontece no ${pico.ano}º ano`
                }
                lateral={
                    pico === null ? undefined : (
                        <MiniRosca
                            fracao={pico.fracao}
                            ano={pico.ano}
                            cor={CHART.critical}
                        />
                    )
                }
            />
            <Tile
                label="Tempo até concluir"
                info="Média de anos de curso de quem concluiu nas turmas maduras (até dois anos depois do prazo)."
                value={tempo === null ? "—" : `${formatDecimal(tempo, 1)} anos`}
                footer={
                    prazos.length === 0
                        ? "Sem prazo previsto"
                        : `Prazo previsto: ${prazos.length === 1 ? prazos[0] : `${prazos[0]} a ${prazos.at(-1)}`} anos`
                }
            />
            <Tile
                label="Turmas em andamento"
                info="Turmas que ainda não completaram o prazo do curso e mais dois anos: ainda podem concluir ou desistir, então ficam fora das comparações (aparecem tracejadas nos gráficos)."
                value={`${andamento} de ${todas.length}`}
                footer={
                    <TextoAjustado maximo={12} minimo={10}>
                        {todas.length - andamento} maduras; compara-se a mais recente de
                        cada curso
                    </TextoAjustado>
                }
            />
        </div>
    );
}

/** Rosca pequena de uma fração (0-1) sobre o trilho cinza, com o ano no meio. */
function MiniRosca({ fracao, ano, cor }: { fracao: number; ano: number; cor: string }) {
    const CHART = useChartTheme();
    const S = 64;
    const T = 9;
    const R = (S - T) / 2;
    const volta = 2 * Math.PI * R;
    const arco = Math.max(Math.min(fracao, 1), 0) * volta;
    return (
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
            <g transform={`rotate(-90 ${S / 2} ${S / 2})`}>
                <circle
                    cx={S / 2}
                    cy={S / 2}
                    r={R}
                    fill="none"
                    stroke={CHART.deemphasis}
                    strokeWidth={T}
                />
                <circle
                    cx={S / 2}
                    cy={S / 2}
                    r={R}
                    fill="none"
                    stroke={cor}
                    strokeWidth={T}
                    strokeDasharray={`${arco} ${volta - arco}`}
                    strokeLinecap="round"
                />
            </g>
            <text
                x={S / 2}
                y={S / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={600}
                className="fill-ink"
            >
                {ano}º ano
            </text>
        </svg>
    );
}
