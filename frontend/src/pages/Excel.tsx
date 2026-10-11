import { useState } from "react";
import { api, can, download, notify, problem, str } from "../api";
import type { Row, User } from "../api";
import { DataTable, FilePicker, Save, Title } from "../ui";
import { useSubmit } from "../hooks";
interface Preview {
  filas: Record<string, unknown>[];
  errores: { fila: number; error: string }[];
  validas: number;
  aplicable: boolean;
}
export default function Excel({ user }: { user: User }) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const { busy, submit } = useSubmit();
  return (
    <>
      <Title
        title="Importar y exportar"
        subtitle="Carga tu catálogo con revisión previa y descarga tus datos autorizados."
      />
      <div className="dashboard-grid">
        {can(user, "excel.importar") && (
          <section className="panel">
            <h2>Importar catálogo</h2>
            <div className="guide-steps">
              <div>
                <b>1</b> Descarga la plantilla
              </div>
              <div>
                <b>2</b> Elige el archivo
              </div>
              <div>
                <b>3</b> Revisa y confirma
              </div>
            </div>
            <p>
              Usa la plantilla para crear productos o actualizarlos por SKU. Las
              existencias se registran mediante movimientos.
            </p>
            <button
              onClick={() =>
                download("/excel/plantilla", "plantilla-productos.xlsx").catch(
                  problem,
                )
              }
            >
              ↓ Descargar plantilla
            </button>
            <form
              onSubmit={(e) =>
                submit(e, async () => {
                  if (!file) throw new Error("Selecciona un archivo");
                  const form = new FormData();
                  form.append("file", file);
                  setPreview(
                    await api<Preview>("/excel/prevalidar", {
                      method: "POST",
                      body: form,
                    }),
                  );
                })
              }
            >
              <FilePicker
                file={file}
                onChange={(f) => {
                  setFile(f);
                  setPreview(null);
                }}
              />
              <Save busy={busy} label="Prevalidar archivo" />
            </form>
          </section>
        )}
        {can(user, "excel.exportar") && (
          <section className="panel">
            <h2>Exportar datos</h2>
            <p>Los costos y las ubicaciones se filtran según tus permisos.</p>
            <div className="export-buttons">
              {[
                {
                  table: "productos",
                  label: "Catálogo completo",
                  permission: "productos.ver",
                },
                {
                  table: "existencias",
                  label: "Existencias",
                  permission: "inventario.ver",
                },
                {
                  table: "movimientos",
                  label: "Kardex",
                  permission: "inventario.ver",
                },
                { table: "ventas", label: "Ventas", permission: "ventas.ver" },
              ]
                .filter((t) => can(user, t.permission))
                .map((t) => (
                  <button
                    key={t.table}
                    onClick={() =>
                      download(
                        `/excel/exportar/${t.table}`,
                        `${t.table}.xlsx`,
                      ).catch(problem)
                    }
                  >
                    {t.label} ↗
                  </button>
                ))}
            </div>
          </section>
        )}
      </div>
      {preview && (
        <section className="panel">
          <div className="section-heading">
            <h2>Resultado de la revisión</h2>
            <strong>
              {preview.validas} filas válidas · {preview.errores.length} errores
            </strong>
          </div>
          {preview.errores.length > 0 ? (
            <DataTable
              rows={preview.errores.map((e, i) => ({ ...e, id: i }))}
              columns={[
                { title: "Fila", cell: (r) => str(r, "fila") },
                { title: "Error", cell: (r) => str(r, "error") },
              ]}
            />
          ) : (
            <>
              <DataTable
                rows={preview.filas
                  .slice(0, 20)
                  .map((r, i) => ({ ...r, id: i }) as Row)}
                columns={[
                  { title: "SKU", cell: (r) => str(r, "sku") },
                  { title: "Nombre", cell: (r) => str(r, "nombre") },
                  { title: "Precio", cell: (r) => str(r, "precio") },
                ]}
              />
              <p className="muted">
                Vista previa de las primeras 20 filas. Confirmar aplica todas
                las filas válidas del lote.
              </p>
            </>
          )}
          <form
            onSubmit={(e) =>
              submit(e, async () => {
                if (!preview.aplicable)
                  throw new Error("Corrige el archivo y vuelve a prevalidar");
                await api("/excel/importar", {
                  method: "POST",
                  body: JSON.stringify({ filas: preview.filas }),
                });
                notify("Importación completada");
                setPreview(null);
              })
            }
          >
            <button
              className="primary"
              disabled={busy || !preview.aplicable}
              type="submit"
            >
              {busy ? "Importando…" : "Confirmar importación"}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
