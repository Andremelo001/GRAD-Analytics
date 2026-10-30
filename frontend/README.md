# GRAD Analytics — Frontend

SPA React do GRAD Analytics: lê os JSONs do painel gerados pelo
[backend](../backend/README.md) — um por campus da UFC — e mostra os
indicadores do campus escolhido no seletor de campus (padrão: Quixadá).
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
cd GRAD-Analytics/frontend

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
├── vite.config.ts           # base do GitHub Pages (nome do repositório) + alias @ → src/
├── tsconfig.json · tsconfig.node.json
├── eslint.config.js · .prettierrc.json
├── components.json          # config do shadcn/ui
├── index.html               # favicon = src/assets/brasao.png; aplica o tema antes da 1ª pintura
├── .gitignore
├── scripts/
│   ├── sync-data.mjs        # copia backend/.../dashboard/ → public/data/dashboard/
│   ├── build-brazil-dots.mjs # gera src/assets/brazil-dots.json (roda uma vez, ver 6)
│   └── build-brazil-geo.mjs  # gera src/assets/brazil-geo.json (roda uma vez, ver 6)
├── public/
│   └── data/dashboard/      # index.json, JSON de cada campus, resumo_campi.json, areas_qualidade/ e trajetoria_areas/ (gitignored, gerado pelo sync-data)
├── designs_pages/           # imagem do design de referência (gitignored)
└── src/
    ├── main.tsx             # entrada: fonte + CSS + <App />
    ├── App.tsx              # ThemeProvider + DashboardDataProvider + RouterProvider
    ├── router.tsx           # rotas (ver 5)
    ├── index.css            # Tailwind + tokens de cor/fonte (claro, escuro e cores acessíveis)
    ├── assets/              # brasao.png (logo) · brazil-dots.json (mapa em pontos) · brazil-geo.json (contornos das UFs + centroides dos municípios)
    ├── types/
    │   ├── dashboard.ts     # tipos que espelham o JSON de cada campus (e o resumo_campi.json)
    │   ├── qualidade-area.ts # tipos dos JSONs de areas_qualidade/ (todos os cursos do Brasil numa área de avaliação)
    │   └── trajetoria-area.ts # tipos dos JSONs de trajetoria_areas/ (a turma madura de cada curso do Brasil numa área CINE)
    ├── context/             # DashboardDataProvider (índice + campus escolhido + campus ao abrir) · ThemeProvider (tema + cores acessíveis) · slots do PageHeader · contexto do modo apresentação
    ├── hooks/               # useDashboardData · useTheme · useChartTheme (paleta do tema) · useMediaQuery · usePresentationMode
    │                        # useElementSize/useElementWidth · useActiveIndicator (sublinhado/pílula que desliza) · useAlturaDisponivel (Mapa sem rolar)
    │                        # useQualidadeArea / useTrajetoriaArea (arquivos das áreas sob demanda) · useResumoCampi · useAbrirNoCampus (abrir curso de outro campus)
    ├── lib/
    │   ├── utils.ts         # cn()
    │   ├── format.ts        # formatPercent, formatPoints, formatDecimal, formatInteger, toTitleCase, normalizeForSearch
    │   ├── cpc.ts           # composição do CPC: os 9 componentes e pesos, limites das faixas, contribuição, quanto falta
    │   ├── qualidade.ts     # buildAvaliacoes: cada curso com a avaliação mais recente, o histórico, a média nacional e o ciclo anterior
    │   ├── trajetoria.ts    # buildTrajetorias: turmas de cada curso (curva + funil), turmas maduras, indicadores do INEP (TAP, TCA, TDA…)
    │   ├── area.ts          # cursos de uma área de avaliação (Mapa da Qualidade): parse do formato colunar, resumo por estado/município, filtros
    │   ├── trajetoria-mapa.ts # indicadores e resumo por estado do Mapa da Trajetória
    │   ├── comparacao.ts    # resumo de um campus pras Comparações (nomeCampus, médias)
    │   ├── curso.ts         # opções dos seletores de curso (código · grau) e siglaValida (sigla da IES)
    │   ├── curso-por-curso.ts # o curso aberto no Por curso, que o Mapa e as Comparações da aba seguem
    │   ├── ultima-subaba.ts # última sub-aba aberta em cada aba (o menu reabre nela)
    │   ├── fontes.ts        # as bases do INEP (nome + link) mostradas no "i" dos cards
    │   ├── rolar.ts         # rolar uma lista até a opção ativa
    │   └── uf.ts            # sigla -> nome do estado
    ├── components/
    │   ├── layout/          # AppLayout (faixa escura + topo), Sidebar (abas), SubTabs (sub-abas em pílula), PageHeader, ThemeToggle, PresentationToggle, PresentationBar, CampusSelect, DataState, Esqueleto (esqueletos de carregamento)
    │   ├── cards/           # Card (ampliável), Tile (indicador do topo das sub-abas), StatTile (taxa + mini gráfico: o MiniSerieAnual no desktop, sparkline no celular), IconeInfo (o "i" com texto e fonte), NotaRodape, ampliado.ts (classes pra card ampliado)
    │   ├── charts/          # SerieAnualCard (ingressantes/concluintes; e o MiniSerieAnual, a versão reduzida dos tiles de taxa), CpcComparativoCard, CursoNacionalLinha (curso × média ano a ano), BrasilMapaCard, EvasaoHeatmapCard,
    │   │                    # ChartMarks, ChartSelect, Segmentado, TextoAjustado, DataTable, chart-theme
    │   │   ├── qualidade/   # cards da aba Qualidade (ver 5) + CursoBusca (seletor com busca), DeltaPill, FaixaPill, ModoToggle
    │   │   └── trajetoria/  # cards da aba Trajetória (ver 5)
    │   └── search/          # CourseSearch (busca de curso no topo)
    └── pages/               # uma por rota (ver 5); pages/qualidade/ e pages/trajetoria/ = sub-abas
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
   os campi, com notas e edições do CPC e a turma madura de cada um, pra
   comparar campi e cursos e pra busca), `areas_qualidade/` — um JSON por
   área de avaliação dos cursos da UFC, com todos os cursos do Brasil na
   edição mais recente da área (Mapa e Comparações da Qualidade) — e
   `trajetoria_areas/` — um JSON por área CINE, com a turma madura de cada
   curso do Brasil (Mapa e Comparações da Trajetória); cada pasta com o seu
   `index.json`.
2. `scripts/sync-data.mjs` copia a pasta inteira para
   `frontend/public/data/dashboard/` — roda sozinho antes de `dev` e `build`
   (`predev`/`prebuild`).
3. `DashboardDataProvider` (em `App.tsx`) busca o `index.json` e o JSON do
   campus escolhido, em `${import.meta.env.BASE_URL}data/dashboard/` — o
   `BASE_URL` já inclui o prefixo do GitHub Pages no build de produção. O
   campus inicial é o fixado em Configurações ("Campus ao abrir o painel",
   chave `prograd-campus-inicial` no `localStorage`), senão o último escolhido
   (`prograd-campus`), senão Quixadá. JSONs já baixados ficam em cache.
4. O seletor de campus (`CampusSelect`, ao lado das sub-abas) troca o
   campus; os dados antigos seguem na tela até os novos chegarem (a seta do
   seletor vira um indicador de carga) e os cards remontam — cursos e focos
   escolhidos voltam ao padrão do novo campus. A busca e o "nos outros
   campi" abrem cursos de outro campus com `useAbrirNoCampus`: o painel
   troca de campus e navega quando o JSON novo chega.
5. As páginas leem os dados com `useDashboardData()` (`{ data, loading, error,
campi, campus, setCampus, switching, campusAoAbrir, setCampusAoAbrir }`) e
   usam `DataState` pra mostrar o esqueleto da página enquanto carrega e o
   erro, se houver.

`types/dashboard.ts` espelha a estrutura do JSON (seções A-F, `fontes`,
`medias_nacionais` — descritas em [`../backend/README.md`](../backend/README.md),
seção 4.4). Se o backend mudar uma chave, esse arquivo muda junto.

Não há backend em runtime: o site é só HTML/JS/CSS + JSONs estáticos. O de
Fortaleza (~100 cursos) passa de 9 MB — é baixado só quando escolhido. Os de
`areas_qualidade/` e `trajetoria_areas/` (centenas de KB cada, bem menos
comprimidos) só quando o Mapa ou as Comparações entre cursos abrem, um por
área, e ficam em cache na sessão (`useQualidadeArea`, `useTrajetoriaArea`); o
`resumo_campi.json`, na busca e nas Comparações.

---

## 5. Rotas e páginas

Três abas principais (`Sidebar`), cada uma com sub-abas em pílula
(`SubTabs`, prop `tabs` do `PageHeader`) e rota própria por sub-aba. O link
de cada aba reabre a última sub-aba aberta nela (`lib/ultima-subaba.ts`).

| Rota                         | Página                                                                                                                   | Onde                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `/`, `/inicio/…`             | `HomePage` + sub-abas (ver abaixo)                                                                                       | Início                                                |
| `/qualidade/…`               | `QualidadePage` + sub-abas (ver abaixo)                                                                                  | Qualidade                                             |
| `/trajetoria/…`              | `TrajetoriaPage` + sub-abas (ver abaixo)                                                                                 | Trajetória                                            |
| `/configuracoes`             | `ConfiguracoesPage` — tema (claro, escuro, automático), campus ao abrir o painel e cores acessíveis, salvos no navegador | engrenagem no topo (tela à parte, com seta de voltar) |
| `/campus`, `/cursos/:codigo` | `CampusPage`, `CursoDetalhePage` (placeholders)                                                                          | — (rotas existem, fora da navegação)                  |

### Início

O curso escolhido no seletor do cabeçalho vale nas três sub-abas.

| Rota               | Sub-aba              | Cards                                                                                                        |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/inicio/ingresso` | Ingresso e conclusão | ingressantes e concluintes por ano (`SerieAnualCard`), do campus ou do curso, × média nacional               |
| `/inicio/cpc`      | Qualidade            | presença no Brasil (mapa em pontos) · CPC ou Conceito Enade do curso × média nacional (`CpcComparativoCard`) |
| `/inicio/evasao`   | Trajetória           | evasão anual por curso (mapa de calor cursos × anos) · taxas de conclusão e de evasão (`StatTile`)           |

### Aba Qualidade

Por que o CPC de cada curso é o que é, onde dá para melhorar e como ele se
compara ao país.

| Rota                       | Página            | Cards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/qualidade/campus`        | `VisaoCampusPage` | 4 indicadores (CPC médio × Brasil, maior avanço no CPC desde o ciclo anterior, Conceito Enade médio × Brasil, cursos com CPC) · ranking dos cursos (ordenável; a linha abre o curso) · evolução entre ciclos (slope chart sobre as faixas; CPC ou Conceito Enade) · mapa de calor cursos × 9 componentes                                                                                                                                                                                                                                                                                                                        |
| `/qualidade/curso/:codigo` | `PorCursoPage`    | ficha da avaliação + seletor (CPC e Conceito Enade com a faixa) · "De onde vem a nota" (nota × peso de cada componente) · "CPC: próxima faixa" e "Conceito Enade: próxima faixa" (régua das faixas, empilhadas na altura do card ao lado) · componentes do CPC ao longo do tempo (nota do componente escolhido × média nacional, ano a ano) · curso × média nacional por componente · participação no Enade                                                                                                                                                                                                                     |
| `/qualidade/mapa`          | `MapaPage` (lazy) | Brasil por estado (indicador: CPC médio, IDD médio ou Conceito Enade médio; filtro de rede); clicar num estado dá zoom e mostra os municípios; no desktop o mapa e o painel cabem na tela sem rolar (`useAlturaDisponivel`) · painel do recorte: cursos, média × Brasil, % nas faixas 4 e 5, notas médias do estado × as do curso do campus e os melhores cursos, com o curso do campus na posição em que fica (ou ficaria, num estado em que ele não está)                                                                                                                                                                     |
| `/qualidade/comparacoes`   | `ComparacoesPage` | dois modos (modo e lados na URL `?modo=…&a=…&b=…`), com os dois seletores separados por um "×": **entre campi** — dois campi da UFC lado a lado (CPC médio, % nas faixas 4 e 5, Enade e IDD médios, notas médias dos 9 componentes em barras espelhadas e as áreas em comum numa régua de CPC) · **entre cursos da mesma área** — um curso do campus escolhido (A) contra qualquer curso da mesma área no Brasil (B, com busca por instituição ou cidade), na edição mais recente da área: indicadores, componentes espelhados e a participação no Enade em cada edição. A em oliva, B em violeta (par validado nos dois temas) |

### Aba Trajetória

O que acontece com as turmas depois que entram: quantas se formam, quantas
desistem e quando. Só entram nas comparações as turmas **maduras** (que já
tiveram o prazo do curso e mais dois anos para se formar).

| Rota                        | Página                             | Cards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/trajetoria/panorama`      | `PanoramaPage` ("Visão do campus") | 4 indicadores (conclusão × Brasil, evasão no 1º ano, tempo até concluir, turmas em andamento) · situação final por curso · em que ano do curso a evasão acontece                                                                                                                                                                                                                                                                                                                                                              |
| `/trajetoria/curso/:codigo` | `PorCursoTrajetoriaPage`           | ficha do curso + seletores de curso e turma · alunos do curso (entraram, concluíram, desistiram, cursando) · o caminho de uma turma (área empilhada ano a ano) · permanência × Brasil · indicadores do INEP (TAP, TCA, TDA) · triângulo das turmas (evasão acumulada de cada turma, ano a ano) · conclusão no prazo e com atraso. A turma escolhida vale em todos os cards                                                                                                                                                    |
| `/trajetoria/mapa`          | `MapaTrajetoriaPage` (lazy)        | o mesmo curso (área CINE, grau e modalidade) pelo Brasil, por estado, na turma madura de cada curso: Taxa de Permanência, de Conclusão Acumulada ou de Desistência Acumulada (média pesada pelos ingressantes); filtro de rede · painel do recorte: cursos, taxa média × Brasil, ingressantes, situação final do estado × a do curso do campus e as maiores (ou, na desistência, menores) taxas, com o curso do campus posicionado. Usa o mesmo mapa da Qualidade (`BrasilQualidadeMapa`, que recebe o indicador como função) |
| `/trajetoria/comparacoes`   | `ComparacoesTrajetoriaPage`        | dois modos, como na Qualidade: **entre campi** (turmas maduras de todos os cursos) e **entre cursos da mesma área** (um curso do campus contra qualquer curso da mesma área CINE, grau e modalidade no Brasil): indicadores, desistência a cada ano do curso (barras espelhadas), situação final e permanência ano a ano lado a lado                                                                                                                                                                                          |

O curso aberto no Por curso de uma aba é o que o Mapa e as Comparações entre
cursos da mesma aba mostram, quando a URL deles não traz outro
(`lib/curso-por-curso.ts`); escolher um curso lá não muda o Por curso. A
busca do topo abre o curso no Por curso de Qualidade ou de Trajetória (o
usuário escolhe), trocando de campus se preciso, e deixa a outra aba no mesmo
curso.

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
`/GRAD-Analytics/qualidade` daria 404 porque esse arquivo não existe no
servidor. Com hash, a rota nunca vai pro servidor.

---

## 6. Design

- **Referência**: a imagem em `designs_pages/` (gitignored). Faixa escura no
  topo com linhas onduladas finas, plano cinza-claro embaixo, cards brancos
  de cantos bem arredondados e sombra difusa, verde-limão como acento.
- **Header** (`AppLayout`): brasão da UFC + "Analytics" em texto branco à
  esquerda, seguidos dos botões de tema (sol/lua) e de apresentação (em
  bolinha) e da engrenagem de Configurações (só o ícone); a busca à direita.
  Abaixo, a saudação (`PageHeader`) e as abas de navegação (`Sidebar` — o
  nome ficou do layout anterior, hoje são abas horizontais com sublinhado
  limão). Configurações é uma tela à parte: o mesmo topo, sem busca, abas e
  botões, com uma seta no canto superior esquerdo (onde fica o X do modo
  apresentação) que volta pra página de onde se veio. A faixa escura tem altura fixa por largura de tela e desce até cobrir só
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
  ciclos cresce até a altura do ranking; a participação no Enade, até a de
  "Curso × média nacional"; as réguas "CPC: próxima faixa" e "Conceito Enade:
  próxima faixa", empilhadas, dividem a altura de "De onde vem a nota").
- **Card ampliado** (`Card expansivel`): clicar num card o amplia no centro
  da tela, com o fundo desfocado (Esc, o X ou um clique fora fecham). É o
  mesmo card que muda de lugar, então seletores e foco continuam. Com
  `expansivel="tela"` ele ganha uma altura grande fixa e o conteúdo se
  ajusta com as classes de `cards/ampliado.ts` (gráficos crescem, listas
  mostram tudo e rolam o resto).
- **"i" dos cards** (`IconeInfo`): clicar abre um painel ao lado do ícone, no
  estilo da lista dos seletores, com o título do card, o que ele mostra e a
  fonte dos dados com o link para a base do INEP (`lib/fontes.ts`; a fonte
  sai da aba aberta, ou da prop `fontes` do card).
- **Troca de abas**: o sublinhado limão das abas e a pílula limão das
  sub-abas deslizam até a escolhida (`useActiveIndicator`); o conteúdo novo
  entra com um fade curto subindo alguns px (classe `.entrada` em
  `index.css`, num contêiner com `key` da aba — em `AppLayout` pra aba
  principal, na página de cada aba pra sub-aba, então o cabeçalho fica
  parado ao trocar de sub-aba). Trocar de aba com a página rolada volta
  ao topo. O código do Mapa da Qualidade é pré-carregado quando a Qualidade
  abre (`mapa-loader.ts`); o da Trajetória carrega ao abrir a sub-aba. Até o
  código ou os dados chegarem, cada página mostra um esqueleto dos cards
  (`Esqueleto.tsx`). Com "reduzir movimento" no sistema, nada
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
- **Início** (`lg+`, grade de 12 colunas, cards na altura da tela): Ingresso
  e conclusão = Ingressantes (6) + Concluintes (6); Qualidade = Presença no
  Brasil (4) + CPC/Conceito Enade curso × média nacional (8); Trajetória =
  evasão anual por curso — mapa de calor cursos × anos (8) + taxas de
  conclusão e evasão empilhadas (4). Abaixo de `lg` tudo vira uma coluna.
  Nenhum card muda de altura ao trocar o curso/turma nos seletores: legenda
  em linhas fixas, subtítulo e frases de contexto em uma linha só (truncam),
  botão do seletor na largura da opção mais longa.
- **Tema claro/escuro**: botão sol/lua à direita do logo (`ThemeToggle`) ou
  Configurações (claro, escuro ou automático). O `ThemeProvider` põe a
  classe `dark` no `<html>` e guarda a escolha no `localStorage`
  (`prograd-theme`); sem escolha salva, segue a preferência do sistema. As
  **cores acessíveis** (Configurações, `prograd-cores-acessiveis`) trocam o
  par limão/vermelho dos cards e gráficos por azul/laranja, pra daltonismo. Um script inline no `index.html` aplica o tema antes da primeira
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
  (`ChartMarks`); passar o mouse muda o foco. O desenho "curso × média
  nacional ano a ano" fica em `CursoNacionalLinha` (usado pelo CPC do Início e
  pelos componentes do CPC no Por curso). Seletores: `ChartSelect` (pílula
  escura com lista própria — o `<select>` nativo abre no estilo do sistema e
  não aceita CSS; também na versão `inline`, dentro de frases), `Segmentado`
  (duas ou três opções à vista, ex.: CPC / Conceito Enade) e `CursoBusca`
  (seletor com busca, o padrão dos cursos; `compacto` dentro dos cards).
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
2. Com essa variável, o `vite.config.ts` usa como `base` o nome do
   repositório (`/GRAD-Analytics/`, lido de `GITHUB_REPOSITORY`, que o
   GitHub Actions preenche) — site publicado em
   `https://andremelo001.github.io/GRAD-Analytics/`. Renomear o repositório
   não quebra o site. Localmente ela não é setada e o `base` fica `/`.
3. Publica `frontend/dist` no GitHub Pages.

Ou seja: pra atualizar os dados do site, basta rodar o backend, commitar os
JSONs novos de `dashboard/` e dar push — o deploy sai sozinho.

No repositório, **Settings → Pages → Source** precisa estar em
**GitHub Actions**.

---

## 8. Pontos conhecidos

- O bundle JS passa de 500 KB (o Vite avisa no build), quase todo pelo
  Recharts. Só os dois Mapas são `lazy` por enquanto; dá pra estender o
  code-splitting às outras rotas.
- As rotas `/campus` e `/cursos/:codigo` existem, mas são placeholders fora
  da navegação.
- O INEP registra cursos diferentes com o mesmo nome no mesmo campus (turno,
  grau): na Qualidade eles aparecem com o grau e, se preciso, o código
  (`rotulosCursos` em `lib/qualidade.ts`).
- Nas edições de 2015 a 2017 os arquivos do INEP só trazem as notas brutas
  de FG e CE (sem as padronizadas): cursos avaliados por último nesses anos
  ficam sem essas duas notas, e o mapa de calor mostra as células
  tracejadas.
- O CPC de cada curso tem no máximo 3 avaliações nos dados atuais (ciclos do
  Enade, 2020 adiado), então os gráficos ano a ano têm poucos pontos por
  curso.
- O INEP registra várias IES com a sigla "0": na leitura dos arquivos das
  áreas ela é descartada (`siglaValida`) e aparece o nome da instituição.
