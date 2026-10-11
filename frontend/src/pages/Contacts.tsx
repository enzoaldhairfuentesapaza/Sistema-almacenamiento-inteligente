import { useState } from "react";
import { api, can, notify, str } from "../api";
import type { Row, User } from "../api";
import {
  Badge,
  DataTable,
  Field,
  ListState,
  Modal,
  Paginator,
  Save,
  Title,
} from "../ui";
import { useList, useSubmit } from "../hooks";
export default function Contacts({ user }: { user: User }) {
  const [q, setQ] = useState(""),
    [type, setType] = useState("cliente"),
    [offset, setOffset] = useState(0),
    [edit, setEdit] = useState<Row | null | undefined>(undefined),
    data = useList(
      `/contactos?tipo=${type}&limit=50&offset=${offset}&q=${encodeURIComponent(q)}`,
    );
  return (
    <>
      <Title
        title="Clientes y proveedores"
        subtitle="Datos de contacto para conectar tus operaciones."
      >
        {can(user, "contactos.editar") && (
          <button className="primary" onClick={() => setEdit(null)}>
            + Nuevo contacto
          </button>
        )}
      </Title>
      <div className="tabs">
        {["cliente", "proveedor"].map((t) => (
          <button
            className={t === type ? "active" : ""}
            key={t}
            onClick={() => {
              setType(t);
              setOffset(0);
            }}
          >
            {t === "cliente" ? "Clientes" : "Proveedores"}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Buscar contactos"
            placeholder="Buscar nombre, documento o correo"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
        </div>
        <ListState {...data} />
        <DataTable
          rows={data.rows}
          columns={[
            {
              title: "Nombre",
              cell: (r) => (
                <>
                  <strong>{str(r, "nombre")}</strong>
                  <small>{str(r, "documento")}</small>
                </>
              ),
            },
            { title: "Teléfono", cell: (r) => str(r, "telefono") },
            { title: "Correo", cell: (r) => str(r, "email") },
            {
              title: "Estado",
              cell: (r) => (
                <Badge good={Boolean(r.activo)}>
                  {r.activo ? "Activo" : "Inactivo"}
                </Badge>
              ),
            },
            {
              title: "Acciones",
              cell: (r) =>
                can(user, "contactos.editar") && (
                  <button onClick={() => setEdit(r)}>Editar</button>
                ),
            },
          ]}
        />
        <Paginator
          offset={offset}
          size={50}
          count={data.rows.length}
          setOffset={setOffset}
        />
      </section>
      {edit !== undefined && (
        <ContactForm
          row={edit}
          type={type}
          close={() => setEdit(undefined)}
          saved={() => {
            setEdit(undefined);
            data.reload();
          }}
        />
      )}
    </>
  );
}
function ContactForm({
  row,
  type,
  close,
  saved,
}: {
  row: Row | null;
  type: string;
  close: () => void;
  saved: () => void;
}) {
  const [data, setData] = useState<Record<string, string>>({
      nombre: row ? str(row, "nombre") : "",
      documento: row ? str(row, "documento") : "",
      telefono: row ? str(row, "telefono") : "",
      email: row ? str(row, "email") : "",
    }),
    [active, setActive] = useState(row ? Boolean(row.activo) : true);
  const { busy, submit } = useSubmit();
  return (
    <Modal title={`${row ? "Editar" : "Nuevo"} ${type}`} close={close}>
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            await api(`/contactos${row ? `/${row.id}` : ""}`, {
              method: row ? "PUT" : "POST",
              body: JSON.stringify({ ...data, tipo: type, activo: active }),
            });
            notify("Contacto guardado");
            saved();
          })
        }
      >
        <div className="form-grid">
          {[
            { k: "nombre", l: "Nombre" },
            { k: "documento", l: "Documento" },
            { k: "telefono", l: "Teléfono" },
            { k: "email", l: "Correo" },
          ].map((f) => (
            <Field key={f.k} label={f.l}>
              <input
                type={f.k === "email" ? "email" : "text"}
                required={f.k === "nombre"}
                maxLength={
                  f.k === "documento" ? 30 : f.k === "telefono" ? 40 : 200
                }
                value={data[f.k]}
                onChange={(e) =>
                  setData((d) => ({ ...d, [f.k]: e.target.value }))
                }
              />
            </Field>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />{" "}
          Contacto activo
        </label>
        <div className="form-footer">
          <Save busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
