import { esquecerCursoDasSubabas } from "@/lib/ultima-subaba";

/** O curso escolhido em cada unidade, o mesmo em todos os seletores de curso
 * do painel: o do Início, o do cabeçalho de Por curso e do Mapa (nas duas
 * abas), o curso A das Comparações entre cursos e os dos cards (Evolução entre
 * ciclos, Situação final, Evasão por ano). Escolher num lugar muda todos.
 *
 * ``curso``: o escolhido, ou ``null`` pra "Todos os cursos" (o Início e os
 * cards têm essa opção). ``ultimo``: o último curso específico escolhido — o
 * que as páginas de um curso só (Por curso, Mapa, Comparações) abrem quando
 * ``curso`` é "Todos". Cada seletor só mostra o escolhido se ele estiver entre
 * as opções dele (um curso sem CPC não aparece no Mapa da Qualidade, por
 * exemplo); senão, usa o próprio padrão, sem mudar a escolha. Só na memória da
 * página, como a última sub-aba. */
export interface CursoEscolhido {
    curso: number | null;
    ultimo: number | null;
}

const NENHUM: CursoEscolhido = { curso: null, ultimo: null };

const porUnidade = new Map<string, CursoEscolhido>();
const ouvintes = new Set<() => void>();

export function cursoEscolhido(unidade: string | null): CursoEscolhido {
    return (unidade && porUnidade.get(unidade)) || NENHUM;
}

export function escolherCurso(unidade: string | null, curso: number | null) {
    if (!unidade) return;
    const atual = cursoEscolhido(unidade);
    const ultimo = curso ?? atual.ultimo;
    if (atual.curso === curso && atual.ultimo === ultimo) return;
    porUnidade.set(unidade, { curso, ultimo });
    // outra escolha (outro curso ou "Todos"): as sub-abas lembradas no menu
    // ("/qualidade/curso/123", "?curso=123") deixam de valer — o código na URL
    // conta como escolha, e voltar pelo menu desfaria esta
    esquecerCursoDasSubabas();
    for (const ouvir of ouvintes) ouvir();
}

export function ouvirCursoEscolhido(ouvir: () => void): () => void {
    ouvintes.add(ouvir);
    return () => ouvintes.delete(ouvir);
}
