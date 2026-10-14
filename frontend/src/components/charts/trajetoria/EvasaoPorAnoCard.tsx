import { useRef, useState, type Ref } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { DataTable } from "@/components/charts/DataTable";
import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatPercent } from "@/lib/format";
import { evasaoPorAnoDoCurso, maduras, type CursoTrajetoria } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

/** Quantos anos de curso mostrar nas colunas (depois disso, a evasão é
 * residual e as turmas maduras mais novas nem chegam lá). */
const ANOS = 7;

/** Fileiras de mini gráficos visíveis antes da grade passar a rolar. */
const FILEIRAS_VISIVEIS = 3;

/** Opção do seletor que mostra a grade com todos (o padrão). */
const TODOS = "todos";

interface Painel {
    chave: string;
    nome: string;
    fracoes: number[];
}

/** Em que ano do curso a evasão acontece: um mini gráfico de colunas por
 * curso (e um do campus inteiro), todos na mesma escala — a parte de toda a
 * evasão das turmas maduras que aconteceu no 1º, 2º, 3º… ano. A coluna mais
 * alta de cada um fica na cor de alerta e ganha o rótulo ("62% no 1º ano"):
 * se a maior parte for no 1º ano, a ação é acolher calouros, não reforçar o
 * fim do curso. Passar o mouse numa coluna mostra o valor dela. */
export function EvasaoPorAnoCard({
    cursos,
    className,
}: {
    cursos: CursoTrajetoria[];
    className?: string;
}) {
    const CHART = useChartTheme();
    // filtro de busca (o mesmo de "Situação final por curso"): todos em
    // grade, ou só o campus / um curso, num gráfico ampliado e centrado
    const [escolha, setEscolha] = useState(TODOS);
    const paineis: Painel[] = [
        {
            chave: "campus",
            nome: "Campus (todos os cursos)",
            fracoes: evasaoPorAnoDoCurso(cursos.flatMap(maduras)),
        },
        ...cursos.map((c) => ({
            chave: String(c.codigo),
            nome: c.nome,
            fracoes: evasaoPorAnoDoCurso(maduras(c)),
        })),
    ].filter((p) => p.fracoes.length > 0);
    const maximo = Math.max(...paineis.flatMap((p) => p.fracoes.slice(0, ANOS)), 0.01);
    // mais de 3 fileiras de mini gráficos (Fortaleza): a grade rola dentro do
    // card, mostrando 3 fileiras de cada vez (altura medida do 1º painel)
    const colunas = useMediaQuery("(min-width: 1024px)") ? 4 : 2;
    const fileiras = Math.ceil(paineis.length / colunas);
    const painelRef = useRef<HTMLDivElement>(null);
    const { height: alturaPainel } = useElementSize(painelRef);
    const GAP_Y = 24; // gap-y-6
    const rola = fileiras > FILEIRAS_VISIVEIS && alturaPainel > 0;
    const alturaMax =
        FILEIRAS_VISIVEIS * alturaPainel + (FILEIRAS_VISIVEIS - 1) * GAP_Y + 8;
    const escolhido = paineis.find((p) => p.chave === escolha);
    const porCodigo = new Map(cursos.map((c) => [String(c.codigo), c]));

    return (
        <Card
            title="Em que ano do curso a evasão acontece"
            subtitle="Taxa de Desistência Anual (TADA) de cada ano de curso, em parte de toda a evasão das turmas maduras"
            className={className}
            action={
                <div className="w-full sm:w-80">
                    <CursoBusca
                        label="Curso"
                        cor={CHART.critical}
                        value={escolha}
                        options={[
                            {
                                value: TODOS,
                                label: "Todos os cursos",
                                detalhe: "Um gráfico por curso, lado a lado",
                            },
                            ...paineis.map((p) => {
                                const c = porCodigo.get(p.chave);
                                return {
                                    value: p.chave,
                                    label: c ? p.nome : "Campus",
                                    detalhe: c
                                        ? [c.grau, c.modalidade]
                                              .filter(Boolean)
                                              .join(" · ") || undefined
                                        : "Todos os cursos somados",
                                };
                            }),
                        ]}
                        onChange={setEscolha}
                        placeholder="Buscar curso…"
                    />
                </div>
            }
        >
            {escolhido ? (
                // um só: ampliado (gráfico centrado, texto à esquerda), na escala dele
                <div className="mt-3">
                    <MiniColunas key={escolhido.chave} painel={escolhido} grande />
                </div>
            ) : (
                <div
                    className={cn(
                        "mt-5 grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4 lg:gap-x-6",
                        rola && "-mr-2 [scrollbar-width:thin] overflow-y-auto pr-2"
                    )}
                    style={rola ? { maxHeight: alturaMax } : undefined}
                >
                    {paineis.map((p, i) => (
                        <MiniColunas
                            key={p.chave}
                            ref={i === 0 ? painelRef : undefined}
                            painel={p}
                            maximo={maximo}
                        />
                    ))}
                </div>
            )}
            <NotaRodape>
                Turmas maduras de cada curso, até dois anos depois do prazo. Desistência
                inclui transferência para outro curso, inclusive dentro da UFC.
            </NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={[
                        "Curso",
                        ...Array.from({ length: ANOS }, (_, i) => `${i + 1}º ano`),
                    ]}
                    rows={paineis.map((p) => [
                        p.nome,
                        ...Array.from({ length: ANOS }, (_, i) =>
                            formatPercent(100 * (p.fracoes[i] ?? 0), 0)
                        ),
                    ])}
                />
            </div>
        </Card>
    );
}

function MiniColunas({
    painel,
    maximo: maximoGrade,
    grande = false,
    ref,
}: {
    painel: Painel;
    /** Escala comum da grade; sem ela (ampliado), a escala do próprio painel. */
    maximo?: number;
    /** Ampliado (um só curso escolhido): colunas altas, textos maiores e o
     * valor escrito em cima de cada coluna. */
    grande?: boolean;
    ref?: Ref<HTMLDivElement>;
}) {
    const CHART = useChartTheme();
    const [foco, setFoco] = useState<number | null>(null);
    const colunas = Array.from({ length: ANOS }, (_, i) => painel.fracoes[i] ?? 0);
    const maximo = maximoGrade ?? Math.max(...colunas, 0.01);
    const pico = colunas.indexOf(Math.max(...colunas));
    const ativo = foco ?? pico;

    return (
        <div ref={ref} className="min-w-0">
            {grande ? (
                // ampliado: tudo numa linha, à esquerda — o curso | o valor
                <p className="flex min-w-0 items-baseline gap-2 text-[14px]">
                    <span className="min-w-0 truncate font-medium" title={painel.nome}>
                        {painel.nome}
                    </span>
                    <span aria-hidden className="text-text-muted">
                        |
                    </span>
                    <span className="text-text-secondary shrink-0 text-[13px]">
                        <span className="text-ink text-[22px] font-semibold tracking-[-0.02em] tabular-nums">
                            {formatPercent(100 * colunas[ativo], 0)}
                        </span>{" "}
                        no {ativo + 1}º ano
                    </span>
                </p>
            ) : (
                <>
                    <p className="truncate text-[12px] font-medium" title={painel.nome}>
                        {painel.nome}
                    </p>
                    <p className="text-text-secondary mt-0.5 text-[12px]">
                        <span className="text-ink text-[15px] font-semibold tabular-nums">
                            {formatPercent(100 * colunas[ativo], 0)}
                        </span>{" "}
                        no {ativo + 1}º ano
                    </p>
                </>
            )}
            {/* ampliado: o gráfico centrado no card (o texto acima fica à
                esquerda do card); na grade, ocupa o painel todo */}
            <div className={cn(grande && "mx-auto w-full max-w-[720px]")}>
                <div
                    className={cn(
                        "flex items-end",
                        grande ? "mt-6 h-60 gap-3" : "mt-2 h-20 gap-1"
                    )}
                    onMouseLeave={() => setFoco(null)}
                    aria-hidden
                >
                    {colunas.map((v, i) => (
                        <span
                            key={i}
                            onMouseEnter={() => setFoco(i)}
                            className={cn(
                                "relative flex-1 cursor-pointer transition-opacity duration-200",
                                grande ? "rounded-t-[6px]" : "rounded-t-[4px]",
                                i !== ativo && "opacity-35"
                            )}
                            style={{
                                height: `${Math.max((v / maximo) * 100, 2)}%`,
                                background: CHART.critical,
                            }}
                        >
                            {grande && (
                                <span className="text-ink absolute inset-x-0 -top-5 text-center text-[12px] font-semibold tabular-nums">
                                    {formatPercent(100 * v, 0)}
                                </span>
                            )}
                        </span>
                    ))}
                </div>
                <div
                    className={cn(
                        "text-text-muted mt-1 flex",
                        grande ? "gap-3 text-[12px]" : "gap-1 text-[10px]"
                    )}
                >
                    {colunas.map((_, i) => (
                        <span
                            key={i}
                            className={cn(
                                "flex-1 text-center tabular-nums",
                                i === ativo && "text-ink font-semibold"
                            )}
                        >
                            {i + 1}º
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
