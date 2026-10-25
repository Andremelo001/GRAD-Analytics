import { useRef, type KeyboardEvent } from "react";

import { useActiveIndicator } from "@/hooks/useActiveIndicator";
import { cn } from "@/lib/utils";

/** Controle segmentado dos cards: poucas opções (duas ou três) lado a lado
 * numa pílula, a escolhida em limão — o mesmo desenho das sub-abas, no
 * tamanho do seletor pequeno dos cards (32px de altura). A pílula limão
 * desliza até a opção escolhida. Teclado: ←/→ trocam (grupo de rádio). */
export function Segmentado<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const indicador = useActiveIndicator(ref, value, '[aria-checked="true"]');
    const atual = options.findIndex((o) => o.value === value);

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        const passo =
            e.key === "ArrowRight" || e.key === "ArrowDown"
                ? 1
                : e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? -1
                  : 0;
        if (!passo) return;
        e.preventDefault();
        const proximo = options[(atual + passo + options.length) % options.length];
        onChange(proximo.value);
        ref.current
            ?.querySelector<HTMLElement>(`[data-valor="${proximo.value}"]`)
            ?.focus();
    }

    return (
        <div
            ref={ref}
            role="radiogroup"
            aria-label={label}
            onKeyDown={onKeyDown}
            className="bg-page relative flex h-8 w-max items-center rounded-full p-1"
        >
            <span
                aria-hidden
                className={cn(
                    "bg-lime absolute top-1 bottom-1 left-0 rounded-full",
                    indicador.animar &&
                        "transition-[transform,width] duration-300 ease-out motion-reduce:transition-none",
                    !indicador.visivel && "opacity-0"
                )}
                style={indicador.style}
            />
            {options.map((o) => {
                const escolhido = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={escolhido}
                        data-valor={o.value}
                        // só o escolhido entra no Tab; as setas trocam
                        tabIndex={escolhido ? 0 : -1}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            "focus-visible:ring-lime/60 relative h-full rounded-full px-3 text-[12px] whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-2",
                            escolhido
                                ? "text-on-lime font-semibold"
                                : "text-text-secondary hover:text-ink"
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
