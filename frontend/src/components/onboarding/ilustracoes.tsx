import { Info, Maximize2, Search, Settings } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import brasao from "@/assets/brasao.png";
import { useChartTheme } from "@/hooks/useChartTheme";
import { cn } from "@/lib/utils";

// Ilustrações do guia de boas-vindas: miniaturas animadas das partes do
// painel (seletores, abas, gráficos), desenhadas com as mesmas cores do tema
// — acompanham o claro/escuro e as cores acessíveis, e não ficam
// desatualizadas como uma captura de tela. Animações em index.css
// (``guia-*``); com "reduzir movimento", tudo aparece pronto e parado.

const atraso = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Moldura de todas as ilustrações: o plano cinza da aplicação, com a malha
 * de pontinhos decorativa no canto. */
function Moldura({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                "bg-page relative h-[176px] overflow-hidden rounded-2xl sm:h-[200px]",
                className
            )}
        >
            <div className="pontilhado absolute inset-y-0 right-0 w-1/2" />
            <div className="relative flex h-full items-center justify-center p-4">
                {children}
            </div>
        </div>
    );
}

/** Texto sendo digitado, em loop: escreve, espera, apaga e recomeça. Com
 * "reduzir movimento", o texto inteiro, parado. */
function useDigitacao(texto: string): string {
    const parado =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [n, setN] = useState(parado ? texto.length : 0);
    useEffect(() => {
        if (parado) return;
        // quadros: digita (1 letra por quadro), segura ~2s cheio, segura ~0,8s vazio
        const total = texto.length + 14 + 5;
        let quadro = 0;
        const id = window.setInterval(() => {
            quadro = (quadro + 1) % total;
            setN(Math.min(quadro, texto.length));
            if (quadro >= texto.length + 14) setN(0);
        }, 150);
        return () => window.clearInterval(id);
    }, [texto, parado]);
    return texto.slice(0, n);
}

/** Linha de gráfico que se desenha (``pathLength`` normalizado pra animação). */
function Linha({
    d,
    cor,
    largura = 2.5,
    delay = 0,
}: {
    d: string;
    cor: string;
    largura?: number;
    delay?: number;
}) {
    return (
        <path
            d={d}
            pathLength={1}
            fill="none"
            stroke={cor}
            strokeWidth={largura}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="guia-desenha"
            style={atraso(delay)}
        />
    );
}

// --- 1. boas-vindas ----------------------------------------------------------

export function IlustracaoBoasVindas() {
    const CHART = useChartTheme();
    return (
        <Moldura>
            <div className="flex w-full max-w-[420px] items-center gap-4 sm:gap-6">
                <div className="flex shrink-0 flex-col items-center gap-2">
                    <img src={brasao} alt="" className="h-16 w-auto sm:h-20" />
                    <span className="text-ink text-[13px] font-bold tracking-[-0.01em]">
                        GRAD Analytics
                    </span>
                </div>
                <div className="bg-surface ring-card-ring flex min-w-0 flex-1 items-center justify-center rounded-xl p-4 shadow-[0_6px_20px_rgb(0_0_0/0.06)] ring-1">
                    <div className="flex w-full items-end gap-1.5">
                        {[38, 52, 46, 64, 58, 76].map((h, i) => (
                            <span
                                key={i}
                                className="guia-cresce-y flex-1 rounded-t-[4px]"
                                style={{
                                    height: h,
                                    background: i === 5 ? CHART.lime : CHART.brand,
                                    ...atraso(i * 90),
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </Moldura>
    );
}

// --- 2. seletor de unidade ---------------------------------------------------

const UNIDADES = [
    ["CC - CENTRO DE CIÊNCIAS", "Fortaleza"],
    ["CCA - CENTRO DE CIÊNCIAS AGRÁRIAS", "Fortaleza"],
    ["DIRQUIXADA - CAMPUS DA UFC EM QUIXADÁ", "Quixadá"],
] as const;

export function IlustracaoUnidade() {
    const busca = useDigitacao("agrár");
    const lista = busca ? UNIDADES.filter(([n]) => n.includes("AGRÁR")) : UNIDADES;
    return (
        <Moldura>
            <div className="flex w-full max-w-[300px] flex-col gap-1.5">
                <div className="bg-band ring-lime/60 flex h-8 items-center gap-2 rounded-full px-3.5 text-[11.5px] ring-2">
                    <Search size={12} className="shrink-0 text-white/50" />
                    <span className="text-white">{busca}</span>
                    <span className="guia-cursor -ml-1.5 h-3.5 w-px bg-white" />
                    {!busca && (
                        <span className="-ml-1 text-white/45">Buscar unidade…</span>
                    )}
                </div>
                <div className="bg-popover rounded-xl p-1 shadow-[0_10px_28px_rgb(0_0_0/0.14)]">
                    {lista.map(([nome, cidade], i) => (
                        <div
                            key={nome}
                            className={cn(
                                "rounded-lg px-2.5 py-1.5",
                                (busca ? i === 0 : nome.startsWith("CCA")) && "bg-page"
                            )}
                        >
                            <p className="text-ink truncate text-[11px] leading-tight">
                                {nome}
                            </p>
                            <p className="text-text-muted text-[9.5px]">{cidade}</p>
                        </div>
                    ))}
                </div>
            </div>
        </Moldura>
    );
}

// --- 3. início ---------------------------------------------------------------

/** Um card em miniatura dentro das seções do Início rolando. */
function MiniCard({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <div className="bg-surface ring-card-ring flex min-w-0 flex-1 flex-col rounded-lg p-2 shadow-[0_4px_14px_rgb(0_0_0/0.05)] ring-1">
            <p className="text-ink truncate text-[9px] font-semibold">{titulo}</p>
            <div className="mt-1 min-h-0 flex-1">{children}</div>
        </div>
    );
}

/** Duas linhas (a série e a média nacional) num mini card. */
function MiniLinhas({ d1, d2 }: { d1: string; d2: string }) {
    const CHART = useChartTheme();
    return (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
            <path d={d1} fill="none" stroke={CHART.brand} strokeWidth={2.5} />
            <path d={d2} fill="none" stroke={CHART.comparacao.b} strokeWidth={2} />
        </svg>
    );
}

const ABAS_INICIO = ["Ingresso e conclusão", "Qualidade", "Trajetória"];
/** Atraso de cada aba na animação do texto ativo (ciclo de 6s, um terço cada). */
const ATRASO_ABA = ["0s", "-4s", "-2s"];

export function IlustracaoInicio() {
    const CHART = useChartTheme();
    // cada seção tem a altura da janela: a página sobe uma seção por vez
    const secao = "flex h-[100px] gap-2 p-1 sm:h-[124px]";
    return (
        <Moldura>
            <div className="flex w-full max-w-[420px] flex-col gap-2">
                {/* as sub-abas do Início, como no topo da página: a pílula na
                    faixa escura e o limão passando pela seção visível */}
                <div className="bg-band rounded-full p-1">
                    <div className="relative grid grid-cols-3 rounded-full bg-white/[0.07] p-[3px] ring-1 ring-white/10">
                        <span className="pointer-events-none absolute inset-y-[3px] left-[3px] w-[calc((100%-6px)/3)]">
                            <span className="guia-abas bg-lime block h-full w-full rounded-full" />
                        </span>
                        {ABAS_INICIO.map((t, i) => (
                            <span
                                key={t}
                                className={cn(
                                    "guia-aba-ativa relative truncate py-1 text-center text-[8px] font-semibold tracking-[-0.01em] min-[390px]:text-[8.5px] sm:text-[10.5px] sm:tracking-normal",
                                    i === 0 ? "text-on-lime" : "text-white/60"
                                )}
                                style={{ animationDelay: ATRASO_ABA[i] }}
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                </div>

                {/* a página rolando: as três seções empilhadas sobem dentro
                    da janela, com a barra de rolagem descendo ao lado */}
                <div className="relative h-[100px] overflow-hidden rounded-lg sm:h-[124px]">
                    <div className="guia-rola pr-3">
                        <div className={secao}>
                            <MiniCard titulo="Ingressantes">
                                <MiniLinhas
                                    d1="M0 34 C 20 30, 35 18, 55 20 S 85 8, 100 6"
                                    d2="M0 36 C 30 32, 55 28, 75 24 S 95 20, 100 18"
                                />
                            </MiniCard>
                            <MiniCard titulo="Concluintes">
                                <MiniLinhas
                                    d1="M0 30 C 15 18, 30 12, 45 26 S 75 14, 100 4"
                                    d2="M0 34 C 25 34, 50 28, 70 22 S 90 10, 100 6"
                                />
                            </MiniCard>
                        </div>
                        <div className={secao}>
                            <MiniCard titulo="Presença no Brasil">
                                <div className="mx-auto grid h-full w-fit grid-cols-6 content-center gap-1">
                                    {[
                                        0, 1, 1, 2, 0, 1, 2, 3, 2, 1, 0, 1, 3, 2, 1, 0,
                                        1, 2,
                                    ].map((n, i) => (
                                        <span
                                            key={i}
                                            className="h-2 w-2 rounded-full sm:h-3 sm:w-3"
                                            style={{
                                                background: CHART.presenca.ramp[n],
                                            }}
                                        />
                                    ))}
                                </div>
                            </MiniCard>
                            <MiniCard titulo="CPC × média nacional">
                                <MiniLinhas
                                    d1="M0 28 L 33 20 L 66 22 L 100 10"
                                    d2="M0 26 L 33 25 L 66 24 L 100 22"
                                />
                            </MiniCard>
                        </div>
                        <div className={secao}>
                            <MiniCard titulo="Evasão por ano">
                                <div className="grid h-full grid-cols-5 content-center gap-[3px]">
                                    {[0, 1, 2, 1, 0, 2, 3, 1, 0, 1, 1, 0, 2, 3, 2].map(
                                        (n, i) => (
                                            <span
                                                key={i}
                                                className="h-2.5 rounded-[2px] sm:h-3.5"
                                                style={{
                                                    background:
                                                        i % 3 === 1
                                                            ? CHART.evasao.acima[n]
                                                            : CHART.evasao.abaixo[n],
                                                }}
                                            />
                                        )
                                    )}
                                </div>
                            </MiniCard>
                            <MiniCard titulo="Conclusão e evasão">
                                <div className="flex h-full items-end gap-1">
                                    {[
                                        [55, 30],
                                        [48, 38],
                                        [62, 24],
                                        [40, 44],
                                    ].map(([conclui, desiste], i) => (
                                        <div
                                            key={i}
                                            className="flex h-full flex-1 flex-col-reverse overflow-hidden rounded-[3px]"
                                        >
                                            <span
                                                style={{
                                                    height: `${conclui}%`,
                                                    background: CHART.brand,
                                                }}
                                            />
                                            <span
                                                style={{
                                                    height: `${desiste}%`,
                                                    background: CHART.critical,
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </MiniCard>
                        </div>
                    </div>
                    {/* barra de rolagem: um terço do trilho, descendo uma seção por vez */}
                    <span className="absolute inset-y-1 right-0.5 w-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
                        <span className="guia-rola-barra block h-1/3 w-full rounded-full bg-[color-mix(in_srgb,var(--ink)_30%,transparent)]" />
                    </span>
                </div>
            </div>
        </Moldura>
    );
}

// --- 4. qualidade ------------------------------------------------------------

export function IlustracaoQualidade() {
    const CHART = useChartTheme();
    const cursos: [string, number, number][] = [
        ["Curso A", 0.92, 5],
        ["Curso B", 0.76, 4],
        ["Curso C", 0.7, 4],
        ["Curso D", 0.52, 3],
    ];
    return (
        <Moldura>
            <div className="bg-surface ring-card-ring flex w-full max-w-[340px] flex-col gap-2 rounded-xl p-3.5 shadow-[0_6px_20px_rgb(0_0_0/0.06)] ring-1">
                <p className="text-ink text-[11.5px] font-semibold">CPC dos cursos</p>
                {cursos.map(([nome, valor, faixa], i) => (
                    <div key={nome} className="flex items-center gap-2">
                        <span className="text-text-secondary w-12 shrink-0 text-[10px]">
                            {nome}
                        </span>
                        <span className="relative h-2.5 flex-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">
                            <span
                                className="guia-cresce-x absolute inset-y-0 left-0 rounded-full"
                                style={{
                                    width: `${valor * 100}%`,
                                    background: CHART.brand,
                                    ...atraso(i * 140),
                                }}
                            />
                            {/* média nacional da área */}
                            <span
                                className="absolute -inset-y-1 w-0.5 rounded"
                                style={{ left: "64%", background: CHART.comparacao.b }}
                            />
                        </span>
                        <span
                            className="guia-surge flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                            style={{
                                background: CHART.faixa.ramp[faixa - 1],
                                color: CHART.faixa.fg[faixa - 1],
                                ...atraso(500 + i * 140),
                            }}
                        >
                            {faixa}
                        </span>
                    </div>
                ))}
            </div>
        </Moldura>
    );
}

// --- 5. trajetória -----------------------------------------------------------

export function IlustracaoTrajetoria() {
    const CHART = useChartTheme();
    // cada coluna: um ano do curso; empilhado: cursando / concluiu / desistiu
    const anos: [number, number, number][] = [
        [86, 0, 14],
        [72, 0, 28],
        [64, 4, 32],
        [40, 26, 34],
        [14, 50, 36],
        [4, 58, 38],
    ];
    return (
        <Moldura>
            <div className="bg-surface ring-card-ring w-full max-w-[340px] rounded-xl p-3.5 shadow-[0_6px_20px_rgb(0_0_0/0.06)] ring-1">
                <p className="text-ink text-[11.5px] font-semibold">
                    O caminho de uma turma
                </p>
                <div className="mt-2.5 flex h-[86px] items-end gap-2">
                    {anos.map(([cursando, concluiu, desistiu], i) => (
                        <div
                            key={i}
                            className="guia-cresce-y flex h-full flex-1 flex-col-reverse overflow-hidden rounded-md"
                            style={atraso(i * 110)}
                        >
                            <span
                                style={{
                                    height: `${desistiu}%`,
                                    background: CHART.critical,
                                }}
                            />
                            <span
                                style={{
                                    height: `${concluiu}%`,
                                    background: CHART.brand,
                                }}
                            />
                            <span
                                style={{
                                    height: `${cursando}%`,
                                    background: CHART.deemphasis,
                                }}
                            />
                        </div>
                    ))}
                </div>
                <div className="text-text-muted mt-2 flex gap-3 text-[9.5px]">
                    {[
                        ["Cursando", CHART.deemphasis],
                        ["Concluiu", CHART.brand],
                        ["Desistiu", CHART.critical],
                    ].map(([t, cor]) => (
                        <span key={t} className="flex items-center gap-1">
                            <span
                                className="h-2 w-2 rounded-sm"
                                style={{ background: cor }}
                            />
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </Moldura>
    );
}

/** Duas imagens lado a lado na mesma moldura, cada uma com uma legenda
 * curta em cima (as duas buscas, os dois modos de comparação), alinhadas pelo
 * topo. */
function Painel({ legenda, children }: { legenda: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-text-secondary text-[9.5px] font-semibold tracking-wide uppercase sm:text-[10px]">
                {legenda}
            </span>
            <div className="flex flex-col">{children}</div>
        </div>
    );
}

// --- 6. busca ----------------------------------------------------------------

export function IlustracaoBusca() {
    const interna = useDigitacao("comp");
    const topo = useDigitacao("medicina");
    const cursos = [
        ["Ciência da Computação", "Bacharelado"],
        ["Engenharia de Computação", "Bacharelado"],
    ];
    return (
        <Moldura>
            <div className="grid w-full max-w-[460px] grid-cols-2 items-start gap-3 sm:gap-4">
                {/* dentro das abas: o seletor de curso, claro, com busca */}
                <Painel legenda="Dentro das abas">
                    <div className="bg-surface ring-lime/60 flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10.5px] ring-2">
                        <Search size={11} className="text-text-muted shrink-0" />
                        <span className="text-ink">{interna}</span>
                        <span className="guia-cursor bg-ink -ml-1 h-3 w-px" />
                        {!interna && (
                            <span className="text-text-muted -ml-0.5 truncate">
                                Buscar curso…
                            </span>
                        )}
                    </div>
                    <div className="bg-popover mt-1.5 min-h-[64px] rounded-lg p-1 shadow-[0_8px_22px_rgb(0_0_0/0.12)]">
                        {interna.length >= 2 &&
                            cursos.map(([nome, grau], i) => (
                                <div
                                    key={nome}
                                    className={cn(
                                        "rounded-md px-2 py-1",
                                        i === 0 && "bg-page"
                                    )}
                                >
                                    <p className="text-ink truncate text-[10px] leading-tight">
                                        {nome}
                                    </p>
                                    <p className="text-text-muted text-[8.5px]">
                                        {grau}
                                    </p>
                                </div>
                            ))}
                    </div>
                </Painel>

                {/* no topo: a busca de todas as unidades, na faixa escura */}
                <Painel legenda="No topo da página">
                    <div className="bg-band flex h-7 items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-[10.5px]">
                        <Search size={11} className="shrink-0 text-white/50" />
                        <span className="text-white">{topo}</span>
                        <span className="guia-cursor -ml-1 h-3 w-px bg-white" />
                        {!topo && (
                            <span className="-ml-0.5 truncate text-white/45">
                                Pesquisar curso…
                            </span>
                        )}
                    </div>
                    <div className="bg-popover mt-1.5 min-h-[64px] rounded-lg p-1 shadow-[0_8px_22px_rgb(0_0_0/0.12)]">
                        {topo.length >= 3 && (
                            <>
                                <div className="bg-page rounded-md px-2 py-1">
                                    <p className="text-ink text-[10px] leading-tight font-medium">
                                        Medicina
                                    </p>
                                    <p className="text-text-muted truncate text-[8.5px]">
                                        FACMED (Fortaleza)
                                    </p>
                                    {/* abrir em Qualidade ou em Trajetória */}
                                    <div className="mt-1 flex gap-1">
                                        {["Qualidade", "Trajetória"].map((t) => (
                                            <span
                                                key={t}
                                                className="bg-surface text-ink ring-card-ring rounded-full px-1.5 py-px text-[8px] font-medium ring-1"
                                            >
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="px-2 py-1">
                                    <p className="text-ink text-[10px] leading-tight font-medium">
                                        Medicina
                                    </p>
                                    <p className="text-text-muted truncate text-[8.5px]">
                                        CUFCSOBRAL (Sobral)
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </Painel>
            </div>
        </Moldura>
    );
}

// --- 7. comparações ----------------------------------------------------------

/** Seletor de um lado da comparação (A ou B), com o ponto da cor do lado. */
function LadoComparacao({ cor, texto }: { cor: string; texto: string }) {
    return (
        <span className="bg-surface ring-card-ring flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 ring-1">
            <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: cor }}
            />
            <span className="text-ink truncate text-[9px] font-semibold">{texto}</span>
        </span>
    );
}

export function IlustracaoComparacoes() {
    const CHART = useChartTheme();
    const { a, b } = CHART.comparacao;
    const outra = useDigitacao("UFRN");
    return (
        <Moldura>
            <div className="grid w-full max-w-[460px] grid-cols-2 items-start gap-3 sm:gap-4">
                {/* entre unidades: duas unidades, indicadores em barras espelhadas */}
                <Painel legenda="Entre unidades">
                    <div className="flex items-center gap-1">
                        <LadoComparacao cor={a} texto="CCA" />
                        <span className="text-text-muted text-[9px]">×</span>
                        <LadoComparacao cor={b} texto="CC" />
                    </div>
                    <div className="bg-surface ring-card-ring mt-1.5 rounded-lg p-2 ring-1">
                        {[
                            [0.8, 0.6],
                            [0.5, 0.9],
                            [0.7, 0.7],
                            [0.4, 0.65],
                        ].map(([va, vb], i) => (
                            <div
                                key={i}
                                className="mt-1 flex items-center gap-1 first:mt-0"
                            >
                                <span className="flex flex-1 justify-end">
                                    <span
                                        className="guia-surge h-2 rounded-l-full"
                                        style={{
                                            width: `${va * 100}%`,
                                            background: a,
                                            ...atraso(i * 120),
                                        }}
                                    />
                                </span>
                                <span className="flex flex-1">
                                    <span
                                        className="guia-surge h-2 rounded-r-full"
                                        style={{
                                            width: `${vb * 100}%`,
                                            background: b,
                                            ...atraso(i * 120 + 60),
                                        }}
                                    />
                                </span>
                            </div>
                        ))}
                    </div>
                </Painel>

                {/* entre cursos: o curso da unidade (A) contra qualquer curso da
                    mesma área no Brasil (B, buscado por instituição ou cidade) */}
                <Painel legenda="Cursos da mesma área">
                    <div className="flex items-center gap-1">
                        <LadoComparacao cor={a} texto="Agronomia · UFC" />
                        <span className="text-text-muted text-[9px]">×</span>
                        <span className="bg-surface ring-lime/60 flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 ring-2">
                            <Search size={9} className="text-text-muted shrink-0" />
                            <span className="text-ink truncate text-[9px] font-semibold">
                                {outra}
                            </span>
                            <span className="guia-cursor bg-ink -ml-0.5 h-2.5 w-px shrink-0" />
                        </span>
                    </div>
                    <div className="bg-surface ring-card-ring mt-1.5 flex h-[64px] items-end justify-center gap-4 rounded-lg px-2 pt-2 ring-1 sm:h-[76px]">
                        {[
                            ["CPC", 0.78, 0.62],
                            ["Enade", 0.66, 0.74],
                            ["IDD", 0.7, 0.5],
                        ].map(([rotulo, va, vb], i) => (
                            <div
                                key={rotulo as string}
                                className="flex h-full flex-col items-center"
                            >
                                <div className="flex flex-1 items-end gap-0.5">
                                    <span
                                        className="guia-cresce-y w-2.5 rounded-t-[3px]"
                                        style={{
                                            height: `${(va as number) * 100}%`,
                                            background: a,
                                            ...atraso(i * 140),
                                        }}
                                    />
                                    <span
                                        className="guia-cresce-y w-2.5 rounded-t-[3px]"
                                        style={{
                                            height: `${(vb as number) * 100}%`,
                                            background: b,
                                            ...atraso(i * 140 + 70),
                                        }}
                                    />
                                </div>
                                <span className="text-text-muted mt-0.5 mb-1 text-[8px]">
                                    {rotulo}
                                </span>
                            </div>
                        ))}
                    </div>
                </Painel>
            </div>
        </Moldura>
    );
}

// --- 8. dicas ----------------------------------------------------------------

export function IlustracaoDicas() {
    const CHART = useChartTheme();
    return (
        <Moldura>
            <div className="flex w-full max-w-[380px] items-center gap-3">
                <div className="bg-surface ring-card-ring relative min-w-0 flex-1 rounded-xl p-3 shadow-[0_6px_20px_rgb(0_0_0/0.06)] ring-1">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-ink text-[11.5px] font-semibold">
                                Ingressantes
                            </p>
                            <p className="text-text-muted text-[9.5px]">
                                por ano de ingresso
                            </p>
                        </div>
                        <span className="guia-pulso text-ink flex h-6 w-6 items-center justify-center rounded-full">
                            <Info size={14} />
                        </span>
                    </div>
                    <svg viewBox="0 0 200 50" className="mt-2 h-10 w-full">
                        <Linha
                            d="M4 42 C 40 38, 60 26, 92 28 S 150 10, 196 8"
                            cor={CHART.brand}
                        />
                    </svg>
                    {/* o painel do "i": o que o card mostra e a fonte */}
                    <div
                        className="guia-surge bg-popover absolute top-9 right-2 w-[132px] rounded-lg p-2 shadow-[0_10px_28px_rgb(0_0_0/0.16)]"
                        style={atraso(900)}
                    >
                        <p className="text-ink text-[9.5px] leading-snug font-semibold">
                            O que o card mostra
                        </p>
                        <p className="text-text-muted mt-1 text-[8.5px] uppercase">
                            Fonte: INEP
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 text-[10px]">
                    <span className="bg-surface text-text-secondary ring-card-ring flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1">
                        <Maximize2 size={11} /> clique: amplia
                    </span>
                    <span className="bg-surface text-text-secondary ring-card-ring flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1">
                        <kbd className="bg-page text-ink rounded px-1 font-sans text-[9.5px] font-semibold">
                            Ctrl K
                        </kbd>
                        apresentação
                    </span>
                    <span className="bg-surface text-text-secondary ring-card-ring flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1">
                        <Settings size={11} /> configurações
                    </span>
                </div>
            </div>
        </Moldura>
    );
}
