import { useCallback, useSyncExternalStore } from "react";

import { useDashboardData } from "@/hooks/useDashboardData";
import {
    cursoEscolhido,
    escolherCurso,
    ouvirCursoEscolhido,
} from "@/lib/curso-escolhido";

/** O curso escolhido na unidade cujos dados estão na tela (ver
 * ``lib/curso-escolhido.ts``) e a função que o troca em todos os seletores.
 * A unidade é a dos dados exibidos (``escopo.slug``), não a recém-escolhida
 * no seletor: enquanto a nova baixa, a tela ainda mostra os cursos da
 * anterior. */
export function useCursoEscolhido() {
    const unidade = useDashboardData().data?.escopo.slug ?? null;
    const { curso, ultimo } = useSyncExternalStore(ouvirCursoEscolhido, () =>
        cursoEscolhido(unidade)
    );
    const escolher = useCallback(
        (c: number | null) => escolherCurso(unidade, c),
        [unidade]
    );
    return { curso, ultimo, escolher };
}
