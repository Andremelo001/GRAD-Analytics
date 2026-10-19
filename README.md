# GRAD Analytics

O **GRAD Analytics** é um painel on-line que reúne, em um só lugar, os
principais indicadores dos cursos de graduação da **UFC**.

A ideia é simples: dados que hoje estão espalhados em planilhas enormes do
governo viram gráficos e números fáceis de ler, para ajudar a coordenação e a
Pró-Reitoria de Graduação (PROGRAD) a acompanhar a situação dos cursos e a
tomar decisões.

**Acesse:** https://andremelo001.github.io/PROGRAD-Analytics/

---

## O que dá para ver no painel

- **Qualidade dos cursos**: a nota que o MEC dá a cada curso (o CPC,
  Conceito Preliminar de Curso) e como ela mudou ao longo dos anos. A aba
  **Qualidade** tem quatro partes:
    - **Visão do campus**: todos os cursos lado a lado, com a faixa (1 a 5),
      quem subiu ou caiu desde a avaliação anterior e em quais componentes da
      nota cada curso está acima ou abaixo da média do país.
    - **Por curso**: de onde vem a nota de um curso, quanto falta para a
      próxima faixa e qual parte da nota mais pesa nisso.
    - **Mapa**: o mesmo curso pelo Brasil, estado por estado; clicando num
      estado aparecem as cidades e os cursos com as melhores notas.
    - **Comparações**: a posição de cada curso entre os do país inteiro, a
      participação dos alunos no Enade e o mesmo curso nos outros campi da UFC.
- **Trajetória dos estudantes**: quantos alunos entram por ano, quantos
  concluem o curso e quantos desistem no caminho.
- **Comparação com o Brasil**: cada curso do campus é comparado com a média
  dos cursos da mesma área no país inteiro. Assim dá para saber se um número
  está bom ou ruim, e não só qual é o número.
- **Alertas**: o painel aponta sozinho o que merece atenção, como um curso
  sem avaliação recente ou com evasão acima da média do campus.
- **Busca por curso**: digite o nome do curso para ver os números só dele.

## Modo apresentação

Para mostrar o painel numa reunião ou num telão, o **modo apresentação** tira
da tela tudo o que não é gráfico (a faixa escura do topo, com o logo, a
busca, a saudação e as abas) e deixa **só os cards**, com um visual mais
limpo. Em computadores, o navegador também entra em **tela cheia**, escondendo
as abas e a barra de endereço.

**Como entrar:**

- clique no botão de apresentação, ao lado do botão de tema (sol/lua), no
  topo da página; ou
- aperte **Ctrl + K** (no Mac, **⌘ + K**).

A faixa do topo sobe até sumir, os cards sobem junto e a página volta para o
começo, para a apresentação começar pelos primeiros gráficos. No lugar da
faixa aparece uma barra fina, acima dos cards, com a frase "Acompanhe os
indicadores da graduação do UFC Campus …", o **seletor de campus** e o logo:
dá para trocar de campus sem sair da apresentação. Na aba **Qualidade**, as sub-abas (Visão do campus, Por curso, Mapa e
Comparações) aparecem logo abaixo dessa barra, para navegar entre elas
durante a apresentação.

**Como sair:**

- clique no **X** no canto superior esquerdo da tela; ou
- aperte **Ctrl + K** (ou **⌘ + K**) de novo; ou
- aperte **Esc**.

A barra se desfaz, a faixa do topo volta ao lugar e, em seguida, o navegador
sai da tela cheia.

## De onde vêm os dados

Todos os números vêm de dados **públicos e oficiais** do **INEP**, o instituto
do Ministério da Educação responsável pelas avaliações e estatísticas da
educação superior no Brasil:

- **Indicadores de Qualidade da Educação Superior**, com as notas dos cursos.
- **Indicadores de Trajetória da Educação Superior**, com o caminho dos alunos
  desde a entrada até a conclusão ou a desistência.

O painel não usa nenhum dado pessoal de estudantes, só números agregados por
curso. Quando o INEP publica dados novos, o projeto baixa, organiza e
atualiza o painel.

## Como o projeto está organizado

O projeto tem duas partes:

- **Coleta e organização dos dados**: baixa as planilhas do INEP, limpa as
  informações e separa só o que interessa ao campus.
- **Site do painel**: a página que você acessa pelo navegador, com os gráficos.

Quem for trabalhar no código encontra as instruções de cada parte em
[`backend/README.md`](backend/README.md) (dados) e
[`frontend/README.md`](frontend/README.md) (site).
