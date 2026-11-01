/** URL de um JSON do painel (``public/data/dashboard/``), com a versão do
 * build na query: cada deploy pede os dados do próprio build, e a cópia de um
 * deploy anterior no cache do navegador (o GitHub Pages manda cache de 10 min)
 * não se mistura com o código novo. ``import.meta.env.BASE_URL`` já inclui o
 * prefixo do GitHub Pages no build de produção. */
export function urlDados(caminho: string): string {
    return `${import.meta.env.BASE_URL}data/dashboard/${caminho}?v=${__VERSAO_DADOS__}`;
}
