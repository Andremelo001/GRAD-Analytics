import { useState, type KeyboardEvent } from "react";

import { Card } from "@/components/cards/Card";
import { DataTable } from "@/components/charts/DataTable";
import { Segmentado } from "@/components/charts/Segmentado";
import { useAbrirNoCampus } from "@/hooks/useAbrirNoCampus";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useResumoCampi } from "@/hooks/useResumoCampi";
import { nomeCampus } from "@/lib/comparacao";
import { FAIXA_LIMITES, faixaDe, faixaNumero } from "@/lib/cpc";
import { formatDecimal, toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResumoCurso } from "@/types/dashboard";

/** O indicador da régua: o CPC ou o Conceito Enade (mesma escala 0-5 e
 * mesmos cortes de faixa), como no "CPC: curso x média nacional". */
type Metrica = "cpc" | "enade";

const METRICAS: Record<
    Metrica,
    {
        nome: string;
        valor: (c: ResumoCurso) => number | null;
        faixa: (c: ResumoCurso, valor: number) => number | null;
    }
> = {
    cpc: {
        nome: "CPC",
        valor: (c) => c.cpc_continuo,
        // a faixa oficial do INEP
        faixa: (c) => faixaNumero(c.cpc_faixa),
    },
    enade: {
        nome: "Conceito Enade",
        valor: (c) => c.conceito_enade_continuo,
        faixa: (_, v) => faixaDe(v),
    },
};

/** A última escolha do seletor: sair da página e voltar mantém o indicador. */
let metricaEscolhida: Metrica = "cpc";

interface Ponto {
    campus: string;
    slug: string;
    curso: ResumoCurso;
    /** O valor do curso no indicador escolhido. */
    valor: number;
}

/** Distância mínima (em % da régua) entre dois rótulos na mesma linha. */
const VAO_ROTULO = 14;

/** O curso escolhido (Por curso) nos outros campi da UFC: o CPC (ou o
 * Conceito Enade, no seletor do card) do curso da mesma área de avaliação em
 * cada campus que o oferece, em pontos numa régua com as faixas de fundo. O
 * deste campus em limão, com o nome e o valor em cima; os outros em cinza,
 * com nome e valor embaixo — em duas linhas que se alternam quando dois
 * pontos ficam perto (faixa e ano no hover). Sem outro campus com a mesma
 * área, o card não aparece. */
export function OutrosCampiCard({
    codigoCurso,
    campusAtual,
    className,
}: {
    codigoCurso: number;
    campusAtual: string;
    className?: string;
}) {
    const CHART = useChartTheme();
    const { resumo } = useResumoCampi();
    const [hover, setHover] = useState<string | null>(null);
    const [metrica, setMetrica] = useState<Metrica>(() => metricaEscolhida);
    const m = METRICAS[metrica];
    const abrirNoCampus = useAbrirNoCampus();
    const abrir = (p: Ponto) =>
        abrirNoCampus(p.slug, `/qualidade/curso/${p.curso.codigo_curso}`, {
            topo: true,
        });

    const curso = resumo?.campi
        .find((c) => c.slug === campusAtual)
        ?.cursos.find((k) => k.codigo_curso === codigoCurso);
    const area = curso?.area_avaliacao;
    if (!resumo || !area || curso?.cpc_continuo == null) return null;

    // o card aparece pelo CPC (a avaliação existe); no Conceito Enade, um
    // campus sem o valor só fica de fora da régua
    const comCpc = resumo.campi.filter((c) =>
        c.cursos.some(
            (k) =>
                k.area_avaliacao === area &&
                k.cpc_continuo !== null &&
                (c.slug !== campusAtual || k.codigo_curso === codigoCurso)
        )
    );
    if (comCpc.length < 2) return null;

    const todos: Ponto[] = resumo.campi.flatMap((c) =>
        c.cursos.flatMap((k) => {
            const valor = m.valor(k);
            return k.area_avaliacao === area &&
                valor !== null &&
                // outros cursos da mesma área neste campus ficam de fora
                (c.slug !== campusAtual || k.codigo_curso === codigoCurso)
                ? [{ campus: nomeCampus(c.nome), slug: c.slug, curso: k, valor }]
                : [];
        })
    );
    const este = todos.find((p) => p.curso.codigo_curso === codigoCurso);

    const seletor = (
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
                setHover(null);
            }}
        />
    );
    const titulo = "Este curso nos outros campi da UFC";
    const info = `O ${m.nome} do mesmo curso (mesma área de avaliação) nos outros campi da UFC, na avaliação mais recente de cada um. O seletor troca entre o CPC e o Conceito Enade.`;
    const subtitulo = `${toTitleCase(area)} · ${m.nome} da avaliação mais recente de cada campus`;

    if (!este || todos.length < 2) {
        return (
            <Card
                expansivel
                title={titulo}
                info={info}
                subtitle={subtitulo}
                action={seletor}
                className={className}
            >
                <p className="text-text-secondary mt-4 text-[13px]">
                    {!este
                        ? `Este curso não tem ${m.nome} na avaliação mais recente.`
                        : `Nenhum outro campus tem ${m.nome} neste curso.`}
                </p>
            </Card>
        );
    }

    const valores = todos.map((p) => p.valor);
    const lo = Math.max(0, Math.floor((Math.min(...valores, 3) - 0.15) * 4) / 4);
    const hi = Math.min(5, Math.ceil((Math.max(...valores, 4) + 0.15) * 4) / 4);
    const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;

    // rótulos dos outros, da esquerda pra direita: alterna de linha quando o
    // vizinho está perto
    const outros = todos.filter((p) => p !== este).sort((x, y) => x.valor - y.valor);
    const niveis: number[] = [];
    outros.forEach((p, i) => {
        const perto = i > 0 && pct(p.valor) - pct(outros[i - 1].valor) < VAO_ROTULO;
        niveis.push(perto ? 1 - niveis[i - 1] : 0);
    });
    const ordem = [...todos].sort((x, y) => y.valor - x.valor);
    const lider = ordem[0];
    const chave = (p: Ponto) => `${p.slug}-${p.curso.codigo_curso}`;
    const ativo = todos.find((p) => chave(p) === hover);

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
            title={titulo}
            info={info}
            subtitle={subtitulo}
            action={seletor}
            className={className}
        >
            {/* uma linha: o campus em foco (hover) ou quem tem o maior valor */}
            <p className="text-text-secondary mt-3 min-h-[20px] min-w-0 truncate text-[13px]">
                {ativo ? (
                    <>
                        <span className="text-ink font-semibold">{ativo.campus}</span>
                        {` | ${m.nome} ${formatDecimal(ativo.valor)}`}
                        {m.faixa(ativo.curso, ativo.valor) !== null &&
                            ` · faixa ${m.faixa(ativo.curso, ativo.valor)}`}
                        {` · avaliado em ${ativo.curso.ano ?? "—"}`}
                    </>
                ) : lider === este ? (
                    <>
                        <span className="text-ink font-semibold">{este.campus}</span>
                        {` tem o maior ${m.nome} da UFC nesta área`}
                    </>
                ) : (
                    <>
                        O maior é{" "}
                        <span className="text-ink font-semibold">{lider.campus}</span>
                        {`, ${formatDecimal(lider.valor)}`}
                    </>
                )}
            </p>

            <div className="mt-4" onMouseLeave={() => setHover(null)}>
                <div className="text-text-muted relative h-4 text-[10px]">
                    {faixas.map((f) => (
                        <span
                            key={f.faixa}
                            className="absolute -translate-x-1/2 whitespace-nowrap"
                            style={{ left: `${pct((f.de + f.ate) / 2)}%` }}
                        >
                            Faixa {f.faixa}
                        </span>
                    ))}
                </div>
                <div className="relative mt-1 h-[104px]">
                    {faixas.map((f, j) => (
                        <span
                            key={f.faixa}
                            aria-hidden
                            className={cn(
                                "absolute inset-y-0",
                                j === 0 && "rounded-l-lg",
                                j === faixas.length - 1 && "rounded-r-lg"
                            )}
                            style={{
                                left: `${pct(f.de)}%`,
                                width: `${pct(f.ate) - pct(f.de)}%`,
                                background: CHART.faixa.ramp[f.faixa - 1],
                                opacity: 0.1,
                            }}
                        />
                    ))}
                    <span
                        aria-hidden
                        className="absolute inset-x-0 top-[44px] h-px"
                        style={{ background: CHART.deemphasis }}
                    />
                    {/* este campus: nome e valor em cima do ponto */}
                    <span
                        className="pointer-events-none absolute top-[10px] -translate-x-1/2 text-[12px] whitespace-nowrap"
                        style={{ left: `${pct(este.valor)}%` }}
                    >
                        <span className="font-semibold">{este.campus}</span>{" "}
                        <span className="tabular-nums">
                            {formatDecimal(este.valor)}
                        </span>
                    </span>
                    {/* outros: nome e valor embaixo, em uma de duas linhas */}
                    {outros.map((p, i) => (
                        <span
                            key={`r-${chave(p)}`}
                            className={cn(
                                "pointer-events-none absolute -translate-x-1/2 text-[11px] whitespace-nowrap transition-[color,opacity] duration-200",
                                // o nome do campus em foco destaca; os outros apagam
                                hover === null
                                    ? "text-text-secondary"
                                    : hover === chave(p)
                                      ? "text-ink font-semibold"
                                      : "text-text-secondary opacity-50"
                            )}
                            style={{
                                left: `${pct(p.valor)}%`,
                                top: niveis[i] === 0 ? 58 : 78,
                            }}
                        >
                            {p.campus}{" "}
                            <span className="tabular-nums">
                                {formatDecimal(p.valor)}
                            </span>
                        </span>
                    ))}
                    {[...outros, este].map((p) => {
                        const atual = p === este;
                        return (
                            <span
                                key={chave(p)}
                                onMouseEnter={() => setHover(chave(p))}
                                // outro campus: clicar abre o curso dele (o
                                // painel troca de campus e sobe pro topo)
                                {...(atual
                                    ? {}
                                    : {
                                          role: "button",
                                          tabIndex: 0,
                                          title: `Abrir ${toTitleCase(p.curso.nome_curso)} em ${p.campus}`,
                                          onFocus: () => setHover(chave(p)),
                                          onClick: () => abrir(p),
                                          onKeyDown: (e: KeyboardEvent) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  abrir(p);
                                              }
                                          },
                                      })}
                                className={cn(
                                    "absolute top-[44px] flex -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 outline-none",
                                    !atual &&
                                        "focus-visible:ring-lime/60 cursor-pointer focus-visible:ring-2"
                                )}
                                style={{ left: `${pct(p.valor)}%` }}
                            >
                                <span
                                    className={cn(
                                        "block rounded-full transition-[scale,box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none",
                                        atual ? "h-4 w-4 border-2" : "h-3 w-3",
                                        // em foco: cresce um pouco, com um anel
                                        hover === chave(p) && "scale-125"
                                    )}
                                    style={{
                                        background: atual
                                            ? CHART.lime
                                            : hover === chave(p)
                                              ? CHART.ink
                                              : CHART.reference,
                                        borderColor: atual ? CHART.onLime : undefined,
                                        // o contorno da cor do card e, em foco, o
                                        // anel por fora (os dois no box-shadow: um
                                        // ``ring`` do Tailwind seria sobrescrito)
                                        boxShadow:
                                            hover === chave(p)
                                                ? `0 0 0 2px ${CHART.surface}, 0 0 0 3.5px ${CHART.ink}`
                                                : `0 0 0 2px ${CHART.surface}`,
                                    }}
                                />
                            </span>
                        );
                    })}
                </div>
                <div className="text-text-muted relative mt-1.5 h-4 text-[10px] tabular-nums">
                    {ticks.map((t) => (
                        <span
                            key={t}
                            className="absolute -translate-x-1/2"
                            style={{ left: `${pct(t)}%` }}
                        >
                            {formatDecimal(t, 1)}
                        </span>
                    ))}
                </div>
            </div>

            <div className="sr-only">
                <DataTable
                    columns={["Campus", m.nome, "Ano"]}
                    rows={ordem.map((p) => [
                        p.campus,
                        formatDecimal(p.valor),
                        String(p.curso.ano ?? "—"),
                    ])}
                />
            </div>
        </Card>
    );
}
