import { useState } from "react";

import { Card } from "@/components/cards/Card";
import { NotaRodape } from "@/components/cards/NotaRodape";
import { DataTable } from "@/components/charts/DataTable";
import { corSituacao, type Situacao } from "@/components/charts/trajetoria/situacao";
import {
    TODAS_AS_TURMAS,
    TurmaInline,
} from "@/components/charts/trajetoria/TurmaInline";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatInteger, formatPercent } from "@/lib/format";
import { somarContagens, type CursoTrajetoria } from "@/lib/trajetoria";
import { cn } from "@/lib/utils";

const PARTES: {
    chave: Situacao;
    rotulo: string;
    campo: "concluiram" | "desistiram" | "cursando";
}[] = [
    { chave: "concluiu", rotulo: "Concluíram", campo: "concluiram" },
    { chave: "desistiu", rotulo: "Desistiram", campo: "desistiram" },
    { chave: "cursando", rotulo: "Ainda cursando", campo: "cursando" },
];

/** Os alunos do curso em números: quantos entraram, concluíram, desistiram
 * e ainda cursam — de todas as turmas somadas ou de uma turma, na situação do
 * último ano acompanhado. Uma barra 100% embaixo divide os que entraram;
 * passar o mouse num número ou na barra destaca a parte. A turma é a da
 * página (``turmaAno``, a dos seletores de turma do topo e dos outros cards):
 * trocar lá troca aqui, e escolher um ano no seletor do subtítulo troca na
 * página; "Todas as turmas" vale só pra este card, até a turma da página
 * mudar. */
export function AlunosCursoCard({
    curso,
    turmaAno,
    onTurma,
    className,
}: {
    curso: CursoTrajetoria;
    turmaAno: number;
    onTurma: (ano: number) => void;
    className?: string;
}) {
    const CHART = useChartTheme();
    // "todas" fica valendo enquanto a turma da página for a mesma de quando
    // foi escolhido (começa assim): trocar a turma em qualquer lugar mostra ela
    const [todasEm, setTodasEm] = useState<number | null>(turmaAno);
    const todas = todasEm === turmaAno;
    const [foco, setFoco] = useState<Situacao | null>(null);

    const turmas = todas
        ? curso.turmas
        : curso.turmas.filter((t) => t.ano === turmaAno);
    const turma = todas ? undefined : turmas[0];
    const n = somarContagens(turmas);
    const ultimoAno = Math.max(...curso.turmas.map((t) => t.ultimoAno ?? 0));
    const pct = (v: number) => (n.entraram > 0 ? (100 * v) / n.entraram : 0);

    return (
        <Card
            title="Alunos do curso"
            info="Quantos alunos entraram no curso e quantos concluíram, desistiram e ainda cursam: de todas as turmas somadas ou de uma turma, na situação do último ano acompanhado."
            subtitle={
                <>
                    {turma ? "Turma de " : ""}
                    <TurmaInline
                        comTodas
                        turmas={curso.turmas}
                        valor={todas ? TODAS_AS_TURMAS : turmaAno}
                        onChange={(a) => {
                            if (a === TODAS_AS_TURMAS) setTodasEm(turmaAno);
                            else {
                                setTodasEm(null);
                                onTurma(a);
                            }
                        }}
                    />
                    {turma
                        ? `, situação em ${turma.ultimoAno ?? ultimoAno}`
                        : ` | ${curso.turmas.length} turmas somadas, situação em ${ultimoAno}`}
                </>
            }
            className={className}
        >
            <dl
                className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4"
                onMouseLeave={() => setFoco(null)}
            >
                <div>
                    <dt className="text-text-muted text-[12px]">Entraram</dt>
                    <dd className="mt-1 text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                        {formatInteger(n.entraram)}
                    </dd>
                    <dd className="text-text-muted mt-1 text-[11px]">
                        {turma
                            ? "ingressantes da turma"
                            : "ingressantes de todas as turmas"}
                    </dd>
                </div>
                {PARTES.map((p) => (
                    <div
                        key={p.chave}
                        onMouseEnter={() => setFoco(p.chave)}
                        className={cn(
                            "transition-opacity duration-200",
                            foco !== null && foco !== p.chave && "opacity-40"
                        )}
                    >
                        <dt className="text-text-muted flex items-center gap-1.5 text-[12px]">
                            <span
                                aria-hidden
                                className="h-2.5 w-2.5 rounded-[3px]"
                                style={{ background: corSituacao(CHART, p.chave) }}
                            />
                            {p.rotulo}
                        </dt>
                        <dd className="mt-1 text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                            {formatInteger(n[p.campo])}
                        </dd>
                        <dd className="text-text-muted mt-1 text-[11px] tabular-nums">
                            {formatPercent(pct(n[p.campo]), 0)} dos que entraram
                        </dd>
                    </div>
                ))}
            </dl>

            <div
                className="mt-5 flex h-4 items-center gap-[2px]"
                onMouseLeave={() => setFoco(null)}
                aria-hidden
            >
                {PARTES.map((p) =>
                    n[p.campo] <= 0 ? null : (
                        <span
                            key={p.chave}
                            onMouseEnter={() => setFoco(p.chave)}
                            className={cn(
                                "cursor-pointer transition-[height,opacity] duration-200 first:rounded-l-full last:rounded-r-full",
                                foco === p.chave ? "h-4" : "h-3",
                                foco !== null && foco !== p.chave && "opacity-35"
                            )}
                            style={{
                                flexGrow: n[p.campo],
                                background: corSituacao(CHART, p.chave),
                            }}
                        />
                    )
                )}
            </div>
            <NotaRodape>
                {todas
                    ? 'Somadas, as turmas recentes (em andamento) ainda puxam o "ainda cursando" pra cima. '
                    : ""}
                Concluíram e desistiram: acumulado até o último ano acompanhado.
                {n.outros > 0 &&
                    ` ${formatInteger(n.outros)} ${n.outros === 1 ? "aluno faleceu ou" : "alunos faleceram ou"} ficaram fora pelo arredondamento.`}{" "}
                Desistência inclui transferência para outro curso, inclusive dentro da
                UFC.
            </NotaRodape>
            <div className="sr-only">
                <DataTable
                    columns={["Entraram", "Concluíram", "Desistiram", "Ainda cursando"]}
                    rows={[
                        [
                            formatInteger(n.entraram),
                            formatInteger(n.concluiram),
                            formatInteger(n.desistiram),
                            formatInteger(n.cursando),
                        ],
                    ]}
                />
            </div>
        </Card>
    );
}
