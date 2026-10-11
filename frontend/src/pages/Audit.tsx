import { ModuleStatistics } from "../Statistics";
import { Icon } from "../icons";
import { date, str } from "../api";
import { DataTable, ListState, Paginator, Title } from "../ui";
import { useList } from "../hooks";
import { useState } from "react";
export default function Audit() {
  const [offset, setOffset] = useState(0),
    list = useList(`/auditoria?limit=50&offset=${offset}`);
  const [statsTab, setStatsTab] = useState("registros");
  return (
    <>
      <Title
        icon="audit"
        title="Auditoría"
        subtitle="Accesos y operaciones críticas de la instalación."
      />
      <div className="tabs">
        <button
          className={statsTab === "registros" ? "active" : ""}
          onClick={() => setStatsTab("registros")}
        >
          <Icon name="file" size={18} />
          Registros
        </button>

        <button
          className={statsTab === "estadisticas" ? "active" : ""}
          onClick={() => setStatsTab("estadisticas")}
        >
          <Icon name="chart" size={18} />
          Estadísticas
        </button>
      </div>
      {statsTab === "estadisticas" && <ModuleStatistics module={"auditoria"} />}
      <div hidden={statsTab === "estadisticas"}>
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
      </div>
    </>
  );
}
