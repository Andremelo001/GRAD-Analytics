import { Check, Info, TriangleAlert } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

import { Card } from "@/components/cards/Card";
import { DataTable } from "@/components/charts/DataTable";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { Notas } from "@/lib/comparacao";
import { COMPONENTES, FAIXA_LIMITES, PARTICIPACAO_BAIXA } from "@/lib/cpc";
import { formatDecimal, formatPercent, toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

// Cards da sub-aba Comparações (Qualidade): sempre dois lados, A (oliva) e B
// (violeta) — ``CHART.comparacao`` — com o nome de cada lado escrito na
// legenda (a cor nunca vai sozinha).

export interface Lados {
    a: string;
    b: string;
}

/** Legenda "● A  ● B" com os nomes. */
export function LegendaLados({ lados }: { lados: Lados }) {
    const CHART = useChartTheme();
    return (
        <div className="text-text-secondary flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            {(["a", "b"] as const).map((lado) => (
                <span key={lado} className="flex min-w-0 items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: CHART.comparacao[lado] }}
                    />
                    <span className="truncate">{lados[lado]}</span>
                </span>
            ))}
        </div>
    );
}

export interface LinhaLadoALado {
    label: string;
    a: number | null;
    b: number | null;
    formato: (v: number) => string;
    /** Maior é melhor (padrão); ``false`` pra métricas como evasão. */
    maiorMelhor?: boolean;
    /** Sem vencedor (ex.: contagens). */
    neutro?: boolean;
}

/** Indicadores lado a lado: valor de A | indicador | valor de B, com o lado
 * à frente marcado (✓ e fundo da cor dele). */
export function LadoALadoCard({
    titulo,
    subtitulo,
    lados,
    linhas,
    rodape,
    action,
    className,
}: {
    titulo: string;
    subtitulo?: string;
    lados: Lados;
    linhas: LinhaLadoALado[];
    rodape?: ReactNode;
    /** À direita do título (ex.: o seletor do lado B). */
    action?: ReactNode;
    className?: string;
}) {
    const CHART = useChartTheme();
    return (
        <Card
            expansivel
            title={titulo}
            subtitle={subtitulo}
            action={action}
            className={className}
        >
            {/* legenda na mesma grade das linhas: cada nome em cima da coluna
                dos seus valores */}
            <div className="text-text-secondary mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[12px]">
                {(["a", "b"] as const).map((lado) => (
                    <span
                        key={lado}
                        className={cn(
                            "flex min-w-0 items-center justify-center gap-1.5 text-center",
                            lado === "a" ? "col-start-1" : "col-start-3"
                        )}
                    >
                        <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: CHART.comparacao[lado] }}
                        />
                        {/* nome inteiro: se não couber, quebra depois do "·"
                            (instituição numa linha, cidade na outra) */}
                        <span>
                            {lados[lado].split(" · ").map((parte, i, partes) => (
                                <Fragment key={i}>
                                    <span className="inline-block whitespace-nowrap">
                                        {parte}
                                        {i < partes.length - 1 && <>&nbsp;·</>}
                                    </span>
                                    {/* espaço comum entre os pedaços: é onde a
                                        linha pode quebrar */}
                                    {i < partes.length - 1 && " "}
                                </Fragment>
                            ))}
                        </span>
                    </span>
                ))}
                <span aria-hidden className="col-start-2 row-start-1 w-28 sm:w-32" />
            </div>
            {/* as linhas dividem a altura do card (que pode estar esticado à
                do vizinho): sem espaço vazio no fim */}
            <dl className="mt-3 flex flex-1 flex-col">
                {linhas.map((l) => {
                    const ambos = l.a !== null && l.b !== null;
                    const empate = ambos && Math.abs(l.a! - l.b!) < 0.005;
                    const aFrente =
                        ambos && !empate && !l.neutro
                            ? l.a! > l.b! === (l.maiorMelhor ?? true)
                                ? "a"
                                : "b"
                            : null;
                    const valor = (lado: "a" | "b") => {
                        const v = l[lado];
                        const vence = aFrente === lado;
                        return (
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[15px] font-semibold whitespace-nowrap tabular-nums",
                                    !vence && "text-text-secondary font-medium"
                                )}
                                style={
                                    vence
                                        ? { background: `${CHART.comparacao[lado]}26` }
                                        : undefined
                                }
                            >
                                {vence && (
                                    <Check
                                        size={13}
                                        strokeWidth={3}
                                        aria-label="à frente"
                                    />
                                )}
                                {v === null ? "—" : l.formato(v)}
                            </span>
                        );
                    };
                    return (
                        <div
                            key={l.label}
                            className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-current/5 py-2 last:border-0"
                        >
                            <dd className="flex justify-center">{valor("a")}</dd>
                            <dt className="text-text-muted w-28 text-center text-[12px] sm:w-32">
                                {l.label}
                            </dt>
                            <dd className="flex justify-center">{valor("b")}</dd>
                        </div>
                    );
                })}
            </dl>
            {rodape && (
                // mesmo formato da nota de "Quanto falta para a próxima faixa"
                <p className="text-text-muted mt-auto flex gap-2 pt-3 text-[11px] leading-snug">
                    <Info
                        size={13}
                        strokeWidth={2}
                        aria-hidden
                        className="mt-px shrink-0"
                    />
                    <span>{rodape}</span>
                </p>
            )}
        </Card>
    );
}

/** As 9 notas (0 a 5) em barras espelhadas (``EspelhoCard``). */
export function ComponentesEspelhoCard({
    titulo,
    subtitulo,
    lados,
    a,
    b,
    className,
}: {
    titulo: string;
    subtitulo?: string;
    lados: Lados;
    a: Notas;
    b: Notas;
    className?: string;
}) {
    return (
        <EspelhoCard
            titulo={titulo}
            subtitulo={subtitulo}
            lados={lados}
            className={className}
            coluna="Componente"
            linhas={COMPONENTES.map((c) => ({
                key: c.key,
                nome: c.nome,
                curto: c.curto,
                a: a[c.key],
                b: b[c.key],
            }))}
            maximo={5}
            formato={(v) => formatDecimal(v)}
            rodape="Notas padronizadas de 0 a 5: medem a posição de cada curso entre os cursos da mesma área no país."
        />
    );
}

export interface LinhaEspelho {
    key: string;
    nome: string;
    /** Nome curto, no celular (padrão: o nome). */
    curto?: string;
    a: number | null;
    b: number | null;
}

/** Barras espelhadas: A cresce pra esquerda, B pra direita, a partir do nome
 * da linha no meio (escala de 0 a ``maximo``). O lado à frente vai em
 * negrito — o maior, ou o menor com ``maiorMelhor={false}``. */
export function EspelhoCard({
    titulo,
    subtitulo,
    lados,
    linhas,
    maximo,
    formato,
    maiorMelhor = true,
    coluna,
    rodape,
    className,
}: {
    titulo: string;
    subtitulo?: string;
    lados: Lados;
    linhas: LinhaEspelho[];
    maximo: number;
    formato: (v: number) => string;
    maiorMelhor?: boolean;
    /** Cabeçalho da coluna dos nomes na tabela pra leitores de tela. */
    coluna: string;
    rodape: ReactNode;
    className?: string;
}) {
    const CHART = useChartTheme();
    const barra = (v: number | null, lado: "a" | "b") => (
        <span
            className={cn(
                "flex h-full items-center gap-2",
                lado === "a" ? "flex-row-reverse" : "flex-row"
            )}
        >
            <span className="bg-page relative h-2.5 flex-1 rounded-full">
                {v !== null && (
                    <span
                        className={cn(
                            "absolute inset-y-0 rounded-full",
                            lado === "a" ? "right-0" : "left-0"
                        )}
                        style={{
                            width: `${Math.min((v / maximo) * 100, 100)}%`,
                            background: CHART.comparacao[lado],
                        }}
                    />
                )}
            </span>
        </span>
    );
    return (
        <Card
            expansivel
            title={titulo}
            subtitle={subtitulo}
            className={className}
            // legenda à direita, na linha do subtítulo
            action={
                <div className="self-end">
                    <LegendaLados lados={lados} />
                </div>
            }
        >
            {/* as linhas dividem a altura do card (esticado à do vizinho): sem
                espaço vazio antes da nota do rodapé */}
            <ul className="mt-4 flex flex-1 flex-col gap-2">
                {linhas.map((l) => {
                    const va = l.a;
                    const vb = l.b;
                    const ganha =
                        va !== null && vb !== null && Math.abs(va - vb) >= 0.005
                            ? va > vb === maiorMelhor
                                ? "a"
                                : "b"
                            : null;
                    return (
                        <li
                            key={l.key}
                            className="grid min-h-5 flex-1 grid-cols-[40px_minmax(0,1fr)_minmax(0,120px)_minmax(0,1fr)_40px] items-center gap-2 text-[12px] sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,200px)_minmax(0,1fr)_44px]"
                        >
                            <span
                                className={cn(
                                    "text-right tabular-nums",
                                    ganha === "a"
                                        ? "text-ink font-bold"
                                        : "text-text-secondary"
                                )}
                            >
                                {va === null ? "—" : formato(va)}
                            </span>
                            {barra(va, "a")}
                            <span
                                className="truncate text-center font-medium"
                                title={l.nome}
                            >
                                {/* no celular, o nome curto (FG, CE, IDD…) */}
                                <span className="sm:hidden">{l.curto ?? l.nome}</span>
                                <span className="hidden sm:inline">{l.nome}</span>
                            </span>
                            {barra(vb, "b")}
                            <span
                                className={cn(
                                    "tabular-nums",
                                    ganha === "b"
                                        ? "text-ink font-bold"
                                        : "text-text-secondary"
                                )}
                            >
                                {vb === null ? "—" : formato(vb)}
                            </span>
                        </li>
                    );
                })}
            </ul>
            <p className="text-text-muted mt-auto flex gap-2 pt-4 text-[11px] leading-snug">
                <Info
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                    className="mt-px shrink-0"
                />
                <span>{rodape}</span>
            </p>
            <div className="sr-only">
                <DataTable
                    columns={[coluna, lados.a, lados.b]}
                    rows={linhas.map((l) => [
                        l.nome,
                        l.a === null ? "—" : formato(l.a),
                        l.b === null ? "—" : formato(l.b),
                    ])}
                />
            </div>
        </Card>
    );
}

/** As áreas que os dois campi oferecem: uma linha por área, A e B como
 * pontos na mesma régua de CPC (faixas de fundo), ligados por um traço, com
 * os valores escritos. */
export function CursosEmComumCard({
    lados,
    areas,
    className,
}: {
    lados: Lados;
    areas: { area: string; a: number; b: number }[];
    className?: string;
}) {
    const CHART = useChartTheme();
    const [hover, setHover] = useState<string | null>(null);
    const valores = areas.flatMap((x) => [x.a, x.b]);
    const lo = Math.max(0, Math.floor((Math.min(...valores, 3) - 0.15) * 4) / 4);
    const hi = Math.min(5, Math.ceil((Math.max(...valores, 4) + 0.15) * 4) / 4);
    const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
    const faixas = [0, ...FAIXA_LIMITES, 5]
        .slice(0, -1)
        .map((de, i) => ({
            faixa: i + 1,
            de: Math.max(de, lo),
            ate: Math.min([...FAIXA_LIMITES, 5][i], hi),
        }))
        .filter((f) => f.ate > f.de);
    const ticks: number[] = [];
    for (let v = Math.ceil(lo * 2) / 2; v <= hi + 1e-9; v += 0.5) ticks.push(v);
    return (
        <Card
            expansivel
            title="Cursos em comum"
            subtitle="Áreas que os dois campi oferecem: o melhor CPC de cada um na área"
            className={className}
            // legenda à direita, na linha do subtítulo
            action={
                areas.length > 0 ? (
                    <div className="self-end">
                        <LegendaLados lados={lados} />
                    </div>
                ) : undefined
            }
        >
            {areas.length === 0 ? (
                <p className="text-text-secondary mt-4 text-[13px]">
                    Os dois campi não têm nenhuma área de avaliação em comum.
                </p>
            ) : (
                <>
                    <div
                        className="mt-4 grid grid-cols-1 gap-x-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"
                        onMouseLeave={() => setHover(null)}
                    >
                        <span className="hidden sm:block" />
                        <span className="text-text-muted relative mb-1 h-4 text-[10px]">
                            {faixas.map((f) => (
                                <span
                                    key={f.faixa}
                                    className="absolute -translate-x-1/2 whitespace-nowrap"
                                    style={{ left: `${pct((f.de + f.ate) / 2)}%` }}
                                >
                                    Faixa {f.faixa}
                                </span>
                            ))}
                        </span>
                        {areas.map((x, i) => {
                            const ativo = hover === x.area;
                            // o menor fica com o valor à esquerda do ponto
                            const esq = x.a <= x.b ? "a" : "b";
                            return (
                                <div key={x.area} className="contents">
                                    <span
                                        className={cn(
                                            "flex min-w-0 items-center pt-3 text-[13px] sm:py-2",
                                            ativo ? "font-semibold" : "font-medium"
                                        )}
                                        title={toTitleCase(x.area)}
                                    >
                                        <span className="truncate">
                                            {toTitleCase(x.area)}
                                        </span>
                                    </span>
                                    <div
                                        className="relative h-12"
                                        onMouseEnter={() => setHover(x.area)}
                                    >
                                        {faixas.map((f, j) => (
                                            <span
                                                key={f.faixa}
                                                aria-hidden
                                                className={cn(
                                                    "absolute inset-y-0",
                                                    j === 0 && "max-sm:rounded-l-lg",
                                                    j === faixas.length - 1 &&
                                                        "max-sm:rounded-r-lg",
                                                    i === 0 &&
                                                        j === 0 &&
                                                        "sm:rounded-tl-lg",
                                                    i === 0 &&
                                                        j === faixas.length - 1 &&
                                                        "sm:rounded-tr-lg",
                                                    i === areas.length - 1 &&
                                                        j === 0 &&
                                                        "sm:rounded-bl-lg",
                                                    i === areas.length - 1 &&
                                                        j === faixas.length - 1 &&
                                                        "sm:rounded-br-lg"
                                                )}
                                                style={{
                                                    left: `${pct(f.de)}%`,
                                                    width: `${pct(f.ate) - pct(f.de)}%`,
                                                    background:
                                                        CHART.faixa.ramp[f.faixa - 1],
                                                    opacity: 0.1,
                                                }}
                                            />
                                        ))}
                                        <span
                                            aria-hidden
                                            className="absolute top-[30px] h-0.5 -translate-y-1/2 rounded-full"
                                            style={{
                                                left: `${pct(Math.min(x.a, x.b))}%`,
                                                width: `${Math.abs(pct(x.a) - pct(x.b))}%`,
                                                background: CHART.deemphasis,
                                            }}
                                        />
                                        {(["a", "b"] as const).map((lado) => (
                                            <span key={lado}>
                                                <span
                                                    className="absolute top-[30px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                                                    style={{
                                                        left: `${pct(x[lado])}%`,
                                                        background:
                                                            CHART.comparacao[lado],
                                                        boxShadow: `0 0 0 2px ${CHART.surface}`,
                                                    }}
                                                />
                                                {/* valor de cada lado, pra fora do traço
                                                    (o menor à esquerda, o maior à direita) */}
                                                <span
                                                    className={cn(
                                                        "absolute top-[30px] -translate-y-1/2 text-[11px] font-semibold tabular-nums",
                                                        lado === esq
                                                            ? "-translate-x-[calc(100%+10px)]"
                                                            : "translate-x-[10px]"
                                                    )}
                                                    style={{ left: `${pct(x[lado])}%` }}
                                                >
                                                    {formatDecimal(x[lado])}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        <span className="hidden sm:block" />
                        <span className="text-text-muted relative mt-1.5 h-4 text-[10px] tabular-nums">
                            {ticks.map((t) => (
                                <span
                                    key={t}
                                    className="absolute -translate-x-1/2"
                                    style={{ left: `${pct(t)}%` }}
                                >
                                    {formatDecimal(t, 1)}
                                </span>
                            ))}
                        </span>
                    </div>
                    <div className="sr-only">
                        <DataTable
                            columns={["Área", lados.a, lados.b]}
                            rows={areas.map((x) => [
                                toTitleCase(x.area),
                                formatDecimal(x.a),
                                formatDecimal(x.b),
                            ])}
                        />
                    </div>
                </>
            )}
        </Card>
    );
}

/** Uma edição do Enade de um curso, pra participação comparada. */
export interface EdicaoParticipacao {
    ano: number;
    inscritos: number | null;
    participantes: number | null;
}

/** Participação no Enade de A e B em cada edição em que pelo menos um dos
 * dois foi avaliado, agrupada por ano: uma barra por curso, inteira = os
 * concluintes inscritos, parte escura = os que fizeram a prova, parte clara =
 * os que faltaram; ao lado, a taxa e a conta (ex.: 88% · 29 de 33). Edição em
 * que um curso não foi avaliado: "sem avaliação". */
export function ParticipacaoComparadaCard({
    lados,
    a,
    b,
    className,
}: {
    lados: Lados;
    a: EdicaoParticipacao[];
    b: EdicaoParticipacao[];
    className?: string;
}) {
    const CHART = useChartTheme();
    const anos = [...new Set([...a, ...b].map((e) => e.ano))].sort((x, y) => y - x);
    const edicao = (lado: "a" | "b", ano: number) =>
        (lado === "a" ? a : b).find((e) => e.ano === ano);
    const taxa = (e: EdicaoParticipacao) =>
        e.inscritos && e.participantes !== null
            ? (100 * e.participantes) / e.inscritos
            : null;

    return (
        <Card
            expansivel
            title="Participação no Enade"
            subtitle="Concluintes inscritos em cada edição: a parte escura fez a prova, a clara não"
            className={className}
            action={
                <div className="self-end">
                    <LegendaLados lados={lados} />
                </div>
            }
        >
            {/* uma grade só pro card inteiro (subgrid nos grupos e nas
                linhas): as colunas de nome e de valor têm a largura do texto
                mais longo e as barras ocupam o resto, iguais em todas as linhas */}
            <div className="mt-4 grid grid-cols-[40px_minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[48px_max-content_minmax(0,1fr)_max-content] sm:gap-x-4">
                {anos.map((ano) => (
                    <div
                        key={ano}
                        className="col-span-full grid grid-cols-subgrid items-center gap-y-2 border-b border-current/5 py-3 first:pt-0 last:border-0 last:pb-0"
                    >
                        <span className="row-span-2 text-[13px] font-semibold tabular-nums">
                            {ano}
                        </span>
                        {(["a", "b"] as const).map((lado) => {
                            const e = edicao(lado, ano);
                            const t = e ? taxa(e) : null;
                            const baixa = t !== null && t < PARTICIPACAO_BAIXA;
                            return (
                                <div
                                    key={lado}
                                    className="col-span-2 col-start-2 grid grid-cols-subgrid items-center gap-y-1 sm:col-span-3"
                                >
                                    <span className="text-text-secondary col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 text-[12px]">
                                        <span
                                            aria-hidden
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{
                                                background: CHART.comparacao[lado],
                                            }}
                                        />
                                        <span className="truncate">{lados[lado]}</span>
                                    </span>
                                    {e && e.inscritos ? (
                                        <span
                                            className="relative col-span-2 row-start-2 h-6 overflow-hidden rounded-[4px] sm:col-span-1 sm:col-start-2 sm:row-start-1"
                                            title={`${e.participantes ?? 0} de ${e.inscritos} inscritos fizeram a prova`}
                                        >
                                            {/* inteira: inscritos (parte clara =
                                                quem não fez a prova) */}
                                            <span
                                                className="absolute inset-0"
                                                style={{
                                                    background: CHART.comparacao[lado],
                                                    opacity: 0.25,
                                                }}
                                            />
                                            <span
                                                className="absolute inset-y-0 left-0 rounded-[4px]"
                                                style={{
                                                    width: `${t ?? 0}%`,
                                                    background: CHART.comparacao[lado],
                                                }}
                                            />
                                        </span>
                                    ) : (
                                        <span className="border-empty col-span-2 row-start-2 h-6 rounded-[4px] border border-dashed sm:col-span-1 sm:col-start-2 sm:row-start-1" />
                                    )}
                                    <span
                                        className={cn(
                                            "col-start-2 row-start-1 text-right text-[12px] whitespace-nowrap tabular-nums sm:col-start-3",
                                            !e && "text-text-muted"
                                        )}
                                    >
                                        {!e ? (
                                            "sem avaliação"
                                        ) : (
                                            <span className="inline-flex items-center gap-1">
                                                {baixa && (
                                                    <TriangleAlert
                                                        size={12}
                                                        strokeWidth={2.5}
                                                        aria-label="participação baixa"
                                                        className="text-status-critical-text"
                                                    />
                                                )}
                                                <span
                                                    className={cn(
                                                        "font-semibold",
                                                        baixa &&
                                                            "text-status-critical-text"
                                                    )}
                                                >
                                                    {t === null
                                                        ? "—"
                                                        : formatPercent(t, 0)}
                                                </span>
                                                <span className="text-text-muted">
                                                    · {e.participantes ?? "—"} de{" "}
                                                    {e.inscritos ?? "—"}
                                                </span>
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="sr-only">
                <DataTable
                    columns={["Edição", lados.a, lados.b]}
                    rows={anos.map((ano) => [
                        String(ano),
                        ...(["a", "b"] as const).map((lado) => {
                            const e = edicao(lado, ano);
                            if (!e) return "sem avaliação";
                            const t = taxa(e);
                            return `${e.participantes ?? "—"} de ${e.inscritos ?? "—"}${t === null ? "" : ` (${formatPercent(t, 0)})`}`;
                        }),
                    ])}
                />
            </div>
        </Card>
    );
}
