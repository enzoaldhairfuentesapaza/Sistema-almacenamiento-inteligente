import { useState } from "react";
import { api, can, download, money, notify, num, problem, str } from "../api";
import type { Row, User } from "../api";
import { Icon } from "../icons";
import {
  Badge,
  DataTable,
  Field,
  ListState,
  Modal,
  Paginator,
  ProductThumb,
  SectionTabs,
  Title,
} from "../ui";
import { useList, useResource, useSubmit } from "../hooks";
import type { Definition } from "../catalog-types";
import { fieldNames } from "../catalog-types";
import ProductCard from "../ProductCard";
import ProductEditor from "./ProductEditor";
import MetaForm from "./CatalogMeta";
import { ModuleStatistics } from "../Statistics";
const emptyFilters = {
  tipo_id: "",
  categoria_id: "",
  marca: "",
  activo: "",
  precio_min: "",
  precio_max: "",
  campo: "",
  valor: "",
  atributo_min: "",
  atributo_max: "",
  existencias: "",
  almacen_id: "",
  orden: "recientes",
};
type Filters = typeof emptyFilters;
export default function Catalog({
  user,
  currency,
  path = "productos",
}: {
  user: User;
  currency: string;
  path?: string;
}) {
  const [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [tab, setTab] = useState("productos"),
    [draft, setDraft] = useState<Filters>(emptyFilters),
    [filters, setFilters] = useState<Filters>(emptyFilters),
    [meta, setMeta] = useState(""),
    [remove, setRemove] = useState<Row | null>(null),
    [metaSearch, setMetaSearch] = useState("");
  const types = useList("/tipos"),
    cats = useList("/categorias"),
    warehouses = useList(
      can(user, "inventario.ver") ? "/almacenes?limit=1000" : null,
    );
  const params = new URLSearchParams({
    limit: "50",
    offset: String(offset),
    q,
  });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const products = useList(`/productos?${params}`),
    allowed = can(user, "productos.editar");
  const fields = (types.rows.find((t) => t.id === Number(draft.tipo_id))
    ?.campos || []) as Definition[];
  const field = fields.find((f) => f.clave === draft.campo);
  const change = (key: keyof Filters, value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(key === "tipo_id"
        ? { campo: "", valor: "", atributo_min: "", atributo_max: "" }
        : {}),
      ...(key === "campo"
        ? { valor: "", atributo_min: "", atributo_max: "" }
        : {}),
    }));
  async function status(row: Row) {
    try {
      await api(`/productos/${row.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !row.activo }),
      });
      products.reload();
      notify(row.activo ? "Producto archivado" : "Producto activado");
    } catch (e) {
      problem(e);
    }
  }
  const navigate = (next: string) => {
    window.location.hash = next;
  };
  if (path !== "productos")
    return (
      <ProductPage
        user={user}
        currency={currency}
        path={path}
        types={types.rows}
        cats={cats.rows}
        saved={() => products.reload()}
        key={path}
      />
    );
  return (
    <>
      <Title
        title="Catálogo de productos"
        subtitle="Encuentra, organiza y presenta cada artículo de tu empresa."
        icon="box"
      >
        {allowed && tab !== "estadisticas" && (
          <button
            className="action-create"
            onClick={() =>
              tab === "productos" ? navigate("productos/nuevo") : setMeta(tab)
            }
          >
            <Icon name="plus" />
            {tab === "productos"
              ? "Nuevo producto"
              : tab === "tipos"
                ? "Nuevo tipo"
                : "Nueva categoría"}
          </button>
        )}
      </Title>
      <SectionTabs
        label="Subsecciones de productos"
        value={tab}
        onChange={setTab}
        items={[
          {
            id: "productos",
            label: "Productos",
            description: "Artículos, fichas y precios",
            icon: "box",
          },
          {
            id: "tipos",
            label: "Tipos y campos",
            description: "Atributos según el rubro",
            icon: "file",
          },
          {
            id: "categorias",
            label: "Categorías",
            description: "Familias para organizar",
            icon: "inventory",
          },
          ...(can(user, "reportes.ver")
            ? [
                {
                  id: "estadisticas",
                  label: "Estadísticas",
                  description: "Indicadores del catálogo",
                  icon: "chart",
                },
              ]
            : []),
        ]}
      />
      {tab === "estadisticas" ? (
        <ModuleStatistics module="productos" />
      ) : tab === "productos" ? (
        <section className="panel">
          <form
            className="catalog-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters(draft);
              setOffset(0);
            }}
          >
            <div className="section-heading">
              <div>
                <h2>
                  <Icon name="filter" />
                  Busca y filtra productos
                </h2>
                <p className="muted">
                  Combina filtros y pulsa Aplicar. La búsqueda por nombre, SKU o
                  marca se actualiza al escribir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setDraft(emptyFilters);
                  setFilters(emptyFilters);
                  setOffset(0);
                }}
              >
                Limpiar filtros
              </button>
            </div>
            <Field label="Buscar catálogo">
              <input
                type="search"
                placeholder="Nombre, SKU o marca"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
              />
            </Field>
            <div className="filter-grid">
              <Field label="Tipo de producto">
                <select
                  value={draft.tipo_id}
                  onChange={(e) => change("tipo_id", e.target.value)}
                >
                  <option value="">Todos los tipos</option>
                  {types.rows.map((t) => (
                    <option key={t.id} value={t.id}>
                      {str(t, "nombre")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Categoría">
                <select
                  value={draft.categoria_id}
                  onChange={(e) => change("categoria_id", e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {cats.rows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {str(c, "nombre")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Marca">
                <input
                  value={draft.marca}
                  maxLength={100}
                  placeholder="Ej. Torque Demo"
                  onChange={(e) => change("marca", e.target.value)}
                />
              </Field>
              <Field label="Estado">
                <select
                  value={draft.activo}
                  onChange={(e) => change("activo", e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Archivados</option>
                </select>
              </Field>
              <Field label={`Precio mínimo (${currency})`}>
                <input
                  type="number"
                  min="0"
                  step=".01"
                  max={draft.precio_max || undefined}
                  value={draft.precio_min}
                  placeholder="Sin mínimo"
                  onChange={(e) => change("precio_min", e.target.value)}
                />
              </Field>
              <Field label={`Precio máximo (${currency})`}>
                <input
                  type="number"
                  min={draft.precio_min || "0"}
                  step=".01"
                  value={draft.precio_max}
                  placeholder="Sin máximo"
                  onChange={(e) => change("precio_max", e.target.value)}
                />
              </Field>
              <Field label="Ordenar por">
                <select
                  value={draft.orden}
                  onChange={(e) => change("orden", e.target.value)}
                >
                  <option value="recientes">Más recientes</option>
                  <option value="nombre">Nombre A–Z</option>
                  <option value="sku">SKU A–Z</option>
                  <option value="precio_asc">Precio: menor a mayor</option>
                  <option value="precio_desc">Precio: mayor a menor</option>
                </select>
              </Field>
              {can(user, "inventario.ver") && (
                <>
                  <Field label="Existencias">
                    <select
                      value={draft.existencias}
                      onChange={(e) => change("existencias", e.target.value)}
                    >
                      <option value="">Cualquier saldo</option>
                      <option value="disponible">Con stock disponible</option>
                      <option value="bajo">Bajo mínimo en algún almacén</option>
                      <option value="agotado">Sin stock disponible</option>
                    </select>
                  </Field>
                  <Field
                    label="Almacén del filtro"
                    hint="Limita el filtro de stock a esta ubicación."
                  >
                    <select
                      value={draft.almacen_id}
                      onChange={(e) => change("almacen_id", e.target.value)}
                    >
                      <option value="">Todos mis almacenes</option>
                      {warehouses.rows.map((w) => (
                        <option key={w.id} value={w.id}>
                          {str(w, "nombre")}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            {!!fields.length && (
              <div className="attribute-filter">
                <Field label="Campo dinámico">
                  <select
                    value={draft.campo}
                    onChange={(e) => change("campo", e.target.value)}
                  >
                    <option value="">Sin filtro de atributo</option>
                    {fields.map((f) => (
                      <option key={f.clave} value={f.clave}>
                        {f.etiqueta} · {fieldNames[f.tipo]}
                      </option>
                    ))}
                  </select>
                </Field>
                {field &&
                  (field.tipo === "numero" ? (
                    <>
                      <Field label={`${field.etiqueta}: mínimo`}>
                        <input
                          type="number"
                          step="any"
                          value={draft.atributo_min}
                          max={draft.atributo_max || undefined}
                          onChange={(e) =>
                            change("atributo_min", e.target.value)
                          }
                        />
                      </Field>
                      <Field label={`${field.etiqueta}: máximo`}>
                        <input
                          type="number"
                          step="any"
                          min={draft.atributo_min || undefined}
                          value={draft.atributo_max}
                          onChange={(e) =>
                            change("atributo_max", e.target.value)
                          }
                        />
                      </Field>
                    </>
                  ) : (
                    <Field label={`Valor de ${field.etiqueta}`}>
                      {field.tipo === "seleccion" ||
                      field.tipo === "booleano" ? (
                        <select
                          value={draft.valor}
                          onChange={(e) => change("valor", e.target.value)}
                        >
                          <option value="">Cualquier valor</option>
                          {field.tipo === "booleano" ? (
                            <>
                              <option value="true">Sí</option>
                              <option value="false">No</option>
                            </>
                          ) : (
                            field.opciones.map((v) => (
                              <option key={v}>{v}</option>
                            ))
                          )}
                        </select>
                      ) : (
                        <input
                          type={field.tipo === "fecha" ? "date" : "text"}
                          value={draft.valor}
                          onChange={(e) => change("valor", e.target.value)}
                        />
                      )}
                    </Field>
                  ))}
              </div>
            )}
            <div className="filter-footer">
              <span className="muted">
                Precios de venta sin impuesto adicional. Los saldos respetan tus
                sedes.
              </span>
              <button className="action-view" type="submit">
                <Icon name="filter" size={18} />
                Aplicar filtros
              </button>
            </div>
          </form>
          <div className="results-heading">
            <h2>Resultados del catálogo</h2>
            <span>{products.rows.length} registros en esta página</span>
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
                      <a className="product-name" href={`#productos/${r.id}`}>
                        {str(r, "nombre")}
                      </a>
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
                  String(
                    types.rows.find((t) => t.id === num(r, "tipo_id"))
                      ?.nombre || "General",
                  ),
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
                  <Badge good={!!r.activo}>
                    {r.activo ? "Activo" : "Archivado"}
                  </Badge>
                ),
              },
              {
                title: "Acciones",
                cell: (r) => (
                  <div className="row-actions">
                    <a
                      className="button action-view"
                      href={`#productos/${r.id}`}
                      aria-label={`Ver producto ${str(r, "nombre")}`}
                      title="Ver ficha"
                    >
                      <Icon name="eye" size={18} />
                    </a>
                    {allowed && (
                      <>
                        <a
                          className="button action-edit"
                          href={`#productos/${r.id}/editar`}
                          aria-label={`Editar producto ${str(r, "nombre")}`}
                        >
                          <Icon name="edit" size={16} />
                          Editar
                        </a>
                        <button
                          className="action-warning"
                          onClick={() => status(r)}
                        >
                          {r.activo ? "Archivar" : "Activar"}
                        </button>
                      </>
                    )}
                    {can(user, "productos.eliminar") && (
                      <button
                        className="action-danger"
                        aria-label={`Borrar producto ${str(r, "nombre")}`}
                        title="Borrar producto sin historial"
                        onClick={() => setRemove(r)}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    )}
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
          <div className="section-heading">
            <div>
              <h2>
                {tab === "tipos"
                  ? "Tipos y atributos dinámicos"
                  : "Familias del catálogo"}
              </h2>
              <p>
                {tab === "tipos"
                  ? "Cada tipo define los campos que aparecerán en el formulario y en sus filtros."
                  : "Las categorías agrupan productos; pueden depender de una categoría principal."}
              </p>
            </div>
          </div>
          <Field
            label={tab === "tipos" ? "Buscar tipo o campo" : "Buscar categoría"}
          >
            <input
              type="search"
              value={metaSearch}
              onChange={(e) => setMetaSearch(e.target.value)}
              placeholder={
                tab === "tipos"
                  ? "Ej. Repuestos, diámetro o compatibilidad"
                  : "Nombre de categoría"
              }
            />
          </Field>
          <DataTable
            rows={(tab === "tipos" ? types.rows : cats.rows).filter((r) =>
              (str(r, "nombre") + " " + JSON.stringify(r.campos || ""))
                .toLowerCase()
                .includes(metaSearch.toLowerCase()),
            )}
            columns={[
              {
                title: "Nombre",
                cell: (r) => <strong>{str(r, "nombre")}</strong>,
              },
              {
                title:
                  tab === "tipos" ? "Campos y formatos" : "Categoría principal",
                cell: (r) =>
                  tab === "tipos" ? (
                    <div className="field-chips">
                      {(r.campos as Definition[]).map((f) => (
                        <span key={f.clave}>
                          <strong>{f.etiqueta}</strong>
                          <small>
                            {fieldNames[f.tipo]}
                            {f.obligatorio ? " · Obligatorio" : ""}
                          </small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    String(
                      cats.rows.find((c) => c.id === num(r, "padre_id"))
                        ?.nombre || "Principal",
                    )
                  ),
              },
            ]}
          />
        </section>
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
      {remove && (
        <DeleteProduct
          row={remove}
          close={() => setRemove(null)}
          deleted={() => {
            setRemove(null);
            products.reload();
          }}
        />
      )}
    </>
  );
}
function ProductPage({
  user,
  currency,
  path,
  types,
  cats,
  saved,
}: {
  user: User;
  currency: string;
  path: string;
  types: Row[];
  cats: Row[];
  saved: () => void;
}) {
  const pieces = path.split("/"),
    isNew = pieces[1] === "nuevo",
    id = Number(pieces[1]),
    edit = isNew || pieces[2] === "editar";
  const valid = isNew || (Number.isInteger(id) && id > 0 && id <= 2147483647);
  const record = useResource<Row>(!isNew && valid ? `/productos/${id}` : null);
  const row = record.data;
  const stock = useList(
    !isNew && valid && can(user, "inventario.ver")
      ? `/inventario?producto_id=${id}&limit=1000`
      : null,
  );
  const parent = useResource<Row>(
    row?.producto_padre_id ? `/productos/${row.producto_padre_id}` : null,
  );
  const close = () => {
    if (
      window.dispatchEvent(
        new Event("request-navigation", { cancelable: true }),
      )
    )
      window.location.hash = "productos";
  };
  if (!valid)
    return (
      <section className="panel">
        <p className="error">Producto no encontrado.</p>
        <button onClick={close}>Volver al catálogo</button>
      </section>
    );
  if (!isNew && !row)
    return (
      <section className="panel">
        <ListState loading={record.loading} error={record.error} />
        <button onClick={close}>Volver al catálogo</button>
      </section>
    );
  return (
    <>
      <div className="breadcrumbs">
        <a href="#productos">Productos</a>
        <Icon name="chevron" size={14} />
        <span>
          {isNew ? "Nuevo producto" : edit ? "Editar producto" : "Ver producto"}
        </span>
      </div>
      <Title
        title={
          isNew ? "Nuevo producto" : edit ? "Editar producto" : "Ver producto"
        }
        subtitle={
          isNew
            ? "Completa la información y revisa la ficha en vivo antes de guardar."
            : str(row!, "nombre")
        }
        icon="box"
      >
        <button onClick={close}>Volver al catálogo</button>
        {!edit && can(user, "productos.editar") && (
          <a className="button action-edit" href={`#productos/${id}/editar`}>
            <Icon name="edit" size={18} />
            Editar producto
          </a>
        )}
      </Title>
      {edit && can(user, "productos.editar") ? (
        <ProductEditor
          row={isNew ? null : row}
          user={user}
          currency={currency}
          types={types}
          cats={cats}
          close={close}
          saved={(p) => {
            saved();
            window.location.hash = `productos/${p.id}`;
          }}
        />
      ) : row ? (
        <div className="product-workspace product-view">
          <ProductCard
            row={row}
            types={types}
            cats={cats}
            currency={currency}
            showCost={can(user, "costos.ver")}
            parentName={parent.data ? str(parent.data, "nombre") : ""}
          />
          <section className="panel product-extra">
            <h2>Información y existencias</h2>
            <p>
              Esta ficha refleja los datos guardados. Puedes descargar el QR
              para identificar el artículo por su SKU.
            </p>
            <button
              className="action-secondary"
              onClick={() =>
                download(
                  `/productos/${id}/qr`,
                  `qr-${str(row, "sku")}.png`,
                ).catch(problem)
              }
            >
              Descargar QR
            </button>
            {can(user, "inventario.ver") && (
              <>
                <h3>Stock por almacén</h3>
                <ListState {...stock} />
                <DataTable
                  rows={stock.rows}
                  columns={[
                    { title: "Almacén", cell: (r) => str(r, "almacen") },
                    { title: "Cantidad", cell: (r) => str(r, "cantidad") },
                    {
                      title: "Estado",
                      cell: (r) => (
                        <Badge good={!r.alerta}>
                          {r.alerta ? "Reponer" : "Disponible"}
                        </Badge>
                      ),
                    },
                  ]}
                />
                <a className="button action-view" href="#inventario">
                  Abrir inventario
                </a>
              </>
            )}
          </section>
        </div>
      ) : (
        <p className="error">No tienes permiso para crear productos.</p>
      )}
    </>
  );
}
function DeleteProduct({
  row,
  close,
  deleted,
}: {
  row: Row;
  close: () => void;
  deleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <Modal title="Borrar producto" close={close}>
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            try {
              await api(`/productos/${row.id}`, { method: "DELETE" });
              notify("Producto borrado");
              deleted();
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : "No se pudo borrar";
              setError(msg);
              notify(msg, true);
            }
          })
        }
      >
        <p>
          Vas a borrar <strong>{str(row, "nombre")}</strong>. Esta acción
          elimina su ficha e imagen y solo se permite si no tiene variantes,
          registros de inventario ni historial.
        </p>
        <p>
          Para conservar un artículo que ya usaste, elige{" "}
          <strong>Archivar</strong> en el catálogo.
        </p>
        <Field label={`Escribe el SKU ${str(row, "sku")} para confirmar`}>
          <input
            required
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </Field>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button
            className="action-danger"
            type="submit"
            disabled={busy || confirmation !== str(row, "sku")}
          >
            <Icon name="trash" size={18} />
            {busy ? "Borrando…" : "Borrar definitivamente"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
