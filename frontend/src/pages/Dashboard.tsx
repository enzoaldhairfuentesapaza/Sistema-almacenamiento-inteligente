import { useEffect, useState } from "react";
import { api, money, problem, can } from "../api";
import type { Row, User } from "../api";
import { Icon } from "../icons";
import { Title, Empty, Badge } from "../ui";
interface Summary {
  productos: number;
  unidades: number;
  ventas_total: number;
  ventas_hoy: number;
  pendiente: number;
  valor_inventario?: number;
  alertas: Row[];
  serie: { fecha: string; valor: number }[];
  ranking: { nombre: string; cantidad: number }[];
}
export default function Dashboard({
  currency,
  user,
}: {
  currency: string;
  user: User;
}) {
  const [data, setData] = useState<Summary | null>(null);
  useEffect(() => {
    api<Summary>("/reportes/resumen").then(setData).catch(problem);
  }, []);
  if (!data) return <p>Cargando indicadores…</p>;
  const maximum = Math.max(1, ...data.serie.map((p) => p.valor)),
    points = data.serie
      .map((p, i) => `${(i * 720) / 29},${150 - (p.valor / maximum) * 130}`)
      .join(" ");
  return (
    <>
      <Title
        title="Tu negocio, de un vistazo"
        subtitle="Existencias, ventas y señales que necesitan tu atención."
      />
      <div className="hero">
        <div>
          <span className="eyebrow">DEL ALMACÉN AL MOSTRADOR</span>
          <h2>Tu operación, bajo control.</h2>
          <p>
            Una vista clara de tu operación, desde el almacén hasta la venta.
          </p>
          <div className="hero-links">
            {can(user, "inventario.ver") && (
              <a className="primary button" href="#inventario">
                Revisar inventario <Icon name="arrow" size={16} />
              </a>
            )}
            {can(user, "pronosticos.ver") && (
              <a className="button" href="#inteligencia">
                Explorar pronósticos <Icon name="sparkle" size={16} />
              </a>
            )}
          </div>
        </div>
        <img className="hero-art" src="/industrial.svg" alt="" />
      </div>
      <div className="quick-actions">
        {[
          {
            permission: "ventas.crear",
            href: "ventas",
            icon: "sale",
            title: "Registrar una venta",
            text: "Productos, total y cobros",
          },
          {
            permission: "inventario.mover",
            href: "inventario",
            icon: "inventory",
            title: "Mover existencias",
            text: "Entradas, salidas y transferencias",
          },
          {
            permission: "productos.editar",
            href: "productos",
            icon: "box",
            title: "Gestionar productos",
            text: "Artículos, imágenes y variantes",
          },
        ]
          .filter((a) => can(user, a.permission))
          .map((a) => (
            <a className="quick-action" key={a.href} href={`#${a.href}`}>
              <Icon name={a.icon} size={20} />
              <div>
                <strong>{a.title}</strong>
                <small>{a.text}</small>
              </div>
              <Icon name="chevron" size={16} />
            </a>
          ))}
      </div>
      <div className="stats">
        <div>
          <span className="stat-icon">
            <Icon name="box" size={18} />
          </span>
          <span>Productos activos</span>
          <strong>{data.productos}</strong>
          <small>Catálogo de la empresa</small>
        </div>
        <div>
          <span className="stat-icon">
            <Icon name="sale" size={18} />
          </span>
          <span>Ventas de hoy</span>
          <strong>{money(data.ventas_hoy, currency)}</strong>
          <small>Ventas confirmadas</small>
        </div>
        <div>
          <span className="stat-icon">
            <Icon name="file" size={18} />
          </span>
          <span>Pendiente de cobro</span>
          <strong>{money(data.pendiente, currency)}</strong>
          <small>Saldo de ventas vigentes</small>
        </div>
        <div>
          <span className="stat-icon">
            <Icon name="inventory" size={18} />
          </span>
          <span>Alertas de stock</span>
          <strong>{data.alertas.length}</strong>
          <small>En tus almacenes autorizados</small>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Ventas en los últimos 30 días</h2>
            <Badge good>Datos registrados</Badge>
          </div>
          <div className="chart">
            <svg
              viewBox="0 0 720 170"
              role="img"
              aria-label="Ventas diarias de los últimos treinta días"
            >
              <line x1="0" y1="150" x2="720" y2="150" stroke="#deded3" />
              <polygon points={`0,150 ${points} 720,150`} fill="#fff2b6" />
              <polyline
                points={points}
                fill="none"
                stroke="#c59800"
                strokeWidth="3"
              />
            </svg>
            <div className="chart-labels">
              <span>{data.serie[0]?.fecha}</span>
              <span>{data.serie.at(-1)?.fecha}</span>
            </div>
          </div>
          <p className="muted">
            Total histórico confirmado: {money(data.ventas_total, currency)}.
            Los cobros se registran por separado.
          </p>
        </section>
        <section className="panel">
          <h2>Productos más vendidos</h2>
          {data.ranking.length ? (
            data.ranking.slice(0, 5).map((p, i) => (
              <div className="rank" key={p.nombre}>
                <span>0{i + 1}</span>
                <strong>{p.nombre}</strong>
                <Badge good>{p.cantidad} u.</Badge>
              </div>
            ))
          ) : (
            <Empty>El ranking aparecerá al registrar ventas.</Empty>
          )}
        </section>
        <section className="panel wide">
          <div className="section-heading">
            <h2>Reposición a la vista</h2>
            <a href="#inventario">Ver inventario →</a>
          </div>
          {data.alertas.length ? (
            <div className="alerts-grid">
              {data.alertas.slice(0, 6).map((p) => (
                <div key={`${p.producto_id}-${p.almacen_id}`}>
                  <strong>{String(p.nombre)}</strong>
                  <p>
                    {String(p.sku)} ·{" "}
                    {String(p.almacen || `Almacén ${p.almacen_id}`)}
                  </p>
                  <Badge>
                    {String(p.cantidad)} disponibles · mínimo {String(p.minimo)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No hay alertas en las existencias registradas.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
