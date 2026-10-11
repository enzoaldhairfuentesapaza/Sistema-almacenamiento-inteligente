import { money, str } from "./api";
import type { Row } from "./api";
import type { Definition } from "./catalog-types";
import { Badge, ProductThumb } from "./ui";
import { Icon } from "./icons";
export default function ProductCard({
  row,
  currency,
  types,
  cats,
  photoUrl = "",
  showCost = false,
  parentName = "",
}: {
  row: Row;
  currency: string;
  types: Row[];
  cats: Row[];
  photoUrl?: string;
  showCost?: boolean;
  parentName?: string;
}) {
  const definition = types.find((x) => x.id === Number(row.tipo_id));
  const fields = (definition?.campos || []) as Definition[];
  const attrs = (row.atributos || {}) as Record<string, unknown>;
  return (
    <article className="product-card" aria-label="Ficha del producto">
      <div className="product-card-image">
        {photoUrl ? (
          <img src={photoUrl} alt="Imagen del producto" />
        ) : (
          <ProductThumb row={row} />
        )}
        <Badge good={row.activo !== false}>
          {row.activo === false ? "Archivado" : "Activo"}
        </Badge>
      </div>
      <div className="product-card-body">
        <span className="product-card-category">
          {String(
            cats.find((x) => x.id === Number(row.categoria_id))?.nombre ||
              "Sin categoría",
          )}
        </span>
        <h2>{str(row, "nombre") || "Nombre del producto"}</h2>
        <p className="muted">
          {str(row, "marca") || "Sin marca"} · SKU{" "}
          {str(row, "sku") || "Por definir"}
        </p>
        <div className="product-card-price">
          <strong>{money(row.precio, currency)}</strong>
          <span>
            por {str(row, "unidad") || "unidad"} · sin impuesto adicional
          </span>
        </div>
        <p className="product-card-description">
          {str(row, "descripcion") ||
            "Agrega una descripción con medidas, compatibilidad y usos del producto."}
        </p>
        <dl className="product-facts">
          <div>
            <dt>Tipo de producto</dt>
            <dd>{String(definition?.nombre || "General")}</dd>
          </div>
          <div>
            <dt>Unidad de venta</dt>
            <dd>{str(row, "unidad") || "unidad"}</dd>
          </div>
          {row.producto_padre_id != null && (
            <div>
              <dt>Variante de</dt>
              <dd>{parentName || "Producto padre"}</dd>
            </div>
          )}
          {fields.map((f) => (
            <div key={f.clave}>
              <dt>{f.etiqueta}</dt>
              <dd>
                {attrs[f.clave] === true
                  ? "Sí"
                  : attrs[f.clave] === false
                    ? "No"
                    : String(attrs[f.clave] ?? "—") || "—"}
              </dd>
            </div>
          ))}
        </dl>
        <div className="product-management">
          <h3>
            <Icon name="shield" size={18} />
            Datos de gestión
          </h3>
          <dl className="product-facts">
            {showCost && (
              <div>
                <dt>Costo unitario interno</dt>
                <dd>{money(row.costo, currency)}</dd>
              </div>
            )}
            <div>
              <dt>Stock mínimo por almacén</dt>
              <dd>{str(row, "stock_minimo") || "0"}</dd>
            </div>
          </dl>
          <small>
            Las existencias se consultan por almacén. El precio de venta no
            incluye el impuesto adicional de la operación.
          </small>
        </div>
      </div>
    </article>
  );
}
