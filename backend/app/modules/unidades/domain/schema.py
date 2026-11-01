from pydantic import BaseModel, Field


class CursoSigaa(BaseModel):
    """Uma linha da tabela de cursos do SIGAA, com todas as colunas da página.

    ``nome`` e ``sede`` vêm como na página (caixa alta, com acento e, às
    vezes, turno ou grau no nome: "DIREITO (NOTURNO)", "FÍSICA -
    LICENCIATURA"). ``coordenador`` é ``None`` quando a célula vem vazia.
    ``id_sigaa`` e ``url_portal`` saem do link "Visualizar Página do Curso".
    """

    nome: str
    sede: str
    modalidade: str | None
    coordenador: str | None
    id_sigaa: int | None
    url_portal: str | None


class UnidadeSigaa(BaseModel):
    """Um agrupamento da tabela (a linha de título acima dos cursos).

    ``rotulo`` é o texto da página ("CCA - CENTRO DE CIÊNCIAS AGRÁRIAS"),
    separado em ``sigla`` ("CCA") e ``nome`` ("CENTRO DE CIÊNCIAS
    AGRÁRIAS") no primeiro " - ". ``sedes``: os municípios dos cursos, na
    ordem em que aparecem.
    """

    rotulo: str
    sigla: str
    nome: str
    sedes: list[str]
    total_cursos: int
    cursos: list[CursoSigaa]


class PaginaCursosSigaa(BaseModel):
    """A página "Consulta de Cursos" do SIGAA inteira, já estruturada.

    ``nivel``: o código do nível consultado ("G" = graduação);
    ``modalidades_filtro``: as opções do filtro de modalidade do formulário
    (inclui modalidades sem curso hoje, como "Semi-Presencial");
    ``colunas``: o cabeçalho da tabela.
    """

    titulo: str | None
    descricao: list[str] = Field(default_factory=list)
    nivel: str | None
    modalidades_filtro: list[str] = Field(default_factory=list)
    colunas: list[str] = Field(default_factory=list)
    unidades: list[UnidadeSigaa] = Field(default_factory=list)

    @property
    def total_cursos(self) -> int:
        return sum(c.total_cursos for c in self.unidades)
