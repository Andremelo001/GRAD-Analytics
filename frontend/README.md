# PROGRAD Analytics — Frontend

SPA React do PROGRAD Analytics: lê os JSONs do painel gerados pelo
[backend](../backend/README.md) — um por campus da UFC — e mostra os
indicadores do campus escolhido no seletor da saudação (padrão: Quixadá).
Publicada no GitHub Pages como site estático, sem servidor.

**Todos os comandos `npm ...` deste README rodam de dentro de `frontend/`.**

---

## 1. Como rodar localmente

Pré-requisitos:

- **Node 22+** (com npm).
- A pasta **`backend/app/data/processed/dashboard/`** (`index.json` + um JSON
  por campus). Ela já vem versionada no repo; se não existir ou se você quiser dados novos, gere com o
  backend (`cd backend && poetry run python -m app.cmd all` — ver
  [`../backend/README.md`](../backend/README.md)).

```bash
# 1. Entrar no frontend
cd PROGRAD-Analytics/frontend

# 2. Instalar as dependências
npm install

# 3. Subir o servidor de desenvolvimento (http://localhost:5173)
npm run dev
```

`npm run dev` roda antes o `sync-data` (hook `predev`), que copia a pasta
`dashboard/` do backend para `public/data/dashboard/`. Se o `index.json` não
existir, ele para com uma mensagem dizendo qual comando do backend rodar.

Outros scripts:

```bash
npm run build      # sync-data + checagem de tipos (tsc -b) + build de produção em dist/
npm run preview    # serve o dist/ localmente (http://localhost:4173) pra conferir o build
npm run lint       # ESLint
npm run format     # Prettier (formata o projeto inteiro)
npm run sync-data  # só copia os JSONs dos campi de novo (ex.: depois de rodar o backend com o dev ligado)
```

---

## 2. Stack

| Ferramenta                                                                | Versão   | Uso                                                                |
| ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| Node                                                                      | **22**   | runtime de build (mesma versão do CI)                              |
| React                                                                     | `^19.3`  | UI                                                                 |
| TypeScript                                                                | `^5.9`   | tipagem (limitado a 5.9 pelo `typescript-eslint`)                  |
| Vite                                                                      | `^8.3`   | dev server + build (`@vitejs/plugin-react`)                        |
| Tailwind CSS                                                              | `^4.3`   | estilos via `@tailwindcss/vite`, tokens em `@theme inline`         |
| `tw-animate-css` · `class-variance-authority` · `clsx` · `tailwind-merge` | —        | infraestrutura do shadcn/ui (`components.json`, helper `cn`)       |
| Recharts                                                                  | `^3.10`  | gráficos                                                           |
| lucide-react                                                              | `^1.48`  | ícones                                                             |
| React Router                                                              | `^7.18`  | rotas (`createHashRouter`, ver 5)                                  |
| `@fontsource-variable/plus-jakarta-sans`                                  | `^5.3`   | fonte Plus Jakarta Sans (variável) self-hosted                     |
| ESLint                                                                    | `^10.11` | lint (flat config, `react-hooks` + `react-refresh`)                |
| Prettier                                                                  | `^3.9`   | formatação (`printWidth` 88, plugin do Tailwind ordena as classes) |

---

## 3. Estrutura de pastas

```
frontend/
├── package.json · package-lock.json
├── vite.config.ts           # base do GitHub Pages + alias @ → src/
├── tsconfig.json · tsconfig.node.json
├── eslint.config.js · .prettierrc.json
├── components.json          # config do shadcn/ui
├── index.html               # favicon = src/assets/brasao.png
├── .gitignore
├── scripts/
│   ├── sync-data.mjs        # copia backend/.../dashboard/ → public/data/dashboard/
│   ├── build-brazil-dots.mjs # gera src/assets/brazil-dots.json (roda uma vez, ver 6)
│   └── build-brazil-geo.mjs  # gera src/assets/brazil-geo.json (roda uma vez, ver 6)
├── public/
│   └── data/dashboard/      # index.json, JSON de cada campus, resumo_campi.json e areas_qualidade/ (gitignored, gerado pelo sync-data)
├── designs_pages/           # imagem do design de referência (gitignored)
└── src/
    ├── main.tsx             # entrada: fonte + CSS + <App />
    ├── App.tsx              # DashboardDataProvider + RouterProvider
    ├── router.tsx           # rotas
    ├── index.css            # Tailwind + tokens de cor/fonte
    ├── assets/              # brasao.png (logo) · brazil-dots.json (mapa em pontos) · brazil-geo.json (contornos das UFs + centroides dos municípios)
    ├── types/
    │   ├── dashboard.ts     # tipos que espelham o JSON de cada campus (e o resumo_campi.json)
    │   └── qualidade-area.ts # tipos dos JSONs de areas_qualidade/ (todos os cursos do Brasil numa área)
    ├── context/             # DashboardDataProvider (índice + campus escolhido) · ThemeProvider (claro/escuro) · slot do PageHeader
    ├── hooks/               # useDashboardData · useTheme · useChartTheme (paleta dos gráficos do tema) · useMediaQuery · usePresentationMode
    │                        # useElementWidth · useQualidadeArea (areas_qualidade/<área>.json sob demanda) · useResumoCampi
    ├── lib/
    │   ├── utils.ts         # cn()
    │   ├── format.ts        # formatPercent, formatPoints, formatDecimal, formatInteger, toTitleCase, normalizeForSearch
    │   ├── cpc.ts           # composição do CPC: os 9 componentes e pesos, limites das faixas, contribuição, quanto falta
    │   ├── qualidade.ts     # buildAvaliacoes: cada curso com a avaliação mais recente, a média nacional e o ciclo anterior
    │   ├── area.ts          # cursos de uma área (Mapa): parse do formato colunar, resumo por estado/município, filtros
    │   └── uf.ts            # sigla -> nome do estado
    ├── components/
    │   ├── layout/          # AppLayout (faixa escura + header), Sidebar (abas), SubTabs (sub-abas em pílula), PageHeader, ThemeToggle, PresentationToggle, PresentationBar, CampusSelect, DataState
    │   ├── cards/           # Card, StatTile (taxa + sparkline)
    │   ├── charts/          # IngressantesTrendCard, CpcComparativoCard, BrasilMapaCard, EvasaoHeatmapCard,
    │   │                    # ChartMarks, ChartSelect, DataTable, chart-theme
    │   │   └── qualidade/   # cards da aba Qualidade (ver 5)
    │   └── search/          # CourseSearch (busca de curso no header)
    └── pages/               # uma por rota (ver 5); pages/qualidade/ = sub-abas da Qualidade
```

Critério das pastas: `components/` agrupa por papel (layout, card, gráfico,
busca), não por página; `pages/` só compõe componentes e escolhe que parte do
JSON mostrar. `src/assets/` é pra arquivos importados pelo código (ganham hash
no nome no build); `public/` é pra arquivos servidos como estão — por isso o
JSONs dos campi ficam em `public/data/dashboard/`.

---

## 4. Fluxo de dados

1. O backend gera `backend/app/data/processed/dashboard/<campus>.json`
   (versionados), um por campus, todos com a mesma estrutura.
   Junto vai um `index.json` com a lista de campi (`slug`, `nome`,
   `total_cursos`, `arquivo`).
   Na mesma pasta: `resumo_campi.json` (resumo de todos os cursos de todos
   os campi, com notas e edições do CPC, pra comparar campi e cursos) e `areas_qualidade/` — um JSON por
   área de avaliação dos cursos da UFC, com todos os cursos do Brasil na
   edição mais recente da área (o Mapa da Qualidade), mais o `areas_qualidade/index.json`.
2. `scripts/sync-data.mjs` copia a pasta inteira para
   `frontend/public/data/dashboard/` — roda sozinho antes de `dev` e `build`
   (`predev`/`prebuild`).
3. `DashboardDataProvider` (em `App.tsx`) busca o `index.json` e o JSON do
   campus escolhido, em `${import.meta.env.BASE_URL}data/dashboard/` — o
   `BASE_URL` já inclui o prefixo do GitHub Pages no build de produção. O
   campus inicial é o último escolhido (`localStorage`, chave
   `prograd-campus`), senão Quixadá. JSONs já baixados ficam em cache.
4. O seletor de campus (`CampusSelect`, dentro da frase da saudação) troca o
   campus; os dados antigos seguem na tela até os novos chegarem (a seta do
   seletor vira um indicador de carga) e os cards da Home remontam — cursos e
   focos escolhidos voltam ao padrão do novo campus.
5. As páginas leem os dados com `useDashboardData()` (`{ data, loading, error,
campi, campus, setCampus, switching }`) e usam `DataState` pra mostrar
   carregando/erro.

`types/dashboard.ts` espelha a estrutura do JSON (seções A-F, `fontes`,
`medias_nacionais` — descritas em [`../backend/README.md`](../backend/README.md),
seção 4.4). Se o backend mudar uma chave, esse arquivo muda junto.

Não há backend em runtime: o site é só HTML/JS/CSS + JSONs estáticos. O de
Fortaleza (~100 cursos) passa de 7 MB — é baixado só quando escolhido. Os de
`areas_qualidade/` (até ~270 KB, ~80 KB comprimidos) só quando o Mapa abre, um por
área, e ficam em cache na sessão (`useQualidadeArea`); o `resumo_campi.json`,
em Comparações e no card de outros campi de Por curso.

---

## 5. Rotas e páginas

| Rota                   | Página                                                                                                                                | Nas abas                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `/`                    | `HomePage` — visão geral do campus (ingressantes, taxas de conclusão/evasão, presença no Brasil, CPC x média, evasão anual por curso) | Início                                   |
| `/qualidade/…`         | `QualidadePage` — cabeçalho + sub-abas (ver abaixo); `/qualidade` abre `/qualidade/campus`                                            | Qualidade                                |
| `/trajetoria`          | `TrajetoriaPage` (placeholder)                                                                                                        | Trajetória                               |
| `/cursos/:codigoCurso` | `CursoDetalhePage` (placeholder) — aberta pela busca do header                                                                        | —                                        |
| `/campus`              | `CampusPage` (placeholder)                                                                                                            | — (rota existe, ainda fora da navegação) |
| `/configuracoes`       | `ConfiguracoesPage` (placeholder)                                                                                                     | Configurações                            |

### Aba Qualidade

Por que o CPC de cada curso é o que é, onde dá para melhorar e como ele se
compara ao país. Quatro sub-abas (`SubTabs`, em pílulas dentro da faixa escura,
logo abaixo do subtítulo — prop `tabs` do `PageHeader`), cada uma com rota
própria:

| Rota                       | Página            | Cards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/qualidade/campus`        | `VisaoCampusPage` | 4 indicadores (CPC médio × Brasil, cursos por faixa, % nas faixas 4-5, sem CPC) · ranking dos cursos (ordenável; a linha abre o curso) · evolução entre ciclos (slope chart sobre as faixas) · mapa de calor cursos × 9 componentes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/qualidade/curso/:codigo` | `PorCursoPage`    | ficha da avaliação + seletor · "De onde vem a nota" (nota × peso de cada componente) · quanto falta para a próxima faixa (em pontos de CPC, com o quanto cada componente ainda pode render e quais bastariam sozinhos) · curso × média nacional por componente · participação no Enade · o mesmo curso nos outros campi da UFC (pontos numa régua de CPC, com o nome de cada campus)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/qualidade/mapa`          | `MapaPage` (lazy) | Brasil por estado (indicador: CPC médio, IDD médio, % nas faixas 4-5 ou nº de cursos; filtro de rede); clicar num estado dá zoom e mostra os municípios; no desktop o mapa e o painel cabem na tela sem rolar (`useAlturaDisponivel`), com filtros na linha do título e a legenda numa linha embaixo do mapa · painel do recorte com faixas, posição do curso do campus, notas do estado × Brasil e os melhores CPCs                                                                                                                                                                                                                                                                                                                                                                                  |
| `/qualidade/comparacoes`   | `ComparacoesPage` | dois modos (botão no topo; modo e lados na URL `?modo=…&a=…&b=…`): **entre campi** — dois campi da UFC lado a lado (CPC médio, % nas faixas 4 e 5, Enade e IDD médios, notas médias dos 9 componentes em barras espelhadas e as áreas em comum numa régua de CPC) · **entre cursos da mesma área** — um curso da UFC (A) contra qualquer curso da mesma área no Brasil (B, com busca por instituição ou cidade), na edição mais recente da área: indicadores, componentes espelhados, e a participação no Enade em cada edição (barras horizontais: inteira = inscritos, parte escura = quem fez a prova; "sem avaliação" quando um dos dois não foi avaliado), da coluna `historico` do arquivo da área, então vale pra qualquer instituição. A em oliva, B em violeta (par validado nos dois temas) |

Regras de comparação: as notas do CPC são padronizadas dentro de cada edição
do Enade, então o curso só é comparado com a média nacional da **mesma área no
mesmo ano** (`lib/cpc.ts`, `chaveAreaAno`). Os pesos do CPC estão em
`lib/cpc.ts` (FG 5%, CE 15%, IDD 35%, doutores 15%, mestres 7,5%, regime
7,5%, didático-pedagógica 7,5%, infraestrutura 5%, oportunidades 2,5%) —
conferidos com os dados: a soma nota × peso bate com o CPC de todos os
cursos. Participação no Enade abaixo de 60% é sinalizada (corte do painel,
não do INEP). O Mapa usa a edição mais recente da área e só cursos da mesma
modalidade (presencial ou a distância) do curso do campus. Curso, indicador,
rede e estado ficam na URL do Mapa (`?curso=…&indicador=…&rede=…&uf=…`).

O router é `createHashRouter` (URLs do tipo `/#/qualidade`) de propósito: o
GitHub Pages é hospedagem estática pura, e um refresh em
`/PROGRAD-Analytics/qualidade` daria 404 porque esse arquivo não existe no
servidor. Com hash, a rota nunca vai pro servidor.

---

## 6. Design

- **Referência**: a imagem em `designs_pages/` (gitignored). Faixa escura no
  topo com linhas onduladas finas, plano cinza-claro embaixo, cards brancos
  de cantos bem arredondados e sombra difusa, verde-limão como acento.
- **Header** (`AppLayout`): brasão da UFC + "Analytics" em texto branco à
  esquerda, só a busca à direita. Abaixo, a saudação (`PageHeader`) e as abas
  de navegação (`Sidebar` — o nome ficou do layout anterior, hoje são abas
  horizontais com sublinhado limão). A faixa escura tem altura fixa por largura de tela e desce até cobrir só
  o topo da primeira linha de cards. Em páginas com sub-abas (prop `tabs` do
  `PageHeader`) as sub-abas ficam na linha em que os cards do Início
  começam, e os cards logo abaixo delas. Esse topo fica preso ao rolar (os cards passam por baixo, com uma sombra;
  parado no topo ele é sólido e, rolando, vira vidro — `bg-band/80` +
  `backdrop-blur`):
  em `lg+` inteiro — logo, busca, saudação e abas, que dividem a mesma linha;
  abaixo de `lg` só até as abas, e a saudação rola com a página (fixa, ela
  tomaria quase um terço da tela do celular). A saudação é o `PageHeader` da
  página, desenhado via portal (`context/page-header-slot.ts`) no slot de
  dentro do topo fixo (`lg+`) ou no de logo abaixo dele (telas menores,
  escolhido com `useMediaQuery`).
- **Altura dos cards**: cada card tem a altura do próprio conteúdo. Listas e
  mapas de calor crescem até um limite (6 a 8 linhas) e depois rolam por
  dentro — campus com poucos cursos não fica com espaço vazio, e Fortaleza
  não estica a página. Cards lado a lado na mesma linha têm a mesma altura:
  o mais flexível ocupa o espaço do vizinho (o gráfico de evolução entre
  ciclos cresce até a altura do ranking; a participação no Enade, até a da
  posição entre os pares; "Quanto falta para a próxima faixa", até a de "De
  onde vem a nota"). Embaixo deles, em "Por curso", cada card tem a própria
  altura.
- **Troca de abas**: o sublinhado limão das abas e a pílula limão das
  sub-abas deslizam até a escolhida (`useActiveIndicator`); o conteúdo novo
  entra com um fade curto subindo alguns px (classe `.entrada` em
  `index.css`, num contêiner com `key` da aba — em `AppLayout` pra aba
  principal, em `QualidadePage` pra sub-aba, então o cabeçalho da Qualidade
  fica parado ao trocar de sub-aba). Trocar de aba com a página rolada volta
  ao topo. O código do Mapa é pré-carregado quando a Qualidade abre
  (`mapa-loader.ts`); abrindo o Mapa direto pelo link, aparece um esqueleto
  dos cards enquanto ele chega. Com "reduzir movimento" no sistema, nada
  disso anima.
- **Modo apresentação**: botão ao lado do sol/lua (`PresentationToggle`, a
  partir de `sm` — no celular o cabeçalho não tem largura pra ele), atalho
  **Ctrl+K** / **⌘+K** pra entrar e sair, **Esc** pra sair. A faixa escura e
  o topo sobem até sumir e os cards sobem junto (0,5s; sem animação com
  "reduzir movimento"), até a altura do X no desktop; o navegador entra em
  tela cheia depois da animação (e, ao sair, só sai da tela cheia depois de
  a faixa voltar), só a partir de 1024px de largura (em
  celular e tablet o modo funciona sem ela; sair da tela cheia pelo
  navegador também sai do modo). Um X no
  canto superior esquerdo sai do modo. No lugar da saudação entra a
  `PresentationBar`: um card baixo, da largura da grade, com a frase + o
  seletor de campus (`CampusSelect tone="surface"`) à esquerda e o logo à
  direita — entra descendo até o lugar e sai subindo (mesmo movimento
  vertical do topo, 0,5s) enquanto abre o próprio espaço e empurra os
  cards; aberta, fica sem recorte e acima dos
  cards, pra lista do seletor abrir por cima deles. Logo abaixo dela, o
  `AppLayout` reserva um lugar (`PresentationTabsSlotContext`) onde o
  `PageHeader` desenha de novo as sub-abas da página (`tabs("surface")`, em
  pílula branca), já que a versão normal sobe com a faixa; fora do modo, ele
  fica recolhido e `inert`. O topo
  escondido fica `inert` (o Tab não passa por ele). Estado e atalhos em
  `hooks/usePresentationMode.ts`; a animação em `AppLayout`.
- **Home** (`lg+`, grade de 12 colunas): linha 1 = Ingressantes (8) + taxas de
  conclusão e evasão empilhadas (4); linha 2 = Presença no Brasil (4) + CPC
  curso x média nacional (8); linha 3 = Evasão anual por curso — mapa de
  calor cursos × anos (12); o número do topo segue a célula sob o mouse. Abaixo de `lg` tudo vira uma coluna (as duas
  taxas ficam lado a lado em `sm`). Conferido em 1280, 900 e 390px de largura.
  Nenhum card muda de altura ao trocar o curso/turma nos seletores: legenda
  em linhas fixas, subtítulo e frases de contexto em uma linha só (truncam),
  botão do seletor na largura da opção mais longa.
- **Tema claro/escuro**: botão sol/lua à direita do logo (`ThemeToggle`). O
  `ThemeProvider` põe a classe `dark` no `<html>` e guarda a escolha no
  `localStorage` (`prograd-theme`); sem escolha salva, segue a preferência do
  sistema. Um script inline no `index.html` aplica o tema antes da primeira
  pintura (a página não "pisca" clara no modo escuro). A faixa do topo é
  escura nos dois temas; no escuro, o plano e os cards também escurecem.
- **Tokens** (`src/index.css`, expostos ao Tailwind via `@theme inline`,
  redefinidos no bloco `.dark`): `band`/`band-soft` (faixa escura e controles
  sobre ela), `page`, `surface`, `popover` (painéis que abrem por cima),
  `pill`/`pill-fg` (pílulas escuras e tooltips), `ink`, `lime` + `on-lime`
  (texto sobre o limão, escuro nos dois temas), `olive`/`olive-text`,
  `text-secondary`/`text-muted`, `empty` (contorno de célula sem dado),
  `card-ring` e `status-critical`/`status-critical-text`. Os tokens
  `primary`, `muted`, `card` etc. são do scaffolding do shadcn/ui. Cor nova
  entra aqui (nos dois temas), nunca como `bg-white`/hex solto no componente
  — exceção: `chart-theme.ts`, ver abaixo.
- **Fonte**: Plus Jakarta Sans (variável) como `--font-sans`, com
  `word-spacing` levemente aberto (o espaço da fonte é estreito).
- **Mapa do Brasil**: `src/assets/brazil-dots.json` é a malha de UFs do IBGE
  rasterizada numa grade de pontos (56 colunas). É versionado; pra gerar de
  novo (ex.: mudar a densidade), `node scripts/build-brazil-dots.mjs` — busca
  a malha na API do IBGE, então precisa de internet.
- **Mapa da Qualidade**: `src/assets/brazil-geo.json` traz o contorno de cada
  UF já como caminho SVG e o centroide de cada município, numa projeção
  equiretangular corrigida pela latitude (sem biblioteca de mapas). Também é
  versionado; `node scripts/build-brazil-geo.mjs` gera de novo (precisa de
  internet). Entra só no pedaço do bundle do Mapa (rota `lazy`).

### Convenções dos gráficos

- Cores em hex em `chart-theme.ts` (atributos de SVG não resolvem
  `var(--...)` de forma confiável), numa paleta por tema (`CHART_LIGHT` /
  `CHART_DARK`, mesmas chaves) — os componentes pegam a do tema atual com
  `useChartTheme()`. Série principal em oliva, trecho fora de foco /
  referência em cinza. No mapa do Brasil, do mais claro (poucos cursos) ao
  mais escuro (muitos), nos dois temas. No mapa de calor, a cor é a
  diferença para a média nacional da área: verde abaixo, vermelho acima,
  mais escuro quanto maior a distância — cada lado com a sua amplitude
  (múltiplo de 5 p.p.), mostrada na legenda. Na Qualidade, as faixas do CPC
  (1-5) usam uma rampa azul ordinal (validada nos dois temas) e a faixa vai
  sempre escrita na pílula; no mapa de calor dos componentes acima da média é
  verde e abaixo é vermelho (o inverso da evasão, onde menos é melhor).
- Gráficos de linha (Ingressantes, CPC) seguem o design: ano em foco numa
  pílula limão no eixo, anel no ponto e etiqueta escura com o valor
  (`ChartMarks`); passar o mouse muda o foco. O seletor de série é o
  `ChartSelect`: pílula escura com lista própria (painel branco, ✓ na opção
  selecionada) — o `<select>` nativo abre no estilo do sistema e não aceita
  CSS.
- Série de referência (média nacional) sempre com legenda — nunca só a cor
  diferenciando as duas.
- Não há alternância gráfico/tabela na tela: cada gráfico tem uma
  `DataTable` dentro de um `sr-only`, pra leitor de tela ler os valores
  exatos.
- O SVG do Recharts é focável: sem contorno ao clicar, anel oliva só no foco
  por teclado (`index.css`).
- Cor de status nunca aparece sozinha: sempre com seta ou texto junto.
- Números formatados em pt-BR pelos helpers de `lib/format.ts`.

---

## 7. Deploy (GitHub Pages)

Workflow em `.github/workflows/deploy-frontend.yml` (na raiz do repo). Roda em
push na `main` que mexa em `frontend/**`, nos JSONs de
`backend/app/data/processed/dashboard/` ou no próprio
workflow (ou manualmente, via _workflow_dispatch_):

1. `npm ci` → `npm run sync-data` → `npm run build` com `GITHUB_PAGES=true`.
2. Com essa variável, o `vite.config.ts` usa `base: "/PROGRAD-Analytics/"`
   (site publicado em `https://andremelo001.github.io/PROGRAD-Analytics/`).
   Localmente ela não é setada e o `base` fica `/`.
3. Publica `frontend/dist` no GitHub Pages.

Ou seja: pra atualizar os dados do site, basta rodar o backend, commitar os
JSONs novos de `dashboard/` e dar push — o deploy sai sozinho.

No repositório, **Settings → Pages → Source** precisa estar em
**GitHub Actions**.

---

## 8. Pontos conhecidos

- O bundle JS passa de 500 KB (o Vite avisa no build), quase todo pelo
  Recharts. Só o Mapa da Qualidade é `lazy` por enquanto; dá pra estender o
  code-splitting às outras rotas.
- A rota `/campus` existe, mas ainda não está nas abas.
- Trajetória, Curso e Configurações ainda são placeholders.
- O INEP registra cursos diferentes com o mesmo nome no mesmo campus (turno,
  grau): na Qualidade eles aparecem com o grau e, se preciso, o código
  (`rotulosCursos` em `lib/qualidade.ts`).
- Nas edições de 2015 a 2017 os arquivos do INEP só trazem as notas brutas
  de FG e CE (sem as padronizadas): cursos avaliados por último nesses anos
  ficam sem essas duas notas, e o mapa de calor mostra as células
  tracejadas.
- O CPC de cada curso tem no máximo 2 avaliações nos dados atuais (ciclos do
  Enade, 2020 adiado), então o gráfico de CPC tem poucos pontos por curso.
