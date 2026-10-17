import { createContext } from "react";

/** ``true`` no modo apresentação (``AppLayout``): o card ampliado ocupa a
 * tela toda, sem o fundo desfocado. */
export const PresentationContext = createContext(false);
