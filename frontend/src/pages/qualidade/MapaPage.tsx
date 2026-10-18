import { ArrowLeft } from "lucide-react";
import { useMemo, useRef, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";

import { Card } from "@/components/cards/Card";
import { ChartSelect } from "@/components/charts/ChartSelect";
import { DataTable } from "@/components/charts/DataTable";
import {
    BrasilQualidadeMapa,
    type MunicipioMapa,
} from "@/components/charts/qualidade/BrasilQualidadeMapa";
import { EstadoPainel } from "@/components/charts/qualidade/EstadoPainel";
import { DataState } from "@/components/layout/DataState";
import { MapaEsqueleto } from "@/components/layout/Esqueleto";
import { useAlturaDisponivel } from "@/hooks/useAlturaDisponivel";
import { useQualidadeArea } from "@/hooks/useQualidadeArea";
import {
    agrupar,
    filtrar,
    formatIndicador,
    INDICADORES,
    REDES,
    resumir,
    type Indicador,
    type Rede,
} from "@/lib/area";
import { buildAvaliacoes } from "@/lib/qualidade";
import { UF_NOMES } from "@/lib/uf";
import type { DashboardData } from "@/types/dashboard";

export function MapaPage() {
    return (
        <DataState
            esqueleto={<MapaEsqueleto />}
            render={(data) => <Mapa key={data.escopo.codigo_municipio} data={data} />}
        />
    );
}

const ehIndicador = (v: string | null): v is Indicador =>
    v !== null && v in INDICADORES;
const ehRede = (v: string | null): v is Rede => v !== null && v in REDES;

/** Rótulos da rede dentro da frase de filtros do mapa. */
const REDES_FRASE: Record<Rede, string> = {
    todas: "todas as redes",
    publicas: "só rede pública",
    privadas: "só rede privada",
};

/** Qualidade → Mapa: o mesmo curso (mesma área de avaliação e modalidade)
 * pelo Brasil, na edição mais recente do Enade da área. Curso, indicador,
 * rede e estado ficam na URL (``?curso=…&indicador=…&rede=…&uf=…``), então
 * dá pra compartilhar a vista. */
function Mapa({ data }: { data: DashboardData }) {
    const [params, setParams] = useSearchParams();
    const avaliacoes = useMemo(
        () => buildAvaliacoes(data).filter((a) => a.area !== null),
        [data]
    );
    const curso =
        avaliacoes.find((a) => String(a.codigo) === params.get("curso")) ??
        [...avaliacoes].sort((a, b) => (b.cpc ?? -1) - (a.cpc ?? -1))[0];
    const indicador: Indicador = ehIndicador(params.get("indicador"))
        ? (params.get("indicador") as Indicador)
        : "cpc";
    const rede: Rede = ehRede(params.get("rede"))
        ? (params.get("rede") as Rede)
        : "todas";
    const ufParam = params.get("uf");

    const { dados, carregando, erro } = useQualidadeArea(curso?.area ?? null);

    // em lg o mapa e o painel cabem na tela, sem rolar
    const gradeRef = useRef<HTMLDivElement>(null);
    // margem = o espaço do rodapé da página (pb-10 do AppLayout): o card
    // termina nele e a página não rola
    const alturaDisponivel = useAlturaDisponivel(gradeRef, { margem: 40, minimo: 420 });

    function atualizar(mudancas: Record<string, string | null>) {
        setParams(
            (atual) => {
                const prox = new URLSearchParams(atual);
                for (const [k, v] of Object.entries(mudancas)) {
                    if (v === null) prox.delete(k);
                    else prox.set(k, v);
                }
                return prox;
            },
            { replace: true }
        );
    }

    const visao = useMemo(() => {
        if (!dados || !curso || dados.area !== curso.area) return null;
        const cursoCampus = dados.cursos.find((c) => c.codigo === curso.codigo);
        const modalidade = data.cursos.find(
            (c) => c.codigo_curso === curso.codigo
        )?.modalidade_ensino;
        const ead = cursoCampus?.ead ?? /dist/i.test(modalidade ?? "");
        const filtrados = filtrar(dados.cursos, rede, ead);
        const porUfCursos = agrupar(filtrados, (c) => c.uf);
        const porUf = new Map(
            [...porUfCursos].map(([uf, cursos]) => [uf, resumir(cursos)])
        );
        return {
            ano: dados.ano,
            ead,
            filtrados,
            porUfCursos,
            porUf,
            brasil: resumir(filtrados),
            cursoCampus: filtrados.find((c) => c.codigo === curso.codigo),
        };
    }, [dados, curso, rede, data.cursos]);

    if (!curso) {
        return (
            <Card title="Mapa">
                <p className="text-text-secondary mt-3 text-[14px]">
                    Nenhum curso deste campus tem avaliação para comparar.
                </p>
            </Card>
        );
    }

    const uf = visao && ufParam && visao.porUf.has(ufParam) ? ufParam : null;
    const cursosRecorte = uf
        ? (visao?.porUfCursos.get(uf) ?? [])
        : (visao?.filtrados ?? []);
    const municipios: MunicipioMapa[] = uf
        ? [...agrupar(cursosRecorte, (c) => c.municipio)].map(([codigo, cursos]) => ({
              codigo,
              nome: `${cursos[0].nomeMunicipio}/${cursos[0].uf}`,
              resumo: resumir(cursos),
          }))
        : [];
    const titulo = uf ? (UF_NOMES[uf] ?? uf) : "Brasil";

    // filtros como frase no cabeçalho (seletores "inline", como o do campus
    // na saudação): "CPC médio ▾ em Redes de Computadores ▾ | todas as
    // redes ▾" (o ano do Enade fica ao lado do título) — os três continuam à mão, sem pílulas escuras
    const filtros = (
        <p className="text-text-secondary mt-1.5 text-[13px] leading-relaxed">
            <ChartSelect
                variant="inline"
                tone="surface"
                label="Indicador"
                value={indicador}
                options={Object.entries(INDICADORES).map(([value, { label }]) => ({
                    value,
                    label,
                }))}
                onChange={(v) => atualizar({ indicador: v })}
            />{" "}
            em{" "}
            <ChartSelect
                variant="inline"
                tone="surface"
                label="Curso"
                value={String(curso.codigo)}
                options={[...avaliacoes]
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                    .map((a) => ({ value: String(a.codigo), label: a.nome }))}
                onChange={(v) => atualizar({ curso: v, uf: null })}
            />
            <span className="text-text-muted mx-1.5">|</span>
            <ChartSelect
                variant="inline"
                tone="surface"
                label="Rede"
                value={rede}
                options={Object.entries(REDES_FRASE).map(([value, label]) => ({
                    value,
                    label,
                }))}
                onChange={(v) => atualizar({ rede: v === "todas" ? null : v })}
            />
        </p>
    );

    return (
        <div
            ref={gradeRef}
            className="grid grid-cols-1 gap-5 lg:h-[var(--mapa-h)] lg:grid-cols-12 lg:gap-6"
            style={{ "--mapa-h": `${alturaDisponivel}px` } as CSSProperties}
        >
            <Card
                expansivel="tela"
                className="lg:col-span-7"
                info="Os cursos da mesma área de avaliação no Brasil, por estado, na edição mais recente do Enade, pintados pelo indicador escolhido. Clique num estado para ver os detalhes dele ao lado."
            >
                {/* título com o ano do Enade ao lado (no estilo da frase de
                    filtros), e a frase de filtros embaixo */}
                <h2 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                    {uf ? titulo : "Brasil por estado"}
                    {visao && (
                        <span className="text-text-muted text-[13px] font-normal tracking-normal">
                            {" "}
                            · Enade {visao.ano}
                        </span>
                    )}
                </h2>
                {filtros}
                <div className="relative mt-4 lg:min-h-0 lg:flex-1">
                    {visao ? (
                        <BrasilQualidadeMapa
                            porUf={visao.porUf}
                            indicador={indicador}
                            selecionado={uf}
                            onSelect={(sigla) => atualizar({ uf: sigla })}
                            municipios={municipios}
                            pino={{
                                municipio: data.escopo.codigo_municipio,
                                rotulo: data.escopo.municipio,
                            }}
                        >
                            {uf && (
                                <button
                                    type="button"
                                    onClick={() => atualizar({ uf: null })}
                                    className="bg-surface/90 hover:text-ink text-text-secondary ring-card-ring focus-visible:ring-lime/60 absolute top-0 left-0 flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium shadow-sm ring-1 outline-none focus-visible:ring-2"
                                >
                                    <ArrowLeft
                                        size={14}
                                        strokeWidth={2.25}
                                        aria-hidden
                                    />
                                    Brasil
                                </button>
                            )}
                        </BrasilQualidadeMapa>
                    ) : (
                        <div className="text-text-secondary flex aspect-square items-center justify-center gap-2 text-[13px] lg:aspect-auto lg:h-full">
                            {erro ? (
                                <span className="text-status-critical-text">
                                    {erro}
                                </span>
                            ) : (
                                <>
                                    <span
                                        aria-hidden
                                        className="border-t-lime h-4 w-4 animate-spin rounded-full border-2 border-current/20"
                                    />
                                    Carregando os cursos da área…
                                </>
                            )}
                        </div>
                    )}
                    {visao && carregando && (
                        <span
                            aria-label="Carregando"
                            className="border-t-lime absolute top-2 right-11 h-4 w-4 animate-spin rounded-full border-2 border-current/20"
                        />
                    )}
                </div>
                {visao && (
                    <div className="sr-only">
                        <DataTable
                            columns={["Estado", "Cursos", INDICADORES[indicador].label]}
                            rows={[...visao.porUf]
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([sigla, r]) => [
                                    UF_NOMES[sigla] ?? sigla,
                                    String(r.cursos),
                                    formatIndicador(
                                        indicador,
                                        INDICADORES[indicador].valor(r)
                                    ),
                                ])}
                        />
                    </div>
                )}
            </Card>

            {/* em lg o painel tem a altura do mapa e rola por dentro */}
            <div className="lg:relative lg:col-span-5">
                <Card
                    expansivel="tela"
                    title={titulo}
                    info="Os números do Brasil, ou do estado escolhido no mapa: cursos por faixa, a posição do curso do campus e os cursos da área com os melhores CPCs."
                    subtitle={
                        visao
                            ? `${visao.cursoCampus ? "" : "Seu curso não tem CPC nesta edição · "}${uf ? "Clique fora do estado para voltar ao Brasil" : "Clique num estado para ver os detalhes"}`
                            : undefined
                    }
                    className="lg:absolute lg:inset-0"
                >
                    {/* folga de 4px em volta (compensada nas margens): o contorno do
                        curso do campus na lista não é cortado pela rolagem, nem
                        quando ele é o primeiro ou o último */}
                    <div className="-mx-1 mt-4 -mr-3 min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto py-1 pr-3 pl-1">
                        {visao && (
                            <EstadoPainel
                                titulo={titulo}
                                cursos={cursosRecorte}
                                resumo={uf ? visao.porUf.get(uf)! : visao.brasil}
                                brasil={visao.brasil}
                                ehEstado={uf !== null}
                                cursoCampus={visao.cursoCampus}
                            />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
