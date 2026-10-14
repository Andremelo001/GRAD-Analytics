// Espelha backend/app/data/processed/dashboard/areas_qualidade/*.json (gerado por
// backend/app/modules/dashboard/domain/services/quality_areas.py): todos os
// cursos do Brasil na edição mais recente de uma área de avaliação.

export interface AreaInfo {
    slug: string;
    area_avaliacao: string;
    ano: number;
    total_cursos: number;
    arquivo: string;
}

export interface AreaIndex {
    gerado_em: string;
    areas: AreaInfo[];
}

/** Formato colunar: cada curso é uma lista na ordem de ``colunas``. */
export interface AreaArquivo {
    area_avaliacao: string;
    ano: number;
    codigo_ies_destaque: number;
    colunas: string[];
    /** Ordem de cada edição na coluna ``historico`` de um curso. */
    colunas_edicao: string[];
    cursos: (number | boolean | null | (number | null)[][])[][];
    /** código da IES -> [nome, sigla, pública?] */
    ies: Record<string, [string | null, string | null, boolean | null]>;
    /** código IBGE do município -> [nome, sigla da UF] */
    municipios: Record<string, [string | null, string | null]>;
}
