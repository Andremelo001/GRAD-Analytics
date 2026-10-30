import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { CursoBusca, type OpcaoCurso } from "@/components/charts/qualidade/CursoBusca";
import { FiltroTopoContext } from "@/context/filtro-topo";
import { useChartTheme } from "@/hooks/useChartTheme";

export type Tom = "band" | "surface";

/** Desenha ``children`` no lugar do seletor do cabeçalho da aba (ver
 * ``FiltroTopoContext``), nos dois tons. Some junto com a sub-aba. */
export function FiltroTopo({ children }: { children: (tom: Tom) => ReactNode }) {
    const { band, surface } = useContext(FiltroTopoContext);
    return (
        <>
            {band && createPortal(children("band"), band)}
            {surface && createPortal(children("surface"), surface)}
        </>
    );
}

/** O seletor de curso do cabeçalho (com busca), o mesmo do Início: pílula
 * escura na faixa, clara no modo apresentação (como a barra de sub-abas ao
 * lado). */
export function SeletorCursoTopo({
    tom,
    value,
    options,
    onChange,
}: {
    tom: Tom;
    value: string;
    options: OpcaoCurso[];
    onChange: (value: string) => void;
}) {
    const CHART = useChartTheme();
    return (
        <CursoBusca
            faixa
            superficie={tom === "surface"}
            cor={CHART.comparacao.a}
            label="Curso"
            placeholder="Buscar curso…"
            value={value}
            options={options}
            onChange={onChange}
        />
    );
}
