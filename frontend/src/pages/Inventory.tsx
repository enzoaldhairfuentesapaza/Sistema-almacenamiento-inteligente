import { useState } from "react";
import { api, can, notify, num, str, date } from "../api";
import type { Row, User } from "../api";
import {
  Badge,
  DataTable,
  Field,
  ListState,
  Modal,
  Paginator,
  ProductLookup,
  Save,
  Title,
} from "../ui";
import { useList, useSubmit } from "../hooks";
export default function Inventory({ user }: { user: User }) {
  const [tab, setTab] = useState("stock"),
    [store, setStore] = useState(""),
    [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [open, setOpen] = useState(false);
  const warehouses = useList("/almacenes?limit=1000"),
    rows = useList(
      `/${tab === "stock" ? "inventario" : "movimientos"}?limit=50&offset=${offset}&q=${encodeURIComponent(q)}${store ? `&almacen_id=${store}` : ""}`,
    );
  return (
    <>
      <Title
        title="Inventario y movimientos"
        subtitle="Cada entrada, salida y transferencia conserva su historia."
      >
        {can(user, "inventario.mover") && (
          <button className="primary" onClick={() => setOpen(true)}>
            + Registrar movimiento
          </button>
        )}
      </Title>
      <div className="tabs">
        <button
          className={tab === "stock" ? "active" : ""}
          onClick={() => {
            setTab("stock");
            setOffset(0);
          }}
        >
          Existencias
        </button>
        <button
          className={tab === "kardex" ? "active" : ""}
          onClick={() => {
            setTab("kardex");
            setOffset(0);
          }}
        >
          Kardex
        </button>
      </div>
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Buscar inventario"
            placeholder="Buscar por nombre o SKU"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
          <select
            aria-label="Filtrar almacén"
            value={store}
            onChange={(e) => {
              setStore(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos mis almacenes</option>
            {warehouses.rows.map((a) => (
              <option key={a.id} value={a.id}>
                {str(a, "nombre")} · {str(a, "sede")}
              </option>
            ))}
          </select>
          <button onClick={rows.reload}>Actualizar</button>
        </div>
        <ListState {...rows} />
        <DataTable
          rows={rows.rows}
          columns={
            tab === "stock"
              ? [
                  {
                    title: "Producto",
                    cell: (r) => (
                      <>
                        <strong>{str(r, "producto")}</strong>
                        <small>{str(r, "sku")}</small>
                      </>
                    ),
                  },
                  { title: "Almacén", cell: (r) => str(r, "almacen") },
                  {
                    title: "Cantidad",
                    cell: (r) => <strong>{str(r, "cantidad")}</strong>,
                  },
                  { title: "Mínimo", cell: (r) => str(r, "stock_minimo") },
                  {
                    title: "Señal",
                    cell: (r) => (
                      <Badge good={!r.alerta}>
                        {r.alerta ? "Reponer" : "Disponible"}
                      </Badge>
                    ),
                  },
                ]
              : [
                  { title: "Fecha", cell: (r) => date(r.fecha) },
                  {
                    title: "Producto",
                    cell: (r) => (
                      <>
                        {str(r, "producto")}
                        <small>{str(r, "sku")}</small>
                      </>
                    ),
                  },
                  { title: "Almacén", cell: (r) => str(r, "almacen") },
                  {
                    title: "Operación",
                    cell: (r) =>
                      ({
                        entrada: "Entrada",
                        salida: "Salida",
                        venta: "Venta",
                        compra: "Compra recibida",
                        ajuste: "Ajuste",
                        anulacion: "Anulación",
                        transferencia_salida: "Transferencia: salida",
                        transferencia_entrada: "Transferencia: entrada",
                      })[str(r, "tipo")] || str(r, "tipo"),
                  },
                  {
                    title: "Cambio",
                    cell: (r) => (
                      <span
                        className={
                          num(r, "cantidad") > 0 ? "positive" : "negative"
                        }
                      >
                        {num(r, "cantidad") > 0 ? "+" : ""}
                        {str(r, "cantidad")}
                      </span>
                    ),
                  },
                  { title: "Saldo", cell: (r) => str(r, "saldo") },
                  {
                    title: "Motivo",
                    cell: (r) => (
                      <>
                        {str(r, "motivo")}
                        <small>{str(r, "referencia")}</small>
                      </>
                    ),
                  },
                ]
          }
        />
        <Paginator
          offset={offset}
          size={50}
          count={rows.rows.length}
          setOffset={setOffset}
        />
      </section>
      {open && (
        <MoveForm
          warehouses={warehouses.rows.filter((a) => a.activo)}
          user={user}
          close={() => setOpen(false)}
          saved={() => {
            setOpen(false);
            rows.reload();
          }}
        />
      )}
    </>
  );
}
function MoveForm({
  warehouses,
  user,
  close,
  saved,
}: {
  warehouses: Row[];
  user: User;
  close: () => void;
  saved: () => void;
}) {
  const [product, setProduct] = useState<Row | null>(null),
    [type, setType] = useState("entrada"),
    [store, setStore] = useState(""),
    [destination, setDestination] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [reason, setReason] = useState(""),
    [direction, setDirection] = useState("sumar");
  const stock = useList(
    product && store
      ? `/inventario?producto_id=${product.id}&almacen_id=${store}`
      : null,
  );
  const available = stock.rows.reduce((sum, r) => sum + num(r, "cantidad"), 0);
  const { busy, submit } = useSubmit();
  return (
    <Modal title="Registrar movimiento" close={close}>
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            if (!product) throw new Error("Selecciona un producto");
            await api("/movimientos", {
              method: "POST",
              body: JSON.stringify({
                producto_id: product.id,
                almacen_id: Number(store),
                tipo: type,
                cantidad: quantity,
                motivo: reason,
                destino_id:
                  type === "transferencia" ? Number(destination) : null,
                direccion_ajuste: direction,
              }),
            });
            notify("Movimiento registrado");
            saved();
          })
        }
      >
        <div className="form-guide">
          {type === "entrada"
            ? "Entrada: añade unidades al almacén elegido."
            : type === "salida"
              ? "Salida: retira unidades del almacén elegido."
              : type === "transferencia"
                ? "Transferencia: mueve unidades entre dos almacenes."
                : "Ajuste: suma o resta la diferencia encontrada en el conteo."}
        </div>
        <h3 className="form-section">
          <span>01</span> Elige el producto
        </h3>
        <ProductLookup value={product} onChange={setProduct} />
        <h3 className="form-section">
          <span>02</span> Define el movimiento
        </h3>
        {product && store && !stock.loading && (
          <p className="availability">
            <strong>{available}</strong> unidades disponibles en el almacén
            seleccionado.
          </p>
        )}
        <div className="form-grid">
          <Field label="Operación">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              {can(user, "inventario.ajustar") && (
                <>
                  <option value="transferencia">Transferencia</option>
                  <option value="ajuste">Ajuste</option>
                </>
              )}
            </select>
          </Field>
          <Field
            label={
              type === "entrada"
                ? "Almacén de ingreso"
                : type === "ajuste"
                  ? "Almacén a ajustar"
                  : "Almacén de origen"
            }
          >
            <select
              required
              value={store}
              onChange={(e) => setStore(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {warehouses.map((a) => (
                <option key={a.id} value={a.id}>
                  {str(a, "nombre")}
                </option>
              ))}
            </select>
          </Field>
          {type === "transferencia" && (
            <Field label="Almacén de destino">
              <select
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {warehouses
                  .filter((a) => a.id !== Number(store))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {str(a, "nombre")}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {type === "ajuste" && (
            <Field label="Dirección">
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="sumar">Sumar unidades</option>
                <option value="restar">Restar unidades</option>
              </select>
            </Field>
          )}
          <Field label="Cantidad">
            <input
              type="number"
              required
              min=".001"
              step=".001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Motivo"
          hint="Ejemplo: recepción de proveedor, traslado a tienda o diferencia de conteo."
        >
          <textarea
            required
            minLength={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="muted">
          La operación se registra en el Kardex. No se permite stock negativo.
        </p>
        <div className="form-footer">
          <Save busy={busy} label="Confirmar movimiento" />
        </div>
      </form>
    </Modal>
  );
}
