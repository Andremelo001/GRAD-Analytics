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

export default defineConfig({
    base: BASE,
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        },
    },
});
