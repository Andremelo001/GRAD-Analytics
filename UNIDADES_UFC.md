# Guia: unidades acadêmicas da UFC (`unidades_ufc.json` e `unidades_ufc_ajustes.json`)

Este guia é pra quem precisa manter o sistema funcionando quando **um curso
não aparece na unidade certa** do painel, ou quando o **SIGAA muda a lista de
cursos** (curso novo, curso extinto, unidade renomeada) — sem precisar mexer
em código. São dois arquivos, os dois na raiz do repositório (ao lado deste
guia):

| Arquivo | Quem escreve | Pode editar à mão? |
|---|---|---|
| **`unidades_ufc.json`** | o pipeline, copiando a página de cursos do SIGAA | **Não.** É regerado a cada execução; o que for editado à mão se perde. |
| **`unidades_ufc_ajustes.json`** | você | **Sim.** É aqui que se trabalha. O pipeline nunca reescreve este arquivo. |

---

## 1. Pra que servem esses arquivos

O painel mostra os cursos da UFC **unidade por unidade**: os centros,
faculdades e institutos de Fortaleza (como o CCA - Centro de Ciências Agrárias
ou a FEAAC) e os campi do interior (Crateús, Quixadá, Russas e Sobral).

Os dados dos cursos vêm do **INEP**, mas o INEP só informa a **cidade** de cada
curso, não a unidade. A unidade vem da página pública de cursos de graduação
do **SIGAA da UFC**:

> https://si3.ufc.br/sigaa/public/curso/lista.jsf?nivel=G&aba=p-ensino

O sistema copia essa página inteira para o **`unidades_ufc.json`** e, a partir
dele, descobre a unidade de cada curso do INEP. Como o SIGAA não traz o código
do curso no INEP (o código e-MEC), essa ligação é feita **pelo nome do curso**,
na mesma cidade e na mesma modalidade (presencial ou a distância). Ex.: o curso
`AGRONOMIA` do INEP, em Fortaleza, presencial, casa com o `AGRONOMIA` que o
SIGAA lista na unidade `CCA - CENTRO DE CIÊNCIAS AGRÁRIAS`.

Quase sempre isso basta. Quando não basta (curso que saiu do SIGAA, nome muito
diferente entre os dois, unidade que não deve ser usada), a correção é feita no
**`unidades_ufc_ajustes.json`**.

---

## 2. Como saber que é preciso mexer

Rode o pipeline normalmente (ver seção 5). Se algum curso do INEP não casou com
nenhuma unidade do SIGAA, aparece um aviso assim no log:

```
REVISAR | 1 curso(s) sem unidade no SIGAA -> 'UFC em Fortaleza' (fortaleza). Fixe a unidade em unidades_ufc_ajustes.json: 150113 ENGENHARIA DE PETRÓLEO
```

Leia assim:

- **`1 curso(s) sem unidade no SIGAA`** — quantos cursos ficaram sem unidade.
- **`-> 'UFC em Fortaleza' (fortaleza)`** — pra onde eles foram por enquanto: um
  grupo provisório com a cidade inteira, que aparece no seletor do painel como
  "UFC em Fortaleza". **O curso não some do painel**, só fica fora da unidade
  certa.
- **`150113 ENGENHARIA DE PETRÓLEO`** — o **código do curso no INEP** e o nome.
  O código é o que vai no arquivo de ajustes (seção 4.1).

Se aparecer esse grupo "UFC em …" no seletor de unidade do painel, é sinal de
que esse aviso apareceu.

Outro aviso possível, quando um ajuste aponta pra uma unidade que não existe:

```
REVISAR | unidades_ufc_ajustes.json: curso 150113 -> unidade 'CTT' inexistente
```

Isso quase sempre é erro de digitação na sigla (aqui, `CTT` em vez de `CT`), ou
uma unidade que mudou de sigla no SIGAA (seção 4.3).

---

## 3. Como os arquivos são organizados

### 3.1. `unidades_ufc.json` (gerado — só consulta)

Guarda **tudo o que a página do SIGAA mostra**, mesmo o que o painel não usa:

```json
{
  "gerado_em": "2026-11-01T12:51:25+00:00",
  "fonte": "https://si3.ufc.br/sigaa/public/curso/lista.jsf?nivel=G&aba=p-ensino",
  "total_unidades": 22,
  "total_cursos": 170,
  "titulo": "Consulta de Cursos - GRADUAÇÃO",
  "descricao": ["Através desta página você pode consultar os cursos de ..."],
  "nivel": "G",
  "modalidades_filtro": ["A Distância", "Presencial", "Semi-Presencial"],
  "colunas": ["Nome", "Sede", "Modalidade", "Coordenador"],
  "unidades": [
    {
      "rotulo": "CCA - CENTRO DE CIÊNCIAS AGRÁRIAS",
      "sigla": "CCA",
      "nome": "CENTRO DE CIÊNCIAS AGRÁRIAS",
      "sedes": ["FORTALEZA"],
      "total_cursos": 7,
      "cursos": [
        {
          "nome": "AGRONOMIA",
          "sede": "FORTALEZA",
          "modalidade": "Presencial",
          "coordenador": "...",
          "id_sigaa": 123456,
          "url_portal": "https://si3.ufc.br/sigaa/public/curso/portal.jsf?id=123456&lc=pt_BR"
        },
        ...
      ]
    },
    ...
  ]
}
```

| Campo | O que é |
|---|---|
| `gerado_em` · `fonte` | quando e de onde a página foi lida |
| `total_unidades` · `total_cursos` | contagens, pra conferir de relance se a página veio inteira |
| `titulo` · `descricao` · `nivel` · `modalidades_filtro` · `colunas` | o cabeçalho da página, o filtro de modalidade do formulário e os títulos das colunas da tabela, como no SIGAA |
| `unidades[].rotulo` | o nome da unidade exatamente como na página. **É o que o painel mostra no seletor de unidade.** |
| `unidades[].sigla` | a parte antes do primeiro " - " do rótulo (`CCA`). **É a sigla usada no arquivo de ajustes** e o nome do arquivo da unidade no painel (`cca.json`). |
| `unidades[].nome` | o resto do rótulo (`CENTRO DE CIÊNCIAS AGRÁRIAS`) |
| `unidades[].sedes` | as cidades dos cursos da unidade |
| `cursos[].nome` · `sede` · `modalidade` | as colunas da tabela do SIGAA; são os três dados usados pra casar com o INEP |
| `cursos[].coordenador` | coordenador do curso; `null` quando o SIGAA deixa a célula vazia (é comum: 44 dos 170 cursos hoje) |
| `cursos[].id_sigaa` · `url_portal` | o código do curso no SIGAA e o link "Visualizar Página do Curso" |

Pra procurar a sigla de uma unidade, abra este arquivo e busque pelo nome (ex.:
`TECNOLOGIA`) — a sigla está logo acima, em `"sigla"`.

### 3.2. `unidades_ufc_ajustes.json` (editado à mão)

```json
{
  "_sobre": "Ajustes manuais do casamento curso do INEP -> unidade ...",
  "unidades_ignoradas": {
    "CUFCCARIRI": "Campus do Cariri: hoje é a UFCA, outra instituição no INEP ..."
  },
  "cursos": {
    "150113": {
      "unidade": "CT",
      "motivo": "Engenharia de Petróleo: sem turma nova desde 2020, ..."
    }
  }
}
```

| Bloco | Pra que serve | Formato de cada linha |
|---|---|---|
| **`cursos`** | Fixa a unidade de um curso do INEP, quando o casamento pelo nome não resolve. **Vale mais que o nome**: se o curso está aqui, a sigla daqui é a usada. | à esquerda, o **código do curso no INEP**, entre aspas (`"150113"`); à direita, `"unidade"` com a **sigla** do `unidades_ufc.json` (`"CT"`) e `"motivo"` com uma explicação livre |
| **`unidades_ignoradas`** | Tira uma unidade do SIGAA do casamento: nenhum curso do INEP vai pra ela. | à esquerda, a **sigla**; à direita, o motivo (texto livre) |

O `motivo` e o `_sobre` são só anotações pra quem ler o arquivo depois — o
sistema ignora. **Sempre escreva o motivo**: daqui a um ano, ninguém vai lembrar
por que aquele curso foi fixado à mão.

---

## 4. Passo a passo

### 4.1. Um curso ficou sem unidade (aviso `sem unidade no SIGAA`)

1. Pegue o **código** e o **nome** do curso no aviso `REVISAR`
   (ex.: `150113 ENGENHARIA DE PETRÓLEO`).
2. Descubra a unidade certa:
   - procure o nome do curso no `unidades_ufc.json` — às vezes ele está lá com
     um nome um pouco diferente (ex.: `TECNOLOGIA EM ...`, `... - LICENCIATURA`)
     ou numa sede diferente;
   - se não estiver (curso extinto, que saiu do SIGAA), confirme com a
     coordenação ou a PROGRAD qual unidade oferecia o curso.
3. Ache a **sigla** dessa unidade no `unidades_ufc.json` (campo `"sigla"`).
4. Acrescente o curso no bloco `cursos` do `unidades_ufc_ajustes.json`, com
   vírgula separando do anterior:

   ```json
   "cursos": {
     "150113": {
       "unidade": "CT",
       "motivo": "Engenharia de Petróleo: sem turma nova desde 2020, ..."
     },
     "999999": {
       "unidade": "CC",
       "motivo": "Nome do curso: por que foi fixado à mão."
     }
   }
   ```

5. Salve e rode o pipeline de novo (seção 5).

O código vai **entre aspas** e **só com números**. A sigla tem que ser
**exatamente** a do `unidades_ufc.json` (maiúsculas, sem acento a mais).

### 4.2. Um curso está na unidade errada

Mesmo caminho da 4.1: fixe a unidade certa no bloco `cursos`. O ajuste manual
**vale mais** que o casamento pelo nome. Pra descobrir o código do curso no
INEP, use a busca de cursos do painel (o código aparece embaixo do nome) ou o
`codigo_curso` nos JSONs de `backend/app/data/processed/dashboard/`.

### 4.3. Uma unidade mudou de sigla no SIGAA

Ex.: o SIGAA passou a chamar o `IAUD` de `IAU`. O `unidades_ufc.json` se
atualiza sozinho, mas os ajustes que usavam a sigla antiga passam a dar o aviso
`unidade 'IAUD' inexistente`. Troque a sigla antiga pela nova em todo o
`unidades_ufc_ajustes.json` (nos dois blocos) e rode o pipeline de novo.

A unidade também muda de endereço no painel (o arquivo passa de `iaud.json`
pra `iau.json`): quem tinha deixado essa unidade como "unidade ao abrir o
painel" volta pro padrão uma vez.

### 4.4. Uma unidade do SIGAA não deve receber cursos

Acrescente a sigla no bloco `unidades_ignoradas`, com o motivo:

```json
"unidades_ignoradas": {
  "CUFCCARIRI": "Campus do Cariri: hoje é a UFCA, ...",
  "NOVASIGLA": "Por que essa unidade fica de fora."
}
```

Use isso quando a unidade **não é da UFC no INEP** (o caso do Cariri, que virou
outra universidade) ou quando o SIGAA tem cadastro errado que confundiria o
casamento.

### 4.5. Um ajuste não é mais necessário

Se o SIGAA passou a listar o curso com o nome certo, o ajuste pode ser apagado
(o curso continua casando pelo nome). Na dúvida, deixe: um ajuste certo nunca
atrapalha.

---

## 5. Rodar o pipeline depois de editar

Da raiz do repositório (precisa de internet — o sistema lê a página do SIGAA de
novo):

```bash
cd backend
poetry run python -m app.cmd unidades     # só relê o SIGAA e regrava o unidades_ufc.json
poetry run python -m app.cmd dashboard    # remonta o painel com as unidades e os ajustes
```

Ou `poetry run python -m app.cmd all`, que faz tudo (INEP, SIGAA e painel).

Depois de editar **só o `unidades_ufc_ajustes.json`**, basta o `dashboard` — não
precisa ler o SIGAA de novo.

Confira o final do log: o aviso `REVISAR` do curso que você corrigiu **não deve
aparecer mais**, e o grupo "UFC em …" some do seletor de unidade do painel.

Pra ver no site, o frontend copia os JSONs novos sozinho no próximo
`npm run dev` ou `npm run build` (ver `frontend/README.md`).

---

## 6. Situações conhecidas que são normais

| Situação | Por quê é normal |
|---|---|
| O SIGAA lista **22 unidades**, o painel mostra **19** | `CUFCCARIRI` está em `unidades_ignoradas` (hoje é a UFCA). `CITAPAJE` (Itapajé) e `PRG` (cursos especiais da Pró-Reitoria) não têm nenhum curso nos dados do INEP. Unidade sem curso no INEP não entra no painel. |
| Curso que está no SIGAA e **não aparece no painel** (ex.: Inteligência Artificial em Quixadá) | Curso novo, que o INEP ainda não publicou. Entra sozinho quando o INEP publicar. |
| Curso que está no painel e **não está no SIGAA** | Curso extinto: o INEP ainda tem as turmas antigas. Precisa de ajuste em `cursos` (é o caso do `150113`, Engenharia de Petróleo). |
| `coordenador: null` em vários cursos | O SIGAA deixa a célula vazia; não é usado pelo painel. |
| Mesmo curso duas vezes na mesma unidade no SIGAA (`DIREITO (DIURNO)` e `DIREITO (NOTURNO)`) | Turnos diferentes. Pro sistema não é ambiguidade: os dois estão na mesma unidade. |
| O SIGAA fora do ar durante o `all` | Aparece `unidades | SIGAA indisponível (...) — mantém o unidades_ufc.json atual` e o painel é montado com o arquivo que já existia. Rode `unidades` de novo mais tarde. |

---

## 7. Se algo der errado

| Mensagem | O que aconteceu | Como resolver |
|---|---|---|
| `unidades_ufc_ajustes.json: JSON inválido na linha 4, coluna 3 ...` | Erro de digitação no formato (vírgula sobrando ou faltando, aspas ou chave sem fechar). O pipeline **para sem gerar nada**. | Vá até a linha indicada. O erro mais comum é vírgula depois do último item de um bloco: `{"a": 1,}` → `{"a": 1}` |
| `REVISAR \| unidades_ufc_ajustes.json: curso 150113 -> unidade 'CTT' inexistente` | A sigla do ajuste não existe no `unidades_ufc.json`. O ajuste é **ignorado** e o curso tenta casar pelo nome (se não casar, cai no "UFC em …"). | Corrija a sigla (seção 4.3) |
| `REVISAR \| unidades_ufc_ajustes.json: unidade ignorada 'XYZ' inexistente` | Sigla em `unidades_ignoradas` que não existe no SIGAA | Corrija ou apague a linha |
| Ajuste em `cursos` que parece não ter efeito, sem aviso nenhum | O código do curso tem algo além de números (`"150113 "`, `"PETROLEO"`) ou falta o `"unidade"` | O código vai entre aspas, só com números; a sigla vai em `"unidade"` |
| `nenhum curso encontrado na página do SIGAA` / `tabela 'listagem' não encontrada` | O SIGAA estava fora do ar ou mudou o formato da página. O `unidades_ufc.json` anterior **não é apagado**. | Tente de novo mais tarde; se continuar, a página mudou (seção 8) |
| `unidades_ufc.json sem unidade — recorte por cidade` | O `unidades_ufc.json` não existe (ou está vazio). O painel volta a ser dividido por cidade. | Rode `poetry run python -m app.cmd unidades` |

Dica: editores como o VS Code sublinham em vermelho erros de formato no JSON
enquanto você digita.

---

## 8. O que **não** se resolve por aqui

Estes casos precisam de alguém que programe:

- O SIGAA **mudou o endereço** da página de cursos — o endereço novo vai na
  variável `SIGAA_CURSOS_URL` do `.env` (sem mexer em código), mas vale conferir
  se o formato da página continua o mesmo.
- O SIGAA **mudou o formato** da página (outras colunas, tabela diferente) e o
  pipeline passa a dar `tabela 'listagem' não encontrada` ou `cabeçalho
  inesperado` mesmo com o site no ar.
- **Muitos cursos** deixaram de casar de uma vez (dezenas de avisos `REVISAR`):
  provavelmente o SIGAA mudou a forma de escrever os nomes, e a regra de
  comparação precisa ser ajustada, em vez de fixar curso por curso.
- Mudar **o que o painel mostra** de cada unidade (ex.: exibir o coordenador).

---

## 9. Detalhes técnicos (pra quem programa)

- Leitura da página: `backend/app/modules/unidades/` (`SigaaUnidadesSource` +
  `sigaa_parser.parse_lista_cursos`, schema em `domain/schema.py`); gravação em
  `build_unidades()`, que levanta `UnidadesVaziasError` sem sobrescrever o
  arquivo quando a página vem sem curso. No `all`, a falha vira aviso
  (`_refresh_unidades` em `app/cmd/__main__.py`).
- Casamento: `backend/app/modules/dashboard/domain/unidade_mapping.py`
  (`match_unidade`): ajuste manual → nome normalizado igual (`chave_nome`: sem
  acento, turno, grau, prefixos como `LICENCIATURA EM`/`TECNOLOGIA EM`/
  `COMUNICAÇÃO SOCIAL -` e sufixo `- <sede>`) na mesma sede e modalidade → nome
  do SIGAA que começa com o do INEP → desempate pelo grau escrito no nome do
  SIGAA. Só aceita quando sobra **uma** unidade.
- Agrupamento e recorte: `shared.discover_unidades()` (cursos sem unidade vão
  pro recorte da cidade) e `_filter_scope` (código do curso **e** município).
  Avisos `REVISAR` em `build_dashboard.py` (`_check_unidades_sigaa`,
  `_warn_sem_unidade`). Erro de formato nos JSONs:
  `ArquivoJsonInvalidoError` (`processed_csv_source.py`).
- Os caminhos dos arquivos podem ser trocados pelas variáveis
  `UNIDADES_UFC_FILE` e `UNIDADES_UFC_AJUSTES_FILE` no `.env`; a página, por
  `SIGAA_CURSOS_URL`.
- Visão geral do fluxo: `backend/README.md`, seção 4.4.
