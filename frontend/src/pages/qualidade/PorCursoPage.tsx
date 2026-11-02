import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Card } from "@/components/cards/Card";
import { ComponentesDumbbellCard } from "@/components/charts/qualidade/ComponentesDumbbellCard";
import { ComponentesTempoCard } from "@/components/charts/qualidade/ComponentesTempoCard";
import { ContribuicaoCard } from "@/components/charts/qualidade/ContribuicaoCard";
import { CursoResumoCard } from "@/components/charts/qualidade/CursoResumoCard";
import { ParticipacaoEnadeCard } from "@/components/charts/qualidade/ParticipacaoEnadeCard";
import { ProximaFaixaCard } from "@/components/charts/qualidade/ProximaFaixaCard";
import { DataState } from "@/components/layout/DataState";
import { FiltroTopo, SeletorCursoTopo } from "@/components/layout/FiltroTopo";
import { PorCursoEsqueleto } from "@/components/layout/Esqueleto";
import { useCursoEscolhido } from "@/hooks/useCursoEscolhido";
import { opcaoCurso } from "@/lib/curso";
import { avaliacaoNoAno, buildAvaliacoes, type AvaliacaoCurso } from "@/lib/qualidade";
import type { DashboardData } from "@/types/dashboard";

export function PorCursoPage() {
    return (
        <DataState
            esqueleto={<PorCursoEsqueleto />}
            render={(data) => <PorCurso key={data.escopo.slug} data={data} />}
        />
    );
}

// O último curso visto (área e nome), pra abrir o equivalente quando a unidade
// muda: a página é montada de novo e o código da URL é de outra unidade.
let ultimoVisto: { area: string | null; nome: string } | null = null;

/** Nome-base do curso, sem o grau/código que os repetidos ganham
 * ("Física · Bacharelado" -> "física"). */
const nomeBase = (nome: string) => nome.split(" · ")[0].toLocaleLowerCase("pt-BR");

const porCpc = (a: AvaliacaoCurso, b: AvaliacaoCurso) => (b.cpc ?? -1) - (a.cpc ?? -1);

/** O curso desta unidade que corresponde ao último visto: mesma área de
 * avaliação, senão mesmo nome; o de maior CPC se houver mais de um. */
function equivalente(avaliacoes: AvaliacaoCurso[]): AvaliacaoCurso | undefined {
    if (!ultimoVisto) return undefined;
    const { area, nome } = ultimoVisto;
    const mesmaArea = area ? avaliacoes.filter((a) => a.area === area) : [];
    const mesmoNome = avaliacoes.filter((a) => nomeBase(a.nome) === nome);
    return [...(mesmaArea.length ? mesmaArea : mesmoNome)].sort(porCpc)[0];
}

/** Qualidade → Por curso (``/qualidade/curso/:codigo``): por que o CPC do
 * curso é o que é e onde dá pra melhorar. O curso da URL é uma escolha (o
 * seletor, um link, a busca) e vira o curso escolhido do painel
 * (``useCursoEscolhido``). Sem código (ou com um código de outra unidade,
 * depois de trocar a unidade), abre o escolhido desta unidade; sem escolha
 * aqui, o equivalente ao que estava aberto (mesma área ou mesmo nome) — já
 * desenhando a página (a URL é corrigida em seguida), sem um quadro vazio no
 * meio: assim a rolagem fica onde estava. Sem equivalente, abre o de maior CPC
 * (sem virar escolha) e volta ao topo. */
function PorCurso({ data }: { data: DashboardData }) {
    const { codigo } = useParams<{ codigo: string }>();
    const navigate = useNavigate();
    const avaliacoes = useMemo(() => buildAvaliacoes(data), [data]);
    // o seletor do cabeçalho: a busca filtra por nome, código e grau (e, sem
    // aparecer, pela área)
    const opcoes = useMemo(
        () =>
            [...avaliacoes]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((c) => ({
                    ...opcaoCurso({
                        codigo: c.codigo,
                        nome: c.nomeCurso,
                        grau: c.grau,
                    }),
                    busca: c.area ?? undefined,
                })),
        [avaliacoes]
    );
    const escolha = useCursoEscolhido();
    // o código que a própria página pôs na URL (sem escolha): não vira escolha
    const automatico = useRef<string | null>(null);
    const pedido = avaliacoes.find((a) => String(a.codigo) === codigo);
    const escolhido = pedido
        ? undefined
        : avaliacoes.find((a) => a.codigo === (escolha.curso ?? escolha.ultimo));
    const correspondente = pedido || escolhido ? undefined : equivalente(avaliacoes);
    const curso =
        pedido ?? escolhido ?? correspondente ?? [...avaliacoes].sort(porCpc)[0];
    // trocou de unidade e o curso que estava aberto não existe aqui: abre outro
    // curso, então a página volta ao topo (com o equivalente, a rolagem fica)
    const semEquivalente =
        !pedido && !escolhido && !correspondente && ultimoVisto !== null;
    const { escolher } = escolha;
    // o ano da avaliação escolhido no CursoResumoCard, do curso em que foi
    // escolhido: trocar de curso volta pra avaliação mais recente
    const [anoEscolhido, setAnoEscolhido] = useState<{
        codigo: number;
        ano: number;
    } | null>(null);

    useEffect(() => {
        if (!curso) return;
        ultimoVisto = { area: curso.area, nome: nomeBase(curso.nome) };
        // o da URL (que não foi a página que pôs) e o equivalente da outra
        // unidade são escolhas; o padrão (maior CPC), não
        if ((pedido && codigo !== automatico.current) || correspondente)
            escolher(curso.codigo);
        // a URL chegou no código automático: daqui pra frente, o mesmo código
        // vindo de um link volta a ser escolha
        if (codigo === automatico.current) automatico.current = null;
        if (String(curso.codigo) !== codigo) {
            if (semEquivalente) window.scrollTo({ top: 0 });
            automatico.current = String(curso.codigo);
            navigate(`/qualidade/curso/${curso.codigo}`, { replace: true });
        }
    }, [curso, codigo, pedido, correspondente, escolher, navigate, semEquivalente]);

    if (!curso) {
        return (
            <p className="text-text-secondary text-[14px]">
                Nenhum curso nesta unidade.
            </p>
        );
    }

    // a avaliação do ano escolhido: os cards dessa avaliação (a ficha, as
    // réguas, "De onde vem a nota", "Curso × média nacional") a seguem; os da
    // série (componentes no tempo, participação) mostram todas as edições
    const avaliacao =
        anoEscolhido?.codigo === curso.codigo
            ? avaliacaoNoAno(data, curso, anoEscolhido.ano)
            : curso;
    const temNotas = avaliacao.cpc !== null && avaliacao.perfil !== undefined;
    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <FiltroTopo>
                {(tom) => (
                    <SeletorCursoTopo
                        tom={tom}
                        value={String(curso.codigo)}
                        options={opcoes}
                        onChange={(c) => navigate(`/qualidade/curso/${c}`)}
                    />
                )}
            </FiltroTopo>
            <CursoResumoCard
                className="lg:col-span-12"
                curso={avaliacao}
                anos={curso.historico.map((e) => e.ano)}
                onAno={(ano) => setAnoEscolhido({ codigo: curso.codigo, ano })}
            />
            {/* lado a lado com a mesma altura: as duas réguas (CPC e Conceito
                Enade), empilhadas, dividem a altura do "De onde vem a nota" */}
            {temNotas && (
                <div className="grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                    <ContribuicaoCard className="lg:col-span-7" curso={avaliacao} />
                    <div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
                        <ProximaFaixaCard
                            className="lg:flex-1"
                            indicador="cpc"
                            valor={avaliacao.cpc}
                        />
                        <ProximaFaixaCard
                            className="lg:flex-1"
                            indicador="enade"
                            valor={avaliacao.enade}
                        />
                    </div>
                </div>
            )}
            {/* cada componente do CPC ao longo das avaliações */}
            {temNotas && (
                <ComponentesTempoCard
                    className="lg:col-span-12"
                    curso={curso}
                    nacional={data.medias_nacionais.perfil_radar}
                />
            )}
            {/* embaixo, também lado a lado com a mesma altura: a participação
                acompanha o "Curso × média nacional" (ou o aviso de sem CPC) */}
            <div className="grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                {temNotas ? (
                    <ComponentesDumbbellCard
                        className="lg:col-span-7"
                        curso={avaliacao}
                    />
                ) : (
                    <SemCpcCard className="lg:col-span-7" curso={avaliacao} />
                )}
                <ParticipacaoEnadeCard className="lg:col-span-5" curso={curso} />
            </div>
        </div>
    );
}

function SemCpcCard({
    curso,
    className,
}: {
    curso: AvaliacaoCurso;
    className?: string;
}) {
    const nunca = curso.ano === null;
    return (
        <Card
            title={nunca ? "Curso ainda não avaliado" : "Sem conceito nesta avaliação"}
            className={className}
        >
            <p className="text-text-secondary mt-3 max-w-prose text-[14px] leading-relaxed">
                {nunca
                    ? "O CPC só é calculado quando o curso tem concluintes inscritos no Enade da sua área. Cursos novos, ou de áreas que ainda não passaram por um ciclo depois da abertura do curso, aparecem aqui sem nota."
                    : `Na avaliação de ${curso.ano} o curso ficou sem conceito (SC): o INEP não calcula o CPC quando há poucos concluintes participantes ou falta alguma informação do curso. As notas por componente não são divulgadas nesse caso.`}
            </p>
        </Card>
    );
}
