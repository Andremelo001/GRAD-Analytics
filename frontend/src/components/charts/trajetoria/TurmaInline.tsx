import { ChartSelect } from "@/components/charts/ChartSelect";
import type { Turma } from "@/lib/trajetoria";

/** Valor do seletor pra "todas as turmas somadas" (``comTodas``). */
export const TODAS_AS_TURMAS = "todas";

/** A turma (ano de ingresso) como seletor no meio de uma frase — o do topo
 * da sub-aba Por curso ("Turma de [2018 ▾]") e o dos subtítulos dos cards:
 * todos mudam a mesma turma da página. Mais recente primeiro; as em andamento
 * avisam. ``comTodas``: a primeira opção é "Todas as turmas" (valor
 * ``TODAS_AS_TURMAS``). */
export function TurmaInline({
    turmas,
    valor,
    onChange,
    comTodas = false,
}: {
    turmas: Turma[];
    valor: number | typeof TODAS_AS_TURMAS;
    onChange: (ano: number | typeof TODAS_AS_TURMAS) => void;
    comTodas?: boolean;
}) {
    return (
        <ChartSelect
            variant="inline"
            tone="surface"
            label="Turma (ano de ingresso)"
            value={String(valor)}
            options={[
                ...(comTodas
                    ? [{ value: TODAS_AS_TURMAS, label: "Todas as turmas" }]
                    : []),
                ...[...turmas].reverse().map((t) => ({
                    value: String(t.ano),
                    label: t.madura ? String(t.ano) : `${t.ano} · em andamento`,
                })),
            ]}
            onChange={(v) => onChange(v === TODAS_AS_TURMAS ? v : Number(v))}
        />
    );
}
