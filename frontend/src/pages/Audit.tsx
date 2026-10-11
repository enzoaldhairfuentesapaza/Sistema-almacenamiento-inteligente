import { date, str } from "../api";
import { DataTable, ListState, Paginator, Title } from "../ui";
import { useList } from "../hooks";
import { useState } from "react";
export default function Audit() {
  const [offset, setOffset] = useState(0),
    list = useList(`/auditoria?limit=50&offset=${offset}`);
  return (
    <>
      <Title
        title="Auditoría"
        subtitle="Accesos y operaciones críticas de la instalación."
      />
      <section className="panel">
        <ListState {...list} />
        <DataTable
          rows={list.rows}
          columns={[
            { title: "Fecha", cell: (r) => date(r.fecha) },
            { title: "Usuario", cell: (r) => str(r, "usuario") },
            { title: "Acción", cell: (r) => str(r, "accion") },
            {
              title: "Entidad",
              cell: (r) => `${str(r, "entidad")} ${str(r, "entidad_id")}`,
            },
            { title: "Detalle", cell: (r) => str(r, "detalle") },
          ]}
        />
        <Paginator
          offset={offset}
          size={50}
          count={list.rows.length}
          setOffset={setOffset}
        />
      </section>
    </>
  );
}
