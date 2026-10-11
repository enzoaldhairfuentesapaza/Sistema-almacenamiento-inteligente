import { useEffect, useState } from "react";
import { api, can, notify, problem, str } from "../api";
import type { Row, User } from "../api";
import type { Definition } from "../catalog-types";
import { Field, FilePicker, ProductThumb, ProductLookup, Save } from "../ui";
import { useSubmit } from "../hooks";
import ProductCard from "../ProductCard";
export default function ProductEditor({
  row,
  types,
  cats,
  user,
  close,
  saved,
  currency,
}: {
  row: Row | null;
  types: Row[];
  cats: Row[];
  user: User;
  close: () => void;
  saved: (row: Row) => void;
  currency: string;
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
  const [photoUrl, setPhotoUrl] = useState("");
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );
  const initial = JSON.stringify(
    row || {
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
  const dirty = JSON.stringify(data) !== initial || !!photo || removePhoto;
  useEffect(() => {
    if (!dirty) return;
    const leaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigation = (event: Event) => {
      if (!window.confirm("¿Descartar los cambios sin guardar?"))
        event.preventDefault();
    };
    const link = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      const href = target?.getAttribute("href");
      if (
        href?.startsWith("#") &&
        href !== window.location.hash &&
        href !== "#main-content" &&
        !window.dispatchEvent(
          new Event("request-navigation", { cancelable: true }),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("request-navigation", navigation);
    document.addEventListener("click", link, true);
    window.addEventListener("beforeunload", leaving);
    return () => {
      window.removeEventListener("beforeunload", leaving);
      window.removeEventListener("request-navigation", navigation);
      document.removeEventListener("click", link, true);
    };
  }, [dirty]);
  const { busy, submit } = useSubmit();
  const change = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));
  const fields = (types.find((t) => t.id === Number(data.tipo_id))?.campos ||
    []) as Definition[];
  const attrs = data.atributos as Record<string, unknown>;
  return (
    <div className="product-workspace">
      <section className="panel product-edit-panel">
        <div className="section-heading">
          <h2>{row ? "Editar información" : "Datos del nuevo producto"}</h2>
          <span className="draft-status">
            {dirty ? "Cambios sin guardar" : "Completa la información"}
          </span>
        </div>
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
                      (e instanceof Error
                        ? e.message
                        : "inténtalo desde Editar"),
                    true,
                  );
                  saved(record);
                  return;
                }
              }
              notify("Producto guardado");
              saved(record);
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
              setPhotoUrl(f ? URL.createObjectURL(f) : "");
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
              Deja vacío para un artículo independiente. La variante debe usar
              el mismo tipo que su padre.
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
            <Save
              busy={busy}
              label={row ? "Guardar cambios" : "Crear producto"}
            />
          </div>
        </form>
      </section>
      <aside className="product-preview">
        <div className="preview-label">
          <strong>Vista previa en vivo</strong>
          <span>Así se verá la ficha al guardar</span>
        </div>
        <ProductCard
          row={
            {
              ...data,
              id: row?.id || 0,
              imagen: removePhoto ? null : data.imagen,
            } as Row
          }
          types={types}
          cats={cats}
          currency={currency}
          photoUrl={photoUrl}
          showCost={can(user, "costos.ver")}
          parentName={parentProduct ? str(parentProduct, "nombre") : ""}
        />
      </aside>
    </div>
  );
}
