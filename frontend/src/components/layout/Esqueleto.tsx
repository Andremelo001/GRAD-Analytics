import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Esqueletos de carregamento: o mesmo desenho de cada página (a grade de
 * cards, nos mesmos tamanhos) com blocos cinza e um brilho passando, enquanto
 * os dados chegam — a primeira carga não pula de um aviso pra página cheia.
 * O brilho (``.esqueleto`` em index.css) para com "reduzir movimento". */

/** Um bloco cinza com o brilho (barra de texto, área de gráfico…). */
export function Barra({ className }: { className?: string }) {
    return <span aria-hidden className={cn("esqueleto block rounded-md", className)} />;
}

/** Casca de card (mesmo fundo, cantos e sombra do ``Card``), com título e
 * subtítulo em barras, e o conteúdo dado. */
export function CardEsqueleto({
    className,
    titulo = true,
    acao = false,
    children,
}: {
    className?: string;
    titulo?: boolean;
    /** Barra de seletor no canto (o ``action`` dos cards). */
    acao?: boolean;
    children?: ReactNode;
}) {
    return (
        <div
            aria-hidden
            className={cn(
                "bg-surface ring-card-ring flex min-w-0 flex-col rounded-[18px] p-5 shadow-[0_4px_24px_rgb(0_0_0/0.05)] ring-1 lg:p-6",
                className
            )}
        >
            {titulo && (
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <Barra className="h-4 w-40 max-w-full" />
                        <Barra className="mt-2.5 h-3 w-64 max-w-full" />
                    </div>
                    {acao && <Barra className="h-9 w-32 shrink-0 rounded-xl" />}
                </div>
            )}
            {children}
        </div>
    );
}

/** Tile de indicador (rótulo, número grande e rodapé). */
export function TileEsqueleto() {
    return (
        <CardEsqueleto titulo={false} className="min-h-[133px] gap-0 lg:min-h-[157px]">
            <Barra className="h-3.5 w-28" />
            <Barra className="mt-4 h-7 w-24" />
            <Barra className="mt-auto h-3 w-40 max-w-full" />
        </CardEsqueleto>
    );
}

/** Linhas de lista/tabela (nome à esquerda, barra e valor). */
function Linhas({ n, className }: { n: number; className?: string }) {
    return (
        <div className={cn("mt-5 flex flex-col gap-4", className)}>
            {Array.from({ length: n }, (_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <Barra className="h-3 w-32 shrink-0" />
                    <Barra className="h-3 flex-1" />
                    <Barra className="h-3 w-10 shrink-0" />
                </div>
            ))}
        </div>
    );
}

/** Embrulho comum: grade da página e o aviso pra leitor de tela. */
function Pagina({ children, rotulo }: { children: ReactNode; rotulo: string }) {
    return (
        <div
            role="status"
            aria-busy
            aria-label={rotulo}
            className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6"
        >
            <span className="sr-only">{rotulo}</span>
            {children}
        </div>
    );
}

/** Genérico: um card grande (páginas sem esqueleto próprio). */
export function PaginaEsqueleto() {
    return (
        <Pagina rotulo="Carregando dados do painel">
            <CardEsqueleto className="lg:col-span-12">
                <Barra className="mt-5 h-64" />
            </CardEsqueleto>
        </Pagina>
    );
}

/** Início: Ingressantes + 2 tiles; Presença + CPC; mapa de calor. */
export function InicioEsqueleto() {
    return (
        <Pagina rotulo="Carregando o Início">
            {/* ingressantes + presença no Brasil */}
            <CardEsqueleto className="lg:col-span-8" acao>
                <Barra className="mt-5 h-[260px]" />
                <Barra className="mt-4 h-3 w-44" />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-4" acao>
                <Barra className="mt-4 h-7 w-20" />
                <Barra className="mt-5 aspect-square w-full rounded-2xl" />
            </CardEsqueleto>
            {/* tiles de qualidade + CPC */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
                <TileEsqueleto />
                <TileEsqueleto />
            </div>
            <CardEsqueleto className="lg:col-span-8" acao>
                <Barra className="mt-4 h-7 w-24" />
                <Barra className="mt-5 h-[300px]" />
            </CardEsqueleto>
            {/* evasão anual + tiles de trajetória */}
            <CardEsqueleto className="lg:col-span-8">
                <Linhas n={6} />
            </CardEsqueleto>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
                <TileEsqueleto />
                <TileEsqueleto />
            </div>
        </Pagina>
    );
}

/** Qualidade → Visão do campus: 4 tiles, ranking + evolução, componentes. */
export function VisaoCampusEsqueleto() {
    return (
        <Pagina rotulo="Carregando a Visão do campus">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4 lg:gap-6">
                <TileEsqueleto />
                <TileEsqueleto />
                <TileEsqueleto />
                <TileEsqueleto />
            </div>
            <CardEsqueleto className="lg:col-span-7">
                <Linhas n={7} className="gap-5" />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-5" acao>
                <Barra className="mt-5 h-[360px]" />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-12">
                <Linhas n={5} />
            </CardEsqueleto>
        </Pagina>
    );
}

/** Qualidade → Por curso: cabeçalho do curso e os dois pares de cards. */
export function PorCursoEsqueleto() {
    return (
        <Pagina rotulo="Carregando o curso">
            <CardEsqueleto className="lg:col-span-12" titulo={false}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <Barra className="h-3 w-56 max-w-full" />
                        <Barra className="mt-2.5 h-6 w-64 max-w-full" />
                    </div>
                    <Barra className="h-10 w-full rounded-xl sm:w-80" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i}>
                            <Barra className="h-3 w-20" />
                            <Barra className="mt-2 h-5 w-16" />
                        </div>
                    ))}
                </div>
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-7">
                <Barra className="mt-4 h-7 w-20" />
                <Barra className="mx-auto mt-6 aspect-square w-full max-w-[340px] rounded-full" />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-5">
                <Barra className="mt-4 h-7 w-20" />
                <Barra className="mt-5 h-3" />
                <Linhas n={4} />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-7">
                <Linhas n={7} />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-5">
                <Linhas n={3} />
            </CardEsqueleto>
        </Pagina>
    );
}

/** Qualidade → Mapa: o mapa e o painel do Brasil/estado. */
export function MapaEsqueleto() {
    return (
        <Pagina rotulo="Carregando o mapa">
            <CardEsqueleto className="lg:col-span-7" acao>
                <Barra className="mt-5 aspect-[1/1.05] w-full rounded-2xl" />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-5">
                <div className="mt-5 grid grid-cols-3 gap-4">
                    {Array.from({ length: 3 }, (_, i) => (
                        <div key={i}>
                            <Barra className="h-3 w-14" />
                            <Barra className="mt-2 h-6 w-16" />
                        </div>
                    ))}
                </div>
                <Barra className="mt-6 h-2.5" />
                <Linhas n={8} />
            </CardEsqueleto>
        </Pagina>
    );
}

/** Qualidade → Comparações: o card de seleção e os cards lado a lado. */
export function ComparacoesEsqueleto() {
    return (
        <Pagina rotulo="Carregando as comparações">
            <CardEsqueleto className="lg:col-span-12" titulo={false}>
                <Barra className="h-9 w-72 max-w-full rounded-full" />
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <Barra className="h-10 rounded-xl" />
                    <Barra className="hidden h-8 w-8 rounded-full sm:block" />
                    <Barra className="h-10 rounded-xl" />
                </div>
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-5">
                <Linhas n={5} className="gap-6" />
            </CardEsqueleto>
            <CardEsqueleto className="lg:col-span-7">
                <Linhas n={9} />
            </CardEsqueleto>
        </Pagina>
    );
}
