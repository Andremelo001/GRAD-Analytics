import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useDashboardData } from "@/hooks/useDashboardData";

// Abrir uma página (ex.: um curso) de outra unidade: o painel troca de unidade e
// só navega quando os dados dele chegam — navegando antes, a página abriria
// com os dados da unidade anterior e trocaria de curso sozinha. O destino fica
// num lugar só da página (não no componente que pediu, que pode sumir na troca
// de unidade); quem navega é ``useNavegacaoPendente``, montado uma vez no
// ``AppLayout``.
let pendente: { slug: string; rota: string; topo: boolean } | null = null;

/** Abre ``rota`` na unidade ``slug`` (trocando de unidade se preciso); com
 * ``topo``, a página sobe pro começo depois de abrir. */
export function useAbrirNaUnidade() {
    const navigate = useNavigate();
    const { unidade, setUnidade } = useDashboardData();
    return useCallback(
        (slug: string, rota: string, { topo = false }: { topo?: boolean } = {}) => {
            if (slug === unidade) {
                navigate(rota);
                if (topo) window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }
            pendente = { slug, rota, topo };
            setUnidade(slug);
        },
        [unidade, navigate, setUnidade]
    );
}

/** Faz a navegação pedida por ``useAbrirNaUnidade`` quando a unidade nova
 * carrega. Montado uma vez, no ``AppLayout``. */
export function useNavegacaoPendente() {
    const navigate = useNavigate();
    const { unidade, switching, data } = useDashboardData();
    useEffect(() => {
        const destino = pendente;
        if (!destino || unidade !== destino.slug || switching || !data) return;
        pendente = null;
        // depois dos efeitos da página: se a sub-aba Por curso já estava
        // aberta, ela troca sozinha pra um curso da unidade nova (o da URL
        // antiga não existe nele) — esta navegação vem por último e vale
        const t = window.setTimeout(() => {
            navigate(destino.rota);
            if (destino.topo) window.scrollTo({ top: 0, behavior: "smooth" });
        }, 0);
        return () => window.clearTimeout(t);
    }, [unidade, switching, data, navigate]);
}
