export interface Definition {
  clave: string;
  etiqueta: string;
  tipo: string;
  obligatorio: boolean;
  opciones: string[];
}
export const fieldNames: Record<string, string> = {
  texto: "Texto",
  numero: "Número",
  fecha: "Fecha",
  booleano: "Sí / No",
  seleccion: "Lista de opciones",
};
