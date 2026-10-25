import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type ReactNode,
} from "react";

import brazilGeo from "@/assets/brazil-geo.json";
import { rampColor } from "@/components/charts/chart-theme";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import { formatInteger } from "@/lib/format";
import { UF_NOMES } from "@/lib/uf";

// Contornos das UFs (caminhos SVG) e centroides dos municípios, na mesma
// projeção — gerados por scripts/build-brazil-geo.mjs (malhas do IBGE).
const GEO = brazilGeo as unknown as {
    largura: number;
    altura: number;
    estados: {
        sigla: string;
        path: string;
        centro: [number, number];
        caixa: [number, number, number, number];
    }[];
    municipios: Record<string, [number, number]>;
};

type ViewBox = [number, number, number, number];
const BRASIL: ViewBox = [-10, -10, GEO.largura + 20, GEO.altura + 20];
const ANIMACAO_MS = 450;

/** O mínimo que o mapa precisa de um recorte (estado, município): quantos
 * cursos tem. O valor pintado sai de ``valorDe``. */
export interface ResumoMapa {
    cursos: number;
}

export interface MunicipioMapa<R extends ResumoMapa = ResumoMapa> {
    codigo: number;
    nome: string;
    resumo: R;
}

/** ViewBox que enquadra a caixa de um estado, com folga e o mesmo formato do
 * desenho (o zoom não distorce). */
function enquadrar([x0, y0, x1, y1]: [number, number, number, number]): ViewBox {
    const aspecto = BRASIL[2] / BRASIL[3];
    let w = (x1 - x0) * 1.25;
    let h = (y1 - y0) * 1.25;
    if (w / h > aspecto) h = w / aspecto;
    else w = h * aspecto;
    w = Math.max(w, 90);
    h = Math.max(h, 90 / aspecto);
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

/** ViewBox animado (interpolação linear com ease-in-out) até ``alvo``. */
function useViewBox(alvo: ViewBox): ViewBox {
    const [vb, setVb] = useState<ViewBox>(alvo);
    const atual = useRef(vb);
    useEffect(() => {
        const inicio = atual.current;
        const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let frame = 0;
        const t0 = performance.now();
        const passo = (agora: number) => {
            const t = reduzido ? 1 : Math.min((agora - t0) / ANIMACAO_MS, 1);
            const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
            const prox = inicio.map((v, i) => v + (alvo[i] - v) * e) as ViewBox;
            atual.current = prox;
            setVb(prox);
            if (t < 1) frame = requestAnimationFrame(passo);
        };
        frame = requestAnimationFrame(passo);
        return () => cancelAnimationFrame(frame);
    }, [alvo]);
    return vb;
}

/** Brasil por estado num mapa coroplético (cor = indicador escolhido; mais
 * escuro = maior). Clicar num estado dá zoom nele e mostra os municípios com
 * cursos como pontos (tamanho = nº de cursos, cor = mesmo indicador);
 * clicar fora dele volta ao Brasil. O pino marca o município do campus.
 * Serve a qualquer indicador: ``valorDe`` tira o valor de um recorte,
 * ``rotulo`` o nomeia ("CPC médio") e ``formatar`` o escreve. */
export function BrasilQualidadeMapa<R extends ResumoMapa>({
    porUf,
    valorDe,
    rotulo,
    formatar,
    selecionado,
    onSelect,
    municipios,
    pino,
    children,
}: {
    porUf: Map<string, R>;
    valorDe: (r: R) => number | null;
    rotulo: string;
    formatar: (v: number | null) => string;
    selecionado: string | null;
    onSelect: (uf: string | null) => void;
    municipios: MunicipioMapa<R>[];
    pino: { municipio: number; rotulo: string } | null;
    /** Controles sobre o mapa (ex.: "← Brasil", ampliar), já posicionados. */
    children?: ReactNode;
}) {
    const CHART = useChartTheme();
    // a área disponível (em lg, a altura que o card tem); o mapa ocupa o
    // maior retângulo com o formato do Brasil que cabe nela, centralizado
    const areaRef = useRef<HTMLDivElement>(null);
    const area = useElementSize(areaRef);
    const aspecto = BRASIL[2] / BRASIL[3];
    const largura =
        area.height > 0 ? Math.min(area.width, area.height * aspecto) : area.width;
    const altura = largura / aspecto;
    const boxRef = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<{
        titulo: string;
        linhas: string[];
        x: number;
        y: number;
    } | null>(null);

    const estadoSel = GEO.estados.find((e) => e.sigla === selecionado);
    const alvo = useMemo(
        () => (estadoSel ? enquadrar(estadoSel.caixa) : BRASIL),
        [estadoSel]
    );
    const vb = useViewBox(alvo);
    // px de tela por unidade do viewBox: marcas com tamanho fixo na tela
    const px = largura > 0 ? vb[2] / largura : 1;

    const { ramp, dominio } = useMemo(() => {
        // a mesma rampa azul em todos os indicadores
        const ramp = CHART.faixa.ramp;
        const vals = [...porUf.values()].flatMap((r) => {
            const v = valorDe(r);
            return v === null ? [] : [v];
        });
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        return { ramp, dominio: vals.length ? [lo, hi === lo ? lo + 1 : hi] : [0, 1] };
    }, [porUf, valorDe, CHART]);
    const cor = (v: number | null) =>
        v === null
            ? CHART.presenca.none
            : rampColor(ramp, (v - dominio[0]) / (dominio[1] - dominio[0]));

    const maxMunicipio = Math.max(1, ...municipios.map((m) => m.resumo.cursos));
    const centroPino = pino ? GEO.municipios[String(pino.municipio)] : undefined;
    const raioMunicipio = (cursos: number) =>
        (4 + 9 * Math.sqrt(cursos / maxMunicipio)) * px;
    const municipioPino =
        selecionado && pino
            ? municipios.find((m) => m.codigo === pino.municipio)
            : undefined;
    const raioPinoZoom = municipioPino
        ? raioMunicipio(municipioPino.resumo.cursos)
        : null;

    function mostrar(event: MouseEvent, titulo: string, resumo: R | undefined) {
        const box = boxRef.current?.getBoundingClientRect();
        if (!box) return;
        setHover({
            titulo,
            linhas: resumo
                ? [
                      `${formatInteger(resumo.cursos)} ${resumo.cursos === 1 ? "curso" : "cursos"}`,
                      `${rotulo} ${formatar(valorDe(resumo))}`,
                  ]
                : ["Sem cursos"],
            x: event.clientX - box.left,
            y: event.clientY - box.top,
        });
    }

    return (
        // em lg o bloco preenche o card: o mapa ocupa o espaço que sobra
        // acima da legenda, ajustado a ele; empilhado (celular), a altura vem
        // do formato do Brasil
        <div className="flex w-full flex-col lg:h-full">
            <div ref={areaRef} className="relative w-full lg:min-h-0 lg:flex-1">
                {/* empilhado: reserva a altura do mapa (formato do Brasil) */}
                <div aria-hidden className="aspect-[1020/1048] lg:hidden" />
                <div
                    ref={boxRef}
                    className="absolute top-0 left-1/2 -translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2"
                    style={{ width: largura, height: altura }}
                    onMouseLeave={() => setHover(null)}
                >
                    <svg
                        viewBox={vb.join(" ")}
                        className="absolute inset-0 h-full w-full"
                        role="group"
                        aria-label="Mapa do Brasil por estado"
                        // clicar no fundo tira a seleção do estado (não amplia o card)
                        data-sem-expandir
                        onClick={() => onSelect(null)}
                    >
                        {GEO.estados.map((e) => {
                            const resumo = porUf.get(e.sigla);
                            const valor = resumo ? valorDe(resumo) : null;
                            const ativo = e.sigla === selecionado;
                            const nome = UF_NOMES[e.sigla] ?? e.sigla;
                            return (
                                <path
                                    key={e.sigla}
                                    d={e.path}
                                    // no zoom o estado fica neutro: a cor passa
                                    // pros pontos dos municípios
                                    fill={ativo ? CHART.presenca.none : cor(valor)}
                                    stroke={ativo ? CHART.ink : CHART.surface}
                                    strokeWidth={ativo ? 2 : 1}
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinejoin="round"
                                    opacity={selecionado && !ativo ? 0.3 : 1}
                                    className="cursor-pointer outline-none focus-visible:opacity-80"
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={ativo}
                                    aria-label={`${nome}: ${resumo ? `${resumo.cursos} cursos, ${rotulo} ${formatar(valor)}` : "sem cursos"}`}
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        onSelect(ativo ? null : e.sigla);
                                    }}
                                    onKeyDown={(ev) => {
                                        if (ev.key === "Enter" || ev.key === " ") {
                                            ev.preventDefault();
                                            onSelect(ativo ? null : e.sigla);
                                        }
                                    }}
                                    onMouseMove={(ev) => mostrar(ev, nome, resumo)}
                                />
                            );
                        })}

                        {selecionado &&
                            municipios.map((m) => {
                                const c = GEO.municipios[String(m.codigo)];
                                if (!c) return null;
                                const valor = valorDe(m.resumo);
                                const r =
                                    (4 +
                                        9 * Math.sqrt(m.resumo.cursos / maxMunicipio)) *
                                    px;
                                return (
                                    <circle
                                        key={m.codigo}
                                        cx={c[0]}
                                        cy={c[1]}
                                        r={r}
                                        fill={cor(valor)}
                                        stroke={CHART.ink}
                                        strokeWidth={1}
                                        vectorEffect="non-scaling-stroke"
                                        onClick={(ev) => ev.stopPropagation()}
                                        onMouseMove={(ev) => {
                                            ev.stopPropagation();
                                            mostrar(ev, m.nome, m.resumo);
                                        }}
                                    />
                                );
                            })}

                        {centroPino &&
                            (raioPinoZoom !== null ? (
                                // no zoom: anel limão em volta do ponto do município
                                <circle
                                    pointerEvents="none"
                                    cx={centroPino[0]}
                                    cy={centroPino[1]}
                                    r={raioPinoZoom + 4 * px}
                                    fill="none"
                                    stroke={CHART.lime}
                                    strokeWidth={3}
                                    vectorEffect="non-scaling-stroke"
                                />
                            ) : (
                                <g pointerEvents="none">
                                    <circle
                                        cx={centroPino[0]}
                                        cy={centroPino[1]}
                                        r={7 * px}
                                        fill={CHART.lime}
                                        stroke={CHART.onLime}
                                        strokeWidth={2}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    <circle
                                        cx={centroPino[0]}
                                        cy={centroPino[1]}
                                        r={2.2 * px}
                                        fill={CHART.onLime}
                                    />
                                </g>
                            ))}
                    </svg>

                    {hover && (
                        <div
                            className="bg-pill text-pill-fg pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-[12px] leading-snug whitespace-nowrap shadow-lg"
                            style={{
                                left: hover.x,
                                top: hover.y,
                                transform: `translate(${hover.x > largura / 2 ? "calc(-100% - 12px)" : "12px"}, -50%)`,
                            }}
                        >
                            <p className="font-semibold">{hover.titulo}</p>
                            {hover.linhas.map((l) => (
                                <p key={l} className="opacity-80">
                                    {l}
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                {children}
            </div>

            {/* legenda numa linha própria, embaixo: sobre o mapa ela cobria a
                ponta do Rio Grande do Sul */}
            <div className="text-text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                <span className="flex items-center gap-2 whitespace-nowrap">
                    <span>{formatar(dominio[0])}</span>
                    <span
                        aria-hidden
                        className="block h-2.5 w-24 rounded-full sm:w-32"
                        style={{
                            background: `linear-gradient(to right, ${ramp.join(", ")})`,
                        }}
                    />
                    <span>{formatar(dominio[1])}</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: CHART.presenca.none }}
                    />
                    sem cursos
                </span>
                {pino && (
                    <span className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="bg-lime h-2.5 w-2.5 rounded-full ring-2 ring-[var(--on-lime)]"
                        />
                        {pino.rotulo}
                    </span>
                )}
                {selecionado && (
                    <span>pontos: municípios (tamanho = nº de cursos)</span>
                )}
            </div>
        </div>
    );
}
