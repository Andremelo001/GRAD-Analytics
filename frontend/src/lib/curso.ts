// O formato das opções de curso em todos os seletores com busca
// (``CursoBusca``): o nome do curso em cima e, embaixo, em texto menor, o
// código, o grau e o turno — só o que houver, separados por "·".

/** "cód: 12344 · Bacharelado · Noturno" (o que faltar não aparece; o INEP
 * hoje não informa o turno). */
export function detalheCurso(c: {
    codigo: number;
    grau?: string | null;
    turno?: string | null;
}): string {
    return [`cód: ${c.codigo}`, c.grau, c.turno].filter(Boolean).join(" · ");
}

/** A opção de um curso no seletor: valor = código, rótulo = nome. */
export function opcaoCurso(c: {
    codigo: number;
    nome: string;
    grau?: string | null;
    turno?: string | null;
}): { value: string; label: string; detalhe: string } {
    return { value: String(c.codigo), label: c.nome, detalhe: detalheCurso(c) };
}
