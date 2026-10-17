import { cn } from "@/lib/utils";

/** Versão em tabela de um gráfico, pra leitor de tela (os cards a usam dentro
 * de um ``sr-only``): nenhum valor fica preso ao tooltip ou à cor. Primeira
 * coluna é o rótulo, as demais são valores. */
export function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
    return (
        <table className="w-full text-left text-[13px] tabular-nums">
            <thead>
                <tr>
                    {columns.map((column, index) => (
                        <th
                            key={column}
                            scope="col"
                            className={cn("font-medium", index > 0 && "text-right")}
                        >
                            {column}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {/* a posição entra na chave: cursos diferentes podem ter o
                    mesmo nome (ex.: Educação Física bacharelado e licenciatura) */}
                {rows.map(([label, ...values], i) => (
                    <tr key={`${i}-${label}`}>
                        <td>{label}</td>
                        {values.map((value, index) => (
                            <td key={index} className="text-right">
                                {value}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
