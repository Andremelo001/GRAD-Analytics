import { ArrowLeftRight } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/cards/Card";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { useChartTheme } from "@/hooks/useChartTheme";
import { nomeCampus } from "@/lib/comparacao";
import type { ResumoCampi } from "@/types/dashboard";

// O topo das Comparações (Qualidade e Trajetória): tipo de comparação, os dois
// seletores (A ⇄ B) e a ficha de cada lado.

/** Card do topo: tipo de comparação + os dois seletores (A ⇄ B) e, embaixo de
 * cada um, a ficha do lado escolhido. */
export function Topo({
    seletorModo,
    seletorA,
    seletorB,
    fichaA,
    fichaB,
    onTrocar,
    podeTrocar = true,
}: {
    seletorModo: ReactNode;
    seletorA: ReactNode;
    seletorB: ReactNode;
    fichaA?: ReactNode;
    fichaB?: ReactNode;
    onTrocar: () => void;
    podeTrocar?: boolean;
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
                <button
                    type="button"
                    onClick={onTrocar}
                    disabled={!podeTrocar}
                    aria-label="Trocar os lados"
                    title={
                        podeTrocar
                            ? "Trocar os lados"
                            : "O curso A é sempre da UFC: só dá pra trocar quando o B também é"
                    }
                    className="bg-page hover:text-ink text-text-secondary focus-visible:ring-lime/60 mt-1 flex h-8 w-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ArrowLeftRight size={15} strokeWidth={2.25} aria-hidden />
                </button>
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

/** Seletor de campus no mesmo formato do de curso (caixa larga com o ponto
 * da cor do lado): os dois modos têm o topo idêntico. */
export function SeletorCampus({
    lado,
    value,
    campi,
    detalhe,
    onChange,
}: {
    lado: "a" | "b";
    value: string;
    campi: ResumoCampi["campi"];
    /** Texto embaixo do nome (padrão: quantos cursos). */
    detalhe?: (campus: ResumoCampi["campi"][number]) => string;
    onChange: (slug: string) => void;
}) {
    const CHART = useChartTheme();
    return (
        <CursoBusca
            label={lado === "a" ? "Campus A" : "Campus B"}
            cor={CHART.comparacao[lado]}
            value={value}
            options={campi.map((c) => ({
                value: c.slug,
                label: nomeCampus(c.nome),
                detalhe: detalhe ? detalhe(c) : `${c.cursos.length} cursos`,
            }))}
            onChange={onChange}
            placeholder="Buscar campus…"
        />
    );
}
