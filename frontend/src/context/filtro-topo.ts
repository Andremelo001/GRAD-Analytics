import { createContext } from "react";

/** Os lugares do seletor de curso no cabeçalho de uma aba com sub-abas
 * (Qualidade, Trajetória), um em cada tom: ``band`` na faixa escura e
 * ``surface`` no modo apresentação — a ponta direita da linha das sub-abas,
 * onde o Início tem o seletor dele. Cada sub-aba que tem curso
 * (``FiltroTopo``) desenha o seletor ali; nas outras, o lugar some. */
export const FiltroTopoContext = createContext<{
    band: HTMLElement | null;
    surface: HTMLElement | null;
}>({ band: null, surface: null });
