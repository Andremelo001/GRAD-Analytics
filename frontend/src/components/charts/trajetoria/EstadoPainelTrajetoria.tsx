import type { ReactNode } from "react";

import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import type { CursoTrajetoriaArea } from "@/hooks/useTrajetoriaArea";
import { formatInteger, formatPoints } from "@/lib/format";
import {
    formatTaxa,
    INDICADORES_MAPA,
    MIN_INGRESSANTES_RANKING,
    rankingTrajetoria,
    type IndicadorMapa,
    type ResumoTrajetoria,
} from "@/lib/trajetoria-mapa";
import { cn } from "@/lib/utils";

const TOP = 10;
const ORDEM: IndicadorMapa[] = ["TCA", "TDA", "TAP"];

/** Painel ao lado do mapa da Trajetória: o recorte escolhido (Brasil ou um
 * estado) em números, no indicador escolhido no mapa (permanência,
 * conclusão ou desistência) — cursos, média, ingressantes, os três
 * indicadores do estado contra o curso do campus e os melhores cursos (com
 * o curso do campus na posição em que fica, ou ficaria). No formato do
 * painel do Mapa da Qualidade. */
export function EstadoPainelTrajetoria({
    titulo,
    cursos,
    resumo,
    brasil,
    ehEstado,
    indicador,
    cursoCampus,
    avisoFora,
}: {
    titulo: string;
    cursos: CursoTrajetoriaArea[];
    resumo: ResumoTrajetoria;
    brasil: ResumoTrajetoria;
    ehEstado: boolean;
    indicador: IndicadorMapa;
    cursoCampus: CursoTrajetoriaArea | undefined;
    /** Por que o curso do campus está fora do recorte (outro estado, ou fora
     * do filtro de rede): a nota embaixo da lista. */
    avisoFora: string | null;
}) {
    const ind = INDICADORES_MAPA[indicador];
    const media = resumo.medias[indicador];
    const mediaBrasil = brasil.medias[indicador];
    const valorCampus = cursoCampus ? ind.doCurso(cursoCampus) : null;
    // a lista dos melhores só com turmas de tamanho razoável (e o curso do
    // campus sempre, se tiver valor)
    const ordenados = rankingTrajetoria(cursos, indicador).filter(
        (c) => ind.doCurso(c) !== null
    );
    // o curso do campus fora do recorte (um estado onde ele não está): entra
    // na lista na posição em que ficaria
    const foraDoRecorte =
        cursoCampus !== undefined &&
        valorCampus !== null &&
        !cursos.some((c) => c.codigo === cursoCampus.codigo);
    const elegiveis = rankingTrajetoria(
        foraDoRecorte ? [...ordenados, cursoCampus] : ordenados,
        indicador
    ).filter(
        (c) =>
            c.turma.ingressantes >= MIN_INGRESSANTES_RANKING ||
            c.codigo === cursoCampus?.codigo
    );
    const top = elegiveis.slice(0, TOP);
    const posicaoLista = cursoCampus
        ? elegiveis.findIndex((c) => c.codigo === cursoCampus.codigo)
        : -1;

    return (
        <div className="flex flex-col gap-6">
            <dl className="flex justify-between gap-3">
                <Kpi label="Cursos">{formatInteger(resumo.cursos)}</Kpi>
                <Kpi
                    centro
                    label={ind.label}
                    extra={
                        ehEstado && media !== null && mediaBrasil !== null ? (
                            <DeltaPill
                                size="sm"
                                diff={media - mediaBrasil}
                                limiar={0.05}
                                format={(v) => formatPoints(v)}
                                maiorMelhor={ind.maiorMelhor}
                            />
                        ) : null
                    }
                >
                    {formatTaxa(media)}
                </Kpi>
                <Kpi label="Ingressantes">{formatInteger(resumo.ingressantes)}</Kpi>
            </dl>

            {ehEstado && (
                <Secao titulo={`Situação final: ${titulo} × seu curso`}>
                    {/* as três colunas de dados com a mesma largura e o
                        conteúdo centrado: o mesmo espaço entre elas */}
                    <div className="text-text-muted grid grid-cols-[minmax(0,1fr)_repeat(3,84px)] items-center gap-2 pb-1.5 text-[11px]">
                        <span />
                        <span className="truncate text-center" title={titulo}>
                            {titulo}
                        </span>
                        <span className="text-center">Seu curso</span>
                        <span />
                    </div>
                    <ul className="flex flex-col gap-1.5">
                        {ORDEM.map((i) => {
                            const uf = resumo.medias[i];
                            const seu = cursoCampus
                                ? INDICADORES_MAPA[i].doCurso(cursoCampus)
                                : null;
                            return (
                                <li
                                    key={i}
                                    className="grid grid-cols-[minmax(0,1fr)_repeat(3,84px)] items-center gap-2 text-[12px]"
                                >
                                    <span
                                        className="truncate"
                                        title={INDICADORES_MAPA[i].label}
                                    >
                                        {/* "Conclusão": o nome inteiro cortaria */}
                                        {INDICADORES_MAPA[i].nome[0].toUpperCase() +
                                            INDICADORES_MAPA[i].nome.slice(1)}
                                    </span>
                                    <span className="text-text-secondary text-center tabular-nums">
                                        {formatTaxa(uf)}
                                    </span>
                                    <span className="text-center font-semibold tabular-nums">
                                        {formatTaxa(seu)}
                                    </span>
                                    {/* o seu curso em relação ao estado */}
                                    <span className="flex justify-center">
                                        {uf !== null && seu !== null ? (
                                            <DeltaPill
                                                size="sm"
                                                diff={seu - uf}
                                                limiar={0.05}
                                                format={(v) => formatPoints(v)}
                                                maiorMelhor={
                                                    INDICADORES_MAPA[i].maiorMelhor
                                                }
                                            />
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
                titulo={`${ind.melhores}${ehEstado ? ` em ${titulo}` : " do Brasil"}`}
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
                    {posicaoLista >= TOP && cursoCampus && (
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
                                posicao={posicaoLista + 1}
                                campus
                            />
                        </>
                    )}
                </ol>
                <p className="text-text-muted mt-2 text-[11px]">
                    {foraDoRecorte && avisoFora && `${avisoFora} `}
                    Só turmas com {MIN_INGRESSANTES_RANKING} ingressantes ou mais.
                </p>
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
    curso: CursoTrajetoriaArea;
    indicador: IndicadorMapa;
    posicao: number;
    campus: boolean;
}) {
    const valor = INDICADORES_MAPA[indicador].doCurso(curso);
    const local = `${curso.nomeMunicipio}${curso.uf ? `/${curso.uf}` : ""}`;
    return (
        <li
            className={cn(
                "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]",
                campus && "bg-lime/25 ring-lime ring-1"
            )}
        >
            <span className="text-text-muted tabular-nums">{posicao}º</span>
            <span className="min-w-0" title={`${curso.nomeIes} — ${local}`}>
                <span className="block truncate font-medium">
                    {curso.siglaIes ?? curso.nomeIes}
                    {campus && (
                        <span className="bg-lime text-on-lime ml-1.5 rounded px-1 py-px text-[10px] font-bold">
                            seu curso
                        </span>
                    )}
                </span>
                <span className="text-text-muted block truncate text-[11px]">
                    {local}
                    {curso.publica === true
                        ? " · pública"
                        : curso.publica === false
                          ? " · privada"
                          : ""}
                    {` · ${formatInteger(curso.turma.ingressantes)} ingressantes em ${curso.turma.ano}`}
                </span>
            </span>
            <span className="font-semibold tabular-nums">{formatTaxa(valor)}</span>
        </li>
    );
}
