import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InteractionStatus } from "@azure/msal-browser";
import LoadingScreen from "./components/LoadingScreen";

import Dashboard from "./components/Dashboard";

// DEBUG helper: decodifica el payload del JWT (solo para inspección en DEV)
const decodeJwt = (token) => {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const json = atob(padded);
    // Manejo básico de UTF-8
    const decoded = decodeURIComponent(
      Array.from(json)
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();
  const { instance, inProgress } = useMsal();

  // Helpers locales (no dependas de variables de otro componente)
  const allAccounts = instance.getAllAccounts();
  const hasAnyAccount = allAccounts.length > 0;
  const cameFromRedirect = !!window.location.hash;

  // Refresh típico: hay cuenta cacheada, pero el flag auth aún no se estabiliza
  const isRefresh = hasAnyAccount && !cameFromRedirect && !isAuthenticated;

  useEffect(() => {
    // No hagas nada mientras MSAL está trabajando
    if (inProgress !== InteractionStatus.None) return;

    const accounts = instance.getAllAccounts();

    // Si hay cuentas, asegura activeAccount y NO redirijas al login (evita parpadeos en refresh)
    if (accounts.length > 0) {
      if (!instance.getActiveAccount()) {
        instance.setActiveAccount(accounts[0]);
      }
      return;
    }

    // Si no hay cuentas y no está autenticado, ahí sí manda al login
    if (!isAuthenticated) {
      instance.loginRedirect(loginRequest);
    }
  }, [instance, inProgress, isAuthenticated]);

  // ✅ IMPORTANTE: los returns van DESPUÉS del useEffect (hooks siempre en el mismo orden)

  // 1) Refresh UI (gris + "Refreshing page..." + spinner moderno)
  if (isRefresh) {
    return <LoadingScreen />;
  }

  // 2) MSAL ocupado (por ejemplo login redirect/startup)
  if (inProgress !== InteractionStatus.None) {
    return <LoadingScreen />;
  }

  // 3) No auth (no refresh): tu pantalla compacta
  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  return children;
};

const RedirectToLogin = () => {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  const [willRedirect, setWillRedirect] = useState(false);

  // Helpers: a veces isAuthenticated tarda 1 render en ponerse true,
  // pero ya existen accounts (post-login). Eso NO debe mostrar "Redirecting to sign in…"
  const hasAnyAccount = instance.getAllAccounts().length > 0;
  const cameFromRedirect = !!window.location.hash;

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    const allAccounts = instance.getAllAccounts();

    // Si no hay activeAccount pero sí hay cuentas, seteamos una.
    if (!instance.getActiveAccount() && allAccounts.length > 0) {
      instance.setActiveAccount(allAccounts[0]);
    }

    const account = instance.getActiveAccount();

    // Si ya está autenticado y tenemos claims, navegamos al home
    if (isAuthenticated && account?.idTokenClaims) {
      navigate("/home", { replace: true });
      return;
    }

    // Si ya hay cuentas (post-login) pero isAuthenticated todavía no “sube”,
    // NO dispares loginRedirect. Solo espera el siguiente render.
    if (allAccounts.length > 0) {
      return;
    }

    // Si no venimos de redirect y no hay cuentas -> sí redirigimos a sign in
    if (!cameFromRedirect) {
      setWillRedirect(true);
      instance.loginRedirect(loginRequest);
    }
  }, [instance, inProgress, isAuthenticated, navigate, cameFromRedirect]);

  // ✅ Render phase correcto (evita el mensaje incorrecto post-login)
  if (inProgress !== InteractionStatus.None) {
    return <LoadingScreen />;
  }

  if (hasAnyAccount && !cameFromRedirect && !isAuthenticated) {
    return <LoadingScreen />;
  }

  if (isAuthenticated || hasAnyAccount || cameFromRedirect) {
    return <LoadingScreen />;
  }

  if (willRedirect) {
    return <LoadingScreen />;
  }

  return <LoadingScreen />;
};

const App = () => {
  return (
    <Router>
      <div className="min-h-screen w-full">
        <Routes>
          <Route path="/" element={<RedirectToLogin />} />

          <Route
            path="/home/*"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
