import { cloneElement, useEffect, useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Icon } from "./icons";
import { str } from "./api";
import type { Row } from "./api";
import { useList } from "./hooks";
export function Title({
  title,
  subtitle,
  children,
  icon = "box",
}: {
  title: string;
  subtitle: string;
  icon?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <span className="section-symbol">
        <Icon name={icon} size={28} />
      </span>
      <div className="page-heading-text">
        <span className="eyebrow">ESPACIO DE TRABAJO</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Empty({
  children = "Todavía no hay registros.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">◇</span>
      <p>{children}</p>
    </div>
  );
}
export function ListState({
  loading,
  error,
}: {
  loading: boolean;
  error: string;
}) {
  return error ? (
    <p role="alert" className="error">
      {error}
    </p>
  ) : loading ? (
    <p className="muted">Cargando datos…</p>
  ) : null;
}
export function Badge({
  children,
  good = false,
}: {
  children: ReactNode;
  good?: boolean;
}) {
  return <span className={`badge ${good ? "good" : ""}`}>{children}</span>;
}
export interface Column {
  title: string;
  cell: (row: Row) => ReactNode;
}
export function DataTable({
  rows,
  columns,
}: {
  rows: Row[];
  columns: Column[];
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.title}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c.title}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-labelledby={titleId}>
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={close}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
      <p className="modal-instruction muted">
        Completa los datos y revisa antes de confirmar. Los campos con * son
        obligatorios.
      </p>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  hint?: string;
  children: ReactElement<{
    id?: string;
    required?: boolean;
    "aria-describedby"?: string;
    "aria-label"?: string;
  }>;
}) {
  const generatedId = useId();
  const id = children.props.id || generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {children.props.required && !label.includes("*") && (
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id,
        "aria-label":
          children.props["aria-label"] || label.replace(/\s*\*$/, ""),
        "aria-describedby": hint
          ? `${id}-hint`
          : children.props["aria-describedby"],
      })}
      {hint && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}
export function Save({
  busy,
  label = "Guardar",
  variant = "save",
}: {
  busy: boolean;
  label?: string;
  variant?: "save" | "danger" | "view";
}) {
  return (
    <button
      disabled={busy}
      className={`primary action-${variant}`}
      type="submit"
    >
      {!busy && <Icon name="check" size={16} />}
      {busy ? "Guardando…" : label}
    </button>
  );
}
export function ProductLookup({
  value,
  onChange,
  parentsOnly = false,
  excludeId,
}: {
  parentsOnly?: boolean;
  excludeId?: number;
  value: Row | null;
  onChange: (row: Row) => void;
}) {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = useList(
    `/productos?activo=true&limit=20&q=${encodeURIComponent(search)}${parentsOnly ? "&solo_padres=true" : ""}`,
  );
  return (
    <div className="product-lookup">
      <input
        aria-label="Buscar producto"
        placeholder="Busca nombre o SKU…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="lookup-results">
        {list.rows
          .filter((r) => r.id !== excludeId)
          .map((r) => (
            <button
              type="button"
              className={value?.id === r.id ? "selected" : ""}
              key={r.id}
              onClick={() => onChange(r)}
            >
              <strong>{str(r, "sku")}</strong> {str(r, "nombre")}
            </button>
          ))}
      </div>
      {!list.loading && !list.error && !list.rows.length && (
        <p className="muted">
          No se encontraron productos. Prueba otro nombre o código.
        </p>
      )}
      {value && (
        <p className="selected-label">Seleccionado: {str(value, "nombre")}</p>
      )}
      <ListState {...list} />
    </div>
  );
}
export function Paginator({
  offset,
  size,
  count,
  setOffset,
}: {
  offset: number;
  size: number;
  count: number;
  setOffset: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>Página {Math.floor(offset / size) + 1}</span>
      <button
        disabled={!offset}
        onClick={() => setOffset(Math.max(0, offset - size))}
      >
        Anterior
      </button>
      <button disabled={count < size} onClick={() => setOffset(offset + size)}>
        Siguiente
      </button>
    </div>
  );
}

export function FilePicker({
  file,
  onChange,
  accept = ".xlsx,.csv",
  label = "Seleccionar archivo",
  hint = "XLSX o CSV · máximo 5 MB",
  preview = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  label?: string;
  hint?: string;
  preview?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file || !preview) return;
    const next = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = next;
    return () => URL.revokeObjectURL(next);
  }, [file, preview]);
  return (
    <div className="file-picker">
      {file && preview ? (
        <img
          ref={imageRef}
          className="file-preview"
          alt="Vista previa de la imagen seleccionada"
        />
      ) : (
        <Icon name={preview ? "image" : "upload"} size={30} />
      )}
      <div>
        <strong>
          {file?.name ||
            (preview
              ? "Una imagen ayuda a identificar el producto"
              : "Elige el archivo que deseas revisar")}
        </strong>
        <small id={`${id}-help`}>{hint}</small>
      </div>
      <input
        ref={input}
        className="file-native"
        id={id}
        type="file"
        accept={accept}
        aria-label={label}
        aria-describedby={`${id}-help`}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        className="action-view"
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" size={16} />
        {file ? "Cambiar archivo" : label}
      </button>
      {file && (
        <button
          type="button"
          aria-label="Quitar archivo seleccionado"
          onClick={() => {
            onChange(null);
            if (input.current) input.current.value = "";
          }}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
export function ProductThumb({ row }: { row: Row }) {
  const [failed, setFailed] = useState("");
  const name = String(row.nombre || "").toLowerCase();
  const family = name.includes("filtro")
    ? "filtro"
    : name.includes("pintura")
      ? "pintura"
      : /taladro|llave|martillo|alicate|dados/.test(name)
        ? "herramienta"
        : /cable|tornillo/.test(name)
          ? "material"
          : /correa|rodamiento|freno/.test(name)
            ? "repuesto"
            : "";
  const source = row.imagen
    ? `/api/v1/productos/${row.id}/imagen?v=${row.imagen}`
    : family
      ? `/products/${family}.svg`
      : "";
  if (source && source !== failed)
    return (
      <img
        className="product-thumb"
        src={source}
        alt=""
        loading="lazy"
        onError={() => setFailed(source)}
      />
    );
  return (
    <span className="product-thumb">
      <Icon name="box" size={22} />
    </span>
  );
}

export interface SectionItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}
export function SectionTabs({
  items,
  value,
  onChange,
  label = "Subsecciones",
}: {
  items: SectionItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <nav className="section-tabs" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-pressed={value === item.id}
          className={value === item.id ? "active" : ""}
          onClick={() => onChange(item.id)}
        >
          <Icon name={item.icon || "box"} size={22} />
          <span>
            <strong>{item.label}</strong>
            {item.description && <small>{item.description}</small>}
          </span>
          <Icon name="chevron" size={16} />
        </button>
      ))}
    </nav>
  );
}
