import { ChartSelect } from "@/components/charts/ChartSelect";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

/** "Quixadá" a partir de "UFC Campus Quixadá" — a frase em volta já diz "UFC
 * Campus". */
function nomeCurto(nome: string): string {
    return nome.replace(/^UFC\s+Campus\s+/i, "");
}

/** Seletor de campus em pílula, à esquerda das sub-abas (``PageHeader``) — o
 * mesmo desenho da barra delas, separado: "Campus [Quixadá ▾]". Troca o JSON
 * carregado (``DashboardDataProvider``); enquanto o novo campus baixa, a seta
 * vira um indicador de carga. ``tom="surface"``: sobre o plano claro (modo
 * apresentação), em pílula branca como as sub-abas. */
export function CampusSelect({ tom = "band" }: { tom?: "band" | "surface" }) {
    const { campi, campus, setCampus, switching } = useDashboardData();
    if (campi.length === 0 || campus === null) return null;

    return (
        <div
            className={cn(
                "flex h-[33px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] ring-1 sm:h-9 sm:text-[13px]",
                tom === "band"
                    ? "bg-white/[0.07] text-white/60 ring-white/10"
                    : "bg-surface text-text-secondary ring-card-ring shadow-[0_4px_24px_rgb(0_0_0/0.05)]"
            )}
        >
            Campus
            <ChartSelect
                variant="inline"
                label="Campus"
                value={campus}
                options={campi.map((c) => ({
                    value: c.slug,
                    label: nomeCurto(c.nome),
                }))}
                onChange={setCampus}
                busy={switching}
                tone={tom}
            />
        </div>
    );
}

/** O campus selecionado no meio de uma frase ("…da graduação do UFC Campus
 * Quixadá"), com a mesma cor e o mesmo peso da frase: só mostra; quem troca
 * é o ``CampusSelect``. */
export function CampusAtual() {
    const { campi, campus } = useDashboardData();
    const info = campi.find((c) => c.slug === campus);
    if (!info) return null;
    return <>{nomeCurto(info.nome)}</>;
}
