import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages hospeda como project page (Andremelo001.github.io/GRAD-Analytics/),
// então o build de produção precisa desse prefixo nas URLs dos assets. O
// prefixo é o nome do repositório, que o GitHub Actions informa em
// GITHUB_REPOSITORY ("dono/repo"): renomear o repositório não quebra o site.
// Em dev (`vite dev`) e no `vite preview` local, a env não é setada e o base
// fica "/".
const REPOSITORIO = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "GRAD-Analytics";
const BASE = process.env.GITHUB_PAGES === "true" ? `/${REPOSITORIO}/` : "/";
// Versão dos dados (JSONs de public/data/), que vai na URL de cada um
// (``lib/dados.ts``): o GitHub Pages manda tudo com cache de 10 min, e os JSONs
// têm sempre o mesmo nome — sem isso, um navegador que abriu o site antes de um
// deploy juntava o código novo com os dados antigos em cache (e quebrava se o
// formato tivesse mudado). É o commit do build (os dados são versionados junto
// com o código); fora do Actions, o momento do build.
const VERSAO_DADOS = process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36);

export default defineConfig({
    base: BASE,
    define: {
        __VERSAO_DADOS__: JSON.stringify(VERSAO_DADOS),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        },
    },
});
