# GRAD Analytics

O **GRAD Analytics** é um painel on-line que reúne, em um só lugar, os
principais indicadores dos cursos de graduação da **UFC**.

A ideia é simples: dados que hoje estão espalhados em planilhas enormes do
governo viram gráficos e números fáceis de ler, para ajudar a coordenação e a
Pró-Reitoria de Graduação (PROGRAD) a acompanhar a situação dos cursos e a
tomar decisões.

**Acesse:** https://andremelo001.github.io/GRAD-Analytics/

---

## O que dá para ver no painel

O painel mostra um campus da UFC por vez (Crateús, Fortaleza, Quixadá,
Russas ou Sobral), escolhido no seletor de campus do topo. São três abas:

- **Início**: um resumo rápido, em três partes:
    - **Ingresso e conclusão**: quantos alunos entram e quantos se formam a
      cada ano, no campus ou num curso escolhido, comparados com a média do
      país.
    - **Qualidade**: onde o curso existe no Brasil e a nota dele (o CPC ou o
      Conceito Enade) ao longo dos anos, comparada com a média do país.
    - **Trajetória**: em que anos os alunos de cada curso desistem e as taxas
      de conclusão e de evasão.
- **Qualidade dos cursos**: a nota que o MEC dá a cada curso (o CPC,
  Conceito Preliminar de Curso), de onde ela vem e como mudou. Quatro partes:
    - **Visão do campus**: todos os cursos lado a lado, com a nota e a faixa
      (1 a 5), o curso que mais melhorou, quem subiu ou caiu desde a avaliação
      anterior e em quais partes da nota cada curso está acima ou abaixo da
      média do país.
    - **Por curso**: de onde vem a nota de um curso, quanto falta para a
      próxima faixa (no CPC e no Conceito Enade), como cada parte da nota
      evoluiu ao longo das avaliações e a participação dos alunos no Enade.
    - **Mapa**: o mesmo curso pelo Brasil, estado por estado; clicando num
      estado aparecem as cidades, a comparação do estado com o seu curso e os
      cursos com as melhores notas, com a posição do seu curso entre eles.
    - **Comparações**: dois campi da UFC lado a lado, ou um curso do campus
      contra qualquer curso da mesma área no Brasil.
- **Trajetória dos estudantes**: o caminho dos alunos desde a entrada, com as
  mesmas quatro partes:
    - **Visão do campus**: quanto as turmas concluem, quanto da evasão
      acontece no 1º ano, o tempo até concluir e a situação final de cada
      curso.
    - **Por curso**: os alunos que entraram, concluíram, desistiram e ainda
      cursam; o caminho de uma turma ano a ano; a permanência comparada com o
      Brasil; a evasão de todas as turmas lado a lado; e quantos se formam no
      prazo.
    - **Mapa**: a taxa de permanência, de conclusão ou de desistência do
      mesmo curso pelo Brasil, estado por estado, com a posição do seu curso.
    - **Comparações**: dois campi da UFC lado a lado, ou um curso do campus
      contra qualquer curso da mesma área no Brasil.

Em todas as partes, cada curso é comparado com a **média dos cursos da mesma
área no país**. Assim dá para saber se um número está bom ou ruim, e não só
qual é o número.

Outros recursos:

- **Busca por curso**: no topo, procura cursos de todos os campi. Escolha se
  quer abrir o curso em Qualidade ou em Trajetória; se ele for de outro
  campus, o painel troca de campus sozinho.
- **De onde vem cada número**: o ícone **i** no canto de cada card explica o
  que ele mostra e traz o link para a base do INEP de onde vieram os dados.
- **Ampliar um card**: clique num card para vê-lo maior, no centro da tela
  (Esc ou o X fecham).
- **Configurações** (a engrenagem no topo): tema claro, escuro ou automático;
  o campus em que o painel abre; e **cores acessíveis**, em azul e laranja,
  para quem tem daltonismo.

## Modo apresentação

Para mostrar o painel numa reunião ou num telão, o **modo apresentação** tira
da tela tudo o que não é gráfico (a faixa escura do topo, com o logo, a
busca, a saudação e as abas) e deixa **só os cards**, com um visual mais
limpo. Em computadores, o navegador também entra em **tela cheia**, escondendo
as abas e a barra de endereço.

**Como entrar:**

- clique no botão de apresentação, ao lado do botão de tema (sol/lua), no
  topo da página (em computadores e tablets); ou
- aperte **Ctrl + K** (no Mac, **⌘ + K**).

A faixa do topo sobe até sumir, os cards sobem junto e a página volta para o
começo, para a apresentação começar pelos primeiros gráficos. No lugar da
faixa aparece uma barra fina, acima dos cards, com a frase "Acompanhe os
indicadores da graduação do UFC Campus …", o **seletor de campus** e o logo:
dá para trocar de campus sem sair da apresentação. As partes de cada aba
(por exemplo, Visão do campus, Por curso, Mapa e Comparações) aparecem logo
abaixo dessa barra, para navegar entre elas durante a apresentação.

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
