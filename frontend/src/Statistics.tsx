import { useState } from "react";
import { can, money } from "./api";
import type { User } from "./api";
import { useResource } from "./hooks";
import { Icon } from "./icons";
import { Empty, Field, ListState, SectionTabs, Title } from "./ui";
export interface Period {
  desde: string;
  hasta: string;
}
interface Metric {
  etiqueta: string;
  valor: number;
  tipo: string;
}
interface Report {
  titulo: string;
  desde: string;
  hasta: string;
  nota: string;
  moneda: string;
  indicadores: Metric[];
  distribucion: { etiqueta: string; valor: number }[];
  distribucion_titulo: string;
  distribucion_tipo: string;
  serie: { fecha: string; valor: number }[];
  serie_tipo: string;
}
const modules = [
  {
    id: "productos",
    label: "Productos",
    description: "Catálogo y categorías",
    icon: "box",
    permission: "productos.ver",
  },
  {
    id: "inventario",
    label: "Inventario",
    description: "Saldos y movimientos",
    icon: "inventory",
    permission: "inventario.ver",
  },
  {
    id: "ventas",
    label: "Ventas y cobros",
    description: "Ventas, saldo y ranking",
    icon: "sale",
    permission: "ventas.ver",
  },
  {
    id: "compras",
    label: "Compras",
    description: "Recepciones y proveedores",
    icon: "purchase",
    permission: "compras.ver",
  },
  {
    id: "contactos",
    label: "Contactos",
    description: "Clientes y proveedores",
    icon: "contacts",
    permission: "contactos.ver",
  },
  {
    id: "organizacion",
    label: "Empresa y sedes",
    description: "Ubicaciones autorizadas",
    icon: "building",
    permission: "sedes.ver",
  },
  {
    id: "accesos",
    label: "Usuarios y roles",
    description: "Usuarios y asignaciones",
    icon: "users",
    permission: "owner",
  },
  {
    id: "auditoria",
    label: "Auditoría",
    description: "Eventos registrados",
    icon: "audit",
    permission: "owner",
  },
  {
    id: "excel",
    label: "Importar / exportar",
    description: "Mis operaciones Excel",
    icon: "file",
    permission: "excel",
  },
];
function availableModules(user: User) {
  return modules.filter((m) =>
    m.permission === "owner"
      ? user.propietario
      : m.permission === "excel"
        ? can(user, "excel.importar") || can(user, "excel.exportar")
        : can(user, m.permission) &&
          (m.id !== "compras" || can(user, "costos.ver")),
  );
}
function format(value: number, kind: string, currency: string) {
  return kind === "moneda"
    ? money(value, currency)
    : new Intl.NumberFormat("es-PE", { maximumFractionDigits: 3 }).format(
        Number(value),
      );
}
function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (value: Period) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="period-filter panel"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(draft);
      }}
    >
      <div>
        <strong>Período de operaciones</strong>
        <small>
          Por defecto: últimos 30 días. El catálogo y los saldos son actuales.
        </small>
      </div>
      <Field label="Desde">
        <input
          type="date"
          value={draft.desde}
          max={draft.hasta || undefined}
          onChange={(e) => setDraft({ ...draft, desde: e.target.value })}
        />
      </Field>
      <Field label="Hasta">
        <input
          type="date"
          value={draft.hasta}
          min={draft.desde || undefined}
          onChange={(e) => setDraft({ ...draft, hasta: e.target.value })}
        />
      </Field>
      <button className="action-view" type="submit">
        <Icon name="filter" size={18} />
        Aplicar período
      </button>
      <button
        type="button"
        onClick={() => {
          const empty = { desde: "", hasta: "" };
          setDraft(empty);
          onChange(empty);
        }}
      >
        Últimos 30 días
      </button>
    </form>
  );
}
export function StatsPanel({
  module,
  period,
  compact = false,
}: {
  module: string;
  period: Period;
  compact?: boolean;
}) {
  const params = new URLSearchParams();
  if (period.desde) params.set("desde", period.desde);
  if (period.hasta) params.set("hasta", period.hasta);
  const list = useResource<Report>(`/reportes/modulos/${module}?${params}`);
  const data = list.data;
  if (!data)
    return (
      <section className="panel">
        <ListState loading={list.loading} error={list.error} />
      </section>
    );
  const maximum = Math.max(1, ...data.distribucion.map((x) => Number(x.valor)));
  const maxSeries = Math.max(1, ...data.serie.map((x) => Number(x.valor)));
  const points = data.serie
    .map(
      (x, i) =>
        `${(i * 720) / Math.max(1, data.serie.length - 1)},${155 - (Number(x.valor) / maxSeries) * 135}`,
    )
    .join(" ");
  return (
    <section
      className={`statistics-result ${compact ? "compact-report panel" : ""}`}
    >
      <div className="section-heading">
        <h2>Estadísticas de {data.titulo}</h2>
        {compact && (
          <a className="button action-view" href={`#estadisticas/${module}`}>
            Ver detalle <Icon name="arrow" size={16} />
          </a>
        )}
      </div>
      {!compact && (
        <p className="muted">
          Operaciones: {data.desde} al {data.hasta}. {data.nota}
        </p>
      )}
      <div className="stats">
        {data.indicadores.slice(0, compact ? 4 : undefined).map((x) => (
          <div key={x.etiqueta}>
            <span>{x.etiqueta}</span>
            <strong>{format(x.valor, x.tipo, data.moneda)}</strong>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="statistics-grid">
          <section className="panel">
            <h3>{data.distribucion_titulo}</h3>
            {data.distribucion.length ? (
              <div className="distribution-bars">
                {data.distribucion.map((x) => (
                  <div key={x.etiqueta}>
                    <div>
                      <span>{x.etiqueta}</span>
                      <strong>
                        {format(x.valor, data.distribucion_tipo, data.moneda)}
                      </strong>
                    </div>
                    <div className="bar-track" aria-hidden="true">
                      <i
                        style={{
                          width: `${(Number(x.valor) / maximum) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No hay datos para este período.</Empty>
            )}
          </section>
          {!!data.serie.length && (
            <section className="panel">
              <h3>
                {data.serie_tipo === "moneda"
                  ? "Importe diario"
                  : "Actividad diaria"}
              </h3>
              <div className="chart">
                <svg
                  viewBox="0 0 720 180"
                  role="img"
                  aria-label={`Actividad diaria de ${data.titulo}`}
                >
                  <line x1="0" y1="155" x2="720" y2="155" stroke="#ddd" />
                  <polygon points={`0,155 ${points} 720,155`} fill="#e8eef9" />
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#315bb8"
                    strokeWidth="3"
                  />
                </svg>
                <div className="chart-labels">
                  <span>{data.serie[0]?.fecha}</span>
                  <span>{data.serie.at(-1)?.fecha}</span>
                </div>
              </div>
              <details className="daily-values">
                <summary>Ver valores por día</summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.serie.map((x) => (
                        <tr key={x.fecha}>
                          <td>{x.fecha}</td>
                          <td>
                            {format(x.valor, data.serie_tipo, data.moneda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
export function ModuleStatistics({ module }: { module: string }) {
  const [period, setPeriod] = useState<Period>({ desde: "", hasta: "" });
  return (
    <>
      <PeriodFilter value={period} onChange={setPeriod} />
      <StatsPanel module={module} period={period} />
    </>
  );
}
export default function Statistics({
  user,
  path,
}: {
  user: User;
  path: string;
}) {
  const available = availableModules(user),
    selected = path.split("/")[1] || "todas";
  const [period, setPeriod] = useState<Period>({ desde: "", hasta: "" });
  const safe = available.some((m) => m.id === selected) ? selected : "todas";
  return (
    <>
      <Title
        title="Estadísticas de la empresa"
        subtitle="Todos los indicadores en un lugar, con tus permisos y sedes asignadas."
        icon="chart"
      />
      <SectionTabs
        label="Secciones de estadísticas"
        value={safe}
        onChange={(id) => {
          window.location.hash = `estadisticas/${id}`;
        }}
        items={[
          {
            id: "todas",
            label: "Todas las secciones",
            description: "Resumen de la empresa",
            icon: "chart",
          },
          ...available,
        ]}
      />
      <PeriodFilter value={period} onChange={setPeriod} />
      {safe === "todas" ? (
        <div className="all-statistics">
          {available.map((m) => (
            <StatsPanel key={m.id} module={m.id} period={period} compact />
          ))}
        </div>
      ) : (
        <StatsPanel module={safe} period={period} />
      )}
    </>
  );
}
