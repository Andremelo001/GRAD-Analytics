import { useEffect, useState } from "react";

import { urlDados } from "@/lib/dados";
import type { ResumoUnidades } from "@/types/dashboard";

const ARQUIVO = urlDados("resumo_unidades.json");

// baixado uma vez por sessão (é o mesmo pra todas as unidades); depois de
// chegar, fica também em ``carregado`` pra quem montar em seguida já desenhar
// com ele, sem um quadro sem os dados (encolheria a página e mexeria na
// rolagem — ex.: trocar de unidade em Por curso)
let promessa: Promise<ResumoUnidades> | null = null;
let carregado: ResumoUnidades | null = null;

function carregar(): Promise<ResumoUnidades> {
    promessa ??= fetch(ARQUIVO).then(async (response) => {
        if (!response.ok) {
            throw new Error(
                `Falha ao carregar o resumo das unidades (HTTP ${response.status})`
            );
        }
        carregado = (await response.json()) as ResumoUnidades;
        return carregado;
    });
    promessa.catch(() => {
        promessa = null;
    });
    return promessa;
}

/** Resumo dos cursos de todas as unidades (``dashboard/resumo_unidades.json``). */
export function useResumoUnidades(): {
    resumo: ResumoUnidades | null;
    erro: string | null;
} {
    const [estado, setEstado] = useState<{
        resumo: ResumoUnidades | null;
        erro: string | null;
    }>({ resumo: carregado, erro: null });
    useEffect(() => {
        if (carregado) return;
        let cancelado = false;
        carregar()
            .then((resumo) => !cancelado && setEstado({ resumo, erro: null }))
            .catch(
                (err: unknown) =>
                    !cancelado &&
                    setEstado({
                        resumo: null,
                        erro: err instanceof Error ? err.message : "Erro desconhecido",
                    })
            );
        return () => {
            cancelado = true;
        };
    }, []);
    return estado;
}
