import { useEffect, useState } from "react";
import { api, can, download, money, notify, num, problem, str } from "../api";
import type { Row, User } from "../api";
import {
  Badge,
  DataTable,
  Field,
  FilePicker,
  ProductThumb,
  ListState,
  Modal,
  Paginator,
  ProductLookup,
  Save,
  Title,
} from "../ui";
import { useList, useSubmit } from "../hooks";
interface Definition {
  clave: string;
  etiqueta: string;
  tipo: string;
  obligatorio: boolean;
  opciones: string[];
}
export default function Catalog({
  user,
  currency,
}: {
  user: User;
  currency: string;
}) {
  const [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [edit, setEdit] = useState<Row | null | undefined>(undefined),
    [tab, setTab] = useState("productos");
  const products = useList(
      `/productos?limit=50&offset=${offset}&q=${encodeURIComponent(q)}`,
    ),
    types = useList("/tipos"),
    cats = useList("/categorias");
  const [meta, setMeta] = useState("");
  const allowed = can(user, "productos.editar");
  async function status(r: Row) {
    try {
      await api(`/productos/${r.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !r.activo }),
      });
      products.reload();
      notify("Estado actualizado");
    } catch (e) {
      problem(e);
    }
  }
  return (
    <>
      <Title
        title="Catálogo de productos"
        subtitle="Artículos, variantes y atributos que se adaptan a tu negocio."
      >
        {allowed && (
          <button
            className="primary"
            onClick={() => (tab === "productos" ? setEdit(null) : setMeta(tab))}
          >
            +{" "}
            {tab === "productos"
              ? "Nuevo producto"
              : tab === "tipos"
                ? "Nuevo tipo"
                : "Nueva categoría"}
          </button>
        )}
      </Title>
      <div className="tabs">
        {["productos", "tipos", "categorias"].map((t) => (
          <button
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t === "categorias"
              ? "Categorías"
              : t === "tipos"
                ? "Tipos y campos"
                : "Productos"}
          </button>
        ))}
      </div>
      {tab === "productos" ? (
        <section className="panel">
          <div className="toolbar">
            <input
              placeholder="Buscar por nombre, SKU o marca"
              aria-label="Buscar catálogo"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
            <span className="muted">50 registros por página</span>
          </div>
          <ListState {...products} />
          <DataTable
            rows={products.rows}
            columns={[
              {
                title: "Producto",
                cell: (r) => (
                  <div className="product-cell">
                    <ProductThumb row={r} />
                    <div>
                      <strong>{str(r, "nombre")}</strong>
                      <small>
                        {str(r, "sku")} · {str(r, "marca") || "Sin marca"}
                      </small>
                    </div>
                  </div>
                ),
              },
              {
                title: "Tipo",
                cell: (r) =>
                  str(
                    types.rows.find((t) => t.id === num(r, "tipo_id")) || {
                      id: 0,
                    },
                    "nombre",
                  ) || "General",
              },
              { title: "Precio", cell: (r) => money(r.precio, currency) },
              ...(can(user, "costos.ver")
                ? [
                    {
                      title: "Costo",
                      cell: (r: Row) => money(r.costo, currency),
                    },
                  ]
                : []),
              {
                title: "Estado",
                cell: (r) => (
                  <Badge good={Boolean(r.activo)}>
                    {r.activo ? "Activo" : "Archivado"}
                  </Badge>
                ),
              },
              {
                title: "Acciones",
                cell: (r) => (
                  <div className="row-actions">
                    {allowed && (
                      <>
                        <button onClick={() => setEdit(r)}>Editar</button>
                        <button onClick={() => status(r)}>
                          {r.activo ? "Archivar" : "Activar"}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() =>
                        download(
                          `/productos/${r.id}/qr`,
                          `qr-${str(r, "sku")}.png`,
                        ).catch(problem)
                      }
                    >
                      QR
                    </button>
                  </div>
                ),
              },
            ]}
          />
          <Paginator
            offset={offset}
            size={50}
            count={products.rows.length}
            setOffset={setOffset}
          />
        </section>
      ) : (
        <section className="panel">
          <DataTable
            rows={tab === "tipos" ? types.rows : cats.rows}
            columns={[
              { title: "Nombre", cell: (r) => str(r, "nombre") },
              {
                title: tab === "tipos" ? "Campos dinámicos" : "Categoría padre",
                cell: (r) =>
                  tab === "tipos"
                    ? (r.campos as Definition[])
                        .map((f) => f.etiqueta)
                        .join(", ") || "Sin campos"
                    : str(
                        cats.rows.find((c) => c.id === num(r, "padre_id")) || {
                          id: 0,
                        },
                        "nombre",
                      ) || "Principal",
              },
            ]}
          />
        </section>
      )}
      {edit !== undefined && (
        <ProductForm
          user={user}
          row={edit}
          types={types.rows}
          cats={cats.rows}
          close={() => setEdit(undefined)}
          saved={() => {
            setEdit(undefined);
            products.reload();
          }}
        />
      )}
      {meta && (
        <MetaForm
          kind={meta}
          cats={cats.rows}
          close={() => setMeta("")}
          saved={() => {
            setMeta("");
            types.reload();
            cats.reload();
          }}
        />
      )}
    </>
  );
}
function ProductForm({
  row,
  types,
  cats,
  user,
  close,
  saved,
}: {
  row: Row | null;
  types: Row[];
  cats: Row[];
  user: User;
  close: () => void;
  saved: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>(
    row
      ? { ...row }
      : {
          sku: "",
          nombre: "",
          descripcion: "",
          marca: "",
          unidad: "unidad",
          precio: "0",
          costo: "0",
          stock_minimo: "0",
          tipo_id: null,
          categoria_id: null,
          producto_padre_id: null,
          atributos: {},
          activo: true,
        },
  );
  const [parentProduct, setParentProduct] = useState<Row | null>(null);
  useEffect(() => {
    if (row?.producto_padre_id)
      api<Row>(`/productos/${row.producto_padre_id}`)
        .then(setParentProduct)
        .catch(problem);
  }, [row]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const { busy, submit } = useSubmit();
  const change = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));
  const fields = (types.find((t) => t.id === Number(data.tipo_id))?.campos ||
    []) as Definition[];
  const attrs = data.atributos as Record<string, unknown>;
  return (
    <Modal title={row ? "Editar producto" : "Nuevo producto"} close={close}>
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            const { id: _id, imagen: _imagen, ...body } = data;
            void _id;
            void _imagen;
            if (!can(user, "costos.ver")) delete body.costo;
            const record = await api<Row>(
              row ? `/productos/${row.id}` : "/productos",
              {
                method: row ? "PUT" : "POST",
                body: JSON.stringify(body),
              },
            );
            if (photo || removePhoto) {
              try {
                if (photo) {
                  const form = new FormData();
                  form.append("file", photo);
                  await api(`/productos/${record.id}/imagen`, {
                    method: "POST",
                    body: form,
                  });
                } else
                  await api(`/productos/${record.id}/imagen`, {
                    method: "DELETE",
                  });
              } catch (e) {
                notify(
                  "Producto guardado. No se pudo actualizar la imagen: " +
                    (e instanceof Error ? e.message : "inténtalo desde Editar"),
                  true,
                );
                saved();
                return;
              }
            }
            notify("Producto guardado");
            saved();
          })
        }
      >
        <div className="form-guide">
          Identifica el artículo, organiza su categoría y define sus importes.
          Las existencias se cargan desde Inventario.
        </div>
        <h3 className="form-section">
          <span>01</span> Identificación y organización
        </h3>
        <div className="form-grid">
          <Field
            label="SKU"
            hint="Código único, por ejemplo REP-FIL-001. Sin espacios."
          >
            <input
              required
              maxLength={80}
              pattern="[A-Za-z0-9_.\-]+"
              value={String(data.sku)}
              onChange={(e) => change("sku", e.target.value)}
            />
          </Field>
          <Field label="Nombre">
            <input
              required
              maxLength={200}
              value={String(data.nombre)}
              onChange={(e) => change("nombre", e.target.value)}
            />
          </Field>
          <Field label="Marca">
            <input
              value={String(data.marca)}
              onChange={(e) => change("marca", e.target.value)}
            />
          </Field>
          <Field label="Unidad" hint="Ejemplo: unidad, metro, litro o caja.">
            <input
              required
              value={String(data.unidad)}
              onChange={(e) => change("unidad", e.target.value)}
            />
          </Field>
          <Field label="Tipo de producto">
            <select
              value={String(data.tipo_id || "")}
              onChange={(e) => {
                change("tipo_id", Number(e.target.value) || null);
                change("atributos", {});
              }}
            >
              <option value="">General</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {str(t, "nombre")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoría">
            <select
              value={String(data.categoria_id || "")}
              onChange={(e) =>
                change("categoria_id", Number(e.target.value) || null)
              }
            >
              <option value="">Sin categoría</option>
              {cats.map((t) => (
                <option key={t.id} value={t.id}>
                  {str(t, "nombre")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Precio de venta">
            <input
              type="number"
              required
              min="0"
              step=".01"
              value={String(data.precio)}
              onChange={(e) => change("precio", e.target.value)}
            />
          </Field>
          {can(user, "costos.ver") && (
            <Field label="Costo unitario">
              <input
                type="number"
                required
                min="0"
                step=".01"
                value={String(data.costo)}
                onChange={(e) => change("costo", e.target.value)}
              />
            </Field>
          )}
          <Field
            label="Stock mínimo por almacén"
            hint="Se mostrará una alerta cuando el stock sea igual o menor."
          >
            <input
              type="number"
              min="0"
              step=".001"
              value={String(data.stock_minimo)}
              onChange={(e) => change("stock_minimo", e.target.value)}
            />
          </Field>
        </div>
        <h3 className="form-section">
          <span>02</span> Imagen del producto
        </h3>
        {Boolean(row?.imagen) && row && !removePhoto && !photo && (
          <div className="existing-photo">
            <ProductThumb row={row} />
            <button type="button" onClick={() => setRemovePhoto(true)}>
              Quitar imagen actual
            </button>
          </div>
        )}
        <FilePicker
          file={photo}
          onChange={(f) => {
            setPhoto(f);
            setRemovePhoto(false);
          }}
          accept=".jpg,.jpeg,.png,.webp"
          label="Agregar imagen"
          hint="Opcional · JPG, PNG o WebP · máximo 5 MB"
          preview
        />
        <div className="parent-selection">
          <h3 className="form-section">
            <span>03</span> Variantes y detalles
          </h3>
          <p>
            <strong>Producto padre (opcional)</strong>
          </p>
          <p className="muted">
            Deja vacío para un artículo independiente. La variante debe usar el
            mismo tipo que su padre.
          </p>
          <ProductLookup
            parentsOnly
            excludeId={row?.id}
            value={data.producto_padre_id ? parentProduct : null}
            onChange={(p) => {
              setParentProduct(p);
              change("producto_padre_id", p.id);
              change("tipo_id", p.tipo_id);
              change("atributos", {});
            }}
          />
          <button
            type="button"
            onClick={() => change("producto_padre_id", null)}
          >
            Sin producto padre
          </button>
        </div>
        <Field
          label="Descripción"
          hint="Describe compatibilidad, medidas o usos habituales."
        >
          <textarea
            value={String(data.descripcion)}
            onChange={(e) => change("descripcion", e.target.value)}
          />
        </Field>
        {fields.length > 0 && (
          <>
            <h3>Atributos del producto</h3>
            <div className="form-grid">
              {fields.map((f) => (
                <Field
                  key={f.clave}
                  label={`${f.etiqueta}${f.obligatorio ? " *" : ""}`}
                >
                  {f.tipo === "seleccion" ? (
                    <select
                      required={f.obligatorio}
                      value={String(attrs[f.clave] ?? "")}
                      onChange={(e) =>
                        change("atributos", {
                          ...attrs,
                          [f.clave]: e.target.value,
                        })
                      }
                    >
                      <option value="">Seleccionar</option>
                      {f.opciones.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.tipo === "booleano" ? (
                    <select
                      value={String(attrs[f.clave] ?? "")}
                      required={f.obligatorio}
                      onChange={(e) =>
                        change("atributos", {
                          ...attrs,
                          [f.clave]:
                            e.target.value === ""
                              ? null
                              : e.target.value === "true",
                        })
                      }
                    >
                      <option value="">Sin definir</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      required={f.obligatorio}
                      type={
                        f.tipo === "numero"
                          ? "number"
                          : f.tipo === "fecha"
                            ? "date"
                            : "text"
                      }
                      step={f.tipo === "numero" ? "any" : undefined}
                      value={String(attrs[f.clave] ?? "")}
                      onChange={(e) =>
                        change("atributos", {
                          ...attrs,
                          [f.clave]:
                            f.tipo === "numero"
                              ? e.target.value === ""
                                ? null
                                : Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </>
        )}
        <div className="form-footer">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <Save busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
function MetaForm({
  kind,
  cats,
  close,
  saved,
}: {
  kind: string;
  cats: Row[];
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(""),
    [parent, setParent] = useState(""),
    [fields, setFields] = useState<Definition[]>([]);
  const { busy, submit } = useSubmit();
  const change = (i: number, key: string, value: unknown) =>
    setFields((items) =>
      items.map((f, n) => (n === i ? { ...f, [key]: value } : f)),
    );
  return (
    <Modal
      title={
        kind === "tipos" ? "Tipo y atributos dinámicos" : "Nueva categoría"
      }
      close={close}
    >
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            await api(kind === "tipos" ? "/tipos" : "/categorias", {
              method: "POST",
              body: JSON.stringify(
                kind === "tipos"
                  ? { nombre: name, campos: fields }
                  : { nombre: name, padre_id: Number(parent) || null },
              ),
            });
            notify("Configuración guardada");
            saved();
          })
        }
      >
        <Field label="Nombre">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {kind === "categorias" ? (
          <Field label="Categoría padre">
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Principal</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {str(c, "nombre")}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <p className="muted">
              Define campos como talla, material, modelo o compatibilidad.
            </p>
            {fields.map((f, i) => (
              <div className="field-definition" key={i}>
                <div className="form-grid">
                  <Field label="Clave (sin espacios)">
                    <input
                      required
                      pattern="[a-z][a-z0-9_]{0,39}"
                      value={f.clave}
                      onChange={(e) => change(i, "clave", e.target.value)}
                    />
                  </Field>
                  <Field label="Etiqueta">
                    <input
                      required
                      value={f.etiqueta}
                      onChange={(e) => change(i, "etiqueta", e.target.value)}
                    />
                  </Field>
                  <Field label="Tipo">
                    <select
                      value={f.tipo}
                      onChange={(e) => change(i, "tipo", e.target.value)}
                    >
                      {[
                        "texto",
                        "numero",
                        "fecha",
                        "booleano",
                        "seleccion",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  {f.tipo === "seleccion" && (
                    <Field label="Opciones separadas por coma">
                      <input
                        required
                        value={f.opciones.join(",")}
                        onChange={(e) =>
                          change(i, "opciones", e.target.value.split(","))
                        }
                      />
                    </Field>
                  )}
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={f.obligatorio}
                    onChange={(e) => change(i, "obligatorio", e.target.checked)}
                  />{" "}
                  Obligatorio
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFields((fs) => fs.filter((_, j) => j !== i))
                  }
                >
                  Quitar campo
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setFields((fs) => [
                  ...fs,
                  {
                    clave: "",
                    etiqueta: "",
                    tipo: "texto",
                    obligatorio: false,
                    opciones: [],
                  },
                ])
              }
            >
              + Añadir campo
            </button>
          </>
        )}
        <div className="form-footer">
          <Save busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
