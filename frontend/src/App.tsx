import { useEffect, useState } from "react";
import { api, can, notify, problem, setCsrf } from "./api";
import type { Row, SessionData, User } from "./api";
import { Icon, Logo } from "./icons";
import { Field, Save } from "./ui";
import { useSubmit } from "./hooks";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Inventory from "./pages/Inventory";
import Commercial from "./pages/Commercial";
import Organization from "./pages/Organization";
import Contacts from "./pages/Contacts";
import Access from "./pages/Access";
import Excel from "./pages/Excel";
import Intelligence from "./pages/Intelligence";
import Audit from "./pages/Audit";
import Statistics from "./Statistics";
import { setSoundEnabled, soundEnabled, unlockAudio } from "./sounds";
const navigation = [
  {
    id: "estadisticas",
    label: "Estadísticas",
    symbol: "chart",
    permission: "reportes.ver",
  },
  {
    id: "inicio",
    label: "Vista general",
    symbol: "chart",
    permission: "reportes.ver",
  },
  {
    id: "productos",
    label: "Productos",
    symbol: "box",
    permission: "productos.ver",
  },
  {
    id: "inventario",
    label: "Inventario",
    symbol: "inventory",
    permission: "inventario.ver",
  },
  {
    id: "ventas",
    label: "Ventas y cobros",
    symbol: "sale",
    permission: "ventas.ver",
  },
  {
    id: "compras",
    label: "Compras",
    symbol: "purchase",
    permission: "compras.ver",
  },
  {
    id: "contactos",
    label: "Contactos",
    symbol: "contacts",
    permission: "contactos.ver",
  },
  {
    id: "organizacion",
    label: "Empresa y sedes",
    symbol: "building",
    permission: "sedes.ver",
  },
  {
    id: "excel",
    label: "Importar / exportar",
    symbol: "file",
    permission: "excel",
  },
  {
    id: "inteligencia",
    label: "Asistente y pronósticos",
    symbol: "sparkle",
    permission: "inteligencia",
  },
  {
    id: "accesos",
    label: "Usuarios y roles",
    symbol: "users",
    permission: "owner",
  },
  { id: "auditoria", label: "Auditoría", symbol: "audit", permission: "owner" },
];
function visible(user: User, permission: string) {
  return permission === "owner"
    ? user.propietario
    : permission === "excel"
      ? can(user, "excel.importar") || can(user, "excel.exportar")
      : permission === "inteligencia"
        ? can(user, "ia.usar") || can(user, "pronosticos.ver")
        : permission === "compras.ver"
          ? can(user, permission) && can(user, "costos.ver")
          : can(user, permission);
}
export default function App() {
  const [demo, setDemo] = useState(false);
  const [sound, setSound] = useState(soundEnabled);
  useEffect(() => {
    const unlock = () => {
      void unlockAudio();
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);
  const [smallScreen, setSmallScreen] = useState(
    window.matchMedia("(max-width: 850px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 850px)");
    const changed = () => setSmallScreen(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("menu-collapsed") === "yes",
  );
  const [groups, setGroups] = useState<Record<string, boolean>>({
    operacion: true,
    analisis: true,
    administracion: true,
  });
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(window.location.hash.slice(1) || "inicio"),
    [company, setCompany] = useState<Row | null>(null),
    [notice, setNotice] = useState<{ message: string; error: boolean } | null>(
      null,
    ),
    [mobile, setMobile] = useState(false);
  useEffect(() => {
    api<SessionData>("/auth/me")
      .then((s) => {
        setUser(s.usuario);
        setDemo(Boolean(s.demo));
        setCsrf(s.csrf);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const expired = () => {
        setUser(null);
        setCsrf("");
      },
      hash = () => {
        setPage(window.location.hash.slice(1) || "inicio");
        setMobile(false);
      },
      notification = (e: Event) => setNotice((e as CustomEvent).detail);
    window.addEventListener("session-expired", expired);
    window.addEventListener("hashchange", hash);
    window.addEventListener("notice", notification);
    return () => {
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("notice", notification);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  const refreshCompany = () =>
    api<Row | null>("/empresa")
      .then(setCompany)
      .catch(() => {});
  useEffect(() => {
    if (user && can(user, "empresa.ver"))
      api<Row | null>("/empresa")
        .then(setCompany)
        .catch(() => {});
  }, [user]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setCsrf("");
    } catch (e) {
      problem(e);
    }
  }
  const toast = notice && (
    <div role="status" className={`toast ${notice.error ? "error-toast" : ""}`}>
      <span>{notice.message}</span>
      <button aria-label="Cerrar aviso" onClick={() => setNotice(null)}>
        ×
      </button>
    </div>
  );
  if (loading)
    return <div className="loading-screen">Preparando tu espacio…</div>;
  if (!user)
    return (
      <>
        <Login
          logged={(s) => {
            setUser(s.usuario);
            setDemo(Boolean(s.demo));
            setCsrf(s.csrf);
          }}
        />
        {toast}
      </>
    );
  const links = navigation.filter((n) => visible(user, n.permission)),
    rootPage = page.split("/")[0],
    selected =
      rootPage === "perfil"
        ? page
        : links.some((n) => n.id === rootPage)
          ? rootPage
          : links.find((n) => n.id === "inicio")?.id ||
            links[0]?.id ||
            "perfil",
    currency = String(company?.moneda || "PEN");
  return (
    <div className={`app ${collapsed ? "menu-collapsed" : ""}`}>
      <aside
        id="main-navigation"
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
      >
        <div className="sidebar-heading">
          <a
            className="brand"
            href={`#${links.find((n) => n.id === "inicio")?.id || links[0]?.id || "perfil"}`}
            aria-label="Inicio de la empresa"
            onClick={() => setMobile(false)}
          >
            <Logo
              name={String(company?.nombre_comercial || "Demo Repuestos")}
            />
          </a>
          {smallScreen && (
            <button
              className="drawer-close"
              aria-label="Cerrar menú"
              onClick={() => setMobile(false)}
            >
              ×
            </button>
          )}
        </div>
        <nav aria-label="Navegación principal">
          {[
            {
              id: "analisis",
              label: "Análisis",
              items: ["inicio", "estadisticas", "inteligencia", "excel"],
            },
            {
              id: "administracion",
              label: "Administración",
              items: ["organizacion", "accesos", "auditoria"],
            },
            {
              id: "operacion",
              label: "Operaciones",
              items: [
                "productos",
                "inventario",
                "ventas",
                "compras",
                "contactos",
              ],
            },
          ].map((group) => {
            const items = group.items.flatMap((id) =>
              links.filter((n) => n.id === id),
            );
            if (!items.length) return null;
            return (
              <div className={`nav-group nav-${group.id}`} key={group.id}>
                <button
                  className="nav-group-toggle"
                  aria-expanded={collapsed || groups[group.id]}
                  aria-controls={`group-${group.id}`}
                  onClick={() => {
                    if (collapsed) {
                      setCollapsed(false);
                      localStorage.setItem("menu-collapsed", "no");
                    }
                    setGroups((g) => ({
                      ...g,
                      [group.id]: collapsed || !g[group.id],
                    }));
                  }}
                >
                  <span>{group.label}</span>
                  <Icon
                    name="chevron"
                    size={14}
                    style={{
                      transform: groups[group.id] ? "rotate(90deg)" : undefined,
                    }}
                  />
                </button>
                <div
                  id={`group-${group.id}`}
                  className="nav-items"
                  hidden={!collapsed && !groups[group.id]}
                >
                  {items.map((n) => (
                    <a
                      className={selected === n.id ? "active" : ""}
                      href={`#${n.id}`}
                      key={n.id}
                      title={collapsed ? n.label : undefined}
                      aria-label={n.label}
                      aria-current={selected === n.id ? "page" : undefined}
                      onClick={() => setMobile(false)}
                    >
                      <Icon name={n.symbol} />
                      <span className="nav-label">{n.label}</span>
                      {n.id === "inteligencia" && (
                        <small className="nav-label" aria-hidden="true">
                          Pendiente
                        </small>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-controls">
          <button
            className="sidebar-collapse"
            onClick={() => {
              if (smallScreen) {
                setMobile(false);
                return;
              }
              setCollapsed(!collapsed);
              localStorage.setItem("menu-collapsed", collapsed ? "no" : "yes");
            }}
            aria-label={
              smallScreen
                ? "Cerrar menú lateral"
                : collapsed
                  ? "Expandir menú"
                  : "Contraer menú"
            }
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            aria-expanded={smallScreen ? mobile : !collapsed}
            aria-controls="main-navigation"
          >
            <Icon
              name="chevron"
              size={20}
              style={{ transform: collapsed ? undefined : "rotate(180deg)" }}
            />
            <span>{smallScreen ? "Cerrar menú" : "Contraer menú"}</span>
          </button>
          <button
            className="sound-toggle"
            aria-pressed={sound}
            aria-label={sound ? "Silenciar sonidos" : "Activar sonidos"}
            title={sound ? "Silenciar sonidos" : "Activar sonidos"}
            onClick={() => {
              setSound(!sound);
              setSoundEnabled(!sound);
            }}
          >
            <Icon name={sound ? "volume" : "mute"} />
            <span>{sound ? "Sonidos activados" : "Sonidos desactivados"}</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="installation-status">
            <i /> Instalación independiente
          </div>
          <span>v0.2.2 · TECCompany</span>
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <div className="app-main">
        <header className="topbar">
          {smallScreen && (
            <button
              className="menu-toggle"
              onClick={() => {
                setCollapsed(false);
                setMobile(!mobile);
              }}
              aria-label={mobile ? "Cerrar menú principal" : "Abrir menú"}
              aria-expanded={mobile}
              aria-controls="main-navigation"
            >
              <Icon name="menu" />
            </button>
          )}
          <div className="company-name">
            <span className="status-dot" />
            <strong>{String(company?.nombre_comercial || "Mi empresa")}</strong>
            <small>
              {navigation.find((n) => n.id === selected)?.label || "Mi perfil"}
            </small>
          </div>
          <div className="topbar-right">
            <a className="user-chip" href="#perfil">
              <span>{user.nombre.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{user.nombre}</strong>
                <small>{user.propietario ? "Propietario" : "Usuario"}</small>
              </div>
            </a>
            <button className="logout" onClick={logout}>
              Salir
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="content"
          data-module={selected}
          key={selected}
        >
          {demo && (
            <div className="demo-banner">
              <Icon name="shield" size={16} />
              <span>
                <strong>Entorno de demostración.</strong> Los productos,
                clientes y operaciones son ficticios.
              </span>
            </div>
          )}
          {selected === "inicio" && (
            <Dashboard user={user} currency={currency} />
          )}
          {selected === "productos" && (
            <Catalog user={user} currency={currency} path={page} />
          )}
          {selected === "estadisticas" && (
            <Statistics user={user} path={page} />
          )}
          {selected === "inventario" && <Inventory user={user} />}
          {selected === "ventas" && (
            <Commercial user={user} currency={currency} />
          )}
          {selected === "compras" && (
            <Commercial user={user} currency={currency} purchase />
          )}
          {selected === "contactos" && <Contacts user={user} />}
          {selected === "organizacion" && (
            <Organization user={user} refreshCompany={refreshCompany} />
          )}
          {selected === "accesos" && <Access />}
          {selected === "excel" && <Excel user={user} />}
          {selected === "inteligencia" && <Intelligence user={user} />}
          {selected === "auditoria" && <Audit />}
          {selected === "perfil" && (
            <Profile
              user={user}
              changed={() => {
                setUser(null);
                setCsrf("");
              }}
            />
          )}
        </main>
        <footer className="footer">
          Una operación clara. Un historial confiable.
          <span>
            {String(company?.moneda || "PEN")} ·{" "}
            {String(company?.zona_horaria || "America/Lima")}
          </span>
        </footer>
      </div>
      {toast}
    </div>
  );
}
function Login({ logged }: { logged: (s: SessionData) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <div className="login-layout">
      <section className="login-story">
        <Logo />
        <span className="eyebrow">ALMACENAMIENTO INTELIGENTE</span>
        <h1>
          Cada repuesto,
          <br />
          <em>en su lugar.</em>
        </h1>
        <p>
          Del almacén al mostrador. Tu operación conectada, tus decisiones más
          claras.
        </p>
        <div className="login-features">
          <div>
            <strong>01</strong>
            <span>Organiza tus productos</span>
          </div>
          <div>
            <strong>02</strong>
            <span>Conecta tus almacenes</span>
          </div>
          <div>
            <strong>03</strong>
            <span>Conserva cada movimiento</span>
          </div>
        </div>
        <img className="login-industrial" src="/industrial.svg" alt="" />
        <small>Tu negocio. Tu instalación. Tu control.</small>
      </section>
      <section className="login-form">
        <div>
          <div className="login-mobile-brand">
            <Logo />
          </div>
          <span className="eyebrow">TU CENTRO DE OPERACIONES</span>
          <h2>Inicia sesión</h2>
          <p className="muted">Accede con la cuenta de tu empresa.</p>
          <form
            onSubmit={(e) =>
              submit(e, async () =>
                logged(
                  await api<SessionData>("/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ email, password }),
                  }),
                ),
              )
            }
          >
            <Field label="Correo electrónico">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="nombre@empresa.com"
              />
            </Field>
            <Field label="Contraseña">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Save busy={busy} label="Entrar a mi espacio →" />
          </form>
          <p className="login-help">
            Si necesitas recuperar el acceso, contacta al responsable de tu
            instalación.
          </p>
        </div>
        <small>Sistema de Almacenamiento Inteligente · v0.2.2</small>
      </section>
    </div>
  );
}
function Profile({ user, changed }: { user: User; changed: () => void }) {
  const [actual, setActual] = useState(""),
    [nueva, setNueva] = useState(""),
    [confirm, setConfirm] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <section className="panel narrow">
      <h1>Mi perfil</h1>
      <p>
        {user.nombre} · {user.email}
      </p>
      <h2>Cambiar contraseña</h2>
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            if (confirm !== nueva)
              throw new Error("Las contraseñas no coinciden");
            await api("/auth/password", {
              method: "POST",
              body: JSON.stringify({ actual, nueva }),
            });
            notify("Contraseña actualizada; vuelve a iniciar sesión");
            changed();
          })
        }
      >
        <Field label="Contraseña actual">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </Field>
        <Field label="Nueva contraseña (12 caracteres mínimo)">
          <input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
        </Field>
        <Field label="Repetir contraseña">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Save busy={busy} />
      </form>
    </section>
  );
}
