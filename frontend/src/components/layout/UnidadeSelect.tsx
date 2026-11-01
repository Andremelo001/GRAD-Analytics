import { useLocation, useNavigate } from "react-router-dom";

import { CursoBusca } from "@/components/charts/qualidade/CursoBusca";
import { useDashboardData } from "@/hooks/useDashboardData";
import { nomeUnidade } from "@/lib/comparacao";

/** Seletor de unidade em pílula, à esquerda das sub-abas (``PageHeader``) — o
 * mesmo desenho da barra delas, separado: "Unidade [CCA (Fortaleza) ▾]". É o
 * seletor com busca da aplicação (``CursoBusca``, como o de curso do Início):
 * aberto, filtra pelo nome, sigla ou cidade, e a lista abre alinhada à
 * esquerda da pílula. Na lista, cada unidade aparece como no SIGAA ("CCA -
 * CENTRO DE CIÊNCIAS AGRÁRIAS"), com a localidade embaixo, menor. Troca o JSON
 * carregado (``DashboardDataProvider``); enquanto a nova unidade baixa, a seta
 * vira um indicador de carga. ``tom="surface"``: sobre o plano claro (modo
 * apresentação), em pílula branca como as sub-abas.
 *
 * Nas Comparações entre unidades (Qualidade e Trajetória), o lado A acompanha
 * a troca: sai da URL (``a``) e volta a ser a unidade escolhida aqui; o B sai
 * também se for a mesma unidade. O inverso não: trocar o A lá não muda esta. */
export function UnidadeSelect({ tom = "band" }: { tom?: "band" | "surface" }) {
    const { unidades, unidade, setUnidade, switching } = useDashboardData();
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    if (unidades.length === 0 || unidade === null) return null;

    function trocar(slug: string) {
        setUnidade(slug);
        const params = new URLSearchParams(search);
        if (!pathname.endsWith("/comparacoes") || params.get("modo") === "cursos")
            return;
        params.delete("a");
        if (params.get("b") === slug) params.delete("b");
        navigate({ pathname, search: params.toString() }, { replace: true });
    }

    return (
        <div className="min-w-0 shrink-0">
            <CursoBusca
                faixa
                superficie={tom === "surface"}
                prefixo="Unidade"
                alinhar="esquerda"
                quebrar
                label="Unidade"
                placeholder="Buscar unidade…"
                vazio="Nenhuma unidade encontrada"
                value={unidade}
                options={unidades.map((c) => ({
                    value: c.slug,
                    label: c.nome,
                    detalhe: c.localidade ?? undefined,
                    busca: c.sigla ?? undefined,
                    curto: nomeUnidade(c),
                }))}
                onChange={(slug) => slug !== unidade && trocar(slug)}
                ocupado={switching}
            />
        </div>
    );
}

/** A unidade selecionada no meio de uma frase ("…da graduação da UFC na
 * unidade CCA (Fortaleza)"), com a mesma cor e o mesmo peso da frase: só
 * mostra; quem troca é o ``UnidadeSelect``. O rótulo inteiro do SIGAA fica no
 * ``title``. */
export function UnidadeAtual() {
    const { unidades, unidade } = useDashboardData();
    const info = unidades.find((c) => c.slug === unidade);
    if (!info) return null;
    return <span title={info.nome}>{nomeUnidade(info)}</span>;
}
