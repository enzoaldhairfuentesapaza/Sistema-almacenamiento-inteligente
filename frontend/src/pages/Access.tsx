import { useState } from "react";
import { api, notify, str } from "../api";
import type { Row } from "../api";
import { Badge, DataTable, Field, Modal, Save, Title } from "../ui";
import { useList, useSubmit } from "../hooks";
export default function Access() {
  const [tab, setTab] = useState("usuarios"),
    [edit, setEdit] = useState<Row | null | undefined>(undefined),
    users = useList("/usuarios"),
    roles = useList("/roles"),
    sites = useList("/sedes?limit=1000"),
    perms = useList("/permisos");
  return (
    <>
      <Title
        title="Usuarios y permisos"
        subtitle="El propietario define los accesos y las sedes de cada persona."
      >
        <button className="primary" onClick={() => setEdit(null)}>
          + {tab === "usuarios" ? "Nuevo usuario" : "Nuevo rol"}
        </button>
      </Title>
      <div className="tabs">
        <button
          className={tab === "usuarios" ? "active" : ""}
          onClick={() => setTab("usuarios")}
        >
          Usuarios
        </button>
        <button
          className={tab === "roles" ? "active" : ""}
          onClick={() => setTab("roles")}
        >
          Roles
        </button>
      </div>
      <section className="panel">
        <DataTable
          rows={tab === "usuarios" ? users.rows : roles.rows}
          columns={
            tab === "usuarios"
              ? [
                  {
                    title: "Usuario",
                    cell: (r) => (
                      <>
                        <strong>{str(r, "nombre")}</strong>
                        <small>{str(r, "email")}</small>
                      </>
                    ),
                  },
                  {
                    title: "Roles",
                    cell: (r) =>
                      r.propietario
                        ? "Propietario"
                        : (r.roles as number[])
                            .map((id) =>
                              str(
                                roles.rows.find((a) => a.id === id) || {
                                  id: 0,
                                },
                                "nombre",
                              ),
                            )
                            .join(", "),
                  },
                  {
                    title: "Sedes",
                    cell: (r) =>
                      r.propietario
                        ? "Todas"
                        : (r.sedes as number[])
                            .map((id) =>
                              str(
                                sites.rows.find((a) => a.id === id) || {
                                  id: 0,
                                },
                                "nombre",
                              ),
                            )
                            .join(", ") || "Sin acceso",
                  },
                  {
                    title: "Estado",
                    cell: (r) => (
                      <Badge good={Boolean(r.activo)}>
                        {r.activo ? "Activo" : "Bloqueado"}
                      </Badge>
                    ),
                  },
                  {
                    title: "Acciones",
                    cell: (r) =>
                      !r.propietario && (
                        <button onClick={() => setEdit(r)}>Editar</button>
                      ),
                  },
                ]
              : [
                  { title: "Rol", cell: (r) => str(r, "nombre") },
                  {
                    title: "Permisos",
                    cell: (r) => (r.permisos as string[]).length,
                  },
                  {
                    title: "Acciones",
                    cell: (r) => (
                      <button onClick={() => setEdit(r)}>
                        Editar permisos
                      </button>
                    ),
                  },
                ]
          }
        />
      </section>
      {edit !== undefined &&
        (tab === "roles" ? (
          <RoleForm
            row={edit}
            permissions={perms.rows}
            close={() => setEdit(undefined)}
            saved={() => {
              setEdit(undefined);
              roles.reload();
            }}
          />
        ) : (
          <UserForm
            row={edit}
            roles={roles.rows}
            sites={sites.rows}
            close={() => setEdit(undefined)}
            saved={() => {
              setEdit(undefined);
              users.reload();
            }}
          />
        ))}
    </>
  );
}
function RoleForm({
  row,
  permissions,
  close,
  saved,
}: {
  row: Row | null;
  permissions: Row[];
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(row ? str(row, "nombre") : ""),
    [selected, setSelected] = useState<string[]>(
      row ? (row.permisos as string[]) : [],
    );
  const { busy, submit } = useSubmit();
  return (
    <Modal title={row ? "Editar rol" : "Nuevo rol"} close={close}>
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            await api(`/roles${row ? `/${row.id}` : ""}`, {
              method: row ? "PUT" : "POST",
              body: JSON.stringify({ nombre: name, permisos: selected }),
            });
            notify("Rol guardado");
            saved();
          })
        }
      >
        <Field label="Nombre">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="permission-grid">
          {permissions.map((p) => (
            <label className="check" key={str(p, "codigo")}>
              <input
                type="checkbox"
                checked={selected.includes(str(p, "codigo"))}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, str(p, "codigo")]
                      : s.filter((c) => c !== str(p, "codigo")),
                  )
                }
              />
              {str(p, "descripcion")}
              <small>{str(p, "codigo")}</small>
            </label>
          ))}
        </div>
        <p className="muted">
          Asigna también los permisos de lectura necesarios para cada pantalla.
          La auditoría global permanece reservada al propietario.
        </p>
        <div className="form-footer">
          <Save busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
function UserForm({
  row,
  roles,
  sites,
  close,
  saved,
}: {
  row: Row | null;
  roles: Row[];
  sites: Row[];
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(row ? str(row, "nombre") : ""),
    [email, setEmail] = useState(row ? str(row, "email") : ""),
    [password, setPassword] = useState(""),
    [selectedRoles, setRoles] = useState<number[]>(
      row ? (row.roles as number[]) : [],
    ),
    [selectedSites, setSites] = useState<number[]>(
      row ? (row.sedes as number[]) : [],
    ),
    [active, setActive] = useState(row ? Boolean(row.activo) : true);
  const { busy, submit } = useSubmit();
  return (
    <Modal title={row ? "Editar usuario" : "Nuevo usuario"} close={close}>
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            await api(`/usuarios${row ? `/${row.id}` : ""}`, {
              method: row ? "PUT" : "POST",
              body: JSON.stringify({
                nombre: name,
                email,
                password: password || null,
                roles: selectedRoles,
                sedes: selectedSites,
                activo: active,
              }),
            });
            notify("Usuario guardado; sus sesiones anteriores se revocaron");
            saved();
          })
        }
      >
        <div className="form-grid">
          <Field label="Nombre">
            <input
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Correo">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={row ? "Nueva contraseña (opcional)" : "Contraseña"}>
            <input
              type="password"
              required={!row}
              minLength={12}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <h3>¿Qué puede hacer?</h3>
        <p className="muted">Elige uno o más roles. Sus permisos se suman.</p>
        <div className="permission-grid">
          {roles.map((r) => (
            <label className="check" key={r.id}>
              <input
                type="checkbox"
                checked={selectedRoles.includes(r.id)}
                onChange={(e) =>
                  setRoles((s) =>
                    e.target.checked
                      ? [...s, r.id]
                      : s.filter((i) => i !== r.id),
                  )
                }
              />
              {str(r, "nombre")}
            </label>
          ))}
        </div>
        <h3>¿Dónde puede trabajar?</h3>
        <p className="muted">
          Marca al menos una sede para dar acceso a sus almacenes y operaciones.
        </p>
        <div className="permission-grid">
          {sites.map((r) => (
            <label className="check" key={r.id}>
              <input
                type="checkbox"
                checked={selectedSites.includes(r.id)}
                onChange={(e) =>
                  setSites((s) =>
                    e.target.checked
                      ? [...s, r.id]
                      : s.filter((i) => i !== r.id),
                  )
                }
              />
              {str(r, "nombre")}
            </label>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />{" "}
          Usuario activo
        </label>
        <div className="form-footer">
          <Save busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
