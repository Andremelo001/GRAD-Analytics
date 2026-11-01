import type { ReactNode } from "react";

import { Card } from "@/components/cards/Card";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { ResumoUnidades } from "@/types/dashboard";

// O topo das Comparações (Qualidade e Trajetória): tipo de comparação, os dois
// seletores (A e B) e a ficha de cada lado.

/** Card do topo: tipo de comparação + os dois seletores (A e B) e, embaixo de
 * cada um, a ficha do lado escolhido. */
export function Topo({
    seletorModo,
    seletorA,
    seletorB,
    fichaA,
    fichaB,
}: {
    seletorModo: ReactNode;
    seletorA: ReactNode;
    seletorB: ReactNode;
    fichaA?: ReactNode;
    fichaB?: ReactNode;
}) {
    return (
        <Card className="lg:col-span-12">
            <div className="-mx-1 [scrollbar-width:none] overflow-x-auto px-1">
                {seletorModo}
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
                <div className="min-w-0">
                    {seletorA}
                    {fichaA && <div className="mt-3">{fichaA}</div>}
                </div>
                {/* o "×" do confronto, na altura dos seletores */}
                <span
                    aria-hidden
                    className="text-text-muted flex h-10 items-center text-[18px] font-semibold"
                >
                    ×
                </span>
                <div className="min-w-0">
                    {seletorB}
                    {fichaB && <div className="mt-3">{fichaB}</div>}
                </div>
            </div>
        </Card>
    );
}

export function Ficha({ itens }: { itens: [string, ReactNode][] }) {
    return (
        <dl className="text-text-secondary flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
            {itens.map(([rotulo, valor]) => (
                <div key={rotulo} className="flex min-h-6 items-center gap-1.5">
                    <dt className="text-text-muted">{rotulo}</dt>
                    <dd className="text-ink flex items-center gap-1.5 font-semibold tabular-nums">
                        {valor}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** Seletor de unidade no mesmo formato do de curso (caixa larga com o ponto
 * da cor do lado): os dois modos têm o topo idêntico. */
export function SeletorUnidade({
    lado,
    value,
    unidades,
    detalhe,
    onChange,
}: {
    lado: "a" | "b";
    value: string;
    unidades: ResumoUnidades["unidades"];
    /** Texto embaixo do nome (padrão: quantos cursos). */
    detalhe?: (unidade: ResumoUnidades["unidades"][number]) => string;
    onChange: (slug: string) => void;
}) {
    const CHART = useChartTheme();
    return (
        <CursoBusca
            label={lado === "a" ? "Unidade A" : "Unidade B"}
            cor={CHART.comparacao[lado]}
            value={value}
            options={unidades.map((c) => ({
                value: c.slug,
                label: c.nome,
                // a localidade, como no seletor de unidade do topo
                detalhe: [
                    c.localidade,
                    detalhe ? detalhe(c) : `${c.cursos.length} cursos`,
                ]
                    .filter(Boolean)
                    .join(" · "),
            }))}
            onChange={onChange}
            placeholder="Buscar unidade…"
        />
    );
}
