import { INDICADORES_INEP, type IndicadorInep } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

/** A sigla oficial de um indicador do INEP ao lado do rótulo (ex.:
 * "Concluíram TCA"), em tinta apagada; o nome e a definição aparecem ao
 * passar o mouse — os números da aba batem com os relatórios do INEP. */
export function SiglaInep({
    sigla,
    className,
}: {
    sigla: IndicadorInep;
    className?: string;
}) {
    const { nome, definicao } = INDICADORES_INEP[sigla];
    return (
        <abbr
            title={`${nome} (${sigla}): ${definicao}`}
            className={cn(
                "text-text-muted cursor-help text-[10px] font-medium tracking-wide no-underline",
                className
            )}
        >
            {sigla}
        </abbr>
    );
}
