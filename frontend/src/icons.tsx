import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  home: "M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21v-8h6v8",
  box: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 5 9-5 M12 12v9 M7.5 5l9 5",
  inventory: "M4 3h16v18H4z M4 9h16 M4 15h16 M8 6h8 M8 12h8 M8 18h8",
  sale: "M4 5h2l2 11h11l2-8H7 M10 20h.01 M18 20h.01 M14 2v5 M11 4.5h6",
  purchase: "M4 9h16v12H4z M12 3v11 M8 10l4 4 4-4",
  contacts:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-3a4 4 0 0 0-3-3.8 M16 2a4 4 0 0 1 0 8",
  chart: "M3 3v18h18 M7 16l5-6 4 3 5-8",
  sparkle: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z M20 2v4 M18 4h4",
  building:
    "M3 21V7h8V3h10v18z M7 11h1 M7 15h1 M15 7h2 M15 11h2 M15 15h2 M11 21v-4h4v4",
  users:
    "M20 21v-3a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v3 M16 6a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
  audit: "M8 3H5v18h14V3h-3 M8 2h8v4H8z M8 10h8 M8 14h8 M8 18h5",
  file: "M14 2H4v20h16V8z M14 2v6h6 M8 13h8 M8 17h5",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12 M6 18 18 6",
  search: "M20 20l-5-5 M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0",
  upload: "M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6",
  check: "m5 12 4 4 10-10",
  image: "M3 3h18v18H3z M3 17l6-6 4 4 4-5 4 4 M9 7h.01",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}
export function Logo({ name = "Demo Repuestos" }: { name?: string }) {
  return (
    <div className="logo-lockup">
      <img src="/logo.svg" alt="" width="42" height="42" />
      <div>
        <strong>{name}</strong>
        <small>ALMACENAMIENTO INTELIGENTE</small>
      </div>
    </div>
  );
}
