import { Check, Info } from "lucide-react";

import { Card } from "@/components/cards/Card";
import { useChartTheme } from "@/hooks/useChartTheme";
import {
    COMPONENTES,
    FAIXA_LIMITES,
    faixaDe,
    contribuicao,
    faltaParaProximaFaixa,
    notaDe,
    potencial,
} from "@/lib/cpc";
import { formatDecimal } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";

/** Diferenças pequenas (< 0,01) com 3 casas: com 2, um curso a 0,001 da
 * próxima faixa apareceria como "faltam 0,00". */
const casas = (v: number) => (Math.abs(v) < 0.01 ? 3 : 2);

const AVISO =
    "Estimativa. As notas são padronizadas em relação aos cursos da mesma área no país: subir uma nota depende também do desempenho dos outros cursos. O IDD ainda depende do Enem de quem ingressou.";

/** Régua do CPC (0 a 5) com as faixas, o curso posicionado e quanto falta de
 * CPC contínuo para a próxima faixa. Abaixo, na mesma unidade do card "De
 * onde vem a nota" (pontos de CPC = nota × peso): quanto cada componente
 * ainda pode render (o máximo menos o que já rende), do maior para o menor,
 * com um traço no que falta — quem passa do traço bastaria sozinho (e aí
 * aparece a nota que precisaria ter). Componentes já no máximo saem da
 * lista. */
export function ProximaFaixaCard({
    curso,
    className,
}: {
    curso: AvaliacaoCurso & { cpc: number };
    className?: string;
}) {
    const CHART = useChartTheme();
    const faixa = faixaDe(curso.cpc);
    const falta = faltaParaProximaFaixa(curso.cpc);
    const limite = FAIXA_LIMITES[faixa - 1];

    const componentes = COMPONENTES.flatMap((c) => {
        const nota = notaDe(curso.perfil, c.key);
        if (nota === null) return [];
        const rende = contribuicao(nota, c);
        const maximo = potencial(c);
        return [{ c, nota, rende, maximo, margem: maximo - rende }];
    });
    const comMargem = componentes
        .filter((x) => x.margem >= 0.005)
        .sort((a, b) => b.margem - a.margem);
    const noMaximo = componentes.filter((x) => x.margem < 0.005);
    // escala das barras: a maior margem ou o que falta, o que for maior
    const escala = Math.max(falta ?? 0, ...comMargem.map((x) => x.margem));
    // "rende 0,39 → 0,39" não diz nada quando falta 0,001: 3 casas nesse caso
    const digitos = falta === null ? 2 : casas(falta);

    const limites = [0, ...FAIXA_LIMITES, 5];
    const pct = (v: number) => `${(v / 5) * 100}%`;

    return (
        <Card
            expansivel
            title="Quanto falta para a próxima faixa"
            info="Onde o CPC contínuo do curso está na régua das faixas, quanto falta para a próxima e quais componentes ainda têm mais pontos a render."
            subtitle="CPC contínuo do curso na régua das faixas"
            className={className}
        >
            <div className="mt-3 flex min-h-[26px] items-center gap-3">
                <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                    {falta === null
                        ? formatDecimal(
                              curso.cpc - FAIXA_LIMITES[3],
                              casas(curso.cpc - FAIXA_LIMITES[3])
                          )
                        : formatDecimal(falta, casas(falta))}
                </p>
                <p className="text-text-secondary min-w-0 text-[13px] leading-snug">
                    {/* a conta por extenso: CPC atual → onde começa a próxima
                        faixa (faixa 5 não é CPC 5, começa em 3,945) */}
                    {falta === null ? (
                        <>
                            acima de{" "}
                            <span className="text-ink font-semibold">
                                {formatDecimal(FAIXA_LIMITES[3], 3)}
                            </span>
                            , onde começa a faixa 5 (a máxima): o CPC do curso é{" "}
                            <span className="text-ink font-semibold">
                                {formatDecimal(curso.cpc, 3)}
                            </span>
                        </>
                    ) : (
                        <>
                            faltam para o CPC sair de{" "}
                            <span className="text-ink font-semibold">
                                {formatDecimal(curso.cpc, 3)}
                            </span>{" "}
                            (faixa {faixa}) e chegar a{" "}
                            <span className="text-ink font-semibold">
                                {formatDecimal(limite, 3)}
                            </span>
                            , onde começa a faixa {faixa + 1}
                        </>
                    )}
                </p>
            </div>

            {/* régua */}
            <div className="mt-6 px-1" aria-hidden>
                <div className="relative h-3">
                    {limites.slice(0, -1).map((de, i) => (
                        <span
                            key={i}
                            className="absolute inset-y-0 border-x border-[var(--surface)] first:rounded-l-full last:rounded-r-full"
                            style={{
                                left: pct(de),
                                width: pct(limites[i + 1] - de),
                                background: CHART.faixa.ramp[i],
                                opacity: i + 1 === faixa ? 1 : 0.35,
                            }}
                        />
                    ))}
                    {falta !== null && (
                        <span
                            className="absolute -top-1 -bottom-1 rounded-full border-2 border-dashed"
                            style={{
                                left: pct(curso.cpc),
                                width: pct(falta),
                                borderColor: CHART.ink,
                            }}
                        />
                    )}
                    <span
                        className="absolute -top-2 -bottom-2 w-1 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)]"
                        style={{ left: pct(curso.cpc), background: CHART.ink }}
                    />
                </div>
                <div className="text-text-muted relative mt-2 h-4 text-[11px]">
                    {limites.slice(0, -1).map((de, i) => (
                        <span
                            key={i}
                            className="absolute -translate-x-1/2"
                            style={{ left: pct((de + limites[i + 1]) / 2) }}
                        >
                            {i + 1}
                        </span>
                    ))}
                </div>
            </div>

            {/* lista: em lg, o card tem a altura do "De onde vem a nota" ao
                lado e a lista rola por dentro; empilhado, altura natural */}
            {comMargem.length > 0 && (
                <div className="mt-5 flex min-h-0 flex-col lg:flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                        <p className="text-text-muted text-[11px] font-medium tracking-wide uppercase">
                            Quanto cada componente ainda pode render
                        </p>
                        {falta !== null && (
                            <span className="text-text-muted flex shrink-0 items-center gap-1.5 text-[11px]">
                                <span
                                    aria-hidden
                                    className="bg-ink h-3 w-0.5 rounded-full"
                                />
                                falta {formatDecimal(falta, casas(falta))}
                            </span>
                        )}
                    </div>
                    <div className="relative mt-3 lg:min-h-[140px] lg:flex-1">
                        <div className="[scrollbar-width:thin] lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-2">
                            <ul className="flex flex-col gap-3 text-[13px]">
                                {comMargem.map(({ c, nota, rende, maximo, margem }) => {
                                    const basta = falta !== null && margem >= falta;
                                    return (
                                        <li key={c.key}>
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span
                                                    className="min-w-0 truncate"
                                                    title={c.nome}
                                                >
                                                    {c.nome}
                                                </span>
                                                <span className="shrink-0 font-semibold tabular-nums">
                                                    {formatDecimal(margem)}
                                                </span>
                                            </div>
                                            <div className="relative mt-1.5 h-2 rounded-full bg-[var(--page)]">
                                                <span
                                                    className="absolute inset-y-0 left-0 rounded-full"
                                                    style={{
                                                        width: `${(margem / escala) * 100}%`,
                                                        background: CHART.brand,
                                                    }}
                                                />
                                                {falta !== null && (
                                                    <span
                                                        aria-hidden
                                                        className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)]"
                                                        style={{
                                                            left: `${(falta / escala) * 100}%`,
                                                            background: CHART.ink,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <p className="text-text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums">
                                                <span>
                                                    rende {formatDecimal(rende)} de{" "}
                                                    {formatDecimal(maximo)}
                                                </span>
                                                {basta && (
                                                    <>
                                                        <span className="bg-lime text-on-lime inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold">
                                                            <Check
                                                                size={11}
                                                                strokeWidth={3}
                                                                aria-hidden
                                                            />
                                                            bastaria sozinho
                                                        </span>
                                                        <span>
                                                            {formatDecimal(
                                                                rende,
                                                                digitos
                                                            )}{" "}
                                                            →{" "}
                                                            {formatDecimal(
                                                                rende + (falta ?? 0),
                                                                digitos
                                                            )}{" "}
                                                            (nota{" "}
                                                            {formatDecimal(
                                                                nota,
                                                                digitos
                                                            )}{" "}
                                                            →{" "}
                                                            {formatDecimal(
                                                                nota +
                                                                    (falta ?? 0) /
                                                                        c.peso,
                                                                digitos
                                                            )}
                                                            )
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                            {falta !== null &&
                                comMargem.every((x) => x.margem < falta) && (
                                    <p className="text-text-secondary mt-3 text-[12px] leading-snug">
                                        Nenhum componente sozinho cobre o que falta:
                                        seria preciso subir mais de um ao mesmo tempo.
                                    </p>
                                )}
                            {noMaximo.length > 0 && (
                                <p className="text-text-muted mt-3 text-[11px] leading-snug">
                                    Já no máximo:{" "}
                                    {noMaximo.map((x) => x.c.nome).join(", ")}.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <p className="text-text-muted mt-auto flex gap-2 pt-4 text-[11px] leading-snug">
                <Info
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                    className="mt-px shrink-0"
                />
                {AVISO}
            </p>
        </Card>
    );
}
