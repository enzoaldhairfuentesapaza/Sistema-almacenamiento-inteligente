import { playAlert } from "./sounds";
export type Row = Record<string, unknown> & { id: number };
export interface User {
  id: number;
  nombre: string;
  email: string;
  propietario: boolean;
  activo: boolean;
  roles: number[];
  sedes: number[];
  permisos: string[];
}
export interface SessionData {
  demo?: boolean;
  usuario: User;
  csrf: string;
}
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "No se pudo completar la solicitud" }));
    if (response.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "Revisa los campos: hay datos inválidos",
    );
  }
  return response.json() as Promise<T>;
}
export async function download(path: string, name: string) {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "No se pudo descargar");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export const str = (row: Row, key: string) => String(row[key] ?? "");
export const num = (row: Row, key: string) => Number(row[key] ?? 0);
export const money = (value: unknown, currency = "PEN") =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(
    Number(value ?? 0),
  );
export const date = (value: unknown) =>
  new Date(String(value)).toLocaleString("es-PE");
export function notify(message: string, error = false) {
  playAlert(error);
  window.dispatchEvent(
    new CustomEvent("notice", { detail: { message, error } }),
  );
}
export function problem(e: unknown) {
  notify(e instanceof Error ? e.message : "Error inesperado", true);
}
export function can(user: User, permission: string) {
  return user.permisos.includes(permission);
}
