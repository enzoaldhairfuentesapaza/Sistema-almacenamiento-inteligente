import { useState } from "react";
import { api, can, str, notify } from "../api";
import type { Row, User } from "../api";
import { DataTable, Field, ProductLookup, Save, Title } from "../ui";
import { useSubmit } from "../hooks";
interface Answer {
  respuesta: string;
  fuentes: { herramienta: string; registros: number }[];
  fecha: string;
  modelo: string;
}
interface Forecast {
  modelo: string;
  objetivo: string;
  dias_historial: number;
  advertencia: string;
  metricas: { modelo: string; mae: number; wape: number | null }[];
  predicciones: {
    fecha: string;
    valor: number;
    inferior: number;
    superior: number;
  }[];
}
export default function Intelligence({ user }: { user: User }) {
  const [tab, setTab] = useState(
      can(user, "ia.usar") ? "asistente" : "pronosticos",
    ),
    [question, setQuestion] = useState(""),
    [history, setHistory] = useState<{ q: string; a: Answer }[]>([]),
    [days, setDays] = useState("14"),
    [product, setProduct] = useState<Row | null>(null),
    [forecast, setForecast] = useState<Forecast | null>(null);
  const { busy, submit } = useSubmit();
  return (
    <>
      <Title
        title="Inteligencia de tu negocio"
        subtitle="Consulta datos autorizados y explora pronósticos con evaluación temporal."
      />
      <div className="tabs">
        {can(user, "ia.usar") && (
          <button
            className={tab === "asistente" ? "active" : ""}
            onClick={() => setTab("asistente")}
          >
            Asistente
          </button>
        )}
        {can(user, "pronosticos.ver") && (
          <button
            className={tab === "pronosticos" ? "active" : ""}
            onClick={() => setTab("pronosticos")}
          >
            Pronósticos
          </button>
        )}
      </div>
      {tab === "asistente" ? (
        <section className="panel narrow">
          <h2>Pregunta a tus datos</h2>
          <p className="muted">
            El asistente consulta herramientas de lectura y respeta tus permisos
            y sedes. Requiere configurar un proveedor LLM.
          </p>
          <div className="suggestions">
            {[
              "¿Qué productos necesitan reposición?",
              "¿Cuántas unidades quedan de un producto?",
              "¿Qué productos se vendieron más?",
            ].map((q) => (
              <button key={q} onClick={() => setQuestion(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="chat-history">
            {history.map((h, i) => (
              <div className="exchange" key={i}>
                <p className="question">{h.q}</p>
                <p className="answer">{h.a.respuesta}</p>
                <small>
                  {h.a.modelo} · {new Date(h.a.fecha).toLocaleString()} ·
                  Fuentes:{" "}
                  {h.a.fuentes
                    .map((f) => `${f.herramienta} (${f.registros})`)
                    .join(", ")}
                </small>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) =>
              submit(e, async () => {
                const a = await api<Answer>("/asistente", {
                  method: "POST",
                  body: JSON.stringify({ pregunta: question }),
                });
                setHistory((h) => [...h, { q: question, a }]);
                setQuestion("");
              })
            }
          >
            <Field label="Tu pregunta">
              <textarea
                required
                minLength={3}
                maxLength={1000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Por ejemplo: ¿cuánto stock hay de filtro de aceite?"
              />
            </Field>
            <Save busy={busy} label="Consultar" />
          </form>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Pronóstico de ventas</h2>
            <p className="muted">
              Compara un patrón semanal con un modelo Ridge de calendario.
              Necesita al menos 56 días de historial continuo; no genera cifras
              si faltan datos.
            </p>
            <div>
              <h3>¿Qué quieres pronosticar?</h3>
              <p className="muted">
                Elige un producto para estimar unidades o deja la selección
                vacía para estimar el importe total vendido.
              </p>
              <ProductLookup value={product} onChange={setProduct} />
              <button onClick={() => setProduct(null)}>
                Usar todas las ventas
              </button>
            </div>
            <form
              className="forecast-form"
              onSubmit={(e) =>
                submit(e, async () => {
                  const f = await api<Forecast>(
                    `/pronosticos?horizonte=${days}${product ? `&producto_id=${product.id}` : ""}`,
                  );
                  setForecast(f);
                  notify("Pronóstico calculado");
                })
              }
            >
              <Field label="Horizonte">
                <select value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="7">7 días</option>
                  <option value="14">14 días</option>
                  <option value="30">30 días</option>
                </select>
              </Field>
              <Save busy={busy} label="Calcular" />
            </form>
          </section>
          {forecast && (
            <section className="panel">
              <div className="section-heading">
                <h2>
                  {forecast.modelo === "semanal"
                    ? "Patrón semanal"
                    : "Tendencia y calendario"}
                </h2>
                <span>{forecast.dias_historial} días de historial</span>
              </div>
              <p>
                {forecast.objetivo === "unidades_vendidas"
                  ? "Objetivo: unidades vendidas del producto."
                  : "Objetivo: importe de ventas confirmadas, no cobros ni utilidad."}
              </p>
              <div className="model-comparison">
                {forecast.metricas.map((m) => (
                  <div
                    className={m.modelo === forecast.modelo ? "winner" : ""}
                    key={m.modelo}
                  >
                    <strong>{m.modelo}</strong>
                    <p>MAE: {m.mae}</p>
                    <p>
                      WAPE: {m.wape === null ? "No definido" : `${m.wape}%`}
                    </p>
                  </div>
                ))}
              </div>
              <DataTable
                rows={forecast.predicciones.map((p, i) => ({ ...p, id: i }))}
                columns={[
                  { title: "Fecha", cell: (r) => str(r, "fecha") },
                  { title: "Estimación", cell: (r) => str(r, "valor") },
                  { title: "Banda inferior", cell: (r) => str(r, "inferior") },
                  { title: "Banda superior", cell: (r) => str(r, "superior") },
                ]}
              />
              <p className="muted">{forecast.advertencia}</p>
            </section>
          )}
        </>
      )}
    </>
  );
}
