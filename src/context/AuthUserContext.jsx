import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../authConfig.js"; // ajusta la ruta si tu estructura difiere
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useCallback,
  useState,
  useRef,
} from "react";
import { getUserRoleService } from "../services/auth/GetUserRoleService";

export const AuthUserContext = createContext({
  userEmail: null,
  userKey: null,
  jwt: null,
  isAuthReady: false,
  refreshJwt: async () => null,
  modules: [],
  isModulesReady: false,
  refreshModules: async () => [],
  refreshRole: async () => null,
});

export const AuthUserProvider = ({ children }) => {
  const { instance } = useMsal();
  const account =
    instance.getActiveAccount() || (instance.getAllAccounts?.()[0] ?? null);

  const userEmail =
    (account?.idTokenClaims?.emails?.[0] &&
      String(account.idTokenClaims.emails[0]).toLowerCase()) ||
    (account?.username && String(account.username).toLowerCase()) ||
    null;

  // ✅ ID estable para localStorage (no dependas del email para keys)
  const userKey =
    (account?.localAccountId && String(account.localAccountId)) ||
    (account?.homeAccountId && String(account.homeAccountId)) ||
    userEmail ||
    null;
  // 4) Guardar JWT (idToken) en memoria (Context)
  const [jwt, setJwt] = useState(null);

  const [role, setRole] = useState(null);
  const [isRoleReady, setIsRoleReady] = useState(false);
  const lastRoleUserKeyRef = useRef(null);

  const refreshTimerRef = useRef(null);
  const [modules, setModules] = useState([]);
  const [isModulesReady, setIsModulesReady] = useState(false);
  const lastModulesUserKeyRef = useRef(null);

  const refreshModules = useCallback(
    async (forcedJwt = null) => {
      if (!userEmail || !userKey) {
        setModules([]);
        setIsModulesReady(false);
        return [];
      }

      const cacheKey = `user_modules_v1__${userKey}`;

      // 2) llamada real
      try {
        setIsModulesReady(false);
        const tokenToUse = forcedJwt || jwt;
        const azureURL = import.meta.env.VITE_AZURE_API_URL;
        const email = String(userEmail).toLowerCase();
        const resp = await fetch(
          `${azureURL}/user/module?email=${encodeURIComponent(email)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(tokenToUse ? { Authorization: `Bearer ${tokenToUse}` } : {}),
            },
            mode: "cors",
          },
        );

        if (!resp.ok) throw new Error(`Failed /user/module: ${resp.status}`);
        const data = await resp.json();
        const raw = Array.isArray(data) ? data : data?.modules;
        const list = Array.isArray(raw)
          ? raw.map((x) => String(x).toLowerCase())
          : [];

        setModules(list);
        setIsModulesReady(true);
        try {
          if (list.length > 0) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(list));
            } catch {}
          } else {
            try {
              localStorage.removeItem(cacheKey);
            } catch {}
          }
        } catch {}

        return list;
      } catch (e) {
        console.error("[AuthUserContext] refreshModules failed:", e);
        setModules([]);
        setIsModulesReady(true); // listo pero vacío
        return [];
      }
    },
    [userEmail, userKey, jwt],
  );

  const refreshRole = useCallback(
    async (forcedJwt = null) => {
      if (!userEmail || !userKey) {
        setRole(null);
        setIsRoleReady(false);
        return null;
      }

      try {
        setIsRoleReady(false);

        const tokenToUse = forcedJwt || jwt;
        const fetchedRole = await getUserRoleService({
          token: tokenToUse,
          email: userEmail,
        });

        const normalizedRole = fetchedRole ? String(fetchedRole).trim() : null;

        setRole(normalizedRole);
        setIsRoleReady(true);
        return normalizedRole;
      } catch (e) {
        console.error("[AuthUserContext] refreshRole failed:", e);
        setRole(null);
        setIsRoleReady(true);
        return null;
      }
    },
    [userEmail, userKey, jwt],
  );

  useEffect(() => {
    if (account) return;

    lastModulesUserKeyRef.current = null;
    lastRoleUserKeyRef.current = null;

    setModules([]);
    setIsModulesReady(false);

    setRole(null);
    setIsRoleReady(false);
  }, [account]);

  useEffect(() => {
    if (!account) return;
    if (!userKey || !userEmail) return;
    if (!jwt) return;

    // evita re-fetch infinito si jwt se refresca
    if (lastModulesUserKeyRef.current === userKey && isModulesReady) return;

    lastModulesUserKeyRef.current = userKey;
    refreshModules(jwt);
  }, [account, userKey, userEmail, jwt, refreshModules, isModulesReady]);

  useEffect(() => {
    if (!account) return;
    if (!userKey || !userEmail) return;
    if (!jwt) return;

    if (lastRoleUserKeyRef.current === userKey && isRoleReady) return;

    lastRoleUserKeyRef.current = userKey;
    refreshRole(jwt);
  }, [account, userKey, userEmail, jwt, refreshRole, isRoleReady]);

  const safeDecodeJwt = (token) => {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

    try {
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!jwt) return;

    //const payload = safeDecodeJwt(jwt);
    //console.log("[AuthUserContext] idToken payload decoded:", payload);
  }, [jwt]);

  const getJwtExpMs = (token) => {
    const payload = safeDecodeJwt(token);
    const expSec = payload?.exp;
    if (!expSec || !Number.isFinite(Number(expSec))) return null;
    return Number(expSec) * 1000;
  };

  const refreshJwt = useCallback(async () => {
    if (!account) {
      setJwt(null);
      return null;
    }

    try {
      // OJO: acquireTokenSilent con loginRequest devuelve idToken (y accessToken si aplica).
      const tokenResp = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });

      // Para Camino 1 vamos a usar idToken como Bearer para tu backend
      const idToken = tokenResp?.idToken || null;
      setJwt(idToken);
      return idToken;
    } catch (e) {
      // Si MSAL dice que necesita interacción, forzamos redirect (mantiene tu UX)
      if (
        e?.errorCode === "interaction_required" ||
        e?.errorMessage?.includes("interaction_required")
      ) {
        instance.loginRedirect(loginRequest);
        return null;
      }

      console.error("[AuthUserContext] acquireTokenSilent failed:", e);
      setJwt(null);
      return null;
    }
  }, [instance, account]);

  // 5) Cuando haya account listo, obtiene idToken y lo guarda
  useEffect(() => {
    if (!account) {
      setJwt(null);
      return;
    }
    refreshJwt();
  }, [account, refreshJwt]);

  // Auto-refresh: refresca el token antes de expirar para que "jwt" no quede vencido
  useEffect(() => {
    // limpia timer anterior
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!jwt) return;

    const expMs = getJwtExpMs(jwt);

    // margen de seguridad (ej: 2 minutos antes)
    const SKEW_MS = 5 * 60 * 1000;

    // si no podemos leer exp, refrescamos cada ~50 min como fallback
    const fallbackMs = 50 * 60 * 1000;

    const now = Date.now();
    const delay = expMs ? Math.max(5_000, expMs - now - SKEW_MS) : fallbackMs;

    refreshTimerRef.current = setTimeout(() => {
      refreshJwt(); // silent renew
    }, delay);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [jwt, refreshJwt]);

  useEffect(() => {
    const onFocus = () => {
      // si está cerca de expirar o expiró, renueva
      if (!jwt) return;
      const expMs = getJwtExpMs(jwt);
      if (!expMs) {
        refreshJwt();
        return;
      }
      const now = Date.now();
      const SKEW_MS = 2 * 60 * 1000;
      if (expMs - now <= SKEW_MS) refreshJwt();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [jwt, refreshJwt]);

  const value = useMemo(
    () => ({
      userEmail,
      userKey,
      jwt,
      role,
      isAuthReady: !!account && !!jwt && isRoleReady,
      isRoleReady,
      refreshJwt,
      modules,
      isModulesReady,
      refreshModules,
      refreshRole,
    }),
    [
      userEmail,
      userKey,
      jwt,
      role,
      account,
      isRoleReady,
      refreshJwt,
      modules,
      isModulesReady,
      refreshModules,
      refreshRole,
    ],
  );

  return (
    <AuthUserContext.Provider value={value}>
      {children}
    </AuthUserContext.Provider>
  );
};
