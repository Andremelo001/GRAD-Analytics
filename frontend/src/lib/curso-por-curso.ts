/** O curso aberto por último na sub-aba Por curso de cada aba (Qualidade,
 * Trajetória). O Mapa e as Comparações (entre cursos) da mesma aba abrem nele
 * quando a URL deles não traz um curso; escolher um curso lá não muda este
 * (só a URL deles). Só na memória da página, como a última sub-aba. */
type Aba = "qualidade" | "trajetoria";

const escolhidos = new Map<Aba, number>();

export function lembrarCursoPorCurso(aba: Aba, codigo: number) {
    escolhidos.set(aba, codigo);
}

export function cursoDoPorCurso(aba: Aba): number | undefined {
    return escolhidos.get(aba);
}
