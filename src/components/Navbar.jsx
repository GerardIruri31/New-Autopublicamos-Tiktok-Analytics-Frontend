"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { useAuthUser } from "../context/useAuthUser.js";

const iconByKey = {
  "author-graphs": "📝",
  "book-graphs": "📚",
  "pa-graphs": "📊",
  "tiktok-api-call": "☁️",
  "database-queries": "🛢️",
  "data-maintenance": "🔧",
  "orden-generation": "📋",
  "orden-queries": "📦",
};

const labelByKey = {
  "author-graphs": "Author Graphs",
  "book-graphs": "Book Graphs",
  "pa-graphs": "PA Graphs",
  "tiktok-api-call": "TikTok API",
  "database-queries": "DB Queries",
  "data-maintenance": "Maintenance",
  "orden-generation": "Order Generation",
  "orden-queries": "Order Queries",
};

const Navbar = ({ name, allowedModules = [] }) => {
  const { instance } = useMsal();
  const { userKey, userEmail } = useAuthUser();

  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const userMenuRef = useRef(null);
  const NAV_PAGE_SIZE = 4;
  const [navPage, setNavPage] = useState(0);

  const handleLogout = () => {
    const account =
      instance.getActiveAccount?.() || (instance.getAllAccounts?.() || [])[0];

    // ids que ya usas para keys
    const email = userEmail || account?.username || "";
    const key = userKey || "";
    const homeId = account?.homeAccountId || "";

    const tiktokUserId =
      (account?.idTokenClaims?.emails?.[0] &&
        String(account.idTokenClaims.emails[0]).toLowerCase()) ||
      (account?.username && String(account.username).toLowerCase()) ||
      (account?.localAccountId && String(account.localAccountId)) ||
      "";

    try {
      if (key) {
        localStorage.removeItem(`user_modules_v1__${key}`);
      }
      // BookGraphs
      if (key) {
        localStorage.removeItem(`BookGraphs_filters_v1__${key}`);
        localStorage.removeItem(`BookGraphs_result_v1__${key}`);
      }

      // AuthorGraphs
      if (email) {
        localStorage.removeItem(`AuthorGraphs_filters_v1__${email}`);
        localStorage.removeItem(`AuthorGraphs_result_v1__${email}`);

        // PaGraphs (mismo userId/email)
        localStorage.removeItem(`PaGraphs_filters_v1__${email}`);
        localStorage.removeItem(`PaGraphs_result_v1__${email}`);
      }

      // DBQueries (por homeAccountId)
      if (homeId) {
        const DBQ_CACHE_PREFIX = "autopub_dbq_cache_v1";
        const base = `${DBQ_CACHE_PREFIX}_${homeId}`;
        localStorage.removeItem(base);
        localStorage.removeItem(`${base}_filters`);
        localStorage.removeItem(`${base}_excel_downloading`);
        localStorage.removeItem(`${base}_excel_download_result`);
      }

      // TikTok API Call (ApifyCall) — borrar TODO el cache de este módulo para el usuario
      if (tiktokUserId) {
        const TT_BASE = "tiktok_api_v1";
        const prefix = `${TT_BASE}:${tiktokUserId}:`;

        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) {
            localStorage.removeItem(k);
          }
        }
      }

      // DataMaintenance — borrar TODO el cache de este módulo para el usuario
      if (tiktokUserId) {
        const suffix = `_${tiktokUserId}`;

        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith("dm_") && k.endsWith(suffix)) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {
      // no-op (no debe bloquear el logout)
    }

    instance.logoutRedirect();
  };

  const navItems = useMemo(
    () =>
      allowedModules.map((m) => ({
        key: m.key,
        path: `/home/${m.path}`,
        label: labelByKey[m.key] ?? m.key,
        icon: iconByKey[m.key] ?? "•",
      })),
    [allowedModules],
  );

  const isActive = (path) => location.pathname === path;

  const navTotalPages = Math.max(1, Math.ceil(navItems.length / NAV_PAGE_SIZE));

  const visibleNavItems = useMemo(() => {
    const start = navPage * NAV_PAGE_SIZE;
    return navItems.slice(start, start + NAV_PAGE_SIZE);
  }, [navItems, navPage]);

  const canPrev = navPage > 0;
  const canNext = navPage < navTotalPages - 1;

  useEffect(() => {
    // Si el módulo activo está en otra página, mover el navbar a esa página
    const activeIndex = navItems.findIndex((it) => isActive(it.path));
    if (activeIndex < 0) return;

    const pageOfActive = Math.floor(activeIndex / NAV_PAGE_SIZE);
    if (pageOfActive !== navPage) setNavPage(pageOfActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navItems]);

  useEffect(() => {
    setNavPage((p) => Math.min(p, navTotalPages - 1));
  }, [navTotalPages]);

  // Close dropdowns on outside click / Esc (solo UI)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setUserOpen(false);
      }
    };
    const onMouseDown = (e) => {
      if (!userMenuRef.current) return;
      if (userMenuRef.current.contains(e.target)) return;
      setUserOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // Cuando cambias de ruta, cerramos el menú móvil (solo UX)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const initial = name?.charAt(0)?.toUpperCase() || "U";

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl">
      {/* Accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500" />

      <div className="w-full px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-slate-100"
              aria-label="Go to Home"
            >
              <img
                src="https://www.autopublicamos.com/wp-content/uploads/2022/08/logo-Autopublicamos-white.png"
                alt="Autopublicamos"
                className="h-10 w-auto object-contain rounded-md bg-slate-900 p-1"
              />
              <div className="hidden sm:block">
                <div className="text-sm font-semibold tracking-tight text-slate-900">
                  Analytics Dashboard
                </div>
                <div className="text-xs text-slate-500">Autopublicamos</div>
              </div>
            </button>
          </div>

          {/* Center: Desktop Nav */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/70 p-1 shadow-sm">
              {/* Flecha izquierda (solo si hay más de 4) */}
              {navTotalPages > 1 && (
                <button
                  type="button"
                  onClick={() => canPrev && setNavPage((p) => p - 1)}
                  disabled={!canPrev}
                  className={[
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition text-xl font-bold",
                    "hover:bg-slate-50",
                  ].join(" ")}
                  aria-label="Anterior"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              )}

              {/* Tabs visibles (4 en 4) */}
              {visibleNavItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={[
                      "group relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold",
                      "transition-all duration-200",
                      active
                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                        : "text-slate-700 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "text-base transition-transform duration-200",
                        active ? "scale-105" : "group-hover:scale-105",
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>
                    <span className="whitespace-nowrap">{item.label}</span>

                    {active && (
                      <span className="absolute -bottom-[6px] left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 blur-[0.5px]" />
                    )}
                  </button>
                );
              })}

              {/* Flecha derecha (solo si hay más de 4) */}
              {navTotalPages > 1 && (
                <button
                  type="button"
                  onClick={() => canNext && setNavPage((p) => p + 1)}
                  disabled={!canNext}
                  className={[
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition text-xl font-bold",
                    "hover:bg-slate-50",
                  ].join(" ")}
                  aria-label="Siguiente"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Right: User + Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/70 p-2 text-slate-700 shadow-sm transition hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {mobileOpen ? (
                  <>
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </>
                )}
              </svg>
            </button>

            {/* User dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm transition hover:bg-slate-100"
                aria-label="Open user menu"
                aria-expanded={userOpen}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm">
                  {initial}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-semibold text-slate-900">
                    {name || "User"}
                  </span>
                  <span className="text-[11px] text-slate-500">Signed in</span>
                </div>
                <svg
                  className={[
                    "h-4 w-4 text-slate-500 transition-transform",
                    userOpen ? "rotate-180" : "",
                  ].join(" ")}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {userOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {name || "User"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Autopublicamos Dashboard
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="M16 17l5-5-5-5" />
                        <path d="M21 12H9" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Nav (collapsible) */}
        {mobileOpen && (
          <div className="lg:hidden pb-4">
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm">
              <div className="grid grid-cols-1 gap-1">
                {navItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                        active
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
