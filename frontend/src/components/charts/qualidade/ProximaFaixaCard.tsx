import { Card } from "@/components/cards/Card";
import { useChartTheme } from "@/hooks/useChartTheme";
import { FAIXA_LIMITES, faixaDe, faltaParaProximaFaixa } from "@/lib/cpc";
import { formatDecimal } from "@/lib/format";

/** Diferenças pequenas (< 0,01) com 3 casas: com 2, um curso a 0,001 da
 * próxima faixa apareceria como "faltam 0,00". */
const casas = (v: number) => (Math.abs(v) < 0.01 ? 3 : 2);

/** O indicador do card: o CPC contínuo ou o Conceito Enade contínuo (mesma
 * escala 0-5 e mesmos cortes de faixa). */
type Indicador = "cpc" | "enade";

const TEXTOS: Record<Indicador, { titulo: string; nome: string; sigla: string }> = {
    cpc: { titulo: "CPC: próxima faixa", nome: "CPC contínuo", sigla: "CPC" },
    enade: {
        titulo: "Conceito Enade: próxima faixa",
        nome: "Conceito Enade contínuo",
        sigla: "Conceito Enade",
    },
};

/** Régua das faixas (0 a 5) com o curso posicionado e quanto falta do
 * indicador (CPC ou Conceito Enade contínuo) para a próxima faixa. Na Por
 * curso, os dois cards ficam empilhados ao lado do "De onde vem a nota" e
 * dividem a altura dele. ``valor === null``: curso sem o indicador. */
export function ProximaFaixaCard({
    indicador,
    valor,
    className,
}: {
    indicador: Indicador;
    valor: number | null;
    className?: string;
}) {
    const { titulo, nome, sigla } = TEXTOS[indicador];

    return (
        <Card
            expansivel
            title={titulo}
            info={`Onde o ${nome} do curso está na régua das faixas (os mesmos cortes do CPC) e quanto falta para a próxima.`}
            subtitle={`${nome} do curso na régua das faixas`}
            className={className}
        >
            {valor === null ? (
                <p className="text-text-secondary mt-3 text-[13px] leading-snug">
                    Sem {sigla} na avaliação mais recente.
                </p>
            ) : (
                <Regua valor={valor} sigla={sigla} />
            )}
        </Card>
    );
}

function Regua({ valor, sigla }: { valor: number; sigla: string }) {
    const CHART = useChartTheme();
    const faixa = faixaDe(valor);
    const falta = faltaParaProximaFaixa(valor);
    const limite = FAIXA_LIMITES[faixa - 1];
    const limites = [0, ...FAIXA_LIMITES, 5];
    const pct = (v: number) => `${(Math.min(Math.max(v, 0), 5) / 5) * 100}%`;

    return (
        <>
            <div className="mt-3 flex min-h-[26px] items-center gap-3">
                <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                    {falta === null
                        ? formatDecimal(
                              valor - FAIXA_LIMITES[3],
                              casas(valor - FAIXA_LIMITES[3])
                          )
                        : formatDecimal(falta, casas(falta))}
                </p>
                <p className="text-text-secondary min-w-0 text-[13px] leading-snug">
                    {/* a conta por extenso: valor atual → onde começa a próxima
                        faixa (faixa 5 não é nota 5, começa em 3,945) */}
                    {falta === null ? (
                        <>
                            acima de{" "}
                            <span className="text-ink font-semibold">
                                {formatDecimal(FAIXA_LIMITES[3], 3)}
                            </span>
                            , onde começa a faixa 5 (a máxima): o {sigla} do curso é{" "}
                            <span className="text-ink font-semibold">
                                {formatDecimal(valor, 3)}
                            </span>
                        </>
                    ) : (
                        <>
                            faltam para o {sigla} sair de{" "}
                            <span className="text-ink font-semibold">
                                {formatDecimal(valor, 3)}
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

            {/* régua: centrada na sobra abaixo do texto (os dois cards
                empilhados dividem a altura do "De onde vem a nota") */}
            <div className="my-auto px-1 pt-6 pb-2" aria-hidden>
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
                                left: pct(valor),
                                width: pct(falta),
                                borderColor: CHART.ink,
                            }}
                        />
                    )}
                    <span
                        className="absolute -top-2 -bottom-2 w-1 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)]"
                        style={{ left: pct(valor), background: CHART.ink }}
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
        </>
    );
}
