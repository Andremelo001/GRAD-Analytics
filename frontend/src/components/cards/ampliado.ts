// Classes pra conteúdo de um ``Card expansivel`` se ajustar quando o card está
// ampliado (o card ganha ``group/card`` e o atributo ``data-card-expandido``).

/** Bloco que vira coluna flexível e cresce com o conteúdo (até o card caber
 * na tela). */
export const AMPLIADO_FLEX =
    "group-data-[card-expandido]/card:flex group-data-[card-expandido]/card:min-h-0 group-data-[card-expandido]/card:flex-auto group-data-[card-expandido]/card:flex-col";

/** Lista ou grade que rola na altura do card normal: ampliado, perde o
 * limite de altura, mostra tudo o que couber e rola só o resto. */
export const AMPLIADO_ROLA =
    "group-data-[card-expandido]/card:max-h-none! group-data-[card-expandido]/card:min-h-0 group-data-[card-expandido]/card:flex-auto group-data-[card-expandido]/card:overflow-y-auto";

/** Bloco de altura fixa (ex.: um gráfico) que, ampliado, ocupa a altura que
 * sobra no card. */
export const AMPLIADO_CRESCE =
    "group-data-[card-expandido]/card:h-auto group-data-[card-expandido]/card:min-h-0 group-data-[card-expandido]/card:flex-1";
