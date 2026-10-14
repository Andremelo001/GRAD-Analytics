import { useEffect, useState } from "react";

import { toTitleCase } from "@/lib/format";
import { turmaResumo, type Turma } from "@/lib/trajetoria";
import type {
    TrajetoriaAreaArquivo,
    TrajetoriaAreaIndex,
} from "@/types/trajetoria-area";

const DIR = `${import.meta.env.BASE_URL}data/dashboard/trajetoria_areas/`;

/** Um curso do Brasil numa área CINE, com a turma madura dele. */
export interface CursoTrajetoriaArea {
    codigo: number;
    ies: number;
    nomeIes: string;
    siglaIes: string | null;
    publica: boolean | null;
    nomeMunicipio: string;
    uf: string | null;
    grau: string | null;
    ead: boolean;
    /** Da IES do painel (UFC). */
    destaque: boolean;
    turma: Turma;
}

export interface TrajetoriaAreaCarregada {
    area: string;
    cursos: CursoTrajetoriaArea[];
}

// Cache do módulo (sobrevive à troca de sub-aba e de campus), como o das
// áreas da Qualidade: cada área só é baixada uma vez.
let indexPromise: Promise<TrajetoriaAreaIndex> | null = null;
const areas = new Map<string, Promise<TrajetoriaAreaCarregada>>();

async function fetchJson<T>(arquivo: string): Promise<T> {
    const response = await fetch(`${DIR}${arquivo}`);
    if (!response.ok) {
        throw new Error(`Falha ao carregar ${arquivo} (HTTP ${response.status})`);
    }
    return (await response.json()) as T;
}

function parse(arquivo: TrajetoriaAreaArquivo): CursoTrajetoriaArea[] {
    const col = Object.fromEntries(arquivo.colunas.map((c, i) => [c, i]));
    return arquivo.cursos.map((linha) => {
        const get = (nome: string) => linha[col[nome]];
        const ies = Number(get("codigo_ies"));
        const [nomeIes, siglaIes, publica] = arquivo.ies[String(ies)] ?? [
            null,
            null,
            null,
        ];
        const municipio = get("codigo_municipio");
        const [nomeMunicipio, uf] =
            municipio === null
                ? [null, null]
                : (arquivo.municipios[String(municipio)] ?? [null, null]);
        return {
            codigo: Number(get("codigo_curso")),
            ies,
            nomeIes: nomeIes ? toTitleCase(nomeIes) : "Instituição sem nome",
            siglaIes,
            publica,
            nomeMunicipio: nomeMunicipio ? toTitleCase(nomeMunicipio) : "—",
            uf,
            grau: get("grau_academico") as string | null,
            ead: Boolean(get("ead")),
            destaque: ies === arquivo.codigo_ies_destaque,
            turma: turmaResumo({
                nome_cine_area_geral: arquivo.area,
                grau_academico: get("grau_academico") as string | null,
                prazo_integralizacao: Number(get("prazo_integralizacao")),
                ano_ingresso: Number(get("ano_ingresso")),
                ingressantes: get("ingressantes") as number | null,
                curva: get("curva") as [number, number, number, number][],
            }),
        };
    });
}

function carregar(area: string): Promise<TrajetoriaAreaCarregada> {
    let promise = areas.get(area);
    if (!promise) {
        indexPromise ??= fetchJson<TrajetoriaAreaIndex>("index.json");
        promise = indexPromise.then(async (index) => {
            const info = index.areas.find((a) => a.area === area);
            if (!info) throw new Error(`Área sem dados nacionais: ${area}`);
            const arquivo = await fetchJson<TrajetoriaAreaArquivo>(info.arquivo);
            return { area, cursos: parse(arquivo) };
        });
        // falhou: não guarda, pra uma nova tentativa baixar de novo
        promise.catch(() => areas.delete(area));
        areas.set(area, promise);
    }
    return promise;
}

/** A turma madura de cada curso do Brasil numa área CINE
 * (``dashboard/trajetoria_areas/``), baixada sob demanda. Enquanto a nova
 * área chega, segue com a anterior. */
export function useTrajetoriaArea(area: string | null): {
    dados: TrajetoriaAreaCarregada | null;
    erro: string | null;
} {
    const [estado, setEstado] = useState<{
        dados: TrajetoriaAreaCarregada | null;
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

    return { dados: estado.dados, erro: estado.pedido === area ? estado.erro : null };
}
