import { useState } from "react";
import {
  api,
  can,
  date,
  download,
  money,
  notify,
  num,
  problem,
  str,
} from "../api";
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
interface CartLine {
  producto_id: number;
  nombre: string;
  cantidad: string;
  precio: string;
  descuento: string;
  costo: string;
}
export default function Commercial({
  user,
  currency,
  purchase = false,
}: {
  user: User;
  currency: string;
  purchase?: boolean;
}) {
  const [q, setQ] = useState(""),
    [open, setOpen] = useState(false),
    [offset, setOffset] = useState(0),
    [detail, setDetail] = useState<Row | null>(null);
  const path = purchase ? "/compras" : "/ventas",
    data = useList(
      `${path}?limit=50&offset=${offset}&q=${encodeURIComponent(q)}`,
    );
  const allowed = can(user, purchase ? "compras.crear" : "ventas.crear");
  return (
    <>
      <Title
        title={purchase ? "Compras y recepciones" : "Ventas y cobros"}
        subtitle={
          purchase
            ? "Recibe productos y conserva la referencia de tu proveedor."
            : "Confirma ventas, controla saldos y consulta sus documentos."
        }
      >
        {allowed && (
          <button className="primary" onClick={() => setOpen(true)}>
            + {purchase ? "Recibir compra" : "Nueva venta"}
          </button>
        )}
      </Title>
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Buscar operaciones"
            placeholder={
              purchase
                ? "Buscar número, proveedor, almacén o referencia"
                : "Buscar número, cliente o almacén"
            }
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
          <span className="muted">50 registros por página</span>
        </div>
        <ListState {...data} />
        <DataTable
          rows={data.rows}
          columns={[
            {
              title: "Número",
              cell: (r) => (purchase ? `CO-${r.id}` : str(r, "numero")),
            },
            { title: "Fecha", cell: (r) => date(r.fecha) },
            { title: "Almacén", cell: (r) => str(r, "almacen") },
            {
              title: "Total",
              cell: (r) => money(r.total, str(r, "moneda") || currency),
            },
            ...(purchase
              ? [
                  {
                    title: "Referencia",
                    cell: (r: Row) => str(r, "referencia"),
                  },
                  {
                    title: "Acciones",
                    cell: (r: Row) => (
                      <button
                        onClick={() =>
                          api<Row>(`/compras/${r.id}`)
                            .then(setDetail)
                            .catch(problem)
                        }
                      >
                        Ver detalle
                      </button>
                    ),
                  },
                ]
              : [
                  {
                    title: "Pendiente",
                    cell: (r: Row) =>
                      money(
                        r.estado === "anulada"
                          ? 0
                          : num(r, "total") - num(r, "pagado"),
                        str(r, "moneda"),
                      ),
                  },
                  {
                    title: "Estado",
                    cell: (r: Row) => (
                      <Badge good={r.estado === "confirmada"}>
                        {str(r, "estado")}
                      </Badge>
                    ),
                  },
                  {
                    title: "Acciones",
                    cell: (r: Row) => (
                      <button
                        onClick={() =>
                          api<Row>(`/ventas/${r.id}`)
                            .then(setDetail)
                            .catch(problem)
                        }
                      >
                        Ver detalle
                      </button>
                    ),
                  },
                ]),
          ]}
        />
        <Paginator
          offset={offset}
          size={50}
          count={data.rows.length}
          setOffset={setOffset}
        />
      </section>
      {open && (
        <OrderForm
          purchase={purchase}
          currency={currency}
          close={() => setOpen(false)}
          saved={() => {
            setOpen(false);
            data.reload();
          }}
        />
      )}
      {detail && !purchase && (
        <SaleDetail
          row={detail}
          user={user}
          close={() => setDetail(null)}
          saved={async () => {
            setDetail(await api<Row>(`/ventas/${detail.id}`));
            data.reload();
          }}
        />
      )}
      {detail && purchase && (
        <Modal
          title={`Recepción CO-${detail.id}`}
          close={() => setDetail(null)}
        >
          <p>
            <strong>{str(detail, "proveedor")}</strong> ·{" "}
            {str(detail, "almacen")}
          </p>
          <p className="muted">
            {date(detail.fecha)} ·{" "}
            {str(detail, "referencia") || "Sin referencia"}
          </p>
          <DataTable
            rows={(detail.items || []) as Row[]}
            columns={[
              { title: "Producto", cell: (r) => str(r, "nombre") },
              { title: "Cantidad", cell: (r) => str(r, "cantidad") },
              {
                title: "Costo unitario",
                cell: (r) => money(r.costo, currency),
              },
              { title: "Importe", cell: (r) => money(r.importe, currency) },
            ]}
          />
          <div className="order-total">
            <span>Total de recepción</span>
            <strong>{money(detail.total, currency)}</strong>
          </div>
          <p className="muted">
            Los costos corresponden a esta recepción. La valoración del catálogo
            se configura por separado.
          </p>
        </Modal>
      )}
    </>
  );
}
function OrderForm({
  purchase,
  currency,
  close,
  saved,
}: {
  purchase: boolean;
  currency: string;
  close: () => void;
  saved: () => void;
}) {
  const warehouses = useList("/almacenes?limit=1000"),
    contacts = useList(
      `/contactos?tipo=${purchase ? "proveedor" : "cliente"}&limit=1000`,
    );
  const [store, setStore] = useState(""),
    [contact, setContact] = useState(""),
    [tax, setTax] = useState("0"),
    [reference, setReference] = useState(""),
    [cart, setCart] = useState<CartLine[]>([]),
    [product, setProduct] = useState<Row | null>(null),
    [requestId] = useState(() => crypto.randomUUID());
  const { busy, submit } = useSubmit();
  function add(p: Row) {
    setProduct(p);
    if (!cart.some((r) => r.producto_id === p.id))
      setCart((c) => [
        ...c,
        {
          producto_id: p.id,
          nombre: str(p, "nombre"),
          cantidad: "1",
          precio: str(p, "precio"),
          descuento: "0",
          costo: str(p, "costo") || "0",
        },
      ]);
  }
  function change(id: number, key: string, value: string) {
    setCart((c) =>
      c.map((r) => (r.producto_id === id ? { ...r, [key]: value } : r)),
    );
  }
  const subtotal = cart.reduce(
    (s, r) =>
      s +
      Math.round(
        (Number(r.cantidad) * Number(purchase ? r.costo : r.precio) -
          Number(purchase ? 0 : r.descuento)) *
          100,
      ) /
        100,
    0,
  );
  return (
    <Modal
      title={purchase ? "Recibir una compra" : "Registrar venta"}
      close={close}
    >
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            if (!cart.length) throw new Error("Añade al menos un producto");
            await api(purchase ? "/compras" : "/ventas", {
              method: "POST",
              body: JSON.stringify({
                request_id: requestId,
                almacen_id: Number(store),
                ...(purchase
                  ? { proveedor_id: Number(contact), referencia: reference }
                  : {
                      cliente_id: Number(contact) || null,
                      tasa_impuesto: Number(tax) / 100,
                      observacion: reference,
                    }),
                items: cart.map((r) =>
                  purchase
                    ? {
                        producto_id: r.producto_id,
                        cantidad: r.cantidad,
                        costo: r.costo,
                      }
                    : {
                        producto_id: r.producto_id,
                        cantidad: r.cantidad,
                        precio: r.precio,
                        descuento: r.descuento,
                      },
                ),
              }),
            });
            notify(
              purchase
                ? "Compra recibida e inventario actualizado"
                : "Venta confirmada e inventario actualizado",
            );
            saved();
          })
        }
      >
        <div className="form-guide">
          {purchase
            ? "Selecciona dónde recibirás la compra, añade productos y verifica los costos."
            : "Selecciona dónde venderás, añade productos y revisa el total. Después podrás registrar el cobro."}
        </div>
        <h3 className="form-section">
          <span>01</span> Ubicación y contacto
        </h3>
        <div className="form-grid">
          <Field label="Almacén">
            <select
              required
              value={store}
              onChange={(e) => setStore(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {warehouses.rows
                .filter((r) => r.activo)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {str(r, "nombre")}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={purchase ? "Proveedor" : "Cliente"}>
            <select
              required={purchase}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            >
              <option value="">
                {purchase ? "Seleccionar" : "Cliente ocasional"}
              </option>
              {contacts.rows
                .filter((r) => r.activo)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {str(r, "nombre")}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <h3 className="form-section">
          <span>02</span> Añade los productos
        </h3>
        <ProductLookup value={product} onChange={add} />
        <div className="cart">
          {cart.map((r) => (
            <div className="cart-line" key={r.producto_id}>
              <strong>{r.nombre}</strong>
              <div className="form-grid">
                <Field label="Cantidad">
                  <input
                    type="number"
                    required
                    min=".001"
                    step=".001"
                    value={r.cantidad}
                    onChange={(e) =>
                      change(r.producto_id, "cantidad", e.target.value)
                    }
                  />
                </Field>
                <Field label={purchase ? "Costo unitario" : "Precio unitario"}>
                  <input
                    type="number"
                    required
                    min="0"
                    step=".01"
                    value={purchase ? r.costo : r.precio}
                    onChange={(e) =>
                      change(
                        r.producto_id,
                        purchase ? "costo" : "precio",
                        e.target.value,
                      )
                    }
                  />
                </Field>
                {!purchase && (
                  <Field label="Descuento total de la fila">
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={r.descuento}
                      onChange={(e) =>
                        change(r.producto_id, "descuento", e.target.value)
                      }
                    />
                  </Field>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCart((c) =>
                    c.filter((x) => x.producto_id !== r.producto_id),
                  )
                }
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <div className="form-grid">
          <Field label={purchase ? "Referencia de recepción" : "Observación"}>
            <input
              maxLength={purchase ? 100 : 300}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          {!purchase && (
            <Field label="Impuesto adicional (%)">
              <input
                type="number"
                min="0"
                max="100"
                step=".1"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </Field>
          )}
        </div>
        <h3 className="form-section">
          <span>03</span> Revisa y confirma
        </h3>
        <div className="order-total">
          <span>Total estimado</span>
          <strong>
            {money(subtotal * (purchase ? 1 : 1 + Number(tax) / 100), currency)}
          </strong>
        </div>
        <p className="muted">
          {purchase
            ? "Registra una recepción completa. Actualiza existencias y conserva los costos de la compra."
            : "El precio es antes del impuesto adicional. Confirmar descuenta stock; el cobro se registra después."}
        </p>
        <div className="form-footer">
          <Save
            busy={busy}
            label={purchase ? "Confirmar recepción" : "Confirmar venta"}
          />
        </div>
      </form>
    </Modal>
  );
}
function SaleDetail({
  row,
  user,
  close,
  saved,
}: {
  row: Row;
  user: User;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [tab, setTab] = useState("detalle"),
    [amount, setAmount] = useState(
      String(num(row, "total") - num(row, "pagado")),
    ),
    [method, setMethod] = useState("efectivo"),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const { busy, submit } = useSubmit();
  const lines = (row.items || []) as Row[],
    payments = (row.pagos || []) as Row[],
    currency = str(row, "moneda");
  return (
    <Modal title={`Venta ${str(row, "numero")}`} close={close}>
      <div className="section-heading">
        <Badge good={row.estado === "confirmada"}>{str(row, "estado")}</Badge>
        <strong>{money(row.total, currency)}</strong>
      </div>
      <div className="tabs">
        <button
          className={tab === "detalle" ? "active" : ""}
          onClick={() => setTab("detalle")}
        >
          Detalle
        </button>
        {row.estado === "confirmada" &&
          num(row, "total") > num(row, "pagado") &&
          can(user, "pagos.registrar") && (
            <button
              className={tab === "pago" ? "active" : ""}
              onClick={() => setTab("pago")}
            >
              Registrar cobro
            </button>
          )}
        {row.estado === "confirmada" && can(user, "ventas.anular") && (
          <button
            className={tab === "anular" ? "active" : ""}
            onClick={() => setTab("anular")}
          >
            Anular venta
          </button>
        )}
      </div>
      {tab === "detalle" ? (
        <>
          <DataTable
            rows={lines}
            columns={[
              { title: "Producto", cell: (r) => str(r, "nombre") },
              { title: "Cantidad", cell: (r) => str(r, "cantidad") },
              { title: "Importe", cell: (r) => money(r.importe, currency) },
            ]}
          />
          <h3>Cobros registrados</h3>
          <DataTable
            rows={payments}
            columns={[
              { title: "Método", cell: (r) => str(r, "metodo") },
              { title: "Monto", cell: (r) => money(r.monto, currency) },
              { title: "Referencia", cell: (r) => str(r, "referencia") },
            ]}
          />
          <p>
            Pendiente:{" "}
            <strong>
              {money(
                row.estado === "anulada"
                  ? 0
                  : num(row, "total") - num(row, "pagado"),
                currency,
              )}
            </strong>
          </p>
          {row.estado === "anulada" && num(row, "pagado") > 0 && (
            <p className="error">
              Esta venta tiene cobros. Concilia el reembolso fuera del sistema.
            </p>
          )}
          <button
            onClick={() =>
              download(
                `/ventas/${row.id}/comprobante`,
                `venta-${row.id}.pdf`,
              ).catch(problem)
            }
          >
            Descargar constancia PDF
          </button>
          <p className="muted">Documento interno sin validez tributaria.</p>
        </>
      ) : tab === "pago" ? (
        <form
          onSubmit={(e) =>
            submit(e, async () => {
              await api(`/ventas/${row.id}/pagos`, {
                method: "POST",
                body: JSON.stringify({
                  request_id: requestId,
                  monto: amount,
                  metodo: method,
                  referencia: reference,
                }),
              });
              setRequestId(crypto.randomUUID());
              notify("Cobro registrado");
              await saved();
              setTab("detalle");
            })
          }
        >
          <Field label="Monto verificado">
            <input
              type="number"
              required
              min=".01"
              max={num(row, "total") - num(row, "pagado")}
              step=".01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Medio de pago">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {["efectivo", "tarjeta", "transferencia", "yape", "plin"].map(
                (m) => (
                  <option key={m}>{m}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Referencia">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required={["yape", "plin", "transferencia"].includes(method)}
              maxLength={100}
            />
          </Field>
          <p className="muted">
            Registra el cobro solo después de verificar que el dinero fue
            recibido.
          </p>
          <Save busy={busy} label="Confirmar cobro" />
        </form>
      ) : (
        <form
          onSubmit={(e) =>
            submit(e, async () => {
              await api(`/ventas/${row.id}/anular`, {
                method: "POST",
                body: JSON.stringify({ motivo: reason }),
              });
              notify("Venta anulada; stock devuelto");
              await saved();
              setTab("detalle");
            })
          }
        >
          <Field label="Motivo de anulación">
            <textarea
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <p className="muted">
            Se devuelve el stock y se conserva el historial. Los cobros
            requieren conciliación de reembolso.
          </p>
          <Save busy={busy} label="Confirmar anulación" />
        </form>
      )}
    </Modal>
  );
}
