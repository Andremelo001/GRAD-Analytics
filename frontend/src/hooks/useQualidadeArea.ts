import { useEffect, useState } from "react";

import { parseArea, type CursoArea } from "@/lib/area";
import type { AreaArquivo, AreaIndex } from "@/types/qualidade-area";

const AREAS_DIR = `${import.meta.env.BASE_URL}data/dashboard/areas_qualidade/`;

export interface AreaCarregada {
    area: string;
    ano: number;
    cursos: CursoArea[];
}

// Cache do módulo (sobrevive à troca de sub-aba e de campus): cada área é
// compartilhada por todos os campi e só é baixada uma vez.
let indexPromise: Promise<AreaIndex> | null = null;
const areas = new Map<string, Promise<AreaCarregada>>();

async function fetchJson<T>(arquivo: string): Promise<T> {
    const response = await fetch(`${AREAS_DIR}${arquivo}`);
    if (!response.ok) {
        throw new Error(`Falha ao carregar ${arquivo} (HTTP ${response.status})`);
    }
    return (await response.json()) as T;
}

function carregar(area: string): Promise<AreaCarregada> {
    let promise = areas.get(area);
    if (!promise) {
        indexPromise ??= fetchJson<AreaIndex>("index.json");
        promise = indexPromise.then(async (index) => {
            const info = index.areas.find((a) => a.area_avaliacao === area);
            if (!info) throw new Error(`Área sem dados nacionais: ${area}`);
            const arquivo = await fetchJson<AreaArquivo>(info.arquivo);
            return { area, ano: arquivo.ano, cursos: parseArea(arquivo) };
        });
        // falhou: não guarda, pra uma nova tentativa baixar de novo
        promise.catch(() => areas.delete(area));
        areas.set(area, promise);
    }
    return promise;
}

/** Todos os cursos do Brasil numa área de avaliação (``dashboard/areas_qualidade/``),
 * baixados sob demanda. Enquanto a nova área chega, segue com a anterior. */
export function useQualidadeArea(area: string | null): {
    dados: AreaCarregada | null;
    carregando: boolean;
    erro: string | null;
} {
    const [estado, setEstado] = useState<{
        dados: AreaCarregada | null;
        erro: string | null;
        pedido: string | null;
    }>({ dados: null, erro: null, pedido: null });

    useEffect(() => {
        if (area === null) return;
        let cancelado = false;
        carregar(area)
            .then((dados) => {
                if (!cancelado) setEstado({ dados, erro: null, pedido: area });
            })
            .catch((err: unknown) => {
                if (!cancelado)
                    setEstado((s) => ({
                        ...s,
                        erro: err instanceof Error ? err.message : "Erro desconhecido",
                        pedido: area,
                    }));
            });
        return () => {
            cancelado = true;
        };
    }, [area]);

    return {
        dados: estado.dados,
        carregando: area !== null && estado.pedido !== area,
        erro: estado.pedido === area ? estado.erro : null,
    };
}
