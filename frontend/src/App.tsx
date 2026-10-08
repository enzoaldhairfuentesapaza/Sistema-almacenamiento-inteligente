import { useEffect, useState } from "react";

function App() {
  const [estado, setEstado] = useState("Conectando…");

  useEffect(() => {
    const controller = new AbortController();

    async function comprobarAPI() {
      try {
        const respuesta = await fetch("/api/v1/health", {
          signal: controller.signal,
        });

        if (!respuesta.ok) {
          throw new Error(`Error HTTP ${respuesta.status}`);
        }

        const datos = await respuesta.json();

        setEstado(
          datos.status === "ok"
            ? "API conectada correctamente"
            : "La API devolvió un estado inesperado",
        );
      } catch {
        if (!controller.signal.aborted) {
          setEstado("No se pudo conectar con la API");
        }
      }
    }

    void comprobarAPI();

    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Sistema de Almacenamiento Inteligente</h1>
      <p>{estado}</p>
    </main>
  );
}

export default App;
