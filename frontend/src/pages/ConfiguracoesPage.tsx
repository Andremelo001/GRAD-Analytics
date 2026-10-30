import {
    ArrowDown,
    ArrowUp,
    Eye,
    MapPin,
    Monitor,
    Moon,
    RotateCcw,
    Sun,
} from "lucide-react";
import { useId, type ReactNode } from "react";

import { ChartSelect } from "@/components/charts/ChartSelect";
import { ModoToggle } from "@/components/charts/qualidade/ModoToggle";
import { PageHeader } from "@/components/layout/PageHeader";
import { ULTIMO_CAMPUS } from "@/context/dashboard-data-context";
import type { ThemePreference } from "@/context/theme-context";
import { useDashboardData } from "@/hooks/useDashboardData";
import { nomeCampus } from "@/lib/comparacao";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const TEMAS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
    { value: "light", label: "Claro", icon: <Sun size={14} aria-hidden /> },
    { value: "dark", label: "Escuro", icon: <Moon size={14} aria-hidden /> },
    { value: "system", label: "Automático", icon: <Monitor size={14} aria-hidden /> },
];

/** Configurações: aparência, campus ao abrir e acessibilidade, salvas neste navegador. Ocupa
 * a largura toda da página (como as outras), com as opções agrupadas por seção; cada mudança vale
 * na hora (sem botão de salvar). */
export function ConfiguracoesPage() {
    const {
        theme,
        preference,
        setPreference,
        coresAcessiveis,
        setCoresAcessiveis,
        restaurarPadroes,
    } = useTheme();
    const { campi, campusAoAbrir, setCampusAoAbrir } = useDashboardData();
    const padrao =
        preference === "system" && !coresAcessiveis && campusAoAbrir === ULTIMO_CAMPUS;
    const fixo = campi.find((c) => c.slug === campusAoAbrir);

    return (
        <>
            <PageHeader
                title="Configurações"
                subtitle="Preferências do painel neste navegador"
            />
            <div className="entrada flex w-full flex-col gap-7">
                <Secao titulo="Aparência">
                    <Linha
                        icone={
                            theme === "dark" ? <Moon size={18} /> : <Sun size={18} />
                        }
                        titulo="Tema"
                        descricao={
                            preference === "system"
                                ? `Automático segue o tema do sistema (agora: ${theme === "dark" ? "escuro" : "claro"})`
                                : "Automático segue o tema do sistema"
                        }
                        controle={
                            <ModoToggle
                                label="Tema"
                                value={preference}
                                options={TEMAS}
                                onChange={setPreference}
                            />
                        }
                    />
                    <Linha
                        icone={<MapPin size={18} />}
                        titulo="Cidade ao abrir o painel"
                        descricao={
                            fixo
                                ? `O painel sempre abre em ${nomeCampus(fixo.nome)}`
                                : "O painel abre na última cidade escolhida"
                        }
                        controle={
                            campi.length > 0 && (
                                <ChartSelect
                                    label="Cidade ao abrir o painel"
                                    value={fixo ? fixo.slug : ULTIMO_CAMPUS}
                                    options={[
                                        { value: ULTIMO_CAMPUS, label: "Último usado" },
                                        ...campi.map((c) => ({
                                            value: c.slug,
                                            label: nomeCampus(c.nome),
                                        })),
                                    ]}
                                    onChange={setCampusAoAbrir}
                                />
                            )
                        }
                    />
                </Secao>

                <Secao titulo="Acessibilidade">
                    <Linha
                        icone={<Eye size={18} />}
                        titulo="Cores acessíveis"
                        descricao="Cores dos cards e gráficos em azul e laranja, para daltonismo"
                        ativo={coresAcessiveis}
                        controle={
                            <Interruptor
                                label="Cores acessíveis"
                                ativo={coresAcessiveis}
                                onChange={setCoresAcessiveis}
                            />
                        }
                    >
                        <PreviaCores ativo={coresAcessiveis} />
                    </Linha>
                </Secao>

                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                    <p className="text-text-muted text-[12px]">
                        As preferências ficam salvas neste navegador.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            restaurarPadroes();
                            setCampusAoAbrir(ULTIMO_CAMPUS);
                        }}
                        disabled={padrao}
                        className="text-text-secondary hover:text-ink hover:bg-surface focus-visible:ring-lime/60 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
                    >
                        <RotateCcw size={14} aria-hidden />
                        Restaurar padrões
                    </button>
                </div>
            </div>
        </>
    );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <section>
            <h2 className="text-text-muted mb-2.5 px-1 text-[11px] font-semibold tracking-wide uppercase">
                {titulo}
            </h2>
            <div className="bg-surface text-ink ring-card-ring divide-page flex flex-col divide-y-2 rounded-[18px] shadow-[0_4px_24px_rgb(0_0_0/0.05)] ring-1">
                {children}
            </div>
        </section>
    );
}

/** Uma opção: ícone, título e descrição à esquerda, o controle à direita
 * (desce pra baixo do texto no celular). ``ativo`` tinge levemente a linha. */
function Linha({
    icone,
    titulo,
    descricao,
    controle,
    ativo = false,
    children,
}: {
    icone: ReactNode;
    titulo: string;
    descricao: string;
    controle: ReactNode;
    ativo?: boolean;
    children?: ReactNode;
}) {
    return (
        <div
            className={cn(
                "px-5 py-4 transition-[background-color] duration-300 first:rounded-t-[18px] last:rounded-b-[18px] lg:px-6",
                ativo && "bg-brand/[0.07]"
            )}
        >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span
                    aria-hidden
                    className="bg-page text-text-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                >
                    {icone}
                </span>
                <div className="min-w-0 flex-1 basis-48">
                    <p className="text-[14px] font-semibold">{titulo}</p>
                    <p className="text-text-muted mt-0.5 text-[12px] leading-snug">
                        {descricao}
                    </p>
                </div>
                <div className="ml-auto">{controle}</div>
            </div>
            {children}
        </div>
    );
}

/** Interruptor liga/desliga (``role="switch"``), na cor da série principal
 * quando ligado. */
function Interruptor({
    label,
    ativo,
    onChange,
}: {
    label: string;
    ativo: boolean;
    onChange: (ativo: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={ativo}
            aria-label={label}
            onClick={() => onChange(!ativo)}
            className={cn(
                "focus-visible:ring-lime/60 relative flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 outline-none focus-visible:ring-2",
                ativo ? "bg-brand" : "bg-empty"
            )}
        >
            <span
                aria-hidden
                className="h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(${ativo ? 20 : 0}px)` }}
            />
        </button>
    );
}

/** Prévia lado a lado das duas paletas de bom/ruim, com a em uso marcada. As
 * cores são fixas (não os tokens), pra mostrar as duas ao mesmo tempo. */
function PreviaCores({ ativo }: { ativo: boolean }) {
    const id = useId();
    const paletas = [
        {
            chave: "padrao",
            nome: "Padrão",
            bom: { bg: "#dcf366", fg: "#1b1b1d" },
            ruim: { bg: "#e5484d", fg: "#ffffff" },
            linha: "#a2b82e",
            emUso: !ativo,
        },
        {
            chave: "acessivel",
            nome: "Acessível",
            bom: { bg: "#2f6fd0", fg: "#ffffff" },
            ruim: { bg: "#e8710a", fg: "#ffffff" },
            linha: "#2f6fd0",
            emUso: ativo,
        },
    ];
    return (
        <div
            aria-labelledby={`${id}-titulo`}
            className="mt-4 grid grid-cols-1 gap-2.5 sm:ml-[52px] sm:grid-cols-2 sm:gap-5"
        >
            <p id={`${id}-titulo`} className="sr-only">
                Prévia das cores de subiu e caiu
            </p>
            {paletas.map((p) => (
                <div
                    key={p.chave}
                    className={cn(
                        "bg-page relative flex items-center gap-4 overflow-hidden rounded-xl px-4 py-4 transition-shadow duration-300",
                        // a que não está em uso ganha um contorno fino: sobre a linha
                        // tingida (cores acessíveis ligadas) o fundo cinza some
                        p.emUso ? "ring-brand/60 ring-2" : "ring-ink/10 ring-1"
                    )}
                >
                    {/* enfeite: os mesmos pontinhos do cabeçalho de Por curso */}
                    <span
                        aria-hidden
                        className="pontilhado pointer-events-none absolute inset-y-0 right-0 w-4/5"
                        style={{
                            backgroundSize: "18px 18px",
                            maskImage:
                                "linear-gradient(to left, black 10%, transparent 100%)",
                        }}
                    />
                    <div className="relative min-w-0 flex-1">
                        <p className="text-text-secondary flex items-center gap-2 text-[11px] font-medium">
                            {p.nome}
                            {p.emUso && (
                                <span className="text-text-muted">· em uso</span>
                            )}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                            <Amostra cor={p.bom} texto="+0,12" seta="sobe" />
                            <Amostra cor={p.ruim} texto="−0,08" seta="desce" />
                        </div>
                    </div>
                    {/* série principal dos gráficos: linha com a área esmaecida */}
                    <svg
                        viewBox="0 0 120 52"
                        className="relative h-[52px] w-[120px] shrink-0"
                        aria-hidden
                    >
                        <path
                            d="M4 44 C 22 44, 30 20, 48 24 S 76 16, 92 12 S 110 6, 116 6 L116 50 L4 50 Z"
                            fill={p.linha}
                            fillOpacity={0.14}
                        />
                        <path
                            d="M4 44 C 22 44, 30 20, 48 24 S 76 16, 92 12 S 110 6, 116 6"
                            fill="none"
                            stroke={p.linha}
                            strokeWidth={2.5}
                            strokeLinecap="round"
                        />
                    </svg>
                </div>
            ))}
        </div>
    );
}

function Amostra({
    cor,
    texto,
    seta,
}: {
    cor: { bg: string; fg: string };
    texto: string;
    seta: "sobe" | "desce";
}) {
    const Icone = seta === "sobe" ? ArrowUp : ArrowDown;
    return (
        <span
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] leading-none font-semibold tabular-nums"
            style={{ background: cor.bg, color: cor.fg }}
        >
            {texto}
            <Icone size={11} strokeWidth={2.5} aria-hidden />
        </span>
    );
}
