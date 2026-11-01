import type { ReactNode } from "react";

import { DeltaPill } from "@/components/charts/qualidade/DeltaPill";
import { FaixaPill } from "@/components/charts/qualidade/FaixaPill";
import {
    INDICADORES,
    ranking,
    type CursoArea,
    type Indicador,
    type ResumoArea,
} from "@/lib/area";
import { COMPONENTES } from "@/lib/cpc";
import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Quantos cursos a lista dos melhores mostra: o bastante pra preencher o
 * painel mesmo numa tela alta (no modo apresentação, em tela cheia); quando
 * não cabem, a lista rola por dentro. */
const TOP = 20;

/** Painel ao lado do mapa: o recorte escolhido (Brasil ou um estado) em
 * números, no indicador escolhido no mapa (CPC, IDD ou Conceito Enade) —
 * cursos, média, % nas faixas 4 e 5, as notas médias do estado contra as do
 * curso da unidade e os melhores cursos (com o curso da unidade na posição em
 * que fica, ou ficaria). */
export function EstadoPainel({
    titulo,
    cursos,
    resumo,
    brasil,
    ehEstado,
    indicador,
    cursoUnidade,
    avisoFora,
}: {
    titulo: string;
    cursos: CursoArea[];
    resumo: ResumoArea;
    brasil: ResumoArea;
    ehEstado: boolean;
    indicador: Indicador;
    cursoUnidade: CursoArea | undefined;
    /** Por que o curso da unidade está fora do recorte (outro estado, ou fora
     * do filtro de rede): a nota embaixo da lista. */
    avisoFora: string | null;
}) {
    const ind = INDICADORES[indicador];
    const media = resumo.medias[indicador];
    const mediaBrasil = brasil.medias[indicador];
    const pctAltas = resumo.pctAltas[indicador];
    const valorUnidade = cursoUnidade ? ind.doCurso(cursoUnidade) : null;
    // o curso da unidade fora do recorte (um estado onde ele não está): entra
    // na lista na posição em que ficaria
    const foraDoRecorte =
        cursoUnidade !== undefined &&
        valorUnidade !== null &&
        !cursos.some((c) => c.codigo === cursoUnidade.codigo);
    const ordenados = ranking(
        foraDoRecorte ? [...cursos, cursoUnidade] : cursos,
        indicador
    );
    const top = ordenados.slice(0, TOP);
    const posicaoUnidade = cursoUnidade
        ? ordenados.findIndex((c) => c.codigo === cursoUnidade.codigo)
        : -1;
    const unidadeForaDoTop = posicaoUnidade >= TOP;

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

            {ehEstado && (
                <Secao titulo={`Notas médias: ${titulo} × seu curso`}>
                    {/* as três colunas de dados com a mesma largura e o
                        conteúdo centrado: o mesmo espaço entre elas */}
                    <div className="text-text-muted grid grid-cols-[minmax(0,1fr)_repeat(3,72px)] items-center gap-2 pb-1.5 text-[11px]">
                        <span />
                        <span className="truncate text-center" title={titulo}>
                            {titulo}
                        </span>
                        <span className="text-center">Seu curso</span>
                        <span />
                    </div>
                    <ul className="flex flex-col gap-1.5">
                        {COMPONENTES.map((c) => {
                            const uf = resumo.notas[c.key];
                            const seu = cursoUnidade ? cursoUnidade.notas[c.key] : null;
                            return (
                                <li
                                    key={c.key}
                                    className="grid grid-cols-[minmax(0,1fr)_repeat(3,72px)] items-center gap-2 text-[12px]"
                                >
                                    <span className="truncate" title={c.nome}>
                                        {c.nome}
                                    </span>
                                    <span className="text-text-secondary text-center tabular-nums">
                                        {uf === null ? "—" : formatDecimal(uf)}
                                    </span>
                                    <span className="text-center font-semibold tabular-nums">
                                        {seu === null ? "—" : formatDecimal(seu)}
                                    </span>
                                    {/* o seu curso em relação ao estado */}
                                    <span className="flex justify-center">
                                        {uf !== null && seu !== null ? (
                                            <DeltaPill size="sm" diff={seu - uf} />
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
                            unidade={c.codigo === cursoUnidade?.codigo}
                        />
                    ))}
                    {unidadeForaDoTop && cursoUnidade && (
                        <>
                            <li
                                aria-hidden
                                className="text-text-muted py-1 pl-2 text-[12px]"
                            >
                                ⋯
                            </li>
                            <LinhaCurso
                                curso={cursoUnidade}
                                indicador={indicador}
                                posicao={posicaoUnidade + 1}
                                unidade
                            />
                        </>
                    )}
                </ol>
                {foraDoRecorte && avisoFora && (
                    <p className="text-text-muted mt-2 text-[11px]">{avisoFora}</p>
                )}
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
    unidade,
}: {
    curso: CursoArea;
    indicador: Indicador;
    posicao: number;
    unidade: boolean;
}) {
    const valor = INDICADORES[indicador].doCurso(curso);
    return (
        <li
            className={cn(
                "grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]",
                unidade && "bg-lime/25 ring-lime ring-1"
            )}
        >
            <span className="text-text-muted tabular-nums">{posicao}º</span>
            <span
                className="min-w-0"
                title={`${curso.nomeIes} — ${curso.nomeMunicipio}/${curso.uf}`}
            >
                <span className="block truncate font-medium">
                    {curso.siglaIes ?? curso.nomeIes}
                    {unidade && (
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
