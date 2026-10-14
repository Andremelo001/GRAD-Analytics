import type { Turma } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

/** Linha do tempo das turmas (ano de ingresso): a escolhida em pílula
 * escura; as em andamento com borda tracejada (ainda não terminaram — não
 * dá pra comparar com as maduras). */
export function SeletorTurma({
    turmas,
    valor,
    onChange,
}: {
    turmas: Turma[];
    valor: number;
    onChange: (ano: number) => void;
}) {
    return (
        <div
            role="radiogroup"
            aria-label="Turma (ano de ingresso)"
            className="flex flex-wrap gap-1"
        >
            {turmas.map((t) => {
                const ativa = t.ano === valor;
                return (
                    <button
                        key={t.ano}
                        type="button"
                        role="radio"
                        aria-checked={ativa}
                        title={
                            t.madura
                                ? `Turma de ${t.ano}`
                                : `Turma de ${t.ano} (em andamento)`
                        }
                        onClick={() => onChange(t.ano)}
                        className={cn(
                            "focus-visible:ring-lime/60 rounded-full px-2.5 py-1 text-[11.5px] tabular-nums transition-colors duration-200 outline-none focus-visible:ring-2",
                            ativa
                                ? "bg-ink text-surface font-semibold"
                                : "text-text-secondary hover:text-ink hover:bg-page",
                            !t.madura &&
                                !ativa &&
                                "border-text-muted/60 border border-dashed",
                            !t.madura &&
                                ativa &&
                                "outline-text-muted outline-1 outline-offset-2 outline-dashed"
                        )}
                    >
                        {t.ano}
                    </button>
                );
            })}
        </div>
    );
}
