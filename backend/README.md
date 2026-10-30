# GRAD Analytics — Backend

Pipeline Python (Poetry) do GRAD Analytics: baixa os dados do INEP, limpa,
gera os CSVs e os JSONs do painel (um por campus) que o
[frontend](../frontend/README.md) consome.

**Todos os comandos `poetry ...` deste README rodam de dentro de `backend/`**
(ou da raiz com `poetry -C backend ...`). Caminhos como `app/data/processed/`
são relativos a `backend/`.

---

## 1. Como rodar localmente

Pré-requisitos: **Python 3.12+** e **Poetry 2.x** instalados.

```bash
# 1. Entrar no backend
cd GRAD-Analytics/backend

# 2. Criar o virtualenv e instalar tudo (runtime + grupo dev)
poetry install

# 3. Instalar o git hook de pre-commit (uma vez por clone)
poetry run pre-commit install

# 4. (opcional) configurar o ambiente — o .env fica na raiz do repo
cp ../.env.example ../.env

# 5. Rodar o pipeline completo: qualidade + trajetória + JSONs do painel
poetry run python -m app.cmd all
```

`poetry install` lê `poetry.toml` + `pyproject.toml` + `poetry.lock`, cria
`backend/.venv` com Python 3.12 e instala o pacote `app`.

Outros comandos da CLI (detalhes na seção 4):

```bash
poetry run python -m app.cmd qualidade                  # só qualidade
poetry run python -m app.cmd trajetoria                 # só trajetória
poetry run python -m app.cmd dashboard                  # só os JSONs do painel (usa os CSVs já gerados)
poetry run python -m app.cmd qualidade --years 2023,2022  # subconjunto de anos
poetry run python -m app.cmd trajetoria --force         # ignora o cache, baixa tudo de novo
```

Depois de gerar os JSONs do painel, o frontend já consegue subir — ver
[`../frontend/README.md`](../frontend/README.md).

### Usar o ambiente

```bash
poetry run python -m app ...       # rodar algo dentro do ambiente
poetry env activate                # imprime o comando de ativação
source .venv/bin/activate          # ativação direta   /   deactivate para sair
```

---

## 2. Ferramentas e versões

| Ferramenta | Versão |
|---|---|
| Python | **3.12.3** |
| Poetry | **2.3.4** |

### Dependências de runtime

| Pacote | Uso |
|---|---|
| `pydantic-settings` · `pydantic` | `core/config/settings.py`, schemas dos módulos, validação do `colunas_inep.json` |
| `loguru` | `core/config/log.py` — logging |
| `pandas` · `python-calamine` | leitura das planilhas (`.xlsx` / `.xls`) e transformação |
| `httpx` · `certifi` | download dos arquivos do INEP (paralelo, ver `InepClient.download_many`) |
| `beautifulsoup4` · `lxml` | scraping das abas por ano no portal do INEP |

`python-calamine` (Rust) substitui `openpyxl`/`xlrd` na leitura — 3-6x mais rápido,
mesmo comportamento nos dois formatos.

### Dependências de desenvolvimento

| Pacote | Restrição |
|---|---|
| `ruff` | `^0.5.0` |
| `mypy` | `^1.10.1` |
| `black` | `^24.4.2` |
| `pre-commit` | `^3.7.1` |
| `import-linter` | `^2.11` |
| `pytest` · `pytest-cov` | `^9.1.1` · `^7.1.0` (testes) |
| `openpyxl` | `^3.1.5` — só para gerar fixtures `.xlsx` nos testes (não é usado em runtime) |

`[tool.mypy]` usa `plugins = ["pydantic.mypy"]`.

---

## 3. Estrutura de pastas

```
backend/
├── pyproject.toml · poetry.lock · poetry.toml
├── .gitignore
├── .venv/                   # virtualenv (gitignored)
├── app/
│   ├── cmd/
│   │   └── __main__.py      # CLI: python -m app.cmd <qualidade|trajetoria|dashboard|all>
│   ├── core/
│   │   ├── config/          # settings.py · log.py · column_mapping.py (lê o colunas_inep.json)
│   │   ├── domain/
│   │   │   ├── normalization.py # normalize_key (casa cabeçalho x "Nome Original")
│   │   │   ├── interfaces/  # Protocols: DataSource, Reader, Transformer, Exporter
│   │   │   ├── pipelines/   # DataPipeline, SpecTransformer, model_to_specs, ModuleReport
│   │   │   └── value_objects/ # RawFile, ColumnSpec
│   │   └── infrastructure/
│   │       ├── http/        # InepClient (httpx + retry) + certs/inep_ca_chain.pem
│   │       ├── scraping/    # govbr_tabs: landing → abas → links de arquivo
│   │       ├── readers/     # SpreadsheetReader (.xlsx / .xls)
│   │       └── storage/     # CsvExporter, JsonExporter, MetaWriter, dataset_locator
│   ├── data/
│   │   ├── raw/             # baixados brutos — cache local (gitignored)
│   │   └── processed/       # qualidade.csv, trajetoria.csv[.gz], _meta.json, dashboard/<campus>.json
│   └── modules/
│       ├── qualidade/       # CPC — Indicadores de Qualidade da Educação Superior
│       ├── trajetoria/      # Indicadores de Trajetória da Educação Superior
│       └── dashboard/       # recorte dos dois datasets acima para o front (ver 4.4)
└── tests/
```

Arquivos da **raiz do repo** que o backend usa:

| Arquivo | Papel |
|---|---|
| `.env` · `.env.example` | configuração do backend (lida por `app/core/config/settings.py`, ver 4.5) |
| `colunas_inep.json` | nomes das colunas do INEP + rótulos das categorias (ver 4.6) |
| `COLUNAS_INEP.md` | guia de manutenção do `colunas_inep.json` |
| `.pre-commit-config.yaml` | hooks do backend (rodam via `poetry -C backend`, ver 3.3) |
| `.editorconfig` · `.gitignore` | valem pro repo inteiro |

### 3.1. Estrutura dos módulos

Cada módulo em `app/modules/<fonte>/`:

- `domain/` — `schema.py` (`<Row>(BaseModel)`, o contrato interno: nome do
  campo = nome normalizado usado no CSV/dashboard, anotação = tipo alvo) ·
  `services/transform.py` (`<Fonte>Transformer(SpecTransformer)`). Os nomes das
  colunas nos arquivos do INEP e os rótulos das categorias **não** ficam no
  código: vêm de `colunas_inep.json` na raiz (ver [`COLUNAS_INEP.md`](../COLUNAS_INEP.md)).
- `application/` — `ports/` (Protocol `<Fonte>Source`) · `use_cases/`
  (`build_<fonte>_dataset()` monta e roda o `DataPipeline`, grava `_meta.json`)
- `infrastructure/sources/` — `Inep<Fonte>Source`: scrape + download (+ unzip)

O `SpecTransformer`, o `DataPipeline` e o `CsvExporter` são genéricos e ficam no
`core/`. Contratos de arquitetura (`import-linter`): módulos independentes ·
`domain` sem I/O · `application` sem infra pesada.

O módulo `dashboard/` segue a mesma estrutura, com duas adaptações porque a
fonte dele não é o INEP e sim os CSVs que os outros dois módulos já geraram:
`ports/dashboard_source.py` (Protocol `DashboardSource`, com
`read_qualidade()`/`read_trajetoria()` em vez de `collect()` — não estende
`DataSource` porque o formato é outro) · `infrastructure/sources/processed_csv_source.py`
(`ProcessedCsvSource`, implementa o port lendo os CSVs de
`app/data/processed/`) · e, em `domain/`, um arquivo por seção do JSON final
em `domain/services/` (A, B, C, D, E, F — ver 4.4) em vez de um
`schema.py`/`transform.py` só, já que não há um schema único a normalizar.
`domain/shared.py` (o "schema" do escopo do dashboard, `ScopedData`) e
`domain/section.py` (`DashboardContext` + Protocol `DashboardSection`, com
`key` + `build(context)`) ficam fora de `services/` por serem estrutura, não
comportamento — mesmo critério de `schema.py` ficar fora de `services/` em
qualidade/trajetória. Cada seção em `domain/services/`
termina numa classe que implementa `DashboardSection`, e `build_dashboard()`
monta o JSON iterando uma lista dessas — acrescentar uma seção nova é
registrar mais uma linha, não editar o orquestrador.

### 3.2. Arquivos auxiliares

- **`README.md`** (`backend/`) — este arquivo (setup + estrutura do backend).
- **`.env.example`** (raiz) — template comentado de todas as variáveis (ver
  4.5); **`.env`** (raiz) é a cópia local, não versionada. O `settings.py`
  acha o `.env` pelo caminho do próprio arquivo, então funciona rodando de
  `backend/` ou da raiz.
- **`.gitignore`** — um por projeto: `backend/.gitignore` (`.venv/`,
  `__pycache__/`, caches de ferramentas, **`app/data/raw/`**) e
  `frontend/.gitignore`. O da raiz tem o que vale pro repo inteiro (`.env*`
  exceto `.env.example`, `.vscode/` exceto `settings.json`, `docs/`).
  `poetry.lock` e `app/data/processed/` **são versionados**.
- **`.editorconfig`** (raiz) — LF, `max_line_length = 88`,
  Python `indent_size = 4`, YAML `indent_size = 2`.
- **`.vscode/settings.json`** (raiz) — interpretador em `backend/.venv` e
  Poetry como env/package manager (`python-envs.defaultEnvManager`). É a única
  exceção ao `.vscode/` ignorado.

### 3.3. `.pre-commit-config.yaml`

Fica na raiz (o git só procura ali), mas os hooks rodam no backend:
`poetry -C backend ...` muda o diretório de trabalho pra `backend/` antes de
executar, e `files: ^backend/.*\.py$` faz os hooks só dispararem quando algo
do backend muda. Hooks `local` / `language: system` (usam o venv do Poetry):

| Hook | Comando | Escopo |
|---|---|---|
| `black` | `poetry -C backend run black app tests` | quando muda `.py` em `backend/` |
| `ruff` | `poetry -C backend run ruff check app tests --fix` | idem |
| `mypy` | `poetry -C backend run mypy app` | idem |

O git hook é instalado com `poetry run pre-commit install` (de dentro de
`backend/`) — ele grava o caminho do Python do `backend/.venv`, então precisa
ser reinstalado se o venv for recriado.

### 3.4. Criação do virtualenv do zero

```bash
cd backend
poetry env use python3.12
poetry lock
poetry install
```

- Virtualenv em **`backend/.venv`** (Python 3.12.3).
- `poetry.lock` gerado e versionado.
- Pacote `app` instalado em modo editável.

### 3.5. Validação

```
$ cd backend
$ poetry run pre-commit run --all-files    # black · ruff · mypy
$ poetry run lint-imports                  # Contracts: 3 kept, 0 broken.
$ poetry run pytest                        # 142 passed
```

---

## 4. Pipelines de dados

Fluxo por módulo: **Extract** (scrape + download do INEP) → **Read** (planilha,
seleção de sheet + cabeçalho) → **Transform** (renomeia pelo `schema`, converte
tipos, decodifica categorias, descarta linha com valor que não converte) →
**Load** (CSV em `app/data/processed/`, com `_meta.json`).

### 4.1. Rodando o pipeline completo

Um único comando baixa e processa os dois módulos (Qualidade + Trajetória) e,
em seguida, gera os JSONs do painel (ver 4.4) a partir dos CSVs resultantes:

```bash
poetry run python -m app.cmd all
```

O que acontece, por módulo:

1. **Scrape** da página do INEP (abas por ano/faixa) — sempre roda.
2. **`HEAD`** em paralelo em cada arquivo identificado (ETag/Last-Modified/
   tamanho) — sempre roda, é rápido (não baixa o corpo).
3. **Download** (em paralelo) só dos arquivos novos ou que mudaram desde a
   última vez; o resto é reaproveitado de `app/data/raw/`.
4. Se **nada mudou em nenhum arquivo** do módulo, o `colunas_inep.json` é o
   mesmo da última vez e já existe um CSV anterior, o pipeline **para aqui** —
   não relê, não retransforma, não reexporta. Log:
   `"<módulo> sem mudanças na fonte | mantém ..."`.
5. Caso contrário: lê (planilha → DataFrame), transforma (renomeia, tipa,
   decodifica, dedup exato) e grava `app/data/processed/<módulo>.csv[.gz]` +
   atualiza `_meta.json`.

Saída esperada num run com tudo novo:

```
app/data/processed/
├── qualidade.csv        (~26 MB,  ~68 mil linhas, 8 anos: 2015-2019, 2021-2023)
├── trajetoria.csv.gz    (~68 MB, ~2,7 milhões de linhas, 11 faixas: 2010-2024)
├── dashboard/           (um JSON por campus da UFC + index.json, resumo_campi.json e areas_qualidade/, ver 4.4)
└── _meta.json           (fonte, data de geração, nº de linhas, colunas — por módulo)
```

Tempo aproximado (medido): **qualidade ~20s**, **trajetória ~6 min** do zero
(download paralelo + leitura via `calamine`); rodar de novo sem nada mudar no
INEP: poucos segundos nos dois (só os `HEAD`).

### 4.2. Rodando módulos/anos específicos

```bash
poetry run python -m app.cmd qualidade                 # só qualidade, todo o escopo padrão
poetry run python -m app.cmd trajetoria                # só trajetória
poetry run python -m app.cmd qualidade --years 2023,2022   # subconjunto de anos
poetry run python -m app.cmd trajetoria --force         # ignora o cache e o manifesto, baixa tudo de novo
```

`--force` ignora tanto `app/data/raw/` quanto o `_manifest.json` — sempre baixa
e sempre reprocessa, mesmo que nada tenha mudado no INEP. `dashboard` não aceita
`--years`/`--force` (não baixa nada, só lê CSVs já gerados) — ver 4.4.

### 4.3. Cache dos downloads

Cada módulo mantém `app/data/raw/<módulo>/_manifest.json` (gitignored) com a
URL + `ETag`/`Last-Modified`/tamanho do último download de cada ano/faixa —
usado para decidir, via `HEAD`, se o arquivo precisa ser baixado de novo.
Detalhe em `app/core/infrastructure/http/cached_download.py`.

`download.inep.gov.br` serve cadeia TLS incompleta; o `InepClient` a completa com
a intermediária em `app/core/infrastructure/http/certs/inep_ca_chain.pem`
(pasta `certs/` reservada para esse tipo de arquivo — não é código Python).

### 4.4. Módulo `dashboard`

`qualidade.csv`/`trajetoria.csv.gz` continuam com **todas** as instituições e
cursos do Brasil — isso não muda. O módulo `dashboard` lê esses dois CSVs,
recorta a instituição configurada (`DASHBOARD_CODIGO_IES`, ver 4.5) **campus por
campus** e grava um JSON por campus, pronto pro front consumir — sem precisar
reprocessar CSVs de ~68 mil/2,7 milhões de linhas no browser:

```
app/data/processed/dashboard/
├── index.json       # lista de campi: slug, nome, codigo_municipio, total_cursos, arquivo
├── crateus.json     # ~340 KB
├── fortaleza.json   # ~9 MB (103 cursos)
├── quixada.json     # ~500 KB — o campus que o site abre por padrão
├── russas.json      # ~380 KB
├── sobral.json      # ~840 KB
├── resumo_campi.json # ~270 KB: os cursos de todas as cidades, resumidos (busca, comparações entre cidades e cursos)
├── areas_qualidade/ # um JSON por área de avaliação dos cursos da UFC (~57): todos os cursos do Brasil na edição mais recente
│   ├── index.json   # slug, area_avaliacao, ano, total_cursos, arquivo
│   └── sistemas-de-informacao.json …   # 10-400 KB cada, gravados compactos
└── trajetoria_areas/ # um JSON por área CINE dos cursos da UFC (~90): a turma madura de cada curso do Brasil
    ├── index.json   # slug, area, total_cursos, arquivo
    └── direito.json …   # até ~600 KB cada, gravados compactos
```

Todos os arquivos de campus têm **exatamente a mesma estrutura** (as seções da
tabela abaixo); muda só o recorte. Os campi **não são configurados**:
`shared.discover_campi()` pega cada município onde a IES tem curso na
trajetória — campus novo publicado pelo INEP entra sozinho no próximo run; um
polo EaD que só aparece na qualidade (sem turma acompanhada) fica de fora. O
nome ("UFC em Crateús") vem da sigla da IES + município da qualidade, e o
nome do arquivo é o município sem acento. JSON de campus que deixou de existir
é apagado.

```bash
poetry run python -m app.cmd dashboard   # só o dashboard (exige qualidade.csv e trajetoria.csv[.gz] já gerados)
poetry run python -m app.cmd all         # roda os dois pipelines e o dashboard em seguida
```

Tempo aproximado (medido): **cerca de 3 min** no total — os 5 campi e os
arquivos das áreas (`areas_qualidade/`, `trajetoria_areas/`); nos campi, mais
da metade é Fortaleza — as médias nacionais e a distribuição por UF são calculadas curso a
curso sobre os ~2,7 milhões de linhas de `trajetoria.csv.gz`.

Cada seção do JSON tem seu próprio arquivo em
`app/modules/dashboard/domain/services/`, para ficar fácil de manter e de
acrescentar mais coisas (`shared.py` fica fora de `services/` por ser
estrutura, não uma seção):

| Arquivo | Chave no JSON | Conteúdo |
|---|---|---|
| `domain/shared.py` | `escopo`, `cursos` | metadados da IES/campus e catálogo de cursos no escopo |
| `domain/services/course_profile.py` | `curso_perfil` | **(A)** perfil por curso: KPIs, evolução do CPC (com as 9 notas de cada ano), radar de notas padronizadas, funil por coorte, curva de sobrevivência |
| `domain/services/course_comparison.py` | `comparacao_cursos` | **(B)** comparação entre cursos: ranking de CPC, tabela comparativa, notas por dimensão, evolução do CPC comparada |
| `domain/services/trajectory_comparison.py` | `trajetoria_comparada` | **(C)** trajetória comparada: evasão por curso (alinhada por anos-desde-o-ingresso), heatmap de evasão anual, demanda de ingressantes e de concluintes |
| `domain/services/campus_overview.py` | `campus` | **(D)** visão agregada do campus: KPIs totais, distribuição de cursos por faixa de CPC, tendência de ingressantes e de concluintes do campus por ano |
| `domain/services/national_benchmarks.py` | `medias_nacionais` | **(E)** médias nacionais do grupo de pares de cada curso, para comparar com A/C/D — ver abaixo |
| `domain/services/alerts.py` | `alertas` | **(F)** alertas automáticos (heurísticas simples) sobre os cursos do campus — ver abaixo |
| `domain/services/campus_summary.py` | — (`resumo_campi.json`) | resumo de cada curso de todos os campi num arquivo só — ver abaixo |
| `domain/services/quality_areas.py` | — (`areas_qualidade/`) | todos os cursos do Brasil de cada área de avaliação — ver abaixo |
| `domain/services/trajectory_areas.py` | — (`trajetoria_areas/`) | a turma madura de cada curso do Brasil por área CINE — ver abaixo |

`build_dashboard.py` (em `application/use_cases/`) só orquestra: lê os CSVs +
o `_meta.json` (via `DashboardSource.read_meta()`, exposto em `fontes` no
JSON final) uma vez só, descobre os campi (`shared.discover_campi`) e, para
cada campus, monta o `ScopedData` (`shared.build_scoped_data`) e chama cada
arquivo acima, reaproveitando os KPIs por curso entre as seções.

**Médias nacionais (E)**: como `qualidade.csv`/`trajetoria.csv.gz` continuam
com o Brasil inteiro, `national_benchmarks.py` recebe os dois CSVs completos
(antes do recorte) e calcula a média de cada métrica só entre os
**cursos-pares** — mesma área de avaliação (CPC/notas) ou mesma classificação
CINE (trajetória) que os cursos do campus oferecem — nunca a média de todas
as áreas do Brasil misturadas (isso compararia Direito com Engenharia). Por
isso `medias_nacionais` é um bloco à parte, não um campo dentro de cada linha
de A/C/D: o front cruza pela chave de área (`area_avaliacao` ou
`nome_cine_area_geral`, presentes nas linhas de A/C que fazem sentido
comparar) e decide como exibir.

| Chave em `medias_nacionais` | Contraparte nacional de | Chave de junção |
|---|---|---|
| `evolucao_cpc` | A2 | `area_avaliacao` + `ano` |
| `perfil_radar` | A3 | `area_avaliacao` + `ano` (só os anos em que algum curso do campus foi avaliado: as notas são padronizadas dentro de cada edição) |
| `curva_sobrevivencia` | A5 / C1 | `nome_cine_area_geral` + `anos_desde_ingresso` (não ano calendário — alinha coortes de anos diferentes) |
| `heatmap_evasao_anual` | C2 | `nome_cine_area_geral` + `ano_referencia` (ano calendário direto) |
| `campus` | D | — (já agregado, calculado só com os cursos-pares das áreas do campus) |
| `distribuicao_uf` | — (mapa "Presença no Brasil" do Início) | `codigo_curso` do campus → `estados[]` por `sigla_uf` |
| `ingressantes` | C3 | `codigo_curso` + `ano_ingresso` (média de ingressantes por curso-par: mesma área CINE, grau e modalidade) |
| `concluintes` | `demanda_concluintes` | `codigo_curso` + `ano_referencia` (média de concluintes por curso-par no ano) |
| `trajetoria_pares` | — (sem uso no painel hoje: era da comparação "Com o Brasil" da Trajetória, removida) | `codigo_curso` (evasão e conclusão dos cursos-pares na turma madura do curso) |

Cada linha nacional também traz `quantidade_cursos_considerados`, pra
transparência de quantos cursos entraram na média. **A1** (KPIs por curso) e
**A4** (funil por coorte) não têm contraparte nacional: são números
absolutos (não comparáveis entre instituições de tamanhos diferentes) ou não
têm um ponto de coorte alinhado nacionalmente — o front usa
`curva_sobrevivencia` no mesmo `anos_desde_ingresso` do curso local para
comparar de forma justa. Ingressantes e concluintes entram como **média por
curso-par** (`ingressantes`, `concluintes`), não como total.

`distribuicao_uf` é a exceção de formato: um item por curso do campus, com
os estados onde existe o **mesmo curso** — quantidade de cursos, ingressantes
e evasão média da turma mais recente, e CPC médio da avaliação mais recente.
O recorte é mais estreito que o das outras médias: além da área, exige a
mesma modalidade (curso EaD é registrado na sede e inflaria o estado dela) e,
na trajetória, o mesmo grau acadêmico (a área CINE "Sistemas de informação"
junta o bacharelado com Análise e Desenvolvimento de Sistemas). O código IBGE
da UF (`codigo_uf`, trajetória) vira sigla por `UF_SIGLAS` pra casar com
`sigla_uf` (qualidade). Detalhe dos campos em `docs/dashboard_dados.md`.

**Curso a curso (A2/A3)**: `evolucao_cpc` traz também a participação no
Enade de cada edição (`n_concluintes_inscritos`,
`n_concluintes_participantes`, `taxa_participacao` em %) e as 9 notas
padronizadas de cada componente naquele ano (a linha do tempo dos
componentes, no Por curso); `perfil_radar` traz só a avaliação mais recente,
com o `ano` e o CPC/faixa/Enade da mesma avaliação das notas.

**Áreas de avaliação (`areas_qualidade/`)**: `domain/services/quality_areas.py` grava,
para cada área de avaliação em que algum curso da UFC foi avaliado por último,
**todos os cursos do Brasil** da edição mais recente da área — CPC, faixa,
as 9 notas padronizadas, modalidade, IES e município, e a coluna `historico` com todas as edições de cada curso (ano, CPC, faixa, concluintes inscritos e participantes; ordem em `colunas_edicao`). É o Mapa da aba
Qualidade, que agrega por estado/município, filtra por rede (pública/privada,
pela categoria administrativa do INEP) e calcula percentis no próprio front.
Formato colunar (`colunas` + uma lista por curso, IES e municípios em
dicionários à parte) e JSON compacto: a maior área (Administração, ~1.800
cursos) fica com ~400 KB (~110 KB comprimido). Um arquivo por área, compartilhado pelos campi.
A sigla da IES vem do INEP, que registra `"0"` para várias instituições sem
sigla: valor sem letras vira `null` (`quality_areas.sigla_ies`), e o front
mostra o nome.

**Áreas CINE (`trajetoria_areas/`)**: `domain/services/trajectory_areas.py`
grava, para cada área CINE dos cursos da UFC, **a turma madura de cada curso
do Brasil** — IES, município, grau, modalidade, prazo, ano de ingresso,
ingressantes e a curva (permanência, conclusão e desistência acumuladas, ano
a ano). É o Mapa e o "entre cursos da mesma área" das Comparações da aba
Trajetória. Mesmo formato colunar e compacto do `areas_qualidade/`.

**Resumo dos campi (`resumo_campi.json`)**:
`domain/services/campus_summary.py` resume cada curso de cada campus (área,
ano, CPC, faixa, Enade, IDD e as 9 notas da avaliação mais recente, as
edições do CPC em `historico`, e a turma madura em `trajetoria` — área CINE,
grau, prazo, ingressantes e a curva) num arquivo só, pra busca e pra
comparar campi e cursos sem baixar o JSON de cada campus.

**Alertas automáticos (F)**: pensado para a tela inicial (o painel ainda não
exibe alertas; o bloco segue no JSON pras próximas páginas) —
`alertas.itens` é uma lista (pode vir vazia) de heurísticas já calculadas,
cada uma com `tipo`, `severidade` (`atencao`/`critico`), `mensagem` (texto
pronto, com decimal em pt-BR) e `cursos` (quais cursos motivaram o alerta):
cursos sem CPC no ciclo atual, cursos em faixa de CPC baixa (1-2) e cursos
com evasão acima da **média do próprio campus** (não a nacional — usar
`medias_nacionais` aqui duplicaria a varredura dos ~2,7 milhões de linhas de
trajetória por pouco ganho).

**`fontes`**: bloco no topo do JSON (irmão de `escopo`/`cursos`) com
`gerado_em`/`linhas` de cada CSV fonte, lido do `_meta.json` via
`DashboardSource.read_meta()` — pra mostrar na tela "dados atualizados em
tal data" sem o front precisar abrir um segundo arquivo.

### 4.5. Configuração via `.env`

Os parâmetros abaixo vêm de `app/core/config/settings.py` (`pydantic-settings`)
e podem ser trocados **sem mexer em código** — copie `.env.example` para `.env`
(os dois na raiz do repo) e edite:

| Variável | Default | Para que serve |
|---|---|---|
| `QUALIDADE_LANDING_URL` | URL do portal de Indicadores de Qualidade | se o INEP mudar a página |
| `TRAJETORIA_LANDING_URL` | URL do portal de Indicadores de Trajetória | se o INEP mudar a página |
| `QUALIDADE_MIN_YEAR` / `QUALIDADE_MAX_YEAR` | `2015` / `2025` | janela de anos do CPC processada por padrão (sem `--years`) |
| `TRAJETORIA_MIN_YEAR` / `TRAJETORIA_MAX_YEAR` | vazio (sem restrição) | idem, para a Trajetória — vazio processa todas as faixas da página |
| `HTTP_MAX_RETRIES` / `HTTP_BACKOFF` | `3` / `2.0` | tentativas e espera (segundos, exponencial) em cada request ao INEP |
| `HTTP_TIMEOUT` | `30.0` | timeout (segundos) de cada request |
| `HTTP_USER_AGENT` | `GRAD-Analytics/0.1 (data pipeline)` | header enviado ao INEP |
| `CSV_GZIP_THRESHOLD_MB` | `40` | acima disso o CSV final vira `.csv.gz` |
| `LOG_LEVEL` | `INFO` | nível de log (`DEBUG`, `INFO`, `WARNING`, ...) |
| `DASHBOARD_CODIGO_IES` | `583` (UFC) | código INEP da IES; cada campus dela vira um JSON em `dashboard/` |
| `COLUNAS_INEP_FILE` | `colunas_inep.json` (raiz) | caminho do arquivo de nomes de colunas/categorias (ver 4.6) |

`QUALIDADE_MIN_YEAR=2015` não é um ajuste arbitrário: antes disso o CPC tem
outro grão (IES × Área, sem `Código do Curso`) — mudar exige revisar
`app/modules/qualidade/domain/schema.py` e o `colunas_inep.json`, não só o `.env`.

Parâmetros de **parsing** (padrões de nome de sheet/arquivo, linha do
cabeçalho) ficam no código, não no `.env` — são acoplados à estrutura exata
dos arquivos do INEP; um valor errado quebra a leitura em silêncio.

### 4.6. Nomes das colunas do INEP (`colunas_inep.json`)

Os nomes que cada coluna tem nas planilhas do INEP e os rótulos das categorias
codificadas ficam fora do código, em **`colunas_inep.json`** (raiz do repo) —
se o INEP renomear uma coluna, o ajuste é feito ali, sem mexer em código. O
passo a passo de manutenção (como identificar, editar, validar e os avisos
conhecidos) está no guia separado **[`COLUNAS_INEP.md`](../COLUNAS_INEP.md)**.

Continuam no código de propósito o nome interno e o tipo de cada coluna
(`schema.py` de cada módulo): coluna nova ou mudança de tipo afeta o CSV final
e o dashboard, então é mudança de código de qualquer jeito. Quando o
`colunas_inep.json` muda, o pipeline percebe (hash gravado como
`mapping_fingerprint` no `_meta.json`) e reprocessa a partir dos arquivos em
cache, sem precisar de `--force`.

---

## 5. Ferramentas de qualidade

```bash
poetry run black .                 # formatar
poetry run ruff check app tests --fix   # lint + autofix
poetry run mypy app                # checagem de tipos
poetry run lint-imports            # contratos de import (import-linter)
poetry run pre-commit run --all-files   # roda os 3 hooks em tudo
poetry run pytest                  # testes
```

## 6. Gerenciar dependências

```bash
poetry add <pacote>                     # dependência de runtime
poetry add --group dev <pacote>         # dependência de desenvolvimento
poetry remove <pacote>
poetry show --tree
poetry update                           # atualiza dentro das restrições + regrava o lock
```

Sempre faça commit de `pyproject.toml` **e** `poetry.lock` juntos.
