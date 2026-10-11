import { useState } from "react";
import { api, notify, str } from "../api";
import type { Row } from "../api";
import type { Definition } from "../catalog-types";
import { Field, Modal, Save } from "../ui";
import { useSubmit } from "../hooks";
export default function MetaForm({
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
