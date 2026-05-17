import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./style/index.css";

import { msalConfig, loginRequest, resetPasswordRequest } from "../authConfig";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { AuthUserProvider } from "./context/AuthUserContext.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";

const msalInstance = new PublicClientApplication(msalConfig);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<LoadingScreen />);

msalInstance
  .handleRedirectPromise()
  .then((response) => {
    if (response?.account) {
      msalInstance.setActiveAccount(response.account);
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }
    }

    const active = msalInstance.getActiveAccount();

    // ✅ Si NO hay cuenta activa → login B2C
    if (!active) {
      msalInstance.loginRedirect(loginRequest);
      return;
    }

    // ✅ Si ya está logueado → renderizamos app
    root.render(
      <MsalProvider instance={msalInstance}>
        <AuthUserProvider>
          <App />
        </AuthUserProvider>
      </MsalProvider>
    );
  })
  .catch((error) => {
    console.error("❌ Error en handleRedirectPromise:", error);

    const msg = error?.errorMessage || error?.message || "";
    // ✅ Forgot password en B2C (AADB2C90118) -> redirige al policy de reset
    if (msg.includes("AADB2C90118")) {
      // opcional pero recomendado: limpia el hash antes de redirigir
      window.location.hash = "";
      msalInstance.loginRedirect(resetPasswordRequest);
      return;
    }

    // ⛔ Si el usuario canceló el login (AADB2C90091), volvemos a mostrar login
    if (msg.includes("AADB2C90091")) {
      console.warn("🔁 Usuario canceló el login, redirigiendo nuevamente...");
      window.location.hash = "";
      msalInstance.loginRedirect(loginRequest);
      return;
    }

    window.location.hash = "";
    msalInstance.loginRedirect(loginRequest);
  });
