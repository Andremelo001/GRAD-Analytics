import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { DashboardDataContext, ULTIMO_CAMPUS } from "@/context/dashboard-data-context";
import type { CampusIndex, CampusInfo, DashboardData } from "@/types/dashboard";

// import.meta.env.BASE_URL já reflete o `base` do vite.config.ts (inclui o
// prefixo /GRAD-Analytics/ quando buildado pro GitHub Pages) — assim o
// fetch funciona igual em dev e em produção sem configuração extra.
const DATA_DIR = `${import.meta.env.BASE_URL}data/dashboard/`;
const CAMPUS_STORAGE_KEY = "prograd-campus";
const CAMPUS_INICIAL_STORAGE_KEY = "prograd-campus-inicial";
const CAMPUS_PADRAO = "quixada";

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
    const response = await fetch(`${DATA_DIR}${arquivo}`);
    if (!response.ok) {
        throw new Error(`Falha ao carregar ${arquivo} (HTTP ${response.status})`);
    }
    return (await response.json()) as T;
}

/** Campus inicial: o fixado nas Configurações ("Campus ao abrir o painel"),
 * senão o último escolhido, senão Quixadá, senão o primeiro do índice. */
function campusInicial(campi: CampusInfo[]): string | null {
    const existe = (slug: string | null) => campi.some((c) => c.slug === slug);
    const fixo = ler(CAMPUS_INICIAL_STORAGE_KEY);
    if (existe(fixo)) return fixo;
    const salvo = ler(CAMPUS_STORAGE_KEY);
    if (existe(salvo)) return salvo;
    if (existe(CAMPUS_PADRAO)) return CAMPUS_PADRAO;
    return campi[0]?.slug ?? null;
}

/** Lê o índice de campi e o JSON do campus selecionado (um por campus, ver
 * scripts/sync-data.mjs). JSONs já baixados ficam em cache: voltar a um
 * campus é instantâneo. */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
    const [campi, setCampi] = useState<CampusInfo[]>([]);
    const [campus, setCampusState] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<{ slug: string; data: DashboardData } | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);
    const cache = useRef(new Map<string, DashboardData>());
    const [campusAoAbrir, setCampusAoAbrirState] = useState(
        () => ler(CAMPUS_INICIAL_STORAGE_KEY) ?? ULTIMO_CAMPUS
    );

    useEffect(() => {
        let cancelled = false;
        fetchJson<CampusIndex>("index.json")
            .then((index) => {
                if (cancelled) return;
                setCampi(index.campi);
                setCampusState(campusInicial(index.campi));
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
        const info = campi.find((c) => c.slug === campus);
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
    }, [campi, campus]);

    const setCampus = useCallback((slug: string) => {
        setCampusState(slug);
        gravar(CAMPUS_STORAGE_KEY, slug);
    }, []);

    // fixar um campus já troca pra ele (o painel mostra o que vai abrir);
    // "Último usado" mantém o campus atual
    const setCampusAoAbrir = useCallback(
        (valor: string) => {
            setCampusAoAbrirState(valor);
            gravar(CAMPUS_INICIAL_STORAGE_KEY, valor === ULTIMO_CAMPUS ? null : valor);
            if (valor !== ULTIMO_CAMPUS) setCampus(valor);
        },
        [setCampus]
    );

    return (
        <DashboardDataContext.Provider
            value={{
                data: loaded?.data ?? null,
                loading: loaded === null && error === null,
                error,
                campi,
                campus,
                setCampus,
                switching: loaded !== null && campus !== loaded.slug && error === null,
                campusAoAbrir,
                setCampusAoAbrir,
            }}
        >
            {children}
        </DashboardDataContext.Provider>
    );
}
