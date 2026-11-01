import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { DashboardDataContext, ULTIMA_UNIDADE } from "@/context/dashboard-data-context";
import { urlDados } from "@/lib/dados";
import type { UnidadeIndex, UnidadeInfo, DashboardData } from "@/types/dashboard";

// import.meta.env.BASE_URL já reflete o `base` do vite.config.ts (inclui o
// prefixo /GRAD-Analytics/ quando buildado pro GitHub Pages) — assim o
// fetch funciona igual em dev e em produção sem configuração extra.
const UNIDADE_STORAGE_KEY = "prograd-unidade";
const UNIDADE_INICIAL_STORAGE_KEY = "prograd-unidade-inicial";
// a unidade de Quixadá (sigla DIRQUIXADA no SIGAA)
const UNIDADE_PADRAO = "dirquixada";

function ler(chave: string): string | null {
    try {
        return localStorage.getItem(chave);
    } catch {
        return null; // armazenamento bloqueado: segue sem lembrar
    }
}

function gravar(chave: string, valor: string | null) {
    try {
        if (valor === null) localStorage.removeItem(chave);
        else localStorage.setItem(chave, valor);
    } catch {
        // armazenamento bloqueado: só não lembra
    }
}

async function fetchJson<T>(arquivo: string): Promise<T> {
    const response = await fetch(urlDados(arquivo));
    if (!response.ok) {
        throw new Error(`Falha ao carregar ${arquivo} (HTTP ${response.status})`);
    }
    return (await response.json()) as T;
}

/** Unidade inicial: a fixada nas Configurações ("Unidade ao abrir o painel"),
 * senão o último escolhido, senão Quixadá, senão o primeiro do índice. Um
 * slug salvo que não existe mais (as cidades de antes, como "quixada") cai
 * no padrão. */
function unidadeInicial(unidades: UnidadeInfo[]): string | null {
    const existe = (slug: string | null) => unidades.some((c) => c.slug === slug);
    const fixo = ler(UNIDADE_INICIAL_STORAGE_KEY);
    if (existe(fixo)) return fixo;
    const salvo = ler(UNIDADE_STORAGE_KEY);
    if (existe(salvo)) return salvo;
    if (existe(UNIDADE_PADRAO)) return UNIDADE_PADRAO;
    return unidades[0]?.slug ?? null;
}

/** Lê o índice de unidades e o JSON da unidade selecionada (um por unidade, ver
 * scripts/sync-data.mjs). JSONs já baixados ficam em cache: voltar a um
 * unidade é instantâneo. */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
    const [unidades, setUnidades] = useState<UnidadeInfo[]>([]);
    const [unidade, setUnidadeState] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<{ slug: string; data: DashboardData } | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);
    const cache = useRef(new Map<string, DashboardData>());
    const [unidadeAoAbrir, setUnidadeAoAbrirState] = useState(
        () => ler(UNIDADE_INICIAL_STORAGE_KEY) ?? ULTIMA_UNIDADE
    );

    useEffect(() => {
        let cancelled = false;
        fetchJson<UnidadeIndex>("index.json")
            .then((index) => {
                if (cancelled) return;
                // índice num formato que este código não conhece (ex.: o
                // ``campi`` de antes das unidades): mensagem de erro em vez de
                // derrubar a página inteira
                if (!Array.isArray(index.unidades)) {
                    throw new Error(
                        "Os dados do painel estão desatualizados neste navegador. Recarregue a página."
                    );
                }
                setUnidades(index.unidades);
                setUnidadeState(unidadeInicial(index.unidades));
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Erro desconhecido");
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const info = unidades.find((c) => c.slug === unidade);
        if (!info) return;
        let cancelled = false;
        const cached = cache.current.get(info.slug);
        (cached ? Promise.resolve(cached) : fetchJson<DashboardData>(info.arquivo))
            .then((data) => {
                cache.current.set(info.slug, data);
                if (!cancelled) {
                    setLoaded({ slug: info.slug, data });
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Erro desconhecido");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [unidades, unidade]);

    const setUnidade = useCallback((slug: string) => {
        setUnidadeState(slug);
        gravar(UNIDADE_STORAGE_KEY, slug);
    }, []);

    // fixar uma unidade já troca pra ela (o painel mostra o que vai abrir);
    // "Último usado" mantém a unidade atual
    const setUnidadeAoAbrir = useCallback(
        (valor: string) => {
            setUnidadeAoAbrirState(valor);
            gravar(
                UNIDADE_INICIAL_STORAGE_KEY,
                valor === ULTIMA_UNIDADE ? null : valor
            );
            if (valor !== ULTIMA_UNIDADE) setUnidade(valor);
        },
        [setUnidade]
    );

    return (
        <DashboardDataContext.Provider
            value={{
                data: loaded?.data ?? null,
                loading: loaded === null && error === null,
                error,
                unidades,
                unidade,
                setUnidade,
                switching: loaded !== null && unidade !== loaded.slug && error === null,
                unidadeAoAbrir,
                setUnidadeAoAbrir,
            }}
        >
            {children}
        </DashboardDataContext.Provider>
    );
}
