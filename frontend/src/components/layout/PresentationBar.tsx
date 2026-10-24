import { useState } from "react";

import brasao from "@/assets/brasao.png";
import { CampusAtual } from "@/components/layout/CampusSelect";
import { cn } from "@/lib/utils";

const TRANSICAO = "duration-500 ease-in-out motion-reduce:transition-none";

/** Barra do modo apresentação: no lugar da saudação (que sobe com o topo),
 * um card baixo da largura da grade com a frase (o campus em destaque) à
 * esquerda e o logo à direita — o campus continua trocável no seletor ao lado
 * das sub-abas. Entra descendo até o lugar (enquanto abre o próprio espaço e
 * empurra os cards) e sai subindo — o mesmo movimento vertical do topo. */
export function PresentationBar({ presenting }: { presenting: boolean }) {
    // terminou de abrir: libera o conteúdo pra fora da barra (a lista do
    // seletor abre por cima dos cards); fechando, volta a esconder o que
    // passa da borda
    const [aberta, setAberta] = useState(false);
    const vaza = presenting && aberta;

    return (
        <div
            inert={!presenting}
            aria-hidden={!presenting}
            onTransitionEnd={(event) => {
                if (event.target !== event.currentTarget) return;
                setAberta(presenting);
            }}
            className={cn(
                // aberta: acima dos cards, pra lista do seletor abrir por cima deles
                "relative grid transition-[grid-template-rows]",
                vaza && "z-20",
                TRANSICAO,
                presenting ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
        >
            <div className={cn("min-h-0", !vaza && "overflow-hidden")}>
                <div className="pb-5 lg:pb-6">
                    <div
                        className={cn(
                            "bg-surface text-ink ring-card-ring flex h-14 items-center justify-between gap-4 rounded-[18px] px-4 shadow-[0_4px_24px_rgb(0_0_0/0.05)] ring-1 transition-[transform,opacity] sm:px-5",
                            TRANSICAO,
                            presenting ? "opacity-100" : "opacity-0"
                        )}
                        // desce pro lugar ao entrar e sobe ao sair — o mesmo
                        // movimento do topo (``transform`` inline: a classe
                        // translate-y-* do Tailwind v4 usa a propriedade
                        // ``translate``, que esta transição não anima)
                        style={{
                            transform: presenting
                                ? "translateY(0)"
                                : "translateY(-100%)",
                        }}
                    >
                        <div className="text-text-secondary min-w-0 text-[13px] leading-snug sm:text-[14px]">
                            <span className="hidden sm:inline">
                                Acompanhe os indicadores da graduação do{" "}
                            </span>
                            UFC Campus <CampusAtual tom="surface" />
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5">
                            <img
                                src={brasao}
                                alt=""
                                width={172}
                                height={207}
                                className="h-8 w-auto"
                            />
                            <span
                                aria-hidden
                                className="bg-ink/25 hidden h-5 w-px sm:block"
                            />
                            <span className="hidden text-[15px] leading-none font-bold tracking-[-0.01em] sm:inline">
                                <span className="sr-only">UFC — PROGRAD </span>
                                Analytics
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
