import {
    useId,
    useMemo,
    useRef,
    useState,
    type PointerEvent,
    type ReactNode,
} from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { yearTickFilter } from "@/components/charts/chart-theme";
import { DataTable } from "@/components/charts/DataTable";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import { formatInteger, toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Curso, DashboardData } from "@/types/dashboard";

/** ``escolha`` da série do campus inteiro. */
export const SERIE_CAMPUS = "campus";
const CAMPUS = SERIE_CAMPUS;

interface Point {
    ano: number;
    valor: number;
    /** Média nacional no mesmo ano (``null`` sem pares naquele ano). */
    nacional: number | null;
}

/** Um valor por ano: do campus inteiro ou de um curso. */
export interface ValorAno {
    ano: number;
    valor: number;
}

export interface ValorCursoAno extends ValorAno {
    codigo: number;
}

/** Série escolhida: o total do campus (``campus``) ou um curso
 * (``porCurso``), cada ano com a média nacional (``nacional``, por curso e
 * ano). No curso, é a média dos cursos-pares; no campus, a soma dessas médias
 * pelos cursos que tiveram dado no ano — o total que o campus teria se cada
 * curso ficasse na média do Brasil. */
function buildSeries(
    escolha: string,
    campus: ValorAno[],
    porCurso: ValorCursoAno[],
    nacional: ValorCursoAno[]
): Point[] {
    const media = new Map(nacional.map((p) => [`${p.codigo}-${p.ano}`, p.valor]));
    if (escolha !== CAMPUS) {
        return porCurso
            .filter((p) => String(p.codigo) === escolha)
            .map((p) => ({
                ano: p.ano,
                valor: p.valor,
                nacional: media.get(`${p.codigo}-${p.ano}`) ?? null,
            }))
            .sort((a, b) => a.ano - b.ano);
    }
    const esperado = new Map<number, number>();
    for (const p of porCurso) {
        const m = media.get(`${p.codigo}-${p.ano}`);
        if (m !== undefined) esperado.set(p.ano, (esperado.get(p.ano) ?? 0) + m);
    }
    return campus
        .map((p) => ({
            ano: p.ano,
            valor: p.valor,
            nacional: esperado.get(p.ano) ?? null,
        }))
        .sort((a, b) => a.ano - b.ano);
}

/** Eixo Y com passos "redondos" (1/2/2,5/5 x 10^n) e 5 marcas a partir do
 * zero ou de um piso abaixo do mínimo. */
function buildTicks(values: number[]): number[] {
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const raw = Math.max(max - min, 1) / 3;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
    const lo = Math.max(0, Math.floor(min / step) * step - step);
    const count = Math.ceil((max - lo) / step) + 1;
    return Array.from({ length: count }, (_, i) => lo + i * step);
}

type Pt = [number, number];
/** Um trecho cúbico: início, dois controles e fim. */
type Cubica = [Pt, Pt, Pt, Pt];

/** Trechos da curva suave que não passa do valor dos pontos (cúbica
 * monotônica em x, Fritsch–Carlson — a mesma ideia do ``monotoneX`` do d3). */
function cubicas(pts: Pt[]): Cubica[] {
    const n = pts.length;
    if (n < 2) return [];
    const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
    const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
    const t = pts.map((_, i) => {
        if (i === 0) return m[0];
        if (i === n - 1) return m[n - 2];
        return m[i - 1] * m[i] <= 0
            ? 0
            : (3 * (dx[i - 1] + dx[i])) /
                  ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
    });
    return dx.map((d, i) => {
        const h = d / 3;
        const [a, b] = [pts[i], pts[i + 1]];
        return [a, [a[0] + h, a[1] + h * t[i]], [b[0] - h, b[1] - h * t[i + 1]], b];
    });
}

function curva(pts: Pt[]): string {
    if (pts.length === 0) return "";
    return (
        `M${pts[0][0]},${pts[0][1]}` +
        cubicas(pts)
            .map(
                ([, c1, c2, b]) =>
                    `C${c1[0]},${c1[1]},${c2[0]},${c2[1]},${b[0]},${b[1]}`
            )
            .join("")
    );
}

/** Pontos ao longo da curva (a cada poucos px), pra testar se uma pílula
 * encosta nela. */
function amostrar(pts: Pt[], passos = 24): Pt[] {
    if (pts.length === 1) return [pts[0]];
    return cubicas(pts).flatMap(([a, c1, c2, b]) =>
        Array.from({ length: passos + 1 }, (_, k): Pt => {
            const u = k / passos;
            const v = 1 - u;
            const f = (i: 0 | 1) =>
                v ** 3 * a[i] +
                3 * v * v * u * c1[i] +
                3 * v * u * u * c2[i] +
                u ** 3 * b[i];
            return [f(0), f(1)];
        })
    );
}

interface Caixa {
    x: number; // centro
    y: number; // topo
    w: number;
}

const PILULA_H = 24;

/** Onde pôr a pílula de valor de um ponto: tenta, em ordem, logo acima/abaixo
 * (o lado preferido primeiro), um pouco mais longe, e dos lados — sempre
 * dentro do gráfico (desliza pra dentro nas bordas). Fica com a primeira
 * posição que não encosta em nenhuma linha, ponto ou pílula já posta; se
 * nenhuma escapar, a que encosta menos. */
function posicionarPilula(
    cx: number,
    cy: number,
    w: number,
    emCima: boolean,
    area: { x0: number; x1: number; y0: number; y1: number },
    obstaculos: Pt[],
    ocupadas: Caixa[]
): Caixa {
    const H = PILULA_H;
    const prende = (c: number) =>
        Math.min(Math.max(c, area.x0 + w / 2), area.x1 - w / 2);
    const acima = (d: number) => cy - 10 - H - d;
    const abaixo = (d: number) => cy + 10 + d;
    const verticais = [0, 14, 30].flatMap((d) =>
        emCima ? [acima(d), abaixo(d)] : [abaixo(d), acima(d)]
    );
    const candidatos: Caixa[] = [
        ...verticais.map((y) => ({ x: prende(cx), y, w })),
        // dos lados do ponto, na mesma altura e um pouco acima/abaixo
        ...[cy - H / 2, cy - H, cy].flatMap((y) => [
            { x: prende(cx - 14 - w / 2), y, w },
            { x: prende(cx + 14 + w / 2), y, w },
        ]),
    ].filter((c) => c.y >= area.y0 && c.y + H <= area.y1);

    const folga = 3;
    const colisoes = (c: Caixa) => {
        const [l, r] = [c.x - w / 2 - folga, c.x + w / 2 + folga];
        const [t, b] = [c.y - folga, c.y + H + folga];
        let n = 0;
        for (const [px, py] of obstaculos)
            if (px >= l && px <= r && py >= t && py <= b) n++;
        for (const o of ocupadas)
            if (
                Math.abs(o.x - c.x) < (o.w + w) / 2 + folga &&
                Math.abs(o.y - c.y) < H + folga
            )
                n += 100;
        return n;
    };
    let melhor: Caixa | null = null;
    let menor = Infinity;
    for (const c of candidatos) {
        const n = colisoes(c);
        if (n === 0) return c;
        if (n < menor) [melhor, menor] = [c, n];
    }
    return melhor ?? { x: prende(cx), y: emCima ? acima(0) : abaixo(0), w };
}

/** Trechos contínuos (sem ano faltando) de uma série. */
function trechos(pts: (Pt | null)[]): Pt[][] {
    const out: Pt[][] = [[]];
    for (const p of pts) {
        if (p) out.at(-1)!.push(p);
        else if (out.at(-1)!.length) out.push([]);
    }
    return out.filter((t) => t.length > 0);
}

const PAD = { top: 14, right: 12, bottom: 32, left: 44 };

/** Uma contagem por ano (ingressantes, concluintes…), em duas linhas suaves:
 * o campus (ou o curso escolhido no seletor), em oliva com uma área
 * esmaecida embaixo, e a média nacional dos mesmos cursos, em violeta. No
 * ano em foco, cada linha ganha uma pílula com o valor: a do campus/curso (limão) embaixo do ponto, a da média nacional
 * (violeta) em cima — trocadas no ano em que o campus passa da média, pra
 * uma não cobrir o ponto da outra. Passar o mouse (ou o dedo) muda
 * o foco; ao sair, volta pro último ano. */
export function SerieAnualCard({
    titulo,
    info,
    subtituloCampus,
    rotuloAno,
    vazio,
    nota,
    campus,
    porCurso,
    nacional,
    cursos,
    escolha,
    className,
}: {
    titulo: string;
    info: string;
    /** Subtítulo da série do campus (o do curso diz o nome dele). */
    subtituloCampus: string;
    /** Cabeçalho da coluna de anos na tabela pra leitores de tela. */
    rotuloAno: string;
    /** Sem dado na série escolhida. */
    vazio: string;
    /** Nota de rodapé (ex.: de onde vêm os anos). */
    nota?: ReactNode;
    campus: ValorAno[];
    porCurso: ValorCursoAno[];
    nacional: ValorCursoAno[];
    cursos: Curso[];
    /** A série: ``"campus"`` (o total) ou o código de um curso — a do seletor
     * de curso do Início (no cabeçalho). */
    escolha: string;
    className?: string;
}) {
    const CHART = useChartTheme();
    const gradId = useId();
    const [hover, setHover] = useState<number | null>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const { width: W, height: H } = useElementSize(boxRef);

    const serie = useMemo(
        () => buildSeries(escolha, campus, porCurso, nacional),
        [escolha, campus, porCurso, nacional]
    );
    const sel = hover !== null && hover < serie.length ? hover : serie.length - 1;
    const foco = serie.at(sel);
    const showTick = yearTickFilter(serie.length, sel, W);
    const ticks =
        serie.length > 0
            ? buildTicks(serie.flatMap((p) => [p.valor, p.nacional ?? p.valor]))
            : [0, 1];
    const curso = cursos.find((c) => String(c.codigo_curso) === escolha);
    const nomeSerie = escolha === CAMPUS ? "Todos os cursos" : "Curso";
    const subtitulo =
        escolha === CAMPUS
            ? subtituloCampus
            : `${toTitleCase(curso?.nome_curso ?? "")} × média dos mesmos cursos no Brasil`;

    // escalas
    const plotW = Math.max(W - PAD.left - PAD.right, 1);
    const plotH = Math.max(H - PAD.top - PAD.bottom, 1);
    // o primeiro e o último ano encostam nas laterais do gráfico; as pílulas
    // de valor é que se ajustam pra dentro perto das bordas (``Ponto``)
    const x = (i: number) =>
        PAD.left + (serie.length > 1 ? (i * plotW) / (serie.length - 1) : plotW / 2);
    const [y0, y1] = [ticks[0], ticks.at(-1)!];
    const y = (v: number) => PAD.top + plotH - ((v - y0) / (y1 - y0 || 1)) * plotH;
    const base = PAD.top + plotH;

    const linhaSerie = serie.map((p, i): Pt => [x(i), y(p.valor)]);
    const linhaNacional = trechos(
        serie.map((p, i) => (p.nacional === null ? null : [x(i), y(p.nacional)]))
    );
    const area =
        linhaSerie.length > 1
            ? `${curva(linhaSerie)}L${linhaSerie.at(-1)![0]},${base}L${linhaSerie[0][0]},${base}Z`
            : "";

    function onPointer(e: PointerEvent<SVGRectElement>) {
        if (serie.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left + PAD.left;
        const passo = serie.length > 1 ? plotW / (serie.length - 1) : 1;
        const i = Math.round((px - PAD.left) / passo);
        setHover(Math.min(Math.max(i, 0), serie.length - 1));
    }

    const fx = foco ? x(sel) : 0;
    const fy = foco ? y(foco.valor) : 0;
    const fyN = foco?.nacional != null ? y(foco.nacional) : null;
    // campus/curso embaixo da linha e média nacional em cima (invertem se o
    // campus está acima da média); as pílulas fogem das linhas e dos pontos
    const campusEmCima = fyN !== null && fy < fyN;
    const textoSerie = foco ? formatInteger(foco.valor) : "";
    const textoNacional = foco?.nacional != null ? formatInteger(foco.nacional) : "";
    const largura = (texto: string) => texto.length * 7 + 18;
    const limitesPilula = { x0: PAD.left, x1: PAD.left + plotW, y0: 0, y1: base };
    const obstaculos: Pt[] = foco
        ? [
              ...amostrar(linhaSerie),
              ...linhaNacional.flatMap((t) => amostrar(t)),
              // os dois pontos em foco (anel de ~7px)
              ...[fy, fyN].flatMap((py) =>
                  py === null
                      ? []
                      : [-7, 0, 7].flatMap((dx) =>
                            [-7, 0, 7].map((dy): Pt => [fx + dx, py + dy])
                        )
              ),
          ]
        : [];
    const pilulaNacional =
        foco && fyN !== null
            ? posicionarPilula(
                  fx,
                  fyN,
                  largura(textoNacional),
                  !campusEmCima,
                  limitesPilula,
                  obstaculos,
                  []
              )
            : null;
    const pilulaSerie = foco
        ? posicionarPilula(
              fx,
              fy,
              largura(textoSerie),
              campusEmCima,
              limitesPilula,
              obstaculos,
              pilulaNacional ? [pilulaNacional] : []
          )
        : null;

    return (
        <Card
            expansivel="tela"
            title={titulo}
            info={info}
            subtitle={subtitulo}
            className={className}
        >
            {/* só gráfico na tela; os valores seguem legíveis por leitor de tela */}
            <div className="sr-only">
                <DataTable
                    columns={[rotuloAno, nomeSerie, "Média nacional"]}
                    rows={serie.map((p) => [
                        String(p.ano),
                        formatInteger(p.valor),
                        p.nacional === null ? "—" : formatInteger(p.nacional),
                    ])}
                />
            </div>
            {serie.length === 0 ? (
                <p className="text-text-secondary mt-6 text-[13px]">{vazio}</p>
            ) : (
                <>
                    <div ref={boxRef} className="relative mt-4 min-h-[240px] flex-1">
                        {W > 0 && H > 0 && (
                            <svg
                                width={W}
                                height={H}
                                className="absolute inset-0 touch-pan-y select-none"
                                aria-hidden
                            >
                                <defs>
                                    <linearGradient
                                        id={gradId}
                                        x1="0"
                                        x2="0"
                                        y1="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor={CHART.comparacao.a}
                                            stopOpacity={0.28}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor={CHART.comparacao.a}
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>

                                {/* grade horizontal e eixo Y */}
                                {ticks.map((t) => (
                                    <g key={t}>
                                        <line
                                            x1={PAD.left}
                                            x2={W - PAD.right}
                                            y1={y(t)}
                                            y2={y(t)}
                                            stroke={CHART.deemphasis}
                                            strokeOpacity={0.7}
                                        />
                                        <text
                                            x={PAD.left - 10}
                                            y={y(t) + 4}
                                            textAnchor="end"
                                            fontSize={CHART.tickFont}
                                            fill={CHART.textMuted}
                                        >
                                            {formatInteger(t)}
                                        </text>
                                    </g>
                                ))}

                                {/* campus/curso: área esmaecida + linha */}
                                <path d={area} fill={`url(#${gradId})`} />
                                <path
                                    d={curva(linhaSerie)}
                                    fill="none"
                                    stroke={CHART.comparacao.a}
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                />
                                {/* média nacional */}
                                {linhaNacional.map((t, i) => (
                                    <path
                                        key={i}
                                        d={curva(t)}
                                        fill="none"
                                        stroke={CHART.comparacao.b}
                                        strokeWidth={2.5}
                                        strokeLinecap="round"
                                    />
                                ))}

                                {/* pontos em foco, cada um com a pílula do valor */}
                                {fyN !== null && pilulaNacional && (
                                    <Ponto
                                        cx={fx}
                                        cy={fyN}
                                        cor={CHART.comparacao.b}
                                        fundo={CHART.surface}
                                        texto={textoNacional}
                                        textoCor="#ffffff"
                                        caixa={pilulaNacional}
                                    />
                                )}
                                {pilulaSerie && (
                                    <Ponto
                                        cx={fx}
                                        cy={fy}
                                        cor={CHART.comparacao.a}
                                        fundo={CHART.surface}
                                        pilula={CHART.lime}
                                        texto={textoSerie}
                                        textoCor={CHART.onLime}
                                        caixa={pilulaSerie}
                                    />
                                )}

                                {/* eixo X */}
                                {serie.map(
                                    (p, i) =>
                                        showTick(i) && (
                                            <text
                                                key={p.ano}
                                                x={x(i)}
                                                y={H - 10}
                                                // nas pontas, o ano alinha pra dentro
                                                textAnchor={
                                                    serie.length > 1 && i === 0
                                                        ? "start"
                                                        : serie.length > 1 &&
                                                            i === serie.length - 1
                                                          ? "end"
                                                          : "middle"
                                                }
                                                fontSize={11.5}
                                                fontWeight={i === sel ? 700 : 400}
                                                fill={
                                                    i === sel
                                                        ? CHART.ink
                                                        : CHART.textMuted
                                                }
                                            >
                                                {p.ano}
                                            </text>
                                        )
                                )}

                                {/* captura do mouse/dedo sobre a área do gráfico */}
                                <rect
                                    x={PAD.left}
                                    y={0}
                                    width={plotW}
                                    height={H}
                                    fill="transparent"
                                    onPointerMove={onPointer}
                                    onPointerDown={onPointer}
                                    onPointerLeave={() => setHover(null)}
                                />
                            </svg>
                        )}
                    </div>
                    <div className="text-text-secondary mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                        <Legenda cor={CHART.comparacao.a} label={nomeSerie} />
                        <Legenda cor={CHART.comparacao.b} label="Média nacional" />
                    </div>
                </>
            )}
            {nota && <NotaRodape>{nota}</NotaRodape>}
        </Card>
    );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
    return (
        <span className="flex items-center gap-2">
            <span
                aria-hidden
                className="h-[3px] w-4 rounded-full"
                style={{ background: cor }}
            />
            {label}
        </span>
    );
}

/** Ponto em foco de uma linha, com a pílula do valor na posição escolhida
 * por ``posicionarPilula``. */
function Ponto({
    cx,
    cy,
    cor,
    fundo,
    pilula = cor,
    texto,
    textoCor,
    caixa,
}: {
    cx: number;
    cy: number;
    cor: string;
    fundo: string;
    pilula?: string;
    texto: string;
    textoCor: string;
    caixa: Caixa;
}) {
    return (
        <g>
            <circle cx={cx} cy={cy} r={5} fill={fundo} stroke={cor} strokeWidth={2.5} />
            <rect
                x={caixa.x - caixa.w / 2}
                y={caixa.y}
                width={caixa.w}
                height={PILULA_H}
                rx={8}
                fill={pilula}
            />
            <text
                x={caixa.x}
                y={caixa.y + 16}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={textoCor}
            >
                {texto}
            </text>
        </g>
    );
}

/** Ingressantes por ano de ingresso: o campus ou um curso, contra a média
 * nacional dos mesmos cursos. */
export function IngressantesCard({
    data,
    escolha,
    className,
}: {
    data: DashboardData;
    escolha: string;
    className?: string;
}) {
    const valores = useMemo(
        () => ({
            campus: data.campus.tendencia_ingressantes.map((p) => ({
                ano: p.ano_ingresso,
                valor: p.qt_ingressante,
            })),
            porCurso: data.trajetoria_comparada.demanda_ingressantes.map((p) => ({
                codigo: p.codigo_curso,
                ano: p.ano_ingresso,
                valor: p.qt_ingressante,
            })),
            nacional: data.medias_nacionais.ingressantes.map((p) => ({
                codigo: p.codigo_curso,
                ano: p.ano_ingresso,
                valor: p.qt_ingressante_media_nacional,
            })),
        }),
        [data]
    );
    return (
        <SerieAnualCard
            className={className}
            titulo="Ingressantes"
            info="Quantos alunos entraram em cada ano: o total de todos os cursos da cidade, ou do curso escolhido no seletor, contra a média nacional dos mesmos cursos no mesmo ano de ingresso."
            subtituloCampus="Todos os cursos × média nacional, por ano de ingresso"
            rotuloAno="Ano de ingresso"
            vazio="Sem dado de ingressantes para esta série."
            cursos={data.cursos}
            escolha={escolha}
            {...valores}
        />
    );
}

/** Concluintes por ano: o campus ou um curso, contra a média nacional dos
 * mesmos cursos — só nos anos em que o INEP acompanha todas as turmas que se
 * formam (o backend corta as pontas). */
export function ConcluintesCard({
    data,
    escolha,
    className,
}: {
    data: DashboardData;
    escolha: string;
    className?: string;
}) {
    const valores = useMemo(
        () => ({
            campus: (data.campus.tendencia_concluintes ?? []).map((p) => ({
                ano: p.ano_referencia,
                valor: p.qt_concluinte,
            })),
            porCurso: (data.trajetoria_comparada.demanda_concluintes ?? []).map(
                (p) => ({
                    codigo: p.codigo_curso,
                    ano: p.ano_referencia,
                    valor: p.qt_concluinte,
                })
            ),
            nacional: (data.medias_nacionais.concluintes ?? []).map((p) => ({
                codigo: p.codigo_curso,
                ano: p.ano_referencia,
                valor: p.qt_concluinte_media_nacional,
            })),
        }),
        [data]
    );
    return (
        <SerieAnualCard
            className={className}
            titulo="Concluintes"
            info="Quantos alunos se formaram em cada ano: o total de todos os cursos da cidade, ou do curso escolhido no seletor, contra a média nacional dos mesmos cursos no mesmo ano. Só aparecem os anos em que os dados do INEP cobrem todas as turmas que se formam (o INEP acompanha as turmas que entraram de 2010 a 2020)."
            subtituloCampus="Todos os cursos × média nacional, por ano de conclusão"
            rotuloAno="Ano de conclusão"
            vazio="Sem dado de concluintes para esta série."
            cursos={data.cursos}
            escolha={escolha}
            {...valores}
        />
    );
}

// os pontos ficam um pouco pra dentro (o anel do foco não é cortado pela
// borda do card); a linha e a área seguem retas até as bordas
const PAD_MINI = { top: 10, right: 10, bottom: 26, left: 10 };

/** A versão reduzida do gráfico de Ingressantes/Concluintes, pros tiles de
 * taxa (Início → Trajetória): a mesma curva suave com a área esmaecida, o
 * ponto em foco com a pílula do valor e os anos embaixo — sem eixo Y, grade,
 * legenda nem a média nacional. De borda a borda do bloco (quem usa decide o
 * tamanho); passar o mouse muda o foco, ao sair volta pro último ano. */
export function MiniSerieAnual({
    serie,
    cor,
    pilula,
    textoPilula,
    formatar,
    className,
}: {
    serie: ValorAno[];
    cor: string;
    /** Fundo e texto da pílula do valor em foco. */
    pilula: string;
    textoPilula: string;
    formatar: (v: number) => string;
    className?: string;
}) {
    const CHART = useChartTheme();
    const gradId = useId();
    const [hover, setHover] = useState<number | null>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const { width: W, height: H } = useElementSize(boxRef);

    const sel = hover !== null && hover < serie.length ? hover : serie.length - 1;
    const foco = serie.at(sel);
    const showTick = yearTickFilter(serie.length, sel, W);
    const valores = serie.map((p) => p.valor);
    const lo = Math.min(...valores);
    const hi = Math.max(...valores);
    // folga em cima pra pílula do valor e embaixo pra área não sumir
    const folga = (hi - lo || Math.abs(hi) || 1) * 0.35;
    const [y0, y1] = [lo - folga, hi + folga];

    const plotW = Math.max(W - PAD_MINI.left - PAD_MINI.right, 1);
    const plotH = Math.max(H - PAD_MINI.top - PAD_MINI.bottom, 1);
    const x = (i: number) =>
        PAD_MINI.left +
        (serie.length > 1 ? (i * plotW) / (serie.length - 1) : plotW / 2);
    const y = (v: number) => PAD_MINI.top + plotH - ((v - y0) / (y1 - y0 || 1)) * plotH;
    const base = PAD_MINI.top + plotH;
    const linha = serie.map((p, i): Pt => [x(i), y(p.valor)]);
    // "M x,y C…" -> "L x,y C…": a curva continua o trecho reto da borda
    const meio = linha.length > 1 ? `L${curva(linha).slice(1)}` : "";
    const [primeiro, ultimo] = [linha[0], linha.at(-1)];
    const tracado =
        primeiro && ultimo ? `M0,${primeiro[1]}${meio}L${W},${ultimo[1]}` : "";
    const area =
        primeiro && ultimo
            ? `M0,${base}L0,${primeiro[1]}${meio}L${W},${ultimo[1]}L${W},${base}Z`
            : "";

    function onPointer(e: PointerEvent<SVGRectElement>) {
        if (serie.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const passo = serie.length > 1 ? plotW / (serie.length - 1) : 1;
        const i = Math.round((e.clientX - rect.left) / passo);
        setHover(Math.min(Math.max(i, 0), serie.length - 1));
    }

    const fx = foco ? x(sel) : 0;
    const fy = foco ? y(foco.valor) : 0;
    const texto = foco ? formatar(foco.valor) : "";
    const caixa = foco
        ? posicionarPilula(
              fx,
              fy,
              texto.length * 7 + 18,
              true,
              // a pílula não encosta nas bordas do card
              { x0: 8, x1: W - 8, y0: 0, y1: base },
              [
                  ...amostrar(linha),
                  ...[-7, 0, 7].flatMap((dx) =>
                      [-7, 0, 7].map((dy): Pt => [fx + dx, fy + dy])
                  ),
              ],
              []
          )
        : null;

    return (
        <div ref={boxRef} className={cn("relative", className)}>
            {W > 0 && H > 0 && serie.length > 1 && (
                <svg
                    width={W}
                    height={H}
                    className="absolute inset-0 touch-pan-y select-none"
                    aria-hidden
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={cor} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={cor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <path d={area} fill={`url(#${gradId})`} />
                    <path
                        d={tracado}
                        fill="none"
                        stroke={cor}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                    />
                    {caixa && (
                        <Ponto
                            cx={fx}
                            cy={fy}
                            cor={cor}
                            fundo={CHART.surface}
                            pilula={pilula}
                            texto={texto}
                            textoCor={textoPilula}
                            caixa={caixa}
                        />
                    )}
                    {/* anos: nas pontas, alinhados pra dentro (com um respiro
                        da borda do card) */}
                    {serie.map(
                        (p, i) =>
                            showTick(i) && (
                                <text
                                    key={p.ano}
                                    x={
                                        i === 0
                                            ? x(i) + 12
                                            : i === serie.length - 1
                                              ? x(i) - 12
                                              : x(i)
                                    }
                                    y={H - 8}
                                    textAnchor={
                                        i === 0
                                            ? "start"
                                            : i === serie.length - 1
                                              ? "end"
                                              : "middle"
                                    }
                                    fontSize={11}
                                    fontWeight={i === sel ? 700 : 400}
                                    fill={i === sel ? CHART.ink : CHART.textMuted}
                                >
                                    {p.ano}
                                </text>
                            )
                    )}
                    <rect
                        x={0}
                        y={0}
                        width={W}
                        height={H}
                        fill="transparent"
                        onPointerMove={onPointer}
                        onPointerDown={onPointer}
                        onPointerLeave={() => setHover(null)}
                    />
                </svg>
            )}
        </div>
    );
}
