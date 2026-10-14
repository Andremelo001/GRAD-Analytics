// Espelha backend/app/data/processed/dashboard/trajetoria_areas/*.json (gerado
// por backend/app/modules/dashboard/domain/services/trajectory_areas.py): a
// turma madura de cada curso do Brasil numa área CINE.

export interface TrajetoriaAreaInfo {
    slug: string;
    area: string;
    total_cursos: number;
    arquivo: string;
}

export interface TrajetoriaAreaIndex {
    gerado_em: string;
    areas: TrajetoriaAreaInfo[];
}

/** Formato colunar: cada curso é uma lista na ordem de ``colunas``. */
export interface TrajetoriaAreaArquivo {
    area: string;
    codigo_ies_destaque: number;
    colunas: string[];
    cursos: (number | string | boolean | null | number[][])[][];
    /** código da IES -> [nome, sigla, pública?] */
    ies: Record<string, [string | null, string | null, boolean | null]>;
    /** código IBGE do município -> [nome, sigla da UF] */
    municipios: Record<string, [string | null, string | null]>;
}
