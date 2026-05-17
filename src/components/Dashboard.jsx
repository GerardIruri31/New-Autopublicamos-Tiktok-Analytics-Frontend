import React, { useMemo, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { useAuthUser } from "../context/useAuthUser.js";

import Layout from "./Layout";

// módulos existentes (no se modifican)
import APICall from "./APICall";
import DataBaseQueries from "./DataBaseQueries";
import DataMaintenance from "./DataMaintenance";
import PaGraphs from "./PaGraphs";
import AuthorGraphs from "./AuthorGraphs";
import BookGraphs from "./BookGraphs";
import LoadingScreen from "./LoadingScreen";
import NoModules from "./NoModules";
import GeneracionOrdenFiltersPage from "../pages/GeneracionOrdenFiltersPage.jsx";
import OrdenQueriesPage from "../pages/OrdenQueriesPage.jsx";

export const decodeJwt = (token) => {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const Dashboard = () => {
  const { instance } = useMsal();
  const account = instance.getActiveAccount();
  const navigate = useNavigate();
  const location = useLocation();

  const { modules, isModulesReady } = useAuthUser();

  const moduleRegistry = useMemo(
    () => ({
      bookgraph: {
        key: "book-graphs",
        path: "book-graphs",
        element: <BookGraphs />,
      },
      authorgraph: {
        key: "author-graphs",
        path: "author-graphs",
        element: <AuthorGraphs />,
      },
      pagraph: { key: "pa-graphs", path: "pa-graphs", element: <PaGraphs /> },
      dbqueryapify: {
        key: "database-queries",
        path: "database-queries",
        element: <DataBaseQueries />,
      },
      tiktokapi: {
        key: "tiktok-api-call",
        path: "tiktok-api-call",
        element: <APICall />,
      },
      maintenance: {
        key: "data-maintenance",
        path: "data-maintenance",
        element: <DataMaintenance />,
      },

      workorden: {
        key: "orden-generation",
        path: "orden-generation",
        element: <GeneracionOrdenFiltersPage />,
      },
      dbqueryorden: {
        key: "orden-queries",
        path: "orden-queries",
        element: <OrdenQueriesPage />,
      },
    }),
    [],
  );

  const MODULE_ORDER = useMemo(
    () => [
      "bookgraph",
      "authorgraph",
      "pagraph",
      "tiktokapi",
      "dbqueryapify",
      "maintenance",
      "workorden",
      "dbqueryorden",
    ],
    [],
  );

  const allowedModules = useMemo(() => {
    const backendList = Array.isArray(modules) ? modules : [];

    // Normaliza a set para filtrar rápido
    const allowedSet = new Set(backendList.map((m) => String(m).toLowerCase()));

    // Orden fijo + solo los que backend permite
    return MODULE_ORDER.filter((m) => allowedSet.has(m))
      .map((m) => moduleRegistry[m] ?? null)
      .filter(Boolean);
  }, [modules, moduleRegistry, MODULE_ORDER]);

  // ✅ HOOK SIEMPRE ARRIBA (nunca debajo de returns condicionales)
  useEffect(() => {
    if (!isModulesReady) return;
    if (allowedModules.length === 0) return;

    if (location.pathname === "/home" || location.pathname === "/home/") {
      navigate(`/home/${allowedModules[0].path}`, { replace: true });
    }
  }, [isModulesReady, allowedModules, location.pathname, navigate]);

  // ✅ recién aquí haces returns condicionales
  if (!isModulesReady) return <LoadingScreen />;
  if (allowedModules.length === 0) return <NoModules />;

  return (
    <Layout allowedModules={allowedModules}>
      <Routes>
        {allowedModules.map((m) => (
          <Route key={m.key} path={m.path} element={m.element} />
        ))}

        <Route
          path="*"
          element={<Navigate to={`/home/${allowedModules[0].path}`} replace />}
        />
      </Routes>
    </Layout>
  );
};
export default Dashboard;
