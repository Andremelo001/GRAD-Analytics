import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useDashboardData } from "@/hooks/useDashboardData";

// Abrir uma página (ex.: um curso) de outro campus: o painel troca de campus e
// só navega quando os dados dele chegam — navegando antes, a página abriria
// com os dados do campus anterior e trocaria de curso sozinha. O destino fica
// num lugar só da página (não no componente que pediu, que pode sumir na troca
// de campus); quem navega é ``useNavegacaoPendente``, montado uma vez no
// ``AppLayout``.
let pendente: { slug: string; rota: string; topo: boolean } | null = null;

/** Abre ``rota`` no campus ``slug`` (trocando de campus se preciso); com
 * ``topo``, a página sobe pro começo depois de abrir. */
export function useAbrirNoCampus() {
    const navigate = useNavigate();
    const { campus, setCampus } = useDashboardData();
    return useCallback(
        (slug: string, rota: string, { topo = false }: { topo?: boolean } = {}) => {
            if (slug === campus) {
                navigate(rota);
                if (topo) window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }
            pendente = { slug, rota, topo };
            setCampus(slug);
        },
        [campus, navigate, setCampus]
    );
}

/** Faz a navegação pedida por ``useAbrirNoCampus`` quando o campus novo
 * carrega. Montado uma vez, no ``AppLayout``. */
export function useNavegacaoPendente() {
    const navigate = useNavigate();
    const { campus, switching, data } = useDashboardData();
    useEffect(() => {
        const destino = pendente;
        if (!destino || campus !== destino.slug || switching || !data) return;
        pendente = null;
        // depois dos efeitos da página: se a sub-aba Por curso já estava
        // aberta, ela troca sozinha pra um curso do campus novo (o da URL
        // antiga não existe nele) — esta navegação vem por último e vale
        const t = window.setTimeout(() => {
            navigate(destino.rota);
            if (destino.topo) window.scrollTo({ top: 0, behavior: "smooth" });
        }, 0);
        return () => window.clearTimeout(t);
    }, [campus, switching, data, navigate]);
}
