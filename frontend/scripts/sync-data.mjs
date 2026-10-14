// Copia os JSONs do painel (gerados pelo pipeline Python em
// backend/app/data/processed/dashboard/: index.json + <slug>.json de cada
// campus, resumo_campi.json e areas_qualidade/, um por área de avaliação) pra
// frontend/public/data/dashboard/, de onde o Vite serve como
// asset estático — tanto em dev quanto no build de produção (GitHub Pages não
// roda servidor nenhum, só serve arquivo). O front lê o index.json pra montar
// o seletor de campus e baixa o <slug>.json do campus escolhido.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(
    __dirname,
    "..",
    "..",
    "backend",
    "app",
    "data",
    "processed",
    "dashboard"
);
const DEST_ROOT = resolve(__dirname, "..", "public", "data");
const DEST = resolve(DEST_ROOT, "dashboard");

if (!existsSync(resolve(SOURCE, "index.json"))) {
    console.error(
        `index.json não encontrado em ${SOURCE}\n` +
            "Rode o pipeline Python antes: cd backend && poetry run python -m app.cmd dashboard"
    );
    process.exit(1);
}

// recomeça do zero: não sobra campus removido nem o dashboard.json antigo
rmSync(DEST_ROOT, { recursive: true, force: true });
cpSync(SOURCE, DEST, { recursive: true });
console.log(`campi sincronizados -> ${DEST}`);
