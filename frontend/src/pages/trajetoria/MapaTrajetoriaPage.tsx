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
import { EstadoPainelTrajetoria } from "@/components/charts/trajetoria/EstadoPainelTrajetoria";
import { DataState } from "@/components/layout/DataState";
import { MapaEsqueleto } from "@/components/layout/Esqueleto";
import { useAlturaDisponivel } from "@/hooks/useAlturaDisponivel";
import { useTrajetoriaArea } from "@/hooks/useTrajetoriaArea";
import { cursoDoPorCurso } from "@/lib/curso-por-curso";
import { type Rede } from "@/lib/area";
import { buildTrajetorias } from "@/lib/trajetoria";
import {
    agruparTrajetoria,
    formatTaxa,
    INDICADORES_MAPA,
    resumirTrajetoria,
    type IndicadorMapa,
    type ResumoTrajetoria,
} from "@/lib/trajetoria-mapa";
import { UF_NOMES } from "@/lib/uf";
import type { DashboardData } from "@/types/dashboard";

export function MapaTrajetoriaPage() {
    return (
        <DataState
            esqueleto={<MapaEsqueleto />}
            render={(data) => <Mapa key={data.escopo.codigo_municipio} data={data} />}
        />
    );
}

/** No seletor, na ordem em que a aba apresenta os indicadores. */
const OPCOES_INDICADOR: IndicadorMapa[] = ["TAP", "TCA", "TDA"];

const ehIndicador = (v: string | null): v is IndicadorMapa =>
    v !== null && v in INDICADORES_MAPA;
const ehRede = (v: string | null): v is Rede =>
    v === "todas" || v === "publicas" || v === "privadas";

/** Rótulos da rede dentro da frase de filtros do mapa. */
const REDES_FRASE: Record<Rede, string> = {
    todas: "todas as redes",
    publicas: "só rede pública",
    privadas: "só rede privada",
};

/** Trajetória → Mapa, no formato do Mapa da Qualidade: o mesmo curso (mesma
 * área CINE, grau e modalidade) pelo Brasil, na turma madura de cada curso,
 * pintado pela Taxa de Permanência, de Conclusão Acumulada ou de Desistência
 * Acumulada. Curso, indicador, rede e estado ficam na URL
 * (``?curso=…&indicador=…&rede=…&uf=…``), então dá pra compartilhar a vista. */
function Mapa({ data }: { data: DashboardData }) {
    const [params, setParams] = useSearchParams();
    const trajetorias = useMemo(
        () => buildTrajetorias(data).filter((c) => c.area !== null),
        [data]
    );
    // o da URL; sem ele, o aberto no Por curso; senão o primeiro
    const curso =
        trajetorias.find((c) => String(c.codigo) === params.get("curso")) ??
        trajetorias.find((c) => c.codigo === cursoDoPorCurso("trajetoria")) ??
        trajetorias[0];
    const indicador: IndicadorMapa = ehIndicador(params.get("indicador"))
        ? (params.get("indicador") as IndicadorMapa)
        : "TCA";
    const rede: Rede = ehRede(params.get("rede"))
        ? (params.get("rede") as Rede)
        : "todas";
    const ufParam = params.get("uf");
    const ind = INDICADORES_MAPA[indicador];

    const area = curso?.area ?? null;
    const { dados, erro } = useTrajetoriaArea(area);
    const carregando = area !== null && dados?.area !== area && !erro;

    // em lg o mapa e o painel cabem na tela, sem rolar
    const gradeRef = useRef<HTMLDivElement>(null);
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
        // os pares: mesmo grau e modalidade do curso do campus (a linha dele
        // no arquivo da área, senão o cadastro do campus)
        const linha = dados.cursos.find((c) => c.codigo === curso.codigo);
        const ead = linha?.ead ?? /dist/i.test(curso.modalidade ?? "");
        const grau = linha?.grau ?? curso.grau;
        const filtrados = dados.cursos.filter(
            (c) =>
                c.uf !== null &&
                c.ead === ead &&
                c.grau === grau &&
                (rede === "todas" ||
                    (rede === "publicas" ? c.publica === true : c.publica === false))
        );
        const porUfCursos = agruparTrajetoria(filtrados, (c) => c.uf!);
        const porUf = new Map(
            [...porUfCursos].map(([uf, cursos]) => [uf, resumirTrajetoria(cursos)])
        );
        return {
            filtrados,
            porUfCursos,
            porUf,
            brasil: resumirTrajetoria(filtrados),
            // o curso do campus é a referência mesmo quando o filtro de rede o
            // tira do recorte (a UFC é pública: "só rede privada"); aí ele
            // aparece onde ficaria entre os cursos filtrados
            cursoCampus: linha,
            noFiltro: filtrados.some((c) => c.codigo === curso.codigo),
        };
    }, [dados, curso, rede]);

    if (!curso) {
        return (
            <Card title="Mapa">
                <p className="text-text-secondary mt-3 text-[14px]">
                    Nenhum curso deste campus tem turmas acompanhadas para comparar.
                </p>
            </Card>
        );
    }

    const uf = visao && ufParam && visao.porUf.has(ufParam) ? ufParam : null;
    const cursosRecorte = uf
        ? (visao?.porUfCursos.get(uf) ?? [])
        : (visao?.filtrados ?? []);
    const municipios: MunicipioMapa<ResumoTrajetoria>[] = uf
        ? [
              ...agruparTrajetoria(
                  cursosRecorte.filter((c) => c.municipio !== null),
                  (c) => c.municipio!
              ),
          ].map(([codigo, cursos]) => ({
              codigo,
              nome: `${cursos[0].nomeMunicipio}/${cursos[0].uf}`,
              resumo: resumirTrajetoria(cursos),
          }))
        : [];
    const titulo = uf ? (UF_NOMES[uf] ?? uf) : "Brasil";
    // por que o curso do campus aparece "na posição em que ficaria" no painel
    const avisoFora = !visao?.cursoCampus
        ? null
        : !visao.noFiltro
          ? `Seu curso é da rede ${visao.cursoCampus.publica ? "pública" : "privada"} e não entra no filtro: aparece na posição em que ficaria.`
          : uf && visao.cursoCampus.uf !== uf
            ? `Seu curso não é de ${UF_NOMES[uf] ?? uf}: aparece na posição em que ficaria.`
            : null;
    const valorDe = (r: ResumoTrajetoria) => r.medias[indicador];

    // filtros como frase no cabeçalho, como no Mapa da Qualidade:
    // "Taxa de Conclusão Acumulada ▾ em Computação ▾ | todas as redes ▾"
    const filtros = (
        <div className="text-text-secondary mt-1.5 text-[13px] leading-relaxed">
            <ChartSelect
                variant="inline"
                tone="surface"
                label="Indicador"
                value={indicador}
                options={OPCOES_INDICADOR.map((i) => ({
                    value: i,
                    label: INDICADORES_MAPA[i].label,
                }))}
                onChange={(v) => atualizar({ indicador: v })}
            />{" "}
            em{" "}
            <ChartSelect
                variant="inline"
                tone="surface"
                label="Curso"
                value={String(curso.codigo)}
                options={trajetorias.map((c) => ({
                    value: String(c.codigo),
                    label: c.nome,
                }))}
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
        </div>
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
                tituloInfo={uf ? titulo : "Brasil por estado"}
                info="Os cursos da mesma área, grau e modalidade no Brasil, por estado, pintados pelo indicador escolhido: a média (pesada pelos ingressantes) da situação final da turma madura de cada curso, dois anos depois do prazo. Clique num estado para ver os detalhes dele ao lado."
            >
                <h2 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                    {uf ? titulo : "Brasil por estado"}
                    <span className="text-text-muted text-[13px] font-normal tracking-normal">
                        {" "}
                        · turmas maduras
                    </span>
                </h2>
                {filtros}
                <div className="relative mt-4 lg:min-h-0 lg:flex-1">
                    {visao ? (
                        <BrasilQualidadeMapa
                            porUf={visao.porUf}
                            valorDe={valorDe}
                            rotulo={ind.label}
                            formatar={formatTaxa}
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
                            columns={["Estado", "Cursos", ind.label]}
                            rows={[...visao.porUf]
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([sigla, r]) => [
                                    UF_NOMES[sigla] ?? sigla,
                                    String(r.cursos),
                                    formatTaxa(valorDe(r)),
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
                    info={`Os números do Brasil, ou do estado escolhido no mapa, na ${ind.label}: cursos, a posição do curso do campus e os cursos da área com as ${ind.melhores.toLowerCase()}.`}
                    subtitle={
                        visao
                            ? `${visao.cursoCampus && ind.doCurso(visao.cursoCampus) !== null ? "" : "Seu curso não tem turma madura nesta área · "}${uf ? "Clique fora do estado para voltar ao Brasil" : "Clique num estado para ver os detalhes"}`
                            : undefined
                    }
                    className="lg:absolute lg:inset-0"
                >
                    {/* folga de 4px em volta (compensada nas margens): o contorno do
                        curso do campus na lista não é cortado pela rolagem */}
                    <div className="-mx-1 mt-4 -mr-3 min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto py-1 pr-3 pl-1">
                        {visao && (
                            <EstadoPainelTrajetoria
                                titulo={titulo}
                                cursos={cursosRecorte}
                                resumo={uf ? visao.porUf.get(uf)! : visao.brasil}
                                brasil={visao.brasil}
                                ehEstado={uf !== null}
                                indicador={indicador}
                                cursoCampus={visao.cursoCampus}
                                avisoFora={avisoFora}
                            />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
