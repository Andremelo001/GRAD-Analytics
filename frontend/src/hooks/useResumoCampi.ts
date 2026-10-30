import { useEffect, useState } from "react";

import type { ResumoCampi } from "@/types/dashboard";

const ARQUIVO = `${import.meta.env.BASE_URL}data/dashboard/resumo_campi.json`;

// baixado uma vez por sessão (é o mesmo pra todos os campi); depois de
// chegar, fica também em ``carregado`` pra quem montar em seguida já desenhar
// com ele, sem um quadro sem os dados (encolheria a página e mexeria na
// rolagem — ex.: trocar de campus em Por curso)
let promessa: Promise<ResumoCampi> | null = null;
let carregado: ResumoCampi | null = null;

function carregar(): Promise<ResumoCampi> {
    promessa ??= fetch(ARQUIVO).then(async (response) => {
        if (!response.ok) {
            throw new Error(
                `Falha ao carregar o resumo das cidades (HTTP ${response.status})`
            );
        }
        carregado = (await response.json()) as ResumoCampi;
        return carregado;
    });
    promessa.catch(() => {
        promessa = null;
    });
    return promessa;
}

/** Resumo dos cursos de todos os campi (``dashboard/resumo_campi.json``). */
export function useResumoCampi(): { resumo: ResumoCampi | null; erro: string | null } {
    const [estado, setEstado] = useState<{
        resumo: ResumoCampi | null;
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
