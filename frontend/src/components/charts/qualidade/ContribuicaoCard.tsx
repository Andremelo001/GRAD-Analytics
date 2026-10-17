import { useRef, useState } from "react";

import { Card } from "@/components/cards/Card";
import { DataTable } from "@/components/charts/DataTable";
import { TextoAjustado } from "@/components/charts/TextoAjustado";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useElementSize } from "@/hooks/useElementSize";
import {
    COMPONENTES,
    contribuicao,
    notaDe,
    potencial,
    type Componente,
} from "@/lib/cpc";
import { formatDecimal } from "@/lib/format";
import type { AvaliacaoCurso } from "@/lib/qualidade";

/** Nome do eixo no radar: mais curto que o ``nome`` (cabe nas pontas) e
 * mais claro que o ``curto`` da tabela. */
const NOME_EIXO: Record<string, string> = {
    formacao_geral: "Formação geral",
    componente_especifico: "Comp. específico",
    idd: "IDD",
    doutores: "Doutores",
    mestres: "Mestres",
    regime_trabalho: "Regime de trabalho",
    organizacao_didatico_pedagogica: "Did.-pedagógica",
    infraestrutura: "Infraestrutura",
    oportunidade_ampliacao: "Oportunidades",
};

/** Espaço (px) que os rótulos ocupam além do anel externo. */
const ROTULO_X = 96;
const ROTULO_Y = 48;

interface Linha {
    componente: Componente;
    nota: number;
    ganho: number;
    maximo: number;
}

/** De onde vem o CPC: cada componente traz nota × peso pontos, de no máximo
 * 5 × peso. Em radar: um eixo por componente (na ordem dos blocos —
 * desempenho, docentes, percepção), o anel externo é o máximo de cada um e o
 * polígono vai até a fração conquistada (nota / 5). Cada ponta mostra os
 * pontos e o máximo, que já carrega o peso. A soma das contribuições é o
 * CPC; passar o mouse num eixo detalha o componente no topo. */
export function ContribuicaoCard({
    curso,
    className,
}: {
    curso: AvaliacaoCurso;
    className?: string;
}) {
    const CHART = useChartTheme();
    const [hover, setHover] = useState<string | null>(null);
    const destaque = hover;
    const boxRef = useRef<HTMLDivElement>(null);
    const { width: W, height: H } = useElementSize(boxRef);

    const linhas: Linha[] = COMPONENTES.flatMap((c) => {
        const nota = notaDe(curso.perfil, c.key);
        return nota === null
            ? []
            : [
                  {
                      componente: c,
                      nota,
                      ganho: contribuicao(nota, c),
                      maximo: potencial(c),
                  },
              ];
    });
    const semNota = COMPONENTES.length - linhas.length;
    const soma = linhas.reduce((t, l) => t + l.ganho, 0);
    const ativa = linhas.find((l) => l.componente.key === destaque);

    return (
        <Card
            expansivel="tela"
            title="De onde vem a nota"
            subtitle="Pontos de CPC que cada componente trouxe (nota × peso), do máximo possível"
            className={className}
        >
            <div className="mt-3 flex min-h-[26px] items-center gap-3">
                <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                    {formatDecimal(ativa ? ativa.ganho : soma)}
                </p>
                <TextoAjustado className="text-text-secondary min-w-0 flex-1">
                    {ativa ? (
                        <>
                            <span className="text-ink font-semibold">
                                {ativa.componente.nome}
                            </span>
                            {` | nota ${formatDecimal(ativa.nota)} × peso ${(ativa.componente.peso * 100).toLocaleString("pt-BR")}% · deixou de ganhar ${formatDecimal(ativa.maximo - ativa.ganho)}`}
                        </>
                    ) : (
                        <>
                            <span className="text-ink font-semibold">
                                Soma das contribuições
                            </span>
                            {curso.cpc !== null &&
                                ` | CPC do curso ${formatDecimal(curso.cpc)}`}
                        </>
                    )}
                </TextoAjustado>
            </div>

            <div
                ref={boxRef}
                className="relative mt-2 min-h-[300px] flex-1 sm:min-h-[380px]"
                onMouseLeave={() => setHover(null)}
            >
                {W > 0 && H > 0 && linhas.length >= 3 && (
                    <Radar
                        linhas={linhas}
                        W={W}
                        H={H}
                        destaque={destaque}
                        onHover={setHover}
                    />
                )}
            </div>

            <div className="text-text-muted mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="border-brand bg-brand/20 h-2.5 w-4 rounded-[3px] border-2"
                    />
                    pontos conquistados
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-2.5 w-4 rounded-[3px] border"
                        style={{ borderColor: CHART.reference }}
                    />
                    máximo possível (nota 5)
                </span>
                {semNota > 0 && (
                    <span>
                        {semNota} {semNota === 1 ? "componente" : "componentes"} sem
                        nota nesta edição
                    </span>
                )}
            </div>

            <div className="sr-only">
                <DataTable
                    columns={["Componente", "Nota", "Peso", "Pontos", "Máximo"]}
                    rows={linhas.map((l) => [
                        l.componente.nome,
                        formatDecimal(l.nota),
                        `${(l.componente.peso * 100).toLocaleString("pt-BR")}%`,
                        formatDecimal(l.ganho),
                        formatDecimal(l.maximo),
                    ])}
                />
            </div>
        </Card>
    );
}

/** O radar em si: anéis em 25/50/75/100% do máximo de cada componente, um
 * raio por componente, o polígono do que o curso conquistou e, em cada
 * ponta, o nome com o peso e os pontos "x de y". */
function Radar({
    linhas,
    W,
    H,
    destaque,
    onHover,
}: {
    linhas: Linha[];
    W: number;
    H: number;
    destaque: string | null;
    onHover: (key: string | null) => void;
}) {
    const CHART = useChartTheme();
    const n = linhas.length;
    // card estreito (celular): nomes curtos (FG, CE, IDD…), que ocupam menos
    // e deixam o radar maior
    const estreito = W < 480;
    const rotuloX = estreito ? 82 : ROTULO_X;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.max(40, Math.min(W / 2 - rotuloX, H / 2 - ROTULO_Y));
    const angulo = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const ponto = (i: number, f: number): [number, number] => [
        cx + R * f * Math.cos(angulo(i)),
        cy + R * f * Math.sin(angulo(i)),
    ];
    const poligono = (fs: number[]) =>
        fs.map((f, i) => ponto(i, f).join(",")).join(" ");
    const fracoes = linhas.map((l) => Math.min(Math.max(l.ganho / l.maximo, 0), 1));

    return (
        <svg width={W} height={H} className="absolute inset-0" aria-hidden>
            {/* grade: anéis e raios */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
                <polygon
                    key={f}
                    points={poligono(linhas.map(() => f))}
                    fill="none"
                    stroke={f === 1 ? CHART.reference : CHART.deemphasis}
                    strokeWidth={1}
                />
            ))}
            {linhas.map((l, i) => {
                const [x, y] = ponto(i, 1);
                return (
                    <line
                        key={l.componente.key}
                        x1={cx}
                        y1={cy}
                        x2={x}
                        y2={y}
                        stroke={CHART.deemphasis}
                        strokeWidth={1}
                    />
                );
            })}

            {/* o que o curso conquistou */}
            <polygon
                points={poligono(fracoes)}
                fill={CHART.brand}
                fillOpacity={0.18}
                stroke={CHART.brand}
                strokeWidth={2}
                strokeLinejoin="round"
            />
            {/* eixo em foco: o raio inteiro na cor da série, por cima do polígono */}
            {linhas.map((l, i) => {
                if (destaque !== l.componente.key) return null;
                const [x, y] = ponto(i, 1);
                return (
                    <line
                        key={l.componente.key}
                        x1={cx}
                        y1={cy}
                        x2={x}
                        y2={y}
                        stroke={CHART.brand}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                    />
                );
            })}
            {linhas.map((l, i) => {
                const [x, y] = ponto(i, fracoes[i]);
                const ativo = destaque === l.componente.key;
                return (
                    <g
                        key={l.componente.key}
                        opacity={destaque && !ativo ? 0.45 : 1}
                        className="transition-opacity duration-200"
                    >
                        {/* halo no ponto em foco */}
                        {ativo && (
                            <circle
                                cx={x}
                                cy={y}
                                r={12}
                                fill={CHART.brand}
                                fillOpacity={0.22}
                            />
                        )}
                        <circle
                            cx={x}
                            cy={y}
                            r={ativo ? 6.5 : 4}
                            fill={CHART.brand}
                            stroke={CHART.surface}
                            strokeWidth={2}
                        />
                    </g>
                );
            })}

            {/* rótulos nas pontas (e a área de hover de cada eixo) */}
            {linhas.map((l, i) => {
                const a = angulo(i);
                const [cos, sin] = [Math.cos(a), Math.sin(a)];
                const ancora = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
                // largura aproximada do rótulo: em telas estreitas, puxa pra
                // dentro o que passaria da borda
                const nome = estreito
                    ? l.componente.curto
                    : (NOME_EIXO[l.componente.key] ?? l.componente.curto);
                // (o nome com o peso, ou a linha "0,85 de 1,75", o que for maior)
                const largura = Math.max((nome.length + 5) * 6, 80);
                const xBruto = cx + (R + 12) * cos;
                const x =
                    ancora === "end"
                        ? Math.max(xBruto, largura)
                        : ancora === "start"
                          ? Math.min(xBruto, W - largura)
                          : Math.min(Math.max(xBruto, largura / 2), W - largura / 2);
                const y = cy + (R + 12) * sin;
                // em cima, as duas linhas sobem a partir da ponta; embaixo, descem
                const y1 = sin < -0.3 ? y - 18 : sin > 0.3 ? y + 10 : y - 4;
                const ativo = destaque === l.componente.key;
                const peso = `${(l.componente.peso * 100).toLocaleString("pt-BR")}%`;
                return (
                    <g
                        key={l.componente.key}
                        onMouseEnter={() => onHover(l.componente.key)}
                        opacity={destaque && !ativo ? 0.45 : 1}
                        className="cursor-default transition-opacity duration-200"
                    >
                        <text
                            x={x}
                            y={y1}
                            textAnchor={ancora}
                            fontSize={11}
                            fontWeight={ativo ? 600 : 400}
                            fill={ativo ? CHART.ink : CHART.textMuted}
                        >
                            {nome}
                            <tspan fill={CHART.textMuted} fontSize={10}>
                                {` ${peso}`}
                            </tspan>
                        </text>
                        <text
                            x={x}
                            y={y1 + 16}
                            textAnchor={ancora}
                            fontSize={13}
                            fontWeight={700}
                            fill={CHART.ink}
                            className="tabular-nums"
                        >
                            {formatDecimal(l.ganho)}
                            <tspan
                                fontSize={11}
                                fontWeight={400}
                                fill={CHART.textMuted}
                            >
                                {` de ${formatDecimal(l.maximo)}`}
                            </tspan>
                        </text>
                        {/* área de hover: do centro até o rótulo */}
                        <line
                            x1={cx}
                            y1={cy}
                            x2={x}
                            y2={y}
                            stroke="transparent"
                            strokeWidth={22}
                        />
                    </g>
                );
            })}
        </svg>
    );
}
