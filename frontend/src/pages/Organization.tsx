import { useEffect, useState } from "react";
import { api, can, notify, problem, str } from "../api";
import type { Row, User } from "../api";
import { Badge, DataTable, Field, Modal, Save, Title } from "../ui";
import { useList, useSubmit } from "../hooks";
export default function Organization({
  user,
  refreshCompany,
}: {
  user: User;
  refreshCompany: () => void;
}) {
  const [tab, setTab] = useState(
      can(user, "empresa.ver") ? "empresa" : "sedes",
    ),
    [company, setCompany] = useState<Record<string, string>>({
      razon_social: "",
      nombre_comercial: "",
      ruc: "",
      moneda: "PEN",
      zona_horaria: "America/Lima",
    }),
    [edit, setEdit] = useState<Row | null | undefined>(undefined);
  const sites = useList(can(user, "sedes.ver") ? "/sedes?limit=1000" : null),
    stores = useList(can(user, "sedes.ver") ? "/almacenes?limit=1000" : null),
    { busy, submit } = useSubmit();
  useEffect(() => {
    if (can(user, "empresa.ver"))
      api<Row | null>("/empresa")
        .then((r) => {
          if (r)
            setCompany({
              razon_social: str(r, "razon_social"),
              nombre_comercial: str(r, "nombre_comercial"),
              ruc: str(r, "ruc"),
              moneda: str(r, "moneda"),
              zona_horaria: str(r, "zona_horaria"),
            });
        })
        .catch(problem);
  }, [user]);
  const path = tab === "sedes" ? "/sedes" : "/almacenes";
  async function status(r: Row) {
    try {
      await api(`${path}/${r.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !r.activo }),
      });
      sites.reload();
      stores.reload();
      notify("Estado actualizado");
    } catch (e) {
      problem(e);
    }
  }
  return (
    <>
      <Title
        title="Empresa y ubicaciones"
        subtitle="Una instalación, una empresa y tantas sedes como necesites."
      />
      <div className="tabs">
        {can(user, "empresa.ver") && (
          <button
            className={tab === "empresa" ? "active" : ""}
            onClick={() => setTab("empresa")}
          >
            Empresa
          </button>
        )}
        {can(user, "sedes.ver") &&
          ["sedes", "almacenes"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "sedes" ? "Sedes" : "Almacenes"}
            </button>
          ))}
      </div>
      {tab === "empresa" ? (
        <section className="panel narrow">
          <h2>Configuración de empresa</h2>
          <form
            onSubmit={(e) =>
              submit(e, async () => {
                await api("/empresa", {
                  method: "PUT",
                  body: JSON.stringify({
                    ...company,
                    ruc: company.ruc || null,
                  }),
                });
                notify("Empresa guardada");
                refreshCompany();
              })
            }
          >
            <div className="form-grid">
              {[
                { k: "razon_social", l: "Razón social" },
                { k: "nombre_comercial", l: "Nombre comercial" },
                { k: "ruc", l: "RUC (opcional)" },
                { k: "moneda", l: "Moneda ISO (ej. PEN, USD)" },
                { k: "zona_horaria", l: "Zona horaria (ej. America/Lima)" },
              ].map((f) => (
                <Field key={f.k} label={f.l}>
                  <input
                    required={f.k !== "ruc"}
                    disabled={!can(user, "empresa.editar")}
                    value={company[f.k]}
                    onChange={(e) =>
                      setCompany((c) => ({ ...c, [f.k]: e.target.value }))
                    }
                  />
                </Field>
              ))}
            </div>
            {can(user, "empresa.editar") && <Save busy={busy} />}
          </form>
        </section>
      ) : (
        <section className="panel">
          <div className="section-heading">
            <h2>{tab === "sedes" ? "Sedes" : "Almacenes"}</h2>
            {can(user, "sedes.editar") &&
              (tab !== "sedes" || user.propietario) && (
                <button className="primary" onClick={() => setEdit(null)}>
                  + Crear
                </button>
              )}
          </div>
          <DataTable
            rows={tab === "sedes" ? sites.rows : stores.rows}
            columns={[
              {
                title: "ID / Código",
                cell: (r) => (
                  <>
                    {r.id}
                    <small>{str(r, "codigo")}</small>
                  </>
                ),
              },
              { title: "Nombre", cell: (r) => str(r, "nombre") },
              {
                title: tab === "sedes" ? "Dirección" : "Sede",
                cell: (r) =>
                  tab === "sedes"
                    ? str(r, "direccion")
                    : str(
                        sites.rows.find((s) => s.id === Number(r.sede_id)) || {
                          id: 0,
                        },
                        "nombre",
                      ),
              },
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
                  can(user, "sedes.editar") && (
                    <div className="row-actions">
                      <button onClick={() => setEdit(r)}>Editar</button>
                      <button onClick={() => status(r)}>
                        {r.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  ),
              },
            ]}
          />
        </section>
      )}
      {edit !== undefined && (
        <LocationForm
          row={edit}
          kind={tab}
          sites={sites.rows}
          close={() => setEdit(undefined)}
          saved={() => {
            setEdit(undefined);
            sites.reload();
            stores.reload();
          }}
        />
      )}
    </>
  );
}
function LocationForm({
  row,
  kind,
  sites,
  close,
  saved,
}: {
  row: Row | null;
  kind: string;
  sites: Row[];
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(row ? str(row, "nombre") : ""),
    [code, setCode] = useState(row ? str(row, "codigo") : ""),
    [address, setAddress] = useState(row ? str(row, "direccion") : ""),
    [site, setSite] = useState(row ? str(row, "sede_id") : "");
  const { busy, submit } = useSubmit();
  return (
    <Modal
      title={`${row ? "Editar" : "Crear"} ${kind === "sedes" ? "sede" : "almacén"}`}
      close={close}
    >
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            await api(`/${kind}${row ? `/${row.id}` : ""}`, {
              method: row ? "PUT" : "POST",
              body: JSON.stringify({
                nombre: name,
                codigo: code,
                ...(kind === "sedes"
                  ? { direccion: address || null }
                  : { sede_id: Number(site) }),
              }),
            });
            notify("Ubicación guardada");
            saved();
          })
        }
      >
        <div className="form-grid">
          <Field label="Código">
            <input
              required
              pattern="[A-Z0-9_\-]+"
              maxLength={30}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Nombre">
            <input
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        {kind === "sedes" ? (
          <Field label="Dirección">
            <input
              maxLength={300}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Sede">
            <select
              required
              disabled={Boolean(row)}
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {sites
                .filter((s) => s.activo || s.id === Number(site))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {str(s, "nombre")}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <div className="form-footer">
          <Save busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
