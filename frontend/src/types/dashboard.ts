// Espelha exatamente a forma de backend/app/data/processed/dashboard.json.
// Fonte de verdade real: docs/dashboard_dados.md e
// backend/app/modules/dashboard/domain/services/*.py — atualize os dois lados juntos
// se um campo mudar.

export interface Escopo {
    codigo_ies: number;
    nome_ies: string | null;
    sigla_ies: string | null;
    codigo_municipio: number;
    municipio: string;
}

export interface Curso {
    codigo_curso: number;
    nome_curso: string;
    grau_academico: string | null;
    modalidade_ensino: string | null;
    /** Duração prevista do curso (anos), na turma mais recente. */
    prazo_integralizacao: number | null;
}

export interface FonteInfo {
    gerado_em: string | null;
    linhas: number | null;
}

export interface Fontes {
    qualidade?: FonteInfo;
    trajetoria?: FonteInfo;
}

// --- A. curso_perfil -------------------------------------------------------

export interface KpiCurso {
    codigo_curso: number;
    nome_curso: string;
    ano_qualidade: number | null;
    cpc_continuo: number | null;
    cpc_faixa: string | null;
    conceito_enade_continuo: number | null;
    // coorte de ingresso mais recente, no seu ano de acompanhamento mais
    // recente — os dois anos vêm juntos de propósito, ver docs/dashboard_dados.md.
    ano_ingresso_referencia: number | null;
    ano_referencia: number | null;
    qt_ingressante: number | null;
    taxa_permanencia: number | null;
    taxa_conclusao_acumulada: number | null;
    taxa_desistencia_acumulada: number | null;
}

export interface EvolucaoCpcPonto {
    codigo_curso: number;
    nome_curso: string;
    area_avaliacao: string;
    ano: number;
    cpc_continuo: number | null;
    cpc_faixa: string | null;
    conceito_enade_continuo: number | null;
    // participação no Enade daquela edição (taxa = participantes / inscritos, %)
    n_concluintes_inscritos: number | null;
    n_concluintes_participantes: number | null;
    taxa_participacao: number | null;
}

/** As 9 notas padronizadas (escala 0-5) da avaliação mais recente do curso,
 * com o ano e o CPC/Enade dessa mesma avaliação. */
export interface PerfilRadar {
    codigo_curso: number;
    nome_curso: string;
    area_avaliacao: string;
    ano: number;
    cpc_continuo: number | null;
    cpc_faixa: string | null;
    conceito_enade_continuo: number | null;
    formacao_geral: number | null;
    componente_especifico: number | null;
    idd: number | null;
    organizacao_didatico_pedagogica: number | null;
    infraestrutura: number | null;
    oportunidade_ampliacao: number | null;
    mestres: number | null;
    doutores: number | null;
    regime_trabalho: number | null;
}

export interface FunilCoorte {
    codigo_curso: number;
    nome_curso: string;
    ano_ingresso: number;
    ano_referencia: number;
    qt_ingressante: number;
    qt_permanencia: number;
    qt_concluinte: number;
    qt_desistencia: number;
    qt_falecido: number;
    /** Duração prevista desta turma (anos; pode mudar entre turmas). */
    prazo_integralizacao?: number | null;
}

export interface CurvaSobrevivenciaPonto {
    codigo_curso: number;
    nome_curso: string;
    nome_cine_area_geral: string | null;
    ano_ingresso: number;
    ano_referencia: number;
    anos_desde_ingresso: number;
    taxa_permanencia: number | null;
    taxa_conclusao_acumulada: number | null;
    taxa_desistencia_acumulada: number | null;
}

export interface CursoPerfil {
    kpis: KpiCurso[];
    evolucao_cpc: EvolucaoCpcPonto[];
    perfil_radar: PerfilRadar[];
    funil_coortes: FunilCoorte[];
    curva_sobrevivencia: CurvaSobrevivenciaPonto[];
}

// --- B. comparacao_cursos ---------------------------------------------------

export interface RankingCpcItem {
    codigo_curso: number;
    nome_curso: string;
    ano: number;
    cpc_continuo: number | null;
}

export interface TabelaComparativaLinha {
    codigo_curso: number;
    nome_curso: string;
    cpc_faixa: string | null;
    conceito_enade_continuo: number | null;
    taxa_conclusao_acumulada: number | null;
    taxa_desistencia_acumulada: number | null;
    taxa_permanencia: number | null;
}

export interface ComparacaoCursos {
    ranking_cpc: RankingCpcItem[];
    tabela_comparativa: TabelaComparativaLinha[];
    // reaproveitam A3/A2 tal e qual — não são cálculos novos.
    notas_por_dimensao: PerfilRadar[];
    evolucao_cpc_comparada: EvolucaoCpcPonto[];
}

// --- C. trajetoria_comparada -------------------------------------------------

export interface EvasaoPorCursoPonto {
    codigo_curso: number;
    nome_curso: string;
    nome_cine_area_geral: string | null;
    ano_ingresso: number;
    ano_referencia: number;
    anos_desde_ingresso: number;
    taxa_desistencia_acumulada: number | null;
}

export interface HeatmapEvasaoAnualCelula {
    codigo_curso: number;
    nome_curso: string;
    nome_cine_area_geral: string | null;
    ano_referencia: number;
    taxa_desistencia_anual: number | null;
}

export interface DemandaIngressantesPonto {
    codigo_curso: number;
    nome_curso: string;
    ano_ingresso: number;
    qt_ingressante: number;
}

export interface TrajetoriaComparada {
    evasao_por_curso: EvasaoPorCursoPonto[];
    heatmap_evasao_anual: HeatmapEvasaoAnualCelula[];
    demanda_ingressantes: DemandaIngressantesPonto[];
    demanda_concluintes?: DemandaConcluintesPonto[];
}

export interface DemandaConcluintesPonto {
    codigo_curso: number;
    nome_curso: string;
    ano_referencia: number;
    qt_concluinte: number;
}

// --- D. campus ---------------------------------------------------------------

export interface CampusKpis {
    total_cursos: number;
    total_ingressantes_ultimo_ano: number | null;
    taxa_conclusao_media: number | null;
    taxa_desistencia_media: number | null;
}

export interface DistribuicaoCpcFaixaItem {
    cpc_faixa: string;
    quantidade_cursos: number;
}

export interface TendenciaIngressantesPonto {
    ano_ingresso: number;
    qt_ingressante: number;
}

/** Concluintes do campus num ano (só os anos com todas as turmas que se
 * formam acompanhadas pelo INEP). */
export interface TendenciaConcluintesPonto {
    ano_referencia: number;
    qt_concluinte: number;
}

export interface Campus {
    kpis: CampusKpis;
    distribuicao_cpc_faixa: DistribuicaoCpcFaixaItem[];
    tendencia_ingressantes: TendenciaIngressantesPonto[];
    tendencia_concluintes?: TendenciaConcluintesPonto[];
}

// --- E. medias_nacionais -------------------------------------------------------

export interface EvolucaoCpcNacionalPonto {
    area_avaliacao: string;
    ano: number;
    cpc_continuo_medio_nacional: number | null;
    quantidade_cursos_considerados: number;
    conceito_enade_medio_nacional: number | null;
    quantidade_cursos_enade: number;
}

/** Notas médias da área no ano (só os anos em que o campus foi avaliado);
 * edições antigas podem não ter alguma nota. */
export interface PerfilRadarNacional {
    area_avaliacao: string;
    ano: number;
    formacao_geral: number | null;
    componente_especifico: number | null;
    idd: number | null;
    organizacao_didatico_pedagogica: number | null;
    infraestrutura: number | null;
    oportunidade_ampliacao: number | null;
    mestres: number | null;
    doutores: number | null;
    regime_trabalho: number | null;
    /** Conceito Enade contínuo médio da área no ano. */
    conceito_enade_continuo: number | null;
    quantidade_cursos_considerados: number;
}

export interface CurvaSobrevivenciaNacionalPonto {
    nome_cine_area_geral: string;
    anos_desde_ingresso: number;
    taxa_permanencia_media_nacional: number;
    taxa_conclusao_acumulada_media_nacional: number;
    taxa_desistencia_acumulada_media_nacional: number;
    quantidade_cursos_considerados: number;
}

export interface HeatmapEvasaoNacionalCelula {
    nome_cine_area_geral: string;
    ano_referencia: number;
    taxa_desistencia_anual_media_nacional: number;
    quantidade_cursos_considerados: number;
}

export interface CampusNacionalKpis {
    taxa_conclusao_media_nacional: number | null;
    taxa_desistencia_media_nacional: number | null;
    quantidade_cursos_considerados: number;
}

export interface DistribuicaoCpcFaixaNacionalItem {
    cpc_faixa: string;
    percentual_nacional: number;
}

export interface CampusNacional {
    kpis: CampusNacionalKpis;
    distribuicao_cpc_faixa: DistribuicaoCpcFaixaNacionalItem[];
}

/** Cursos-pares de um curso do campus em uma UF. Contagem, ingressantes e
 * evasão vêm da trajetória (turma de ``ano_ingresso``); o CPC, da avaliação
 * de ``ano_cpc``. */
export interface DistribuicaoUfEstado {
    sigla_uf: string;
    quantidade_cursos: number;
    qt_ingressante: number | null;
    taxa_desistencia_media: number | null;
    cpc_continuo_medio: number | null;
    quantidade_cursos_cpc: number;
}

/** Onde existe, no Brasil, o mesmo curso (mesma área e modalidade). */
export interface DistribuicaoUfCurso {
    codigo_curso: number;
    nome_cine_area_geral: string | null;
    area_avaliacao: string | null;
    sigla_uf_campus: string | null;
    ano_ingresso: number | null;
    ano_cpc: number | null;
    estados: DistribuicaoUfEstado[];
}

/** Ingressantes médios dos cursos-pares no Brasil (mesmo rótulo CINE,
 * modalidade e grau) de um curso do campus, por ano de ingresso. */
/** Evasão e conclusão acumuladas dos cursos-pares do Brasil na turma madura
 * de um curso do campus (mesmo ano de ingresso, ``anos_desde_ingresso`` anos
 * depois), pra pôr o curso entre eles (percentil). */
export interface TrajetoriaPares {
    codigo_curso: number;
    ano_ingresso: number;
    anos_desde_ingresso: number;
    evasao: number[];
    conclusao: number[];
}

export interface ConcluintesNacionalPonto {
    codigo_curso: number;
    ano_referencia: number;
    qt_concluinte_media_nacional: number;
    quantidade_cursos_considerados: number;
}

export interface IngressantesNacionalPonto {
    codigo_curso: number;
    ano_ingresso: number;
    qt_ingressante_media_nacional: number;
    quantidade_cursos_considerados: number;
}

/** Médias só do grupo de pares (mesma área/classificação de curso do
 * campus) — nunca o Brasil inteiro misturado. Ver docs/dashboard_dados.md. */
export interface MediasNacionais {
    evolucao_cpc: EvolucaoCpcNacionalPonto[];
    perfil_radar: PerfilRadarNacional[];
    curva_sobrevivencia: CurvaSobrevivenciaNacionalPonto[];
    heatmap_evasao_anual: HeatmapEvasaoNacionalCelula[];
    campus: CampusNacional;
    distribuicao_uf: DistribuicaoUfCurso[];
    ingressantes: IngressantesNacionalPonto[];
    concluintes?: ConcluintesNacionalPonto[];
    trajetoria_pares?: TrajetoriaPares[];
}

// --- F. alertas ----------------------------------------------------------------

export type AlertaTipo = "sem_cpc" | "cpc_faixa_baixa" | "evasao_acima_da_media";
export type AlertaSeveridade = "atencao" | "critico";

export interface AlertaItem {
    tipo: AlertaTipo;
    severidade: AlertaSeveridade;
    mensagem: string;
    cursos: string[];
}

export interface Alertas {
    itens: AlertaItem[];
}

// --- índice de campi (processed/dashboard/index.json) ---------------------

/** Um campus da IES — cada um tem o seu ``<slug>.json`` (um DashboardData). */
export interface CampusInfo {
    slug: string;
    nome: string;
    codigo_municipio: number;
    total_cursos: number;
    arquivo: string;
}

export interface CampusIndex {
    gerado_em: string;
    codigo_ies: number;
    campi: CampusInfo[];
}

// --- resumo dos campi (processed/dashboard/resumo_campi.json) -------------

export interface ResumoCurso {
    codigo_curso: number;
    nome_curso: string;
    grau_academico?: string | null;
    area_avaliacao: string | null;
    ano: number | null;
    cpc_continuo: number | null;
    cpc_faixa: string | null;
    conceito_enade_continuo: number | null;
    idd: number | null;
    /** As 9 notas padronizadas da avaliação mais recente (null sem CPC). */
    notas: Record<
        | "formacao_geral"
        | "componente_especifico"
        | "idd"
        | "organizacao_didatico_pedagogica"
        | "infraestrutura"
        | "oportunidade_ampliacao"
        | "mestres"
        | "doutores"
        | "regime_trabalho",
        number | null
    > | null;
    /** As edições do CPC do curso, da mais antiga à mais recente. */
    historico: { ano: number; cpc_continuo: number | null; cpc_faixa: string | null }[];
    ano_ingresso_referencia: number | null;
    ano_referencia: number | null;
    taxa_conclusao_acumulada: number | null;
    taxa_desistencia_acumulada: number | null;
    /** Turma madura do curso (pra comparar o mesmo curso entre campi). */
    trajetoria?: TrajetoriaResumo | null;
}

/** Turma madura no resumo dos campi: área CINE e grau (o mesmo curso noutro
 * campus), prazo, ingresso, ingressantes (o peso nas médias do campus) e a
 * curva ``[anos, % cursando, % concluiu, % desistiu]``. */
export interface TrajetoriaResumo {
    nome_cine_area_geral: string | null;
    grau_academico: string | null;
    prazo_integralizacao: number;
    ano_ingresso: number;
    ingressantes?: number | null;
    curva: [number, number, number, number][];
}

export interface ResumoCampi {
    gerado_em: string;
    campi: { slug: string; nome: string; cursos: ResumoCurso[] }[];
}

// --- raiz ------------------------------------------------------------------

export interface DashboardData {
    gerado_em: string;
    escopo: Escopo;
    cursos: Curso[];
    fontes: Fontes;
    curso_perfil: CursoPerfil;
    comparacao_cursos: ComparacaoCursos;
    trajetoria_comparada: TrajetoriaComparada;
    campus: Campus;
    medias_nacionais: MediasNacionais;
    alertas: Alertas;
}
