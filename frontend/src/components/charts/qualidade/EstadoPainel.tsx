import { useState, type ReactNode } from "react";

import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { FaixaPill } from "@/components/charts/qualidade/FaixaPill";
import { useChartTheme } from "@/hooks/useChartTheme";
import {
    INDICADORES,
    percentil,
    ranking,
    type CursoArea,
    type Indicador,
    type ResumoArea,
} from "@/lib/area";
import { COMPONENTES } from "@/lib/cpc";
import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const TOP = 10;

/** Painel ao lado do mapa: o recorte escolhido (Brasil ou um estado) em
 * números, no indicador escolhido no mapa (CPC, IDD ou Conceito Enade) —
 * cursos, média, faixas, onde o curso do campus fica entre os pares, as
 * notas médias do estado contra o Brasil e os melhores cursos. */
export function EstadoPainel({
    titulo,
    cursos,
    resumo,
    brasil,
    ehEstado,
    indicador,
    cursoCampus,
}: {
    titulo: string;
    cursos: CursoArea[];
    resumo: ResumoArea;
    brasil: ResumoArea;
    ehEstado: boolean;
    indicador: Indicador;
    cursoCampus: CursoArea | undefined;
}) {
    const CHART = useChartTheme();
    const ind = INDICADORES[indicador];
    const media = resumo.medias[indicador];
    const mediaBrasil = brasil.medias[indicador];
    const faixas = resumo.faixas[indicador];
    const pctAltas = resumo.pctAltas[indicador];
    const valorCampus = cursoCampus ? ind.doCurso(cursoCampus) : null;
    const ordenados = ranking(cursos, indicador);
    const top = ordenados.slice(0, TOP);
    const posicaoCampus = cursoCampus
        ? ordenados.findIndex((c) => c.codigo === cursoCampus.codigo)
        : -1;
    const campusForaDoTop = posicaoCampus >= TOP;
    const totalFaixas = faixas.reduce((a, b) => a + b, 0);
    // faixa em foco (mouse na barra ou na legenda, ou toque): o pedaço dela
    // engrossa, os outros apagam e o item da legenda se destaca — como nos
    // medidores da Visão do campus
    const [foco, setFoco] = useState<number | null>(null);
    const corFaixa = (i: number) => (i < 5 ? CHART.faixa.ramp[i] : CHART.presenca.none);

    return (
        <div className="flex flex-col gap-6">
            {/* o mesmo espaço entre os três (rótulos de larguras diferentes),
                com o do meio centrado no próprio rótulo */}
            <dl className="flex justify-between gap-3">
                <Kpi label="Cursos">{formatInteger(resumo.cursos)}</Kpi>
                <Kpi
                    centro
                    label={ind.label}
                    extra={
                        ehEstado && media !== null && mediaBrasil !== null ? (
                            <DeltaPill size="sm" diff={media - mediaBrasil} />
                        ) : null
                    }
                >
                    {media === null ? "—" : formatDecimal(media)}
                </Kpi>
                <Kpi label="Faixas 4 e 5">
                    {pctAltas === null ? "—" : formatPercent(pctAltas, 0)}
                </Kpi>
            </dl>

            <Secao titulo={`Cursos por faixa do ${ind.nome}`}>
                <div
                    className="flex h-4 w-full items-center gap-[2px]"
                    onMouseLeave={() => setFoco(null)}
                    aria-hidden
                >
                    {faixas.map((n, i) =>
                        n === 0 ? null : (
                            <span
                                key={i}
                                onMouseEnter={() => setFoco(i)}
                                onClick={() => setFoco(foco === i ? null : i)}
                                className={cn(
                                    "cursor-pointer transition-[height,opacity] duration-200 first:rounded-l-full last:rounded-r-full",
                                    foco === i ? "h-4" : "h-3",
                                    foco !== null && foco !== i && "opacity-35"
                                )}
                                style={{ flexGrow: n, background: corFaixa(i) }}
                            />
                        )
                    )}
                </div>
                <p
                    className="text-text-secondary mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]"
                    onMouseLeave={() => setFoco(null)}
                >
                    {faixas.map((n, i) =>
                        n === 0 ? null : (
                            <span
                                key={i}
                                onMouseEnter={() => setFoco(i)}
                                className={cn(
                                    "flex items-center gap-1.5 whitespace-nowrap transition-opacity duration-200",
                                    foco === i && "text-ink font-semibold",
                                    foco !== null && foco !== i && "opacity-45"
                                )}
                            >
                                <span
                                    aria-hidden
                                    className="h-2 w-2 rounded-[3px]"
                                    style={{ background: corFaixa(i) }}
                                />
                                {i < 5 ? `Faixa ${i + 1}` : "Sem conceito"}:{" "}
                                <span className="text-ink font-semibold">{n}</span>
                                <span className="text-text-muted">
                                    ({formatPercent((100 * n) / totalFaixas, 0)})
                                </span>
                            </span>
                        )
                    )}
                </p>
            </Secao>

            {cursoCampus && valorCampus !== null && (
                <PosicaoCampus
                    cursos={cursos}
                    curso={cursoCampus}
                    valor={valorCampus}
                    indicador={indicador}
                    posicao={posicaoCampus}
                    ehEstado={ehEstado}
                    titulo={titulo}
                />
            )}

            {ehEstado && (
                <Secao titulo={`Notas médias: ${titulo} × Brasil`}>
                    <ul className="flex flex-col gap-1.5">
                        {COMPONENTES.map((c) => {
                            const uf = resumo.notas[c.key];
                            const br = brasil.notas[c.key];
                            return (
                                <li
                                    key={c.key}
                                    className="grid grid-cols-[minmax(0,1fr)_44px_64px] items-center gap-2 text-[12px]"
                                >
                                    <span className="truncate" title={c.nome}>
                                        {c.nome}
                                    </span>
                                    <span className="text-right font-semibold tabular-nums">
                                        {uf === null ? "—" : formatDecimal(uf)}
                                    </span>
                                    <span className="flex justify-end">
                                        {uf !== null && br !== null ? (
                                            <DeltaPill size="sm" diff={uf - br} />
                                        ) : (
                                            <span className="text-text-muted">—</span>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </Secao>
            )}

            <Secao
                titulo={`Melhores ${ind.plural}${ehEstado ? ` em ${titulo}` : " do Brasil"}`}
            >
                <ol className="flex flex-col">
                    {top.map((c, i) => (
                        <LinhaCurso
                            key={c.codigo}
                            curso={c}
                            indicador={indicador}
                            posicao={i + 1}
                            campus={c.codigo === cursoCampus?.codigo}
                        />
                    ))}
                    {campusForaDoTop && cursoCampus && (
                        <>
                            <li
                                aria-hidden
                                className="text-text-muted py-1 pl-2 text-[12px]"
                            >
                                ⋯
                            </li>
                            <LinhaCurso
                                curso={cursoCampus}
                                indicador={indicador}
                                posicao={posicaoCampus + 1}
                                campus
                            />
                        </>
                    )}
                </ol>
            </Secao>
        </div>
    );
}

function Kpi({
    label,
    extra,
    centro = false,
    children,
}: {
    label: string;
    extra?: ReactNode;
    /** O valor centrado embaixo do rótulo. */
    centro?: boolean;
    children: ReactNode;
}) {
    return (
        <div className={cn("min-w-0", centro && "text-center")}>
            <dt className="text-text-muted text-[11px]">{label}</dt>
            <dd
                className={cn(
                    "mt-1 flex flex-wrap items-center gap-1.5 text-[20px] leading-none font-semibold tracking-[-0.02em] tabular-nums",
                    centro && "justify-center"
                )}
            >
                {children}
                {extra}
            </dd>
        </div>
    );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <section>
            <h3 className="text-text-muted mb-2.5 text-[11px] font-medium tracking-wide uppercase">
                {titulo}
            </h3>
            {children}
        </section>
    );
}

function LinhaCurso({
    curso,
    indicador,
    posicao,
    campus,
}: {
    curso: CursoArea;
    indicador: Indicador;
    posicao: number;
    campus: boolean;
}) {
    const valor = INDICADORES[indicador].doCurso(curso);
    return (
        <li
            className={cn(
                "grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]",
                campus && "bg-lime/25 ring-lime ring-1"
            )}
        >
            <span className="text-text-muted tabular-nums">{posicao}º</span>
            <span
                className="min-w-0"
                title={`${curso.nomeIes} — ${curso.nomeMunicipio}/${curso.uf}`}
            >
                <span className="block truncate font-medium">
                    {curso.siglaIes ?? curso.nomeIes}
                    {campus && (
                        <span className="bg-lime text-on-lime ml-1.5 rounded px-1 py-px text-[10px] font-bold">
                            seu curso
                        </span>
                    )}
                </span>
                <span className="text-text-muted block truncate text-[11px]">
                    {curso.nomeMunicipio}/{curso.uf}
                    {curso.publica === true
                        ? " · pública"
                        : curso.publica === false
                          ? " · privada"
                          : ""}
                </span>
            </span>
            <span className="font-semibold tabular-nums">
                {valor === null ? "—" : formatDecimal(valor)}
            </span>
            <FaixaPill faixa={INDICADORES[indicador].faixaDoCurso(curso)} />
        </li>
    );
}

/** Histograma do indicador nos cursos do recorte (faixas de 0,25) com a
 * barra do curso do campus em oliva, e o percentil. */
function PosicaoCampus({
    cursos,
    curso,
    valor,
    indicador,
    posicao,
    ehEstado,
    titulo,
}: {
    cursos: CursoArea[];
    curso: CursoArea;
    /** O valor do curso do campus no indicador. */
    valor: number;
    indicador: Indicador;
    posicao: number;
    ehEstado: boolean;
    titulo: string;
}) {
    const CHART = useChartTheme();
    const { doCurso, nome } = INDICADORES[indicador];
    const LARGURA = 0.25;
    const bins = Array.from({ length: 20 }, () => 0);
    for (const c of cursos) {
        const v = doCurso(c);
        if (v === null) continue;
        bins[Math.min(Math.floor(v / LARGURA), 19)]++;
    }
    const doCampus = Math.min(Math.floor(valor / LARGURA), 19);
    const max = Math.max(...bins, 1);
    const pct = percentil(
        cursos.filter((c) => c.codigo !== curso.codigo),
        valor,
        indicador
    );
    // fora do recorte (ex.: um estado onde o campus não está): onde ficaria
    const noRecorte = posicao >= 0;
    const colocacao = noRecorte
        ? posicao + 1
        : cursos.filter((c) => (doCurso(c) ?? -Infinity) > valor).length + 1;
    const comValor = cursos.filter((c) => doCurso(c) !== null).length;

    return (
        <Secao
            titulo={`Posição do seu curso ${ehEstado ? `em ${titulo}` : "no Brasil"}`}
        >
            <p className="text-[13px] leading-snug">
                {!noRecorte && <span className="text-text-secondary">Ficaria em </span>}
                <span className="text-[20px] font-semibold tabular-nums">
                    {colocacao}º
                </span>{" "}
                <span className="text-text-secondary">
                    de {formatInteger(comValor)} cursos com {nome}
                    {pct !== null && (
                        <>
                            {" "}
                            · {nome} maior que o de{" "}
                            <span className="text-ink font-semibold">
                                {formatPercent(pct, 0)}
                            </span>{" "}
                            deles
                        </>
                    )}
                </span>
            </p>
            <div className="mt-3 flex h-14 items-end gap-[2px]" aria-hidden>
                {bins.map((n, i) => (
                    <span
                        key={i}
                        className="flex-1 rounded-t-[3px]"
                        style={{
                            height: n === 0 ? 0 : `${Math.max((n / max) * 100, 4)}%`,
                            // só a cor marca a barra do seu curso: oliva (o limão
                            // sem contorno sumiria no fundo claro)
                            background: i === doCampus ? CHART.brand : CHART.deemphasis,
                        }}
                    />
                ))}
            </div>
            <div className="text-text-muted mt-1 flex justify-between text-[10px] tabular-nums">
                {[0, 1, 2, 3, 4, 5].map((t) => (
                    <span key={t}>{t}</span>
                ))}
            </div>
        </Secao>
    );
}
