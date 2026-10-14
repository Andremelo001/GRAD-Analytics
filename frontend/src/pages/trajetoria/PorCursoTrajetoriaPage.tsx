import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AlunosCursoCard } from "@/components/charts/trajetoria/AlunosCursoCard";
import { CaminhoTurmaCard } from "@/components/charts/trajetoria/CaminhoTurmaCard";
import { ConclusaoPrazoCard } from "@/components/charts/trajetoria/ConclusaoPrazoCard";
import { CursoTrajetoriaCard } from "@/components/charts/trajetoria/CursoTrajetoriaCard";
import { IndicadoresInepCard } from "@/components/charts/trajetoria/IndicadoresInepCard";
import { PermanenciaCard } from "@/components/charts/trajetoria/PermanenciaCard";
import { TrianguloTurmasCard } from "@/components/charts/trajetoria/TrianguloTurmasCard";
import { DataState } from "@/components/layout/DataState";
import { PorCursoEsqueleto } from "@/components/layout/Esqueleto";
import { useElementSize } from "@/hooks/useElementSize";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
    buildTrajetorias,
    curvaNacional,
    turmaMadura,
    type CursoTrajetoria,
} from "@/lib/trajetoria";
import type { DashboardData } from "@/types/dashboard";

export function PorCursoTrajetoriaPage() {
    return (
        <DataState
            esqueleto={<PorCursoEsqueleto />}
            render={(data) => (
                <PorCurso key={data.escopo.codigo_municipio} data={data} />
            )}
        />
    );
}

// O nome do último curso visto: ao trocar de campus (a página é montada de
// novo e o código da URL é de outro campus), abre o curso de mesmo nome.
let ultimoNome: string | null = null;

/** Trajetória → Por curso (``/trajetoria/curso/:codigo``): a história das
 * turmas de um curso. Os gráficos dividem a turma escolhida (a madura mais
 * recente, de início): a linha do tempo do "caminho" e um clique no triângulo
 * trocam a turma de todos. */
function PorCurso({ data }: { data: DashboardData }) {
    const { codigo } = useParams<{ codigo: string }>();
    const navigate = useNavigate();
    const cursos = useMemo(() => buildTrajetorias(data), [data]);
    const curso =
        cursos.find((c) => String(c.codigo) === codigo) ??
        cursos.find((c) => c.nome === ultimoNome) ??
        cursos[0];

    useEffect(() => {
        if (!curso) return;
        ultimoNome = curso.nome;
        if (String(curso.codigo) !== codigo)
            navigate(`/trajetoria/curso/${curso.codigo}`, { replace: true });
    }, [curso, codigo, navigate]);

    if (!curso) {
        return (
            <p className="text-text-secondary text-[14px]">
                Nenhum curso deste campus tem turmas acompanhadas.
            </p>
        );
    }
    return (
        <CursoDetalhe
            key={curso.codigo}
            data={data}
            curso={curso}
            cursos={cursos}
            onCurso={(c) => navigate(`/trajetoria/curso/${c}`)}
        />
    );
}

function CursoDetalhe({
    data,
    curso,
    cursos,
    onCurso,
}: {
    data: DashboardData;
    curso: CursoTrajetoria;
    cursos: CursoTrajetoria[];
    onCurso: (codigo: number) => void;
}) {
    const [turmaAno, setTurmaAno] = useState(
        () => (turmaMadura(curso) ?? curso.turmas.at(-1))!.ano
    );
    const turma = curso.turmas.find((t) => t.ano === turmaAno) ?? curso.turmas.at(-1)!;
    const nacional = useMemo(() => curvaNacional(data, curso.area), [data, curso.area]);
    const alunosRef = useRef<HTMLDivElement>(null);
    const { height: alturaAlunos } = useElementSize(alunosRef);
    const largo = useMediaQuery("(min-width: 1024px)");

    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <CursoTrajetoriaCard
                className="lg:col-span-12"
                data={data}
                curso={curso}
                cursos={cursos}
                onChange={onCurso}
            />
            {/* os alunos em números, na largura toda, logo abaixo do cabeçalho */}
            <div ref={alunosRef} className="flex flex-col lg:col-span-12">
                <AlunosCursoCard className="flex-1" curso={curso} />
            </div>
            {/* lado a lado com a mesma altura */}
            <div className="grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                <CaminhoTurmaCard
                    className="lg:col-span-7"
                    curso={curso}
                    turma={turma}
                    onTurma={setTurmaAno}
                />
                <PermanenciaCard
                    className="lg:col-span-5"
                    turma={turma}
                    nacional={nacional}
                />
            </div>
            {/* os indicadores do INEP da mesma turma, na largura toda e na
                altura do card dos alunos (no celular, a altura natural) */}
            <div
                className="flex flex-col lg:col-span-12"
                style={
                    largo && alturaAlunos > 0 ? { minHeight: alturaAlunos } : undefined
                }
            >
                <IndicadoresInepCard
                    className="flex-1"
                    turma={turma}
                    nacional={nacional}
                />
            </div>
            <div className="grid grid-cols-1 gap-5 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                <TrianguloTurmasCard
                    className="lg:col-span-7"
                    curso={curso}
                    turmaAno={turma.ano}
                    onTurma={setTurmaAno}
                />
                <ConclusaoPrazoCard
                    className="lg:col-span-5"
                    curso={curso}
                    cursos={cursos}
                />
            </div>
        </div>
    );
}
