import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import clickSound from "../Sounds/clicksound.mp3";
import { useMsal } from "@azure/msal-react";
import { useAuthUser } from "../context/useAuthUser.js";

const DataBaseQueries = () => {
  const navigate = useNavigate();
  const audio = new Audio(clickSound);
  const playSound = () => audio.play();

  const { instance } = useMsal();
  const { jwt, refreshJwt, role } = useAuthUser();

  const getBearerToken = async () => {
    // 1) Si ya existe en contexto, úsalo
    if (jwt) return jwt;

    // 2) Si no existe, intenta refrescarlo (silent)
    const nuevo = await refreshJwt();
    return nuevo || null;
  };

  const account =
    instance.getActiveAccount() || (instance.getAllAccounts?.()[0] ?? null);

  const hasAnyAccount = (instance.getAllAccounts?.() || []).length > 0;

  const userRol = String(role || "")
    .trim()
    .toLowerCase();

  const isAdmin = userRol === "adm";

  const [postDateFrom, setPostDateFrom] = useState("");
  const [postDateTo, setPostDateTo] = useState("");
  const [trackingDateFrom, setTrackingDateFrom] = useState("");
  const [trackingDateTo, setTrackingDateTo] = useState("");

  const [author, setAuthor] = useState("");
  const [book, setBook] = useState("");

  // =========================
  // Non-admin: Author Names / Book Names (visual) -> codes in author/book strings
  // =========================
  const userEmail =
    account?.idTokenClaims?.emails?.[0] &&
    String(account.idTokenClaims.emails[0]).trim()
      ? String(account.idTokenClaims.emails[0]).trim().toLowerCase()
      : "";

  const [seudoLibroRows, setSeudoLibroRows] = useState([]);

  const [authorOptions, setAuthorOptions] = useState([]); // [{codautora, nombre_completo}]
  const [bookOptions, setBookOptions] = useState([]); // [{codlibro, deslibro, codautora}]

  const [authorNameByCode, setAuthorNameByCode] = useState({}); // { MM: "Mia Mara", ...}
  const [bookNameByCode, setBookNameByCode] = useState({}); // { LK: "Luck", ...}

  const [authorCodeSelected, setAuthorCodeSelected] = useState([]); // ["MM","MK"]
  const [bookCodeSelected, setBookCodeSelected] = useState([]); // ["LK","DDF"]

  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false);

  const [postTypeOptions, setPostTypeOptions] = useState([]); // [{ tippublicacion, despost }]
  const [postTypeNameByCode, setPostTypeNameByCode] = useState({}); // { a: "Long slide", ... }
  const [postTypeCodeSelected, setPostTypeCodeSelected] = useState([]); // ["a","b"]

  const [postTypeDropdownOpen, setPostTypeDropdownOpen] = useState(false);
  const postTypePopoverRef = useRef(null);

  const authorPopoverRef = useRef(null);
  const bookPopoverRef = useRef(null);
  // ✅ Toast guards (evita spam cuando el effect re-ejecuta)
  const seudoLibroToastOnceRef = useRef(false);
  const postTypesToastOnceRef = useRef(false);

  // ✅ reset por usuario (cuando cambia el correo)
  useEffect(() => {
    seudoLibroToastOnceRef.current = false;
    postTypesToastOnceRef.current = false;
  }, [userEmail]);

  const normalizeCsv = (s) =>
    String(s || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const [publisher, setPublisher] = useState("");
  const [sceneCode, setSceneCode] = useState("");
  const [postType, setPostType] = useState("");

  const [tikTokUsername, setTikTokUsername] = useState("");
  const [postID, setpostID] = useState("");
  const [region, setRegion] = useState("");

  const [viewsRange, setViewsRange] = useState({ min: "", max: "" });
  const [LikesRange, setLikesRange] = useState({ min: "", max: "" });
  const [SavesRange, setSavesRange] = useState({ min: "", max: "" });
  const [engagement, setEngagement] = useState({ min: "", max: "" });
  const [interactions, setInteractions] = useState({ min: "", max: "" });
  const [commentsRange, setCommentsRange] = useState({ min: "", max: "" });

  const [records, setRecords] = useState([]);
  const [columns, setColumns] = useState([]);
  const [log, setLog] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExcel, setIsLoadingExcel] = useState(false);

  const [buttonDisable, setButtonDisable] = useState(false);
  const [buttonText, setButtonText] = useState("Database Query");

  const [buttonConcisoDisable, setButtonConcisoDisable] = useState(false);
  const [buttonConcisoText, setButtonConcisoText] = useState("Short Report");

  const [buttonScoreDisable, setButtonScoreDisable] = useState(false);
  const [buttonScoreText, setButtonScoreText] = useState("Score Scenes");

  const [buttonClick, setButtonClick] = useState("filter");
  const [lastQueryBody, setLastQueryBody] = useState(null);

  const [toast, setToast] = useState(null);
  // toast: { title: string, message: string, type?: "success"|"warning"|"error"|"info" } | null

  // ✅ queue para mostrar toasts uno por uno
  const [toastQueue, setToastQueue] = useState([]);

  // ✅ ref para saber si hay toast visible en el momento del notify (evita stale state)
  const toastRef = useRef(null);

  // ✅ ref para evitar notify/setState cuando el componente ya se desmontó (cambio de módulo)
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // ✅ cuando el toast actual se cierra (auto o manual), muestra el siguiente de la cola
  useEffect(() => {
    if (toast) return;

    setToastQueue((q) => {
      if (q.length === 0) return q;

      const [siguiente, ...resto] = q;
      setToast(siguiente);
      return resto;
    });
  }, [toast]);

  useEffect(() => {
    if (isAdmin) return;

    // ✅ filtros que NO deben existir para NO-admin
    setTrackingDateFrom("");
    setTrackingDateTo("");
    setPublisher("");
    setSceneCode("");
    setRegion("");
  }, [isAdmin]);

  // ====== Notifications (reemplazo de alert) ======
  const notify = (title, message, type = "info") => {
    const nuevoToast = { title, message, type };

    // Si ya hay un toast en pantalla, lo encolamos
    if (toastRef.current) {
      setToastQueue((q) => [...q, nuevoToast]);
      return;
    }

    // Si no hay toast, lo mostramos de frente
    setToast(nuevoToast);
  };

  const toastBarClass =
    toast?.type === "success"
      ? "bg-emerald-600"
      : toast?.type === "warning"
        ? "bg-rose-400"
        : toast?.type === "error"
          ? "bg-rose-500"
          : "bg-slate-900";

  // UI-only: filter “carousel” step
  const [filterStep, setFilterStep] = useState(0);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const [filtersTouched, setFiltersTouched] = useState(false);

  // =========================
  // LocalStorage cache (UI persistence)
  // - Persists last SUCCESSFUL result across refresh/module navigation
  // - Clears automatically when user logs out (no active account)
  // =========================
  const DBQ_CACHE_PREFIX = "autopub_dbq_cache_v1";
  const dbqCacheKey = account?.homeAccountId
    ? `${DBQ_CACHE_PREFIX}_${account.homeAccountId}`
    : null;
  // Key separada SOLO para filtros (no resultados)
  const dbqFiltersKey = dbqCacheKey ? `${dbqCacheKey}_filters` : null;
  // Key separada para persistir estado de descarga de Excel (overlay)
  const dbqExcelKey = dbqCacheKey ? `${dbqCacheKey}_excel_downloading` : null;

  // Key separada para persistir el resultado de descarga (por si el usuario cambia de módulo)
  const dbqExcelResultKey = dbqCacheKey
    ? `${dbqCacheKey}_excel_download_result`
    : null;

  // TTL para evitar overlay infinito si algo se rompe (10 min)
  const EXCEL_DOWNLOAD_TTL_MS = 10 * 60 * 1000;

  // Restore + sanity check (mount / account change)
  useEffect(() => {
    try {
      if (!dbqExcelKey) return;

      const raw = localStorage.getItem(dbqExcelKey);
      if (!raw) {
        setIsLoadingExcel(false);
        return;
      }

      const saved = JSON.parse(raw);
      const startedAt = Number(saved?.startedAt || 0);

      // Si no está realmente en progreso, o está expirado, limpiamos
      if (!saved?.inProgress) {
        localStorage.removeItem(dbqExcelKey);
        setIsLoadingExcel(false);
        return;
      }

      if (startedAt && Date.now() - startedAt > EXCEL_DOWNLOAD_TTL_MS) {
        localStorage.removeItem(dbqExcelKey);
        setIsLoadingExcel(false);
        return;
      }

      // Sigue en progreso => mantenemos overlay
      setIsLoadingExcel(true);
    } catch (_) {
      try {
        if (dbqExcelKey) localStorage.removeItem(dbqExcelKey);
      } catch (_) {}
      setIsLoadingExcel(false);
    }
  }, [dbqExcelKey]);

  // Si el download terminó mientras estabas en otro módulo, muestra el toast al volver
  const consumeExcelDownloadResult = () => {
    try {
      if (!dbqExcelResultKey) return;

      const raw = localStorage.getItem(dbqExcelResultKey);
      if (!raw) return;

      const saved = JSON.parse(raw);

      // consumir 1 sola vez
      try {
        localStorage.removeItem(dbqExcelResultKey);
      } catch (_) {}

      if (saved?.type === "success") {
        notify(
          saved?.title || "Success",
          saved?.message || "Excel file exported successfully.",
          "success",
        );
      } else if (saved?.type === "error") {
        notify(
          saved?.title || "Download failed",
          saved?.message || "Error downloading the Excel file.",
          "error",
        );
      }
    } catch (_) {
      try {
        if (dbqExcelResultKey) localStorage.removeItem(dbqExcelResultKey);
      } catch (_) {}
    }
  };

  useEffect(() => {
    if (!dbqExcelResultKey) return;
    if (isLoadingExcel) return;

    // doble intento por race (primero rápido, luego respaldo)
    const t1 = setTimeout(() => consumeExcelDownloadResult(), 150);
    const t2 = setTimeout(() => consumeExcelDownloadResult(), 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoadingExcel, dbqExcelResultKey]);
  // Si el download terminó mientras estabas en otro módulo, muestra el toast al volver
  useEffect(() => {
    consumeExcelDownloadResult();
  }, [dbqExcelResultKey]);

  // Mientras el overlay esté activo, sincroniza estado vs localStorage.
  // Esto evita que se quede infinito cuando vuelves al módulo y el download ya terminó.
  useEffect(() => {
    if (!dbqExcelKey) return;
    if (!isLoadingExcel) return;

    const id = setInterval(() => {
      try {
        const raw = localStorage.getItem(dbqExcelKey);

        // Si el key ya no existe, el download terminó (o se limpió) => apagar overlay
        if (!raw) {
          setIsLoadingExcel(false);
          clearInterval(id);
          return;
        }

        const saved = JSON.parse(raw);
        const startedAt = Number(saved?.startedAt || 0);

        if (!saved?.inProgress) {
          try {
            localStorage.removeItem(dbqExcelKey);
          } catch (_) {}
          setIsLoadingExcel(false);
          clearInterval(id);
          return;
        }

        // TTL anti-stuck
        if (startedAt && Date.now() - startedAt > EXCEL_DOWNLOAD_TTL_MS) {
          try {
            localStorage.removeItem(dbqExcelKey);
          } catch (_) {}
          setIsLoadingExcel(false);
          clearInterval(id);
        }
      } catch (_) {
        try {
          localStorage.removeItem(dbqExcelKey);
        } catch (_) {}
        setIsLoadingExcel(false);
        clearInterval(id);
      }
    }, 800); // 0.8s es suficiente

    return () => clearInterval(id);
  }, [dbqExcelKey, isLoadingExcel]);

  // Load cache on mount / account change
  useLayoutEffect(() => {
    try {
      // Solo borrar cache si REALMENTE no hay sesión (no en el cold start de MSAL)
      if (!dbqCacheKey) {
        if (!hasAnyAccount) {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(DBQ_CACHE_PREFIX)) localStorage.removeItem(k);
          }
        }
        return;
      }

      const raw = localStorage.getItem(dbqCacheKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (Array.isArray(saved?.columns)) setColumns(saved.columns);
      if (Array.isArray(saved?.records)) setRecords(saved.records);
      if (Array.isArray(saved?.log)) setLog(saved.log);
      if (typeof saved?.dataLoaded === "boolean")
        setDataLoaded(saved.dataLoaded);
    } catch (_) {
      // no-op
    }
  }, [dbqCacheKey, hasAnyAccount]);

  // Persist ONLY when we have a successful result
  useEffect(() => {
    try {
      if (!dbqCacheKey) return;
      if (!dataLoaded) return;

      const payload = {
        dataLoaded,
        columns,
        records,
        log,
        savedAt: Date.now(),
      };

      try {
        localStorage.setItem(dbqCacheKey, JSON.stringify(payload));
      } catch (e) {
        // Fallback if too big (quota exceeded): store a preview
        localStorage.setItem(
          dbqCacheKey,
          JSON.stringify({
            ...payload,
            records: Array.isArray(records) ? records.slice(0, 300) : [],
            truncated: true,
          }),
        );
      }
    } catch (_) {
      // no-op
    }
  }, [dbqCacheKey, dataLoaded, columns, records, log]);

  // Load FILTERS cache on mount / account change
  useLayoutEffect(() => {
    try {
      // Si no hay key aún (MSAL cold start), no hidratar todavía.
      if (!dbqFiltersKey) return;
      if (filtersTouched) {
        setFiltersHydrated(true);
        return;
      }

      const raw = localStorage.getItem(dbqFiltersKey);
      if (!raw) {
        // No hay nada guardado, pero habilitamos guardado para futuros cambios
        setFiltersHydrated(true);
        return;
      }

      const saved = JSON.parse(raw);

      // Strings
      if (typeof saved?.postDateFrom === "string")
        setPostDateFrom(saved.postDateFrom);
      if (typeof saved?.postDateTo === "string")
        setPostDateTo(saved.postDateTo);
      if (isAdmin) {
        if (typeof saved?.trackingDateFrom === "string")
          setTrackingDateFrom(saved.trackingDateFrom);
        if (typeof saved?.trackingDateTo === "string")
          setTrackingDateTo(saved.trackingDateTo);
        if (typeof saved?.publisher === "string") setPublisher(saved.publisher);
        if (typeof saved?.sceneCode === "string") setSceneCode(saved.sceneCode);
        if (typeof saved?.region === "string") setRegion(saved.region);
      }

      if (typeof saved?.author === "string") setAuthor(saved.author);
      if (typeof saved?.book === "string") setBook(saved.book);

      if (typeof saved?.postType === "string") setPostType(saved.postType);

      if (typeof saved?.tikTokUsername === "string")
        setTikTokUsername(saved.tikTokUsername);
      if (typeof saved?.postID === "string") setpostID(saved.postID);

      // Ranges (objetos)
      if (saved?.viewsRange && typeof saved.viewsRange === "object")
        setViewsRange(saved.viewsRange);
      if (saved?.LikesRange && typeof saved.LikesRange === "object")
        setLikesRange(saved.LikesRange);
      if (saved?.SavesRange && typeof saved.SavesRange === "object")
        setSavesRange(saved.SavesRange);
      if (saved?.engagement && typeof saved.engagement === "object")
        setEngagement(saved.engagement);
      if (saved?.interactions && typeof saved.interactions === "object")
        setInteractions(saved.interactions);
      if (saved?.commentsRange && typeof saved.commentsRange === "object")
        setCommentsRange(saved.commentsRange);

      // UI-only
      if (typeof saved?.filterStep === "number")
        setFilterStep(saved.filterStep);
    } catch (_) {
      // no-op
    } finally {
      // IMPORTANTE: habilita persistencia SOLO después de intentar hidratar
      setFiltersHydrated(true);
    }
  }, [dbqFiltersKey, filtersTouched]);

  // Persist FILTERS when they change
  useEffect(() => {
    try {
      if (!dbqFiltersKey) return;
      if (!filtersHydrated) return;

      const payload = {
        postDateFrom,
        postDateTo,
        trackingDateFrom,
        trackingDateTo,
        author,
        book,
        publisher,
        sceneCode,
        postType,
        tikTokUsername,
        postID,
        region,
        viewsRange,
        LikesRange,
        SavesRange,
        engagement,
        interactions,
        commentsRange,
        filterStep,
      };

      localStorage.setItem(dbqFiltersKey, JSON.stringify(payload));
    } catch (_) {
      // no-op
    }
  }, [
    dbqFiltersKey,
    filtersHydrated,
    postDateFrom,
    postDateTo,
    trackingDateFrom,
    trackingDateTo,
    author,
    book,
    publisher,
    sceneCode,
    postType,
    tikTokUsername,
    postID,
    region,
    viewsRange,
    LikesRange,
    SavesRange,
    engagement,
    interactions,
    commentsRange,
    filterStep,
  ]);

  useEffect(() => {
    if (isAdmin) return;
    if (!userEmail) return;

    const controller = new AbortController();

    (async () => {
      try {
        const azureURL = import.meta.env.VITE_AZURE_API_URL;
        const token = await getBearerToken();
        if (!token) {
          notify("Authentication required", "Please sign in again.", "error");
          return;
        }
        const res = await fetch(
          `${azureURL}/autoras/dbqueries?correo=${encodeURIComponent(
            userEmail,
          )}`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) {
          throw new Error(`Server responded with status ${res.status}`);
        }

        const json = await res.json().catch(() => ({}));
        const rows = Array.isArray(json?.seudo_libro) ? json.seudo_libro : [];

        setSeudoLibroRows(rows);

        // Build unique authors + books
        const authorMap = new Map(); // codautora -> nombre
        const bookMap = new Map(); // codlibro -> {codlibro, deslibro, codautora}

        rows.forEach((r) => {
          const aCode = String(r?.codautora ?? "")
            .trim()
            .toUpperCase();
          const aName = String(r?.nombre_completo ?? "").trim();
          if (aCode) authorMap.set(aCode, aName || aCode);

          const bCode = String(r?.codlibro ?? "")
            .trim()
            .toUpperCase();
          const bName = String(r?.deslibro ?? "").trim();
          if (bCode)
            bookMap.set(bCode, {
              codlibro: bCode,
              deslibro: bName || bCode,
              codautora: aCode,
            });
        });

        const aOpts = Array.from(authorMap.entries())
          .map(([codautora, nombre_completo]) => ({
            codautora,
            nombre_completo,
          }))
          .sort((x, y) => x.nombre_completo.localeCompare(y.nombre_completo));

        const bOpts = Array.from(bookMap.values()).sort((x, y) =>
          x.deslibro.localeCompare(y.deslibro),
        );

        const aNameBy = Object.fromEntries(
          aOpts.map((a) => [a.codautora, a.nombre_completo]),
        );
        const bNameBy = Object.fromEntries(
          bOpts.map((b) => [b.codlibro, b.deslibro]),
        );

        setAuthorOptions(aOpts);
        setBookOptions(bOpts);
        setAuthorNameByCode(aNameBy);
        setBookNameByCode(bNameBy);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error(
          "❌ Failed to load author/book options for DB Queries:",
          e,
        );
        // Fallback limpio
        setSeudoLibroRows([]);
        setAuthorOptions([]);
        setBookOptions([]);
        setAuthorNameByCode({});
        setBookNameByCode({});
        if (!seudoLibroToastOnceRef.current) {
          seudoLibroToastOnceRef.current = true;

          notify(
            "Failed to load filters",
            "Could not load allowed Author/Book options. Please refresh or try again later.",
            "error",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [isAdmin, userEmail]);

  useEffect(() => {
    if (isAdmin) return;

    const fromStr = normalizeCsv(author).map((x) => x.toUpperCase());
    const allowed = new Set(authorOptions.map((a) => a.codautora));
    const filtered = fromStr.filter((c) => allowed.has(c));

    const same =
      filtered.length === authorCodeSelected.length &&
      filtered.every((c) => authorCodeSelected.includes(c));

    if (!same) setAuthorCodeSelected(filtered);
  }, [isAdmin, author, authorOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAdmin) return;

    const fromStr = normalizeCsv(book).map((x) => x.toUpperCase());
    const allowed = new Set(bookOptions.map((b) => b.codlibro));
    const filtered = fromStr.filter((c) => allowed.has(c));

    const same =
      filtered.length === bookCodeSelected.length &&
      filtered.every((c) => bookCodeSelected.includes(c));

    if (!same) setBookCodeSelected(filtered);
  }, [isAdmin, book, bookOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAdmin) return;
    if (authorCodeSelected.length === 0) return; // si no hay autor, NO discriminamos books

    const allowedBookCodes = new Set(
      bookOptions
        .filter((b) => authorCodeSelected.includes(String(b.codautora).trim()))
        .map((b) => String(b.codlibro).trim())
        .filter(Boolean),
    );

    setBookCodeSelected((prev) => {
      const next = prev.filter((c) => allowedBookCodes.has(c));
      const nextStr = next.join(", ");
      if (nextStr !== book) setBook(nextStr);
      return next;
    });
  }, [isAdmin, authorCodeSelected, bookOptions, book]);

  useEffect(() => {
    if (!authorDropdownOpen) return;

    const onDown = (e) => {
      if (!authorPopoverRef.current) return;
      if (!authorPopoverRef.current.contains(e.target)) {
        setAuthorDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [authorDropdownOpen]);

  useEffect(() => {
    if (!bookDropdownOpen) return;

    const onDown = (e) => {
      if (!bookPopoverRef.current) return;
      if (!bookPopoverRef.current.contains(e.target)) {
        setBookDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [bookDropdownOpen]);

  useEffect(() => {
    if (isAdmin) return;

    const controller = new AbortController();

    (async () => {
      try {
        const azureURL = import.meta.env.VITE_AZURE_API_URL;
        const token = await getBearerToken();
        if (!token) {
          notify("Authentication required", "Please sign in again.", "error");
          return;
        }
        const res = await fetch(`${azureURL}/databasequery/posts`, {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          throw new Error(`Server responded with status ${res.status}`);
        }

        const json = await res.json().catch(() => ({}));
        const rows = Array.isArray(json?.type_posts) ? json.type_posts : [];

        const opts = rows
          .map((r) => ({
            tippublicacion: String(r?.tippublicacion ?? "")
              .trim()
              .toLowerCase(),
            despost: String(r?.despost ?? "").trim(),
          }))
          .filter((x) => x.tippublicacion)
          .sort((a, b) =>
            (a.despost || a.tippublicacion).localeCompare(
              b.despost || b.tippublicacion,
            ),
          );

        setPostTypeOptions(opts);

        const nameBy = Object.fromEntries(
          opts.map((o) => [o.tippublicacion, o.despost || o.tippublicacion]),
        );
        setPostTypeNameByCode(nameBy);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error("❌ Failed to load post type options:", e);
        setPostTypeOptions([]);
        setPostTypeNameByCode({});
        if (!postTypesToastOnceRef.current) {
          postTypesToastOnceRef.current = true;

          notify(
            "Failed to load filters",
            "Could not load allowed Post Type options. Please refresh or try again later.",
            "error",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;

    const fromStr = normalizeCsv(postType).map((x) => x.toLowerCase());
    const allowed = new Set(postTypeOptions.map((p) => p.tippublicacion));
    const filtered = fromStr.filter((c) => allowed.has(c));

    const same =
      filtered.length === postTypeCodeSelected.length &&
      filtered.every((c) => postTypeCodeSelected.includes(c));

    if (!same) setPostTypeCodeSelected(filtered);
  }, [isAdmin, postType, postTypeOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!postTypeDropdownOpen) return;

    const onDown = (e) => {
      if (!postTypePopoverRef.current) return;
      if (!postTypePopoverRef.current.contains(e.target)) {
        setPostTypeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [postTypeDropdownOpen]);

  const resolveDateRangesForBackend = () => {
    return {
      pubFrom: postDateFrom || "",
      pubTo: postDateTo || "",
      trackFrom: trackingDateFrom || "",
      trackTo: trackingDateTo || "",
    };
  };

  const buildRequestBody = (overrides = {}) => {
    const { pubFrom, pubTo, trackFrom, trackTo } =
      resolveDateRangesForBackend();

    const effectiveAuthorList =
      overrides.AuthorList ??
      (isAdmin
        ? author
          ? author
              .split(",")
              .map((item) => item.trim().toUpperCase())
              .filter(Boolean)
          : []
        : (authorCodeSelected || [])
            .map((x) => String(x).trim().toUpperCase())
            .filter(Boolean));

    const effectiveBookList =
      overrides.BookList ??
      (isAdmin
        ? book
          ? book
              .split(",")
              .map((item) => item.trim().toUpperCase())
              .filter(Boolean)
          : []
        : (bookCodeSelected || [])
            .map((x) => String(x).trim().toUpperCase())
            .filter(Boolean));
    return {
      PubStartDate: pubFrom,
      PubFinishtDate: pubTo,
      TrackStartDate: trackFrom,
      TrackFinishtDate: trackTo,
      AuthorList: effectiveAuthorList,
      BookList: effectiveBookList,
      PAList:
        isAdmin && publisher
          ? publisher
              .split(",")
              .map((item) => item.trim().toUpperCase())
              .filter(Boolean)
          : [],
      SceneList:
        isAdmin && sceneCode
          ? sceneCode
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      TypePostList: postType
        ? postType
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
        : [],
      AccountList: tikTokUsername
        ? tikTokUsername
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
        : [],
      PostIDList: postID
        ? postID
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      RegionList:
        isAdmin && region
          ? region
              .split(",")
              .map((item) => item.trim().toUpperCase())
              .filter(Boolean)
          : [],
      viewsMin: viewsRange.min,
      viewsMax: viewsRange.max,
      likesMin: LikesRange.min,
      likesMax: LikesRange.max,
      savesMin: SavesRange.min,
      savesMax: SavesRange.max,
      CommentsMin: commentsRange.min,
      CommentsMax: commentsRange.max,
      EngagementMin: engagement.min,
      EngagementMax: engagement.max,
      InteractionMin: interactions.min,
      InteractionMax: interactions.max,
    };
  };

  // ===== Max date range validation (<= 3 months) =====
  const parseYMD_UTC = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  };

  const addMonthsUTC = (dateUTC, months) => {
    const y = dateUTC.getUTCFullYear();
    const m = dateUTC.getUTCMonth();
    const day = dateUTC.getUTCDate();

    // create first day of target month
    const base = new Date(Date.UTC(y, m + months, 1));
    // clamp day to last day of target month
    const lastDay = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
    ).getUTCDate();

    base.setUTCDate(Math.min(day, lastDay));
    return base;
  };

  const isRangeOverMaxMonths = (fromStr, toStr, maxMonths = 3) => {
    const from = parseYMD_UTC(fromStr);
    const to = parseYMD_UTC(toStr);
    if (!from || !to) return false;

    const limit = addMonthsUTC(from, maxMonths);
    return to > limit; // > 3 months (si es exactamente 3 meses, es válido)
  };

  const handleDBQuery = async (reportType) => {
    setIsLoading(true);
    setButtonDisable(true);

    const startTime = new Date();

    // ===== Date validation (no permitir fechas a medias) =====
    const hasPostAny = Boolean(postDateFrom || postDateTo);
    const hasTrackingAny = Boolean(trackingDateFrom || trackingDateTo);

    if (hasPostAny && (!postDateFrom || !postDateTo)) {
      notify(
        "Action required",
        "Post Date requires BOTH From and To.",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      return;
    }

    if (hasTrackingAny && (!trackingDateFrom || !trackingDateTo)) {
      notify(
        "Action required",
        "Tracking Date requires BOTH From and To.",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      return;
    }

    const hasAtLeastOneCompleteRange =
      (postDateFrom && postDateTo) || (trackingDateFrom && trackingDateTo);

    if (!hasAtLeastOneCompleteRange) {
      notify(
        "Action required",
        "Please select at least one complete date range (From + To).",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      return;
    }

    // ===== Non-admin must select at least Author OR Book =====
    // ===== Non-admin: si no elige Author ni Book => default "ALL Authors" (y NO books) =====
    let effectiveAuthorCodes = authorCodeSelected || [];
    let effectiveBookCodes = bookCodeSelected || [];

    if (!isAdmin) {
      const hasAuthorOrBook =
        (effectiveAuthorCodes && effectiveAuthorCodes.length > 0) ||
        (effectiveBookCodes && effectiveBookCodes.length > 0);

      if (!hasAuthorOrBook) {
        // "Select All" de autores permitidos para ese user (NO books)
        const allAuthors = (authorOptions || [])
          .map((a) =>
            String(a?.codautora ?? "")
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean);

        effectiveAuthorCodes = allAuthors;
        effectiveBookCodes = [];

        // ✅ opcional pero recomendado: reflejarlo en UI (como si eligiera "All")
        const allStr = allAuthors.join(", ");
        if (author !== allStr) setAuthor(allStr);

        if (book) setBook("");
        if (bookCodeSelected?.length) setBookCodeSelected([]);
        if (
          authorCodeSelected?.length !== allAuthors.length ||
          !allAuthors.every((c) => authorCodeSelected.includes(c))
        ) {
          setAuthorCodeSelected(allAuthors);
        }
      }
    }

    // ===== Date order validation (From <= To) =====
    const toYMD = (v) => (v ? v.replaceAll("-", "") : "");
    // ===== Max range length validation (<= 3 months) =====
    if (
      postDateFrom &&
      postDateTo &&
      isRangeOverMaxMonths(postDateFrom, postDateTo, 3)
    ) {
      notify(
        "Date range too large",
        "The selected Post Date range exceeds the maximum allowed window of 3 months. Please split it into smaller ranges and try again.",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      return;
    }

    if (
      trackingDateFrom &&
      trackingDateTo &&
      isRangeOverMaxMonths(trackingDateFrom, trackingDateTo, 3)
    ) {
      notify(
        "Date range too large",
        "The selected Tracking Date range exceeds the maximum allowed window of 3 months. Please split it into smaller ranges and try again.",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      return;
    }

    if (postDateFrom && postDateTo && toYMD(postDateFrom) > toYMD(postDateTo)) {
      notify(
        "Invalid date range",
        "Post Date: From must be earlier than or equal to To.",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      return;
    }

    if (
      trackingDateFrom &&
      trackingDateTo &&
      toYMD(trackingDateFrom) > toYMD(trackingDateTo)
    ) {
      notify(
        "Invalid date range",
        "Tracking Date: From must be earlier than or equal to To.",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      return;
    }

    // 🔹 Limpieza columnas/records si vuelve a consultar
    setRecords([]);
    setColumns([]);
    setDataLoaded(false);
    setLog([]);

    const requestBody = isAdmin
      ? buildRequestBody() // admin: usa lo que está en los textareas author/book
      : buildRequestBody({
          AuthorList: effectiveAuthorCodes,
          BookList: effectiveBookCodes,
        }); // no-admin: usa selections del dropdown

    setLastQueryBody(requestBody);

    if (reportType == "conciso") {
      try {
        setButtonConcisoText("In Progress...");
        const azureURL = import.meta.env.VITE_AZURE_API_URL;
        const token = await getBearerToken();
        if (!token) {
          notify("Authentication required", "Please sign in again.", "error");
          setIsLoading(false);
          setButtonDisable(false);
          return;
        }

        const response = await fetch(azureURL + "/databasequery/conciso", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          notify(
            "Request failed",
            `Server responded with status ${response.status}`,
            "error",
          );
          throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();

        const filteredData = data.map((record) => ({
          "Author Name": record["Author name"] || "Not found: N/A",
          "Book Name": record["Book name"] || "Not found: N/A",
          "Scene Name": record["Scene name"] || "Not found: N/A",
          "Post Type": record["Post Type"] || "Not found: N/A",
          "Date Posted": record["Date posted"] || "Not found: N/A",
          "Time Posted": record["Time posted"] || "Not found: N/A",
          "TikTok Username": record["TikTok Username"] || "Not found: N/A",
          "Post URL": record["Post URL"] || "Not found: N/A",
          Views: record["Views"] || 0,
          Likes: record["Likes"] || 0,
          Comments: record["Comments"] || 0,
          Reposted: record["Reposted"] || 0,
          Saves: record["Saves"] || 0,
          "Ratio Saves/Likes": record["Ratio Saves/Likes"] ?? "0%",
          "Best Scenes Score": record["Best Scenes Score"] ?? 0,
          "Engagement Rate":
            Math.round(record["Engagement rate"] * 100.0) / 100.0 || 0,
          Interactions: record["Interactions"] || 0,
          Hashtags: record["Hashtags"] || "Not found: N/A",
          "# of Hashtags": record["Number of Hashtags"] || 0,
          "Sound URL": record["Sound URL"] || "Not found: N/A",
        }));

        setRecords(filteredData);
        setColumns(Object.keys(filteredData[0] || {}));

        const registrosProcesados =
          data?.length > 0 && data?.[0]?.count != null
            ? Number(data[0].count)
            : data.length;
        setLog((prevLog) => [
          ...prevLog,
          `📊 Amount of Records Processed: ${registrosProcesados}`,
        ]);

        const endTime = new Date();
        const durationInSeconds = Math.floor((endTime - startTime) / 1000);
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = durationInSeconds % 60;
        const formattedTime = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;

        setLog((prevLog) => [
          ...prevLog,
          `⏳ Total function execution time: ${formattedTime} minutes`,
        ]);

        if (data.length > 0) {
          setLog((prevLog) => [
            ...prevLog,
            `✅ Execution completed successfully. Data found is available and ready to be downloaded now.`,
          ]);
        } else {
          setLog((prevLog) => [
            ...prevLog,
            `❌ Execution not completed. No data available`,
          ]);
        }

        setDataLoaded(true);
      } catch (error) {
        console.error(
          "❌ Error fetching data from DB (DatabaseQueries - REPORTE CONCISO):",
          error,
        );
        notify("Request failed", "Failed to fetch data from DB.", "error");
      } finally {
        setIsLoading(false);
        setButtonDisable(false);
        setButtonConcisoText("Short Report");
      }
    } else if (reportType == "scoreScene") {
      try {
        setButtonScoreText("In Progress...");

        const azureURL = import.meta.env.VITE_AZURE_API_URL;
        const token = await getBearerToken();
        if (!token) {
          notify("Authentication required", "Please sign in again.", "error");
          setIsLoading(false);
          setButtonDisable(false);
          return;
        }

        const response = await fetch(azureURL + "/databasequery/scorescene", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          notify(
            "Request failed",
            `Server responded with status ${response.status}`,
            "error",
          );
          throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();

        const filteredData = data.map((record) => ({
          "Author Name": record["author_name"] || "Not found: N/A",
          "Book Name": record["book"] || "Not found: N/A",
          "Number of Scene": record["scene_code"] || "Not found: N/A",
          "Scene Name": record["scene"] || "Not found: N/A",
          "Scene Score": record["score_scene"] || "Not found: N/A",
          "View Average": record["promviews"] || "Not found: N/A",
          "Interaction Average":
            record["prominteracciones"] || "Not found: N/A",
        }));

        setRecords(filteredData);
        setColumns(Object.keys(filteredData[0] || {}));

        const registrosProcesados =
          data?.length > 0 && data?.[0]?.count != null
            ? Number(data[0].count)
            : data.length;
        setLog((prevLog) => [
          ...prevLog,
          `📊 Amount of Records Processed: ${registrosProcesados}`,
        ]);

        const endTime = new Date();
        const durationInSeconds = Math.floor((endTime - startTime) / 1000);
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = durationInSeconds % 60;
        const formattedTime = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;

        setLog((prevLog) => [
          ...prevLog,
          `⏳ Total function execution time: ${formattedTime} minutes`,
        ]);

        if (data.length > 0) {
          setLog((prevLog) => [
            ...prevLog,
            `✅ Execution completed successfully. Data found is available and ready to be downloaded now.`,
          ]);
        } else {
          setLog((prevLog) => [
            ...prevLog,
            `❌ Execution not completed. No data available`,
          ]);
        }

        setDataLoaded(true);
      } catch (error) {
        console.error(
          "❌ Error fetching data from DB (DatabaseQueries - SCORE SCENES):",
          error,
        );
        notify("Request failed", "Failed to fetch data from DB.", "error");
      } finally {
        setIsLoading(false);
        setButtonDisable(false);
        setButtonScoreText("Score Scenes");
      }
    } else {
      try {
        setButtonText("In Progress...");

        const azureURL = import.meta.env.VITE_AZURE_API_URL;
        const token = await getBearerToken();
        if (!token) {
          notify("Authentication required", "Please sign in again.", "error");
          setIsLoading(false);
          setButtonDisable(false);
          return;
        }

        const response = await fetch(azureURL + "/databasequery/filter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          notify(
            "Request failed",
            `Server responded with status ${response.status}`,
            "error",
          );
          throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();

        const filteredData = data.map((record) => ({
          "Post Code": record["Post Code"] || "Not found: N/A",
          "Author Name": record["Author name"] || "Not found: N/A",
          "Book Name": record["Book name"] || "Not found: N/A",
          "Number of Scene": record["Number of Scene"] || "Not found: N/A",
          "Scene Name": record["Scene name"] || "Not found: N/A",
          "Post Type": record["Post Type"] || "Not found: N/A",
          "PA Name": record["PA name"] || "Not found: N/A",
          "Date Posted": record["Date posted"] || "Not found: N/A",
          "Time Posted": record["Time posted"] || "Not found: N/A",
          "TikTok Username": record["TikTok Username"] || "Not found: N/A",
          "Post URL": record["Post URL"] || "Not found: N/A",
          Views: record["Views"] || 0,
          Likes: record["Likes"] || 0,
          Comments: record["Comments"] || 0,
          Reposted: record["Reposted"] || 0,
          Saves: record["Saves"] || 0,
          "Engagement Rate":
            Math.round(record["Engagement rate"] * 100.0) / 100.0 || 0,
          Interactions: record["Interactions"] || 0,
          Hashtags: record["Hashtags"] || "Not found: N/A",
          "# of Hashtags": record["Number of Hashtags"] || 0,
          "Sound URL": record["Sound URL"] || "Not found: N/A",
          "Region of Posting": record["Region Code"] || "Not found: N/A",
          "Tracking Date": record["Tracking date"] || "Not found: N/A",
          "Tracking Time": record["Tracking time"] || "Not found: N/A",
          "Logged-in User": record["Logged-in User"] || "Not found: N/A",
        }));

        setRecords(filteredData);
        setColumns(Object.keys(filteredData[0] || {}));

        const registrosProcesados =
          data?.length > 0 && data?.[0]?.count != null
            ? Number(data[0].count)
            : data.length;
        setLog((prevLog) => [
          ...prevLog,
          `📊 Amount of Records Processed: ${registrosProcesados}`,
        ]);

        const endTime = new Date();
        const durationInSeconds = Math.floor((endTime - startTime) / 1000);
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = durationInSeconds % 60;
        const formattedTime = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;

        setLog((prevLog) => [
          ...prevLog,
          `⏳ Total function execution time: ${formattedTime} minutes`,
        ]);

        if (data.length > 0) {
          setLog((prevLog) => [
            ...prevLog,
            `✅ Execution completed successfully. Data found is available and ready to be downloaded now.`,
          ]);
        } else {
          setLog((prevLog) => [
            ...prevLog,
            `❌ Execution not completed. No data available`,
          ]);
        }

        setDataLoaded(true);
      } catch (error) {
        console.error(
          "❌ Error fetching data from DB (DatabaseQueries - handleDBQuery):",
          error,
        );
        notify("Request failed", "Failed to fetch data from DB.", "error");
      } finally {
        setIsLoading(false);
        setButtonDisable(false);
        setButtonText("Database Query");
      }
    }
  };

  const handleExportToExcel = async () => {
    if (isLoadingExcel) return;

    // Si se desmontó y volvió rápido, puede que el state aún no se haya rehidratado
    // Si se desmontó y volvió rápido, puede que el state aún no se haya rehidratado
    if (dbqExcelKey) {
      try {
        const raw = localStorage.getItem(dbqExcelKey);
        if (raw) {
          const saved = JSON.parse(raw);
          const startedAt = Number(saved?.startedAt || 0);

          // Si está en progreso y NO está expirado, mantenemos overlay y salimos
          if (
            saved?.inProgress &&
            (!startedAt || Date.now() - startedAt <= EXCEL_DOWNLOAD_TTL_MS)
          ) {
            setIsLoadingExcel(true);
            return;
          }

          // Si está expirado o inválido, limpiamos y dejamos continuar
          localStorage.removeItem(dbqExcelKey);
        }
      } catch (_) {}
    }

    if (!dataLoaded) {
      notify(
        "Action required",
        "You must make the database query first.",
        "warning",
      );
      return;
    }

    if (dbqExcelKey) {
      try {
        localStorage.setItem(
          dbqExcelKey,
          JSON.stringify({ inProgress: true, startedAt: Date.now() }),
        );
      } catch (_) {}
    }
    setIsLoadingExcel(true);
    try {
      const azureURL = import.meta.env.VITE_AZURE_API_URL;
      let requestBody = lastQueryBody || buildRequestBody();

      if (!requestBody) {
        notify(
          "Action required",
          "You must make the database query first.",
          "warning",
        );
        return;
      }

      // ===== Max range length validation (<= 3 months) =====
      const { PubStartDate, PubFinishtDate, TrackStartDate, TrackFinishtDate } =
        requestBody || {};

      if (
        PubStartDate &&
        PubFinishtDate &&
        isRangeOverMaxMonths(PubStartDate, PubFinishtDate, 3)
      ) {
        notify(
          "Date range too large",
          "The selected Post Date range exceeds the maximum allowed window of 3 months. Please split it into smaller ranges and try again.",
          "warning",
        );
        setIsLoadingExcel(false);
        return;
      }

      if (
        TrackStartDate &&
        TrackFinishtDate &&
        isRangeOverMaxMonths(TrackStartDate, TrackFinishtDate, 3)
      ) {
        notify(
          "Date range too large",
          "The selected Tracking Date range exceeds the maximum allowed window of 3 months. Please split it into smaller ranges and try again.",
          "warning",
        );
        setIsLoadingExcel(false);
        return;
      }

      const reportTypeParam =
        buttonClick === "scoreScene"
          ? "scorescene"
          : buttonClick === "filter"
            ? "filter"
            : buttonClick === "conciso"
              ? "conciso"
              : null;

      if (!reportTypeParam) {
        notify(
          "Action required",
          "Select a report type first (Filter / Short Report / Score Scenes).",
          "warning",
        );
        return;
      }
      const token = await getBearerToken();
      if (!token) {
        notify("Authentication required", "Please sign in again.", "error");
        setIsLoadingExcel(false);
        return;
      }

      const response = await fetch(
        `${azureURL}/databasequery/download?reportType=${encodeURIComponent(
          reportTypeParam,
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) throw new Error("Error al descargar el archivo");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const now = new Date();
      const timestamp =
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0") +
        "_" +
        String(now.getHours()).padStart(2, "0") +
        "-" +
        String(now.getMinutes()).padStart(2, "0") +
        "-" +
        String(now.getSeconds()).padStart(2, "0");

      const fileName = `filtros_tiktok_videos_${timestamp}.xlsx`;
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      if (isMountedRef.current) {
        notify("Success", "Excel file exported successfully.", "success");
      } else if (dbqExcelResultKey) {
        // terminó cuando estabas en otro módulo => persistimos resultado para mostrar al volver
        try {
          localStorage.setItem(
            dbqExcelResultKey,
            JSON.stringify({
              type: "success",
              title: "Success",
              message: "Excel file exported successfully.",
              finishedAt: Date.now(),
            }),
          );
        } catch (_) {}
      }
    } catch (error) {
      console.error(
        "❌ Error downloading the Excel File (DataBaseQueries): ",
        error,
      );
      if (isMountedRef.current) {
        notify("Download failed", "Error downloading the Excel file.", "error");
      } else if (dbqExcelResultKey) {
        try {
          localStorage.setItem(
            dbqExcelResultKey,
            JSON.stringify({
              type: "error",
              title: "Download failed",
              message: "Error downloading the Excel file.",
              finishedAt: Date.now(),
            }),
          );
        } catch (_) {}
      }
    } finally {
      if (isMountedRef.current) setIsLoadingExcel(false);
      if (dbqExcelKey) {
        try {
          localStorage.removeItem(dbqExcelKey);
        } catch (_) {}
      }
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  // confirm: { title, message, confirmText, danger, onConfirm }
  const confirmRef = useRef(null);

  const openConfirm = ({
    title,
    message,
    confirmText = "Confirm",
    danger = false,
    onConfirm,
  }) => {
    confirmRef.current = onConfirm;
    setConfirmOpen({ title, message, confirmText, danger });
  };

  const closeConfirm = () => {
    confirmRef.current = null;
    setConfirmOpen(false);
  };

  const runConfirm = () => {
    const fn = confirmRef.current;
    closeConfirm();
    if (typeof fn === "function") fn();
  };

  // ====== UI CLASSES (solo estética) ======
  // Más “color pro” (gradientes) y spacing más fino.
  const inputBase =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

  const inputDate = `${inputBase} h-10`;
  const textareaBase = `${inputBase} min-h-[78px] resize-none leading-relaxed`;

  const coreNonAdminHeight = "min-h-[50px]"; // un poco más alto que 78px (ajustable)
  const placeholderTight =
    "placeholder:text-[11px] placeholder:lowercase placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400";
  // ✅ Core (non-admin) textarea WITHOUT the global min-h[78px]

  // ✅ SOLO NON-ADMIN (Dates tab)
  // ✅ SOLO NON-ADMIN (Dates tab) — responsive sin romper el look actual
  const inputDateNonAdmin = `${inputBase} h-11 w-full min-w-0 max-w-[170px] sm:max-w-[200px] lg:max-w-none`;

  // TikTok Username: reducir altura para alinear visualmente con Post Date
  const textareaTikTokNonAdmin = `${inputBase} h-[45px] min-h-0 resize-none leading-relaxed font-mono lowercase ${placeholderTight}`;
  const coreNonAdminTextareaHeight = "h-[50px] min-h-0";

  const textareaBaseCoreCompact = `${inputBase} ${coreNonAdminTextareaHeight} resize-none overflow-hidden leading-[46px] !py-0`;
  const textareaUpperCoreCompact = `${textareaBaseCoreCompact} font-mono uppercase ${placeholderTight}`;
  const textareaLowerCoreCompact = `${textareaBaseCoreCompact} font-mono lowercase ${placeholderTight}`;

  const textareaIdCompact = `${inputBase} ${coreNonAdminTextareaHeight} resize-none overflow-hidden leading-[46px] !py-0 ${placeholderTight}`;
  const textareaIdCompactLower = `${textareaIdCompact} font-mono lowercase`;
  const textareaIdCompactUpper = `${textareaIdCompact} font-mono uppercase`;

  // ✅ SOLO ADMIN (Identifiers) - más compacto (menos alto que min-h-[78px])
  const textareaAdminIdentifiersBase = `${inputBase} h-[56px] min-h-0 resize-none leading-relaxed ${placeholderTight}`;

  const textareaAdminIdentifiersLower = `${textareaAdminIdentifiersBase} font-mono lowercase`;

  const textareaAdminIdentifiersUpper = `${textareaAdminIdentifiersBase} font-mono uppercase`;
  // ✅ NO-ADMIN: usar EXACTAMENTE el mismo estilo que ADMIN (evita gap al dar Enter)
  // ✅ NO-ADMIN: mismo look (mono + placeholder), pero altura igual a dropdowns

  // ✅ SOLO ADMIN (Core Filters) - EXACTAMENTE misma altura que Identifiers
  const textareaAdminCoreBase = `${inputBase} h-[56px] min-h-0 resize-none leading-relaxed ${placeholderTight}`;
  const textareaAdminCoreUpper = `${textareaAdminCoreBase} font-mono uppercase`;

  // Mantiene el alto original (min-h-[78px]) y centra visualmente 1 sola línea
  const textareaCenterOnly = "!pt-[26px] !pb-0 leading-normal overflow-hidden";

  const textareaUpper = `${textareaBase} font-mono uppercase ${placeholderTight}`;
  const textareaLower = `${textareaBase} font-mono lowercase ${placeholderTight}`;
  const labelBase = "block text-[11px] font-semibold text-slate-600";
  const dateTitleClass = "text-sm font-semibold text-slate-800";

  const labelTitle = "block text-sm font-semibold text-slate-800";

  const sectionTitle = "text-base font-bold text-slate-900";
  const sectionSub = "text-xs text-slate-500";

  // ✅ SOLO NON-ADMIN (Core Filters inputs tipo "1 línea", misma altura que dropdowns)
  const textareaNonAdminIdentifiersBase = `${inputBase} h-[50px] min-h-0 resize-none leading-relaxed ${placeholderTight}`;
  const textareaNonAdminIdentifiersLower = `${textareaNonAdminIdentifiersBase} font-mono lowercase`;
  const textareaNonAdminIdentifiersUpper = `${textareaNonAdminIdentifiersBase} font-mono uppercase`;

  const textareaNonAdminLower = textareaNonAdminIdentifiersLower;
  const textareaNonAdminUpper = textareaNonAdminIdentifiersUpper;
  const coreLabelGap = !isAdmin ? "mt-2.5" : "mt-0";

  // Buttons (como los que indicas)
  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

  const btnExportExcel =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/20 transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";
  const btnDanger =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white " +
    "shadow-sm transition " +
    "focus:outline-none focus:ring-4 focus:ring-rose-200 " +
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 " +
    "ring-1 ring-rose-500/20";

  // ✅ Range inputs (más compactos + placeholder igual a textarea)
  const inputRange =
    "w-[110px] max-w-full h-6.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 shadow-sm outline-none transition " +
    "placeholder:text-[11px] placeholder:lowercase placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 " +
    "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

  const inputRangeCompact =
    "w-full min-w-0 max-w-[104px] sm:max-w-[130px] md:max-w-[150px] lg:max-w-[170px] xl:max-w-none " +
    "h-6 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 shadow-sm outline-none transition " +
    "placeholder:text-[11px] placeholder:lowercase placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 " +
    "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

  const compactCoreActions = !isAdmin && filterStep === 1 && records.length > 0;

  const allowPopoverOverflow =
    !isAdmin &&
    filterStep === 1 &&
    (authorDropdownOpen || bookDropdownOpen || postTypeDropdownOpen);

  const steps = isAdmin
    ? [
        { key: "dates", title: "Dates", desc: "Select date ranges" },
        {
          key: "core",
          title: "Core Filters",
          desc: "Author, book, publisher, scene, post type",
        },
        { key: "ids", title: "Identifiers", desc: "Username, post id, region" },
        {
          key: "ranges",
          title: "Ranges",
          desc: "Views, likes, saves, engagement, interactions",
        },
      ]
    : [
        { key: "dates", title: "Dates", desc: "Post date + username" },
        {
          key: "core",
          title: "Core Filters",
          desc: "Author, book, post id, post type",
        },
        {
          key: "ranges",
          title: "Ranges",
          desc: "Views, likes, saves, engagement, interactions",
        },
      ];

  useEffect(() => {
    const max = steps.length - 1;
    if (filterStep > max) setFilterStep(max);
  }, [steps.length, filterStep]);

  const StepPill = ({ active, done, idx, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
        active
          ? "bg-slate-900 text-white ring-slate-900/10"
          : done
            ? "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
            : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
      ].join(" ")}
      aria-current={active ? "step" : undefined}
    >
      <span
        className={[
          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold",
          active
            ? "bg-white text-slate-900"
            : done
              ? "bg-slate-700 text-white"
              : "bg-slate-200 text-slate-700",
        ].join(" ")}
      >
        {done ? "✓" : idx + 1}
      </span>
      <span className="whitespace-nowrap">{steps[idx].title}</span>
    </button>
  );

  const EMOJIS_TO_STRIP = ["✅", "❌", "⚠️", "⏳", "📊", "🚀", "🧠", "🔎"];

  const stripLeadingLogEmoji = (msg = "") => {
    let out = msg;

    // Por si en algún momento metes 2 emojis seguidos (ej: "📊 ✅ ...")
    while (true) {
      const trimmed = out.trimStart();
      const hit = EMOJIS_TO_STRIP.find((e) => trimmed.startsWith(e));
      if (!hit) break;
      out = trimmed.slice(hit.length).trimStart();
    }

    return out;
  };

  const StatusCardBody = () => {
    if (isLoading) {
      return (
        <div
          className={
            "flex w-full min-h-[160px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/60 p-5 text-center shadow-sm"
          }
        >
          {" "}
          <div className="relative">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
            <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-red-600/15" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-900">
            Processing...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Please keep this tab open until completion
          </p>
        </div>
      );
    }

    if (!dataLoaded) {
      return (
        <div
          className={
            "flex w-full min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70 p-5 text-center"
          }
        >
          {" "}
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-6 w-6 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-slate-900">No logs yet</h2>
          <p className="mt-1 text-xs text-slate-600">
            Run a report to see status updates here
          </p>
        </div>
      );
    }

    return (
      <div className="w-full max-h-[300px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white/60 p-4">
        {log.map((entry, index) => {
          const cleanEntry = stripLeadingLogEmoji(entry);

          const isSuccess = entry.includes("✅");
          const isError = entry.includes("❌");
          const isWarn = entry.includes("⚠️");
          const isTime = entry.includes("⏳");
          const isRecords = entry.includes("📊");

          const badgeChar = isSuccess
            ? "✓"
            : isError
              ? "×"
              : isWarn
                ? "!"
                : isTime
                  ? "⏳"
                  : isRecords
                    ? "📊"
                    : "i";

          const badgeClass = isSuccess
            ? "bg-emerald-100 text-emerald-700"
            : isError
              ? "bg-red-100 text-red-700"
              : isWarn
                ? "bg-amber-100 text-amber-800"
                : "bg-indigo-100 text-indigo-700";

          return (
            <div
              key={index}
              className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/85 p-3 text-xs font-medium text-slate-700 shadow-sm"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${badgeClass}`}
              >
                {badgeChar}
              </span>

              {/* AQUÍ está el fix: ya NO renderices `entry`, sino `cleanEntry` */}
              <span className="flex-1 leading-relaxed">{cleanEntry}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const RangeField = ({
    label,
    icon,
    valueMin,
    valueMax,
    onChangeMin,
    onChangeMax,
    preventDecimal = true,
  }) => (
    <div className={`min-w-0 space-y-1`}>
      {/* ✅ Header único: NO-admin = icono alineado con el texto */}
      <div className={`flex items-center gap-1.5`}>
        {icon && (
          <div
            className="flex h-3.5 w-3.5 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200"
            title={label}
          >
            {icon}
          </div>
        )}

        <div className={`${dateTitleClass} leading-tight`}>{label}</div>

        {/* accesibilidad (opcional, pero ok dejarlo) */}
        {icon && <span className="sr-only">{label}</span>}
      </div>

      <div className="grid grid-cols-2 gap-1.5 justify-items-start">
        <input
          className={inputRangeCompact}
          type="number"
          placeholder="min"
          min="1"
          value={valueMin}
          onChange={onChangeMin}
          onKeyDown={(e) => {
            if (!preventDecimal) return;
            if (e.key === "." || e.key === "," || e.key === "-")
              e.preventDefault();
          }}
        />

        <input
          className={inputRangeCompact}
          type="number"
          placeholder="max"
          min="1"
          value={valueMax}
          onChange={onChangeMax}
          onKeyDown={(e) => {
            if (!preventDecimal) return;
            if (e.key === "." || e.key === "," || e.key === "-")
              e.preventDefault();
          }}
        />
      </div>
    </div>
  );

  const RangeIconOnly = ({ titulo, children }) => (
    <div className="mb-1 flex items-center">
      <div
        className="flex h-7 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200"
        title={titulo}
      >
        {children}
      </div>
      <span className="sr-only">{titulo}</span>
    </div>
  );

  const StepContent = () => {
    if (filterStep === 0) {
      // “Fix” UX del date picker:
      // 1) Removemos cualquier bloqueo de wheel/blur que podía hacer sentir que el mes “no cambia”.
      // 2) Forzamos showPicker() en click (cuando el browser lo soporta) para que el usuario navegue meses sin fricción.

      const dateCardClass = (partial) =>
        [
          "rounded-2xl border bg-white p-2.5 transition",
          partial ? "border-amber-200 bg-amber-50/40" : "border-slate-200/70",
        ].join(" ");

      if (!isAdmin) {
        return (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {/* Post Date (igual) */}
            {/* Post Date (NO-admin) */}
            <div className={dateCardClass()}>
              {/* Header estilo “foto”: icono a la izquierda estirado a 2 líneas */}
              <div className="flex items-stretch gap-3">
                {/* icono: se estira a la altura total (título + subtítulo) */}
                <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                {/* textos (2 líneas) */}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    Post Date (From - To)
                  </div>
                  <p className="text-xs text-slate-500 leading-tight truncate">
                    Select a complete date range
                  </p>
                </div>
              </div>

              {/* Inputs sin “From/To” separados */}
              <div className="mt-[14px] grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  aria-label="Post Date From"
                  title="From"
                  className={inputDateNonAdmin}
                  value={postDateFrom}
                  onChange={(e) => {
                    setFiltersTouched(true);
                    setPostDateFrom(e.target.value);
                  }}
                />

                <input
                  type="date"
                  aria-label="Post Date To"
                  title="To"
                  className={inputDateNonAdmin}
                  value={postDateTo}
                  onChange={(e) => {
                    setFiltersTouched(true);
                    setPostDateTo(e.target.value);
                  }}
                />
              </div>
            </div>

            {/* TikTok Username (mismo state) */}
            <div className={dateCardClass()}>
              {/* Header estilo “foto”: icono a la izquierda estirado a 2 líneas */}
              <div className="flex items-stretch gap-3">
                {/* icono: se estira a la altura total (título + subtítulo) */}
                <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>

                {/* textos (las 2 líneas viven acá para que el icono “mida” ambas) */}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    TikTok Username
                  </div>
                  <p className="text-xs text-slate-500 leading-tight truncate">
                    Enter usernames separated by commas
                  </p>
                </div>
              </div>

              <div className="mt-[14px]">
                <textarea
                  className={textareaTikTokNonAdmin}
                  placeholder="e.g. user1, user2, user3"
                  value={tikTokUsername}
                  onChange={(e) => {
                    setFiltersTouched(true);
                    setTikTokUsername(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {/* Post Date (ADMIN igual a NO-admin) */}
          <div className={dateCardClass()}>
            <div className="flex items-stretch gap-3">
              <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  Post Date (From - To)
                </div>
                <p className="text-xs text-slate-500 leading-tight truncate">
                  Select a complete date range
                </p>
              </div>
            </div>

            <div className="mt-[14px] grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="date"
                aria-label="Post Date From"
                title="From"
                className={inputDateNonAdmin}
                value={postDateFrom}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setPostDateFrom(e.target.value);
                }}
              />

              <input
                type="date"
                aria-label="Post Date To"
                title="To"
                className={inputDateNonAdmin}
                value={postDateTo}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setPostDateTo(e.target.value);
                }}
              />
            </div>
          </div>

          {/* Tracking Date (ADMIN igual a NO-admin) */}
          <div className={dateCardClass()}>
            <div className="flex items-stretch gap-3">
              <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  Tracking Date (From - To)
                </div>
                <p className="text-xs text-slate-500 leading-tight truncate">
                  Select a complete date range
                </p>
              </div>
            </div>

            <div className="mt-[14px] grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="date"
                aria-label="Tracking Date From"
                title="From"
                className={inputDateNonAdmin}
                value={trackingDateFrom}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setTrackingDateFrom(e.target.value);
                }}
              />

              <input
                type="date"
                aria-label="Tracking Date To"
                title="To"
                className={inputDateNonAdmin}
                value={trackingDateTo}
                onChange={(e) => {
                  setFiltersTouched(true);
                  setTrackingDateTo(e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (filterStep === 1) {
      return (
        <div
          className={`grid grid-cols-1 gap-4 ${
            isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-4"
          }`}
        >
          <div className="space-y-2 lg:col-span-1">
            <div className="space-y-2 lg:col-span-1">
              {isAdmin ? (
                <div className="flex items-stretch gap-3">
                  <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1"
                      />
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 12a4 4 0 100-8 4 4 0 000 8z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 leading-tight">
                      Author Codes
                    </div>
                    <p className="text-xs text-slate-500 leading-tight truncate">
                      Comma-separated
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-stretch gap-3">
                  <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1"
                      />
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 12a4 4 0 100-8 4 4 0 000 8z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 leading-tight">
                      Author Names
                    </div>
                    <p className="text-xs text-slate-500 leading-tight truncate">
                      Select authors
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-2.5">
                {isAdmin ? (
                  <textarea
                    className={textareaAdminCoreUpper}
                    placeholder="e.g. code1, code2"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                ) : (
                  <div ref={authorPopoverRef} className="relative z-[80]">
                    <button
                      type="button"
                      className={`${coreNonAdminHeight} w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm
focus:outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between mt-0`}
                      onClick={() => setAuthorDropdownOpen((v) => !v)}
                      disabled={!authorOptions.length}
                      title="Select author names"
                    >
                      <span className="truncate">
                        {authorOptions.length === 0
                          ? "No authors assigned"
                          : authorCodeSelected.length === 0
                            ? "Select authors"
                            : (() => {
                                const n = authorCodeSelected.length;
                                const top = authorCodeSelected
                                  .slice(0, 1)
                                  .map((c) => authorNameByCode[c] ?? c)
                                  .join(", ");
                                return n <= 1
                                  ? `${n} selected: ${top}`
                                  : `${n} selected: ${top}, +${n - 1} more`;
                              })()}
                      </span>

                      <svg
                        className={`h-4 w-4 text-slate-500 transition ${
                          authorDropdownOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {authorDropdownOpen && authorOptions.length > 0 && (
                      <div className="absolute left-0 top-full mt-2 z-[200] w-[270px] max-w-[92vw] rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
                        <div className="flex items-center px-2 py-2 border-b border-slate-200/60">
                          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                            {authorCodeSelected.length} selected
                          </span>
                          <div className="flex-1" />
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                              onClick={() => {
                                const all = authorOptions
                                  .map((a) => String(a?.codautora ?? "").trim())
                                  .filter(Boolean);
                                setAuthorCodeSelected(all);
                                setAuthor(all.join(", "));
                              }}
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                              onClick={() => {
                                setAuthorCodeSelected([]);
                                setAuthor("");
                              }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="max-h-52 overflow-auto px-2 py-1">
                          <div className="flex flex-col gap-1">
                            {authorOptions.map((a) => {
                              const code = String(a?.codautora ?? "")
                                .trim()
                                .toUpperCase();
                              if (!code) return null;

                              const label =
                                String(a?.nombre_completo ?? "").trim() || code;

                              const checked = authorCodeSelected.includes(code);

                              return (
                                <label
                                  key={code}
                                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                                    checked={checked}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;

                                      const next = isChecked
                                        ? Array.from(
                                            new Set([
                                              ...authorCodeSelected,
                                              code,
                                            ]),
                                          )
                                        : authorCodeSelected.filter(
                                            (x) => x !== code,
                                          );

                                      setAuthorCodeSelected(next);
                                      setAuthor(next.join(", "));
                                    }}
                                  />
                                  <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-medium text-slate-700">
                                    {label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 lg:col-span-1">
            <div className="space-y-2 lg:col-span-1">
              {isAdmin ? (
                <div className="flex items-stretch gap-3">
                  <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 leading-tight">
                      Book Codes
                    </div>
                    <p className="text-xs text-slate-500 leading-tight truncate">
                      Comma-separated
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-stretch gap-3">
                  <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                    {/* icono libro */}
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 leading-tight">
                      Book Names
                    </div>
                    <p className="text-xs text-slate-500 leading-tight truncate">
                      Select books
                    </p>
                  </div>
                </div>
              )}

              <div className={coreLabelGap}>
                {isAdmin ? (
                  <textarea
                    className={textareaAdminCoreUpper}
                    placeholder="e.g. code1, code2"
                    value={book}
                    onChange={(e) => setBook(e.target.value)}
                  />
                ) : (
                  (() => {
                    const visibleBooks =
                      authorCodeSelected.length > 0
                        ? bookOptions.filter((b) =>
                            authorCodeSelected.includes(
                              String(b?.codautora ?? "").trim(),
                            ),
                          )
                        : bookOptions;

                    const allVisibleBookCodes = visibleBooks
                      .map((b) =>
                        String(b?.codlibro ?? "")
                          .trim()
                          .toUpperCase(),
                      )
                      .filter(Boolean);

                    return (
                      <div ref={bookPopoverRef} className="relative z-[80]">
                        <button
                          type="button"
                          className={`${coreNonAdminHeight} w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm
focus:outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between mt-0`}
                          onClick={() => setBookDropdownOpen((v) => !v)}
                          disabled={!visibleBooks.length}
                          title="Select book names"
                        >
                          <span className="truncate">
                            {bookOptions.length === 0
                              ? "No books assigned"
                              : visibleBooks.length === 0
                                ? "No books available"
                                : bookCodeSelected.length === 0
                                  ? "Select books"
                                  : (() => {
                                      const n = bookCodeSelected.length;
                                      const top = bookCodeSelected
                                        .slice(0, 1)
                                        .map((c) => bookNameByCode[c] ?? c)
                                        .join(", ");
                                      return n <= 1
                                        ? `${n} selected: ${top}`
                                        : `${n} selected: ${top}, +${n - 1} more`;
                                    })()}
                          </span>

                          <svg
                            className={`h-4 w-4 text-slate-500 transition ${
                              bookDropdownOpen ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {bookDropdownOpen && visibleBooks.length > 0 && (
                          <div className="absolute left-0 top-full mt-2 z-[200] w-[270px] max-w-[92vw] rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
                            <div className="flex items-center px-2 py-2 border-b border-slate-200/60">
                              <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                                {bookCodeSelected.length} selected
                              </span>
                              <div className="flex-1" />
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                                  onClick={() => {
                                    setBookCodeSelected(allVisibleBookCodes);
                                    setBook(allVisibleBookCodes.join(", "));
                                  }}
                                >
                                  Select all
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                                  onClick={() => {
                                    setBookCodeSelected([]);
                                    setBook("");
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>

                            <div className="max-h-52 overflow-auto px-2 py-1">
                              <div className="flex flex-col gap-1">
                                {visibleBooks.map((b) => {
                                  const code = String(b?.codlibro ?? "")
                                    .trim()
                                    .toUpperCase();
                                  if (!code) return null;

                                  const label =
                                    String(b?.deslibro ?? "").trim() || code;
                                  const checked =
                                    bookCodeSelected.includes(code);

                                  return (
                                    <label
                                      key={code}
                                      className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                                    >
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                                        checked={checked}
                                        onChange={(e) => {
                                          const isChecked = e.target.checked;

                                          const next = isChecked
                                            ? Array.from(
                                                new Set([
                                                  ...bookCodeSelected,
                                                  code,
                                                ]),
                                              )
                                            : bookCodeSelected.filter(
                                                (x) => x !== code,
                                              );

                                          setBookCodeSelected(next);
                                          setBook(next.join(", "));
                                        }}
                                      />
                                      <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-medium text-slate-700">
                                        {label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-1 lg:col-span-1">
              <div className="flex items-stretch gap-3">
                <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  <svg
                    className="h-4.5 w-4.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2z"
                    />
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 5h4"
                    />
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 19h2"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    PA Codes
                  </div>
                  <p className="text-xs text-slate-500 leading-tight truncate">
                    Comma-separated
                  </p>
                </div>
              </div>

              <div className="mt-2.5">
                <textarea
                  rows={1}
                  className={textareaAdminCoreUpper}
                  placeholder="e.g. code1, code2"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                />
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-1 lg:col-span-1">
              <div className="flex items-stretch gap-3">
                <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 7h10M7 12h6M7 17h10M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    Scene Codes
                  </div>
                  <p className="text-xs text-slate-500 leading-tight truncate">
                    Comma-separated
                  </p>
                </div>
              </div>

              <div className="mt-2.5">
                <textarea
                  rows={1}
                  className={textareaAdminCoreUpper}
                  placeholder="e.g. code1, code2"
                  value={sceneCode}
                  onChange={(e) => setSceneCode(e.target.value)}
                />
              </div>
            </div>
          )}

          {!isAdmin && (
            <div className="space-y-2 lg:col-span-1">
              <div className="flex items-stretch gap-3">
                <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    Post Types
                  </div>
                  <p className="text-xs text-slate-500 leading-tight truncate">
                    Select post types
                  </p>
                </div>
              </div>

              <div className={coreLabelGap}>
                <div ref={postTypePopoverRef} className="relative z-[80]">
                  <button
                    type="button"
                    className={`${coreNonAdminHeight} w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm
focus:outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between mt-0`}
                    onClick={() => setPostTypeDropdownOpen((v) => !v)}
                    disabled={!postTypeOptions.length}
                    title="Select post types"
                  >
                    <span className="truncate">
                      {postTypeOptions.length === 0
                        ? "No post types available"
                        : postTypeCodeSelected.length === 0
                          ? "Select post types"
                          : (() => {
                              const n = postTypeCodeSelected.length;
                              const top = postTypeCodeSelected
                                .slice(0, 1)
                                .map((c) => postTypeNameByCode[c] ?? c)
                                .join(", ");
                              return n <= 1
                                ? `${n} selected: ${top}`
                                : `${n} selected: ${top}, +${n - 1} more`;
                            })()}
                    </span>

                    <svg
                      className={`h-4 w-4 text-slate-500 transition ${
                        postTypeDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {postTypeDropdownOpen && postTypeOptions.length > 0 && (
                    <div className="absolute left-0 top-full mt-2 z-[200] w-[270px] max-w-[92vw] rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
                      <div className="flex items-center px-2 py-2 border-b border-slate-200/60">
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                          {postTypeCodeSelected.length} selected
                        </span>

                        <div className="flex-1" />

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                            onClick={() => {
                              const all = postTypeOptions
                                .map((p) =>
                                  String(p?.tippublicacion ?? "")
                                    .trim()
                                    .toLowerCase(),
                                )
                                .filter(Boolean);

                              setFiltersTouched(true);
                              setPostTypeCodeSelected(all);
                              setPostType(all.join(", "));
                            }}
                          >
                            Select all
                          </button>

                          <button
                            type="button"
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                            onClick={() => {
                              setFiltersTouched(true);
                              setPostTypeCodeSelected([]);
                              setPostType("");
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="max-h-52 overflow-auto px-2 py-1">
                        <div className="flex flex-col gap-1">
                          {postTypeOptions.map((p) => {
                            const code = String(p?.tippublicacion ?? "")
                              .trim()
                              .toLowerCase();
                            if (!code) return null;

                            const label =
                              String(p?.despost ?? "").trim() || code;
                            const checked = postTypeCodeSelected.includes(code);

                            return (
                              <label
                                key={code}
                                className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                                  checked={checked}
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;

                                    const next = isChecked
                                      ? Array.from(
                                          new Set([
                                            ...postTypeCodeSelected,
                                            code,
                                          ]),
                                        )
                                      : postTypeCodeSelected.filter(
                                          (x) => x !== code,
                                        );

                                    setFiltersTouched(true);
                                    setPostTypeCodeSelected(next);
                                    setPostType(next.join(", "));
                                  }}
                                />

                                <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-medium text-slate-700">
                                  {label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ✅ Post ID (entre Book y Post Type) */}
          {!isAdmin && (
            <div className="space-y-2 lg:col-span-1">
              <div className="flex items-stretch gap-3">
                <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  {/* icono ID */}
                  <svg
                    className="h-5.5 w-5.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 7a2 2 0 012-2h9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                    />
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 10l3 2-3 2v-4z"
                    />
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 10l3-2v8l-3-2v-4z"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    Post ID
                  </div>
                  <p className="text-xs text-slate-500 leading-tight truncate">
                    Comma-separated
                  </p>
                </div>
              </div>

              <div className={coreLabelGap}>
                <textarea
                  className={textareaNonAdminUpper}
                  placeholder="e.g. 74701069, 96543531"
                  value={postID}
                  onChange={(e) => {
                    // Permite solo: dígitos, coma y espacios
                    const limpio = e.target.value.replace(/[^\d,\s]/g, "");
                    setpostID(limpio);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pegado = e.clipboardData?.getData("text") || "";
                    const limpio = pegado.replace(/[^\d,\s]/g, "");
                    setpostID((prev) => prev + limpio);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    if (isAdmin && filterStep === 2) {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* TikTok Username */}
          <div className="space-y-1">
            <div className="flex items-stretch gap-3">
              <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                {/* mismo icono user que ya usas en NO-admin */}
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  TikTok Username
                </div>
                <p className="text-xs text-slate-500 leading-tight truncate">
                  Comma-separated
                </p>
              </div>
            </div>

            <div className="mt-2.5">
              <textarea
                className={textareaAdminIdentifiersLower} // ✅ igual que antes (admin)
                placeholder="e.g. user1, user2"
                value={tikTokUsername}
                onChange={(e) => setTikTokUsername(e.target.value)}
              />
            </div>
          </div>

          {/* Post ID */}
          <div className="space-y-1">
            <div className="flex items-stretch gap-3">
              <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                {/* mismo icono “video/tiktok” que usas en NO-admin Post ID */}
                <svg
                  className="h-5.5 w-5.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 7a2 2 0 012-2h9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                  />
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 10l3 2-3 2v-4z"
                  />
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 10l3-2v8l-3-2v-4z"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  Post ID
                </div>
                <p className="text-xs text-slate-500 leading-tight truncate">
                  Comma-separated
                </p>
              </div>
            </div>

            <div className="mt-2.5">
              <textarea
                className={textareaAdminIdentifiersUpper} // ✅ igual que antes (admin)
                placeholder="e.g. 74795470, 75676545"
                value={postID}
                onChange={(e) => {
                  // Permite solo: dígitos, coma y espacios
                  const limpio = e.target.value.replace(/[^\d,\s]/g, "");
                  setpostID(limpio);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pegado = e.clipboardData?.getData("text") || "";
                  const limpio = pegado.replace(/[^\d,\s]/g, "");
                  setpostID((prev) => prev + limpio);
                }}
              />
            </div>
          </div>

          {/* Post Region */}
          <div className="space-y-1">
            <div className="flex items-stretch gap-3">
              <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                {/* icono “globo” para region */}
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 22a10 10 0 100-20 10 10 0 000 20z"
                  />
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2 12h20"
                  />
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 2a15.3 15.3 0 010 20"
                  />
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 2a15.3 15.3 0 000 20"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  Post Region
                </div>
                <p className="text-xs text-slate-500 leading-tight truncate">
                  Comma-separated
                </p>
              </div>
            </div>

            <div className="mt-2.5">
              <textarea
                className={textareaAdminIdentifiersUpper} // ✅ igual que antes (admin)
                placeholder="e.g. region1, region2"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>

          {/* Post Types (ADMIN moved here) */}
          <div className="space-y-1">
            <div className="flex items-stretch gap-3">
              <div className="w-9 shrink-0 self-stretch flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                {/* icono lista (mismo que usas en Post Types no-admin) */}
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  Post Types
                </div>
                <p className="text-xs text-slate-500 leading-tight truncate">
                  Comma-separated
                </p>
              </div>
            </div>

            <div className="mt-2.5">
              <textarea
                className={textareaAdminIdentifiersLower}
                placeholder="e.g. a, b, c"
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
              />
            </div>
          </div>
        </div>
      );
    }

    // filterStep === 3
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          {RangeField({
            label: "Views (min - max)",
            icon: (
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
                />
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                />
              </svg>
            ),
            valueMin: viewsRange.min,
            valueMax: viewsRange.max,
            onChangeMin: (e) =>
              setViewsRange({ ...viewsRange, min: e.target.value }),
            onChangeMax: (e) =>
              setViewsRange({ ...viewsRange, max: e.target.value }),
          })}
        </div>
        <div className="lg:col-span-2">
          {RangeField({
            label: "Likes (min - max)",
            icon: (
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"
                />
              </svg>
            ),
            valueMin: LikesRange.min,
            valueMax: LikesRange.max,
            onChangeMin: (e) =>
              setLikesRange({ ...LikesRange, min: e.target.value }),
            onChangeMax: (e) =>
              setLikesRange({ ...LikesRange, max: e.target.value }),
          })}
        </div>
        <div className="lg:col-span-2">
          {RangeField({
            label: "Saves (min - max)",
            icon: (
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 3h10a2 2 0 012 2v16l-7-4-7 4V5a2 2 0 012-2z"
                />
              </svg>
            ),
            valueMin: SavesRange.min,
            valueMax: SavesRange.max,
            onChangeMin: (e) =>
              setSavesRange({ ...SavesRange, min: e.target.value }),
            onChangeMax: (e) =>
              setSavesRange({ ...SavesRange, max: e.target.value }),
          })}
        </div>
        <div className="lg:col-span-2">
          {RangeField({
            label: "Engagement (%) ",
            icon: (
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 17l6-6 4 4 7-7"
                />
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 8h6v6"
                />
              </svg>
            ),
            valueMin: engagement.min,
            valueMax: engagement.max,
            onChangeMin: (e) =>
              setEngagement({ ...engagement, min: e.target.value }),
            onChangeMax: (e) =>
              setEngagement({ ...engagement, max: e.target.value }),
            preventDecimal: false,
          })}
        </div>
        {/* ✅ NUEVO - Comments (solo UI) */}
        <div className="lg:col-span-2">
          {RangeField({
            label: "Comments (min - max)",
            icon: (
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4v8z"
                />
              </svg>
            ),
            valueMin: commentsRange.min,
            valueMax: commentsRange.max,
            onChangeMin: (e) =>
              setCommentsRange({ ...commentsRange, min: e.target.value }),
            onChangeMax: (e) =>
              setCommentsRange({ ...commentsRange, max: e.target.value }),
          })}
        </div>
        <div className="lg:col-span-2">
          {RangeField({
            label: "Interactions (min - max)",
            icon: (
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"
                />
              </svg>
            ),
            valueMin: interactions.min,
            valueMax: interactions.max,
            onChangeMin: (e) =>
              setInteractions({ ...interactions, min: e.target.value }),
            onChangeMax: (e) =>
              setInteractions({ ...interactions, max: e.target.value }),
          })}
        </div>
      </div>
    );
  };

  const handleClearAll = () => {
    // evita limpiar mientras está corriendo algo
    if (isLoading || isLoadingExcel) return;

    // 1) Reset filtros
    setPostDateFrom("");
    setPostDateTo("");
    setTrackingDateFrom("");
    setTrackingDateTo("");

    setAuthor("");
    setBook("");
    setPublisher("");
    setSceneCode("");
    setPostType("");

    setTikTokUsername("");
    setpostID("");
    setRegion("");

    setViewsRange({ min: "", max: "" });
    setLikesRange({ min: "", max: "" });
    setSavesRange({ min: "", max: "" });
    setEngagement({ min: "", max: "" });
    setInteractions({ min: "", max: "" });

    // UI-only (Comments)
    setCommentsRange({ min: "", max: "" });

    // UI-only step
    setFilterStep(0);

    // 2) Reset resultados
    setRecords([]);
    setColumns([]);
    setLog([]);
    setDataLoaded(false);

    // 3) Reset toasts
    setToast(null);

    // 4) Limpia cache localStorage (resultados + filtros)
    try {
      if (dbqCacheKey) localStorage.removeItem(dbqCacheKey);
      if (dbqFiltersKey) localStorage.removeItem(dbqFiltersKey);
    } catch (e) {
      console.warn("Failed to clear cache:", e);
    }
  };

  // === Table UI helpers (igual que APICall) ===
  const isHttpUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

  const extractTikTokId = (url) => {
    if (typeof url !== "string") return "";

    // video id
    const m1 = url.match(/\/video\/(\d+)/);
    if (m1?.[1]) return m1[1];

    // sound/music id (muchas veces termina en dígitos)
    const m2 = url.match(/(\d{6,})(?:\D*$)/);
    return m2?.[1] || "";
  };

  return (
    <div className="w-full space-y-6">
      {toast && (
        <div className="fixed right-5 top-5 z-50 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{toast.title}</p>
              <p className="mt-1 text-xs text-slate-600">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className={`h-1 w-full ${toastBarClass}`} />
        </div>
      )}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/20 to-slate-900/10 backdrop-blur-[2px]"
            onClick={closeConfirm}
          />

          {/* dialog */}
          <div className="relative w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

            <div className="p-6 text-center">
              {/* Icono arriba (según danger o normal) */}
              <div
                className={
                  confirmOpen.danger
                    ? "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                    : "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/5 text-slate-900 ring-1 ring-slate-200"
                }
              >
                {confirmOpen.danger ? (
                  /* warning icon */
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v4m0 4h.01M10.3 3.6l-8.6 15A2 2 0 0 0 3.4 21h17.2a2 2 0 0 0 1.7-2.4l-8.6-15a2 2 0 0 0-3.4 0z"
                    />
                  </svg>
                ) : (
                  /* check icon */
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20 6L9 17l-5-5"
                    />
                  </svg>
                )}
              </div>

              <p className="text-[16px] font-semibold tracking-tight text-slate-900">
                {confirmOpen.title}
              </p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {confirmOpen.message}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={runConfirm}
                  className={
                    confirmOpen.danger
                      ? "inline-flex items-center justify-center rounded-xl bg-rose-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm ring-1 ring-rose-500/20 hover:bg-rose-600 active:bg-rose-700"
                      : "inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm ring-1 ring-slate-900/10 hover:bg-slate-800 active:bg-slate-950"
                  }
                >
                  {confirmOpen.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters + Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Filters (carousel) */}
        <section
          className={`relative flex flex-col ${
            allowPopoverOverflow ? "overflow-visible" : "overflow-hidden"
          } rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6 lg:col-span-8 ${
            compactCoreActions ? "self-start h-auto" : "h-full"
          }`}
        >
          {" "}
          {/* top accent */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-950 to-slate-700 shadow-sm">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </div>

              <div>
                <h2 className={sectionTitle}>Database Filters</h2>
                <p className={sectionSub}>Choose a section to edit filters.</p>
              </div>
            </div>

            {/* Pills clickable */}
            <div className="flex flex-wrap items-center gap-2">
              {steps.map((_, idx) => (
                <StepPill
                  key={steps[idx].key}
                  idx={idx}
                  active={idx === filterStep}
                  done={idx < filterStep}
                  onClick={() => setFilterStep(idx)}
                />
              ))}
            </div>
          </div>
          {/* Step content */}
          <div
            className={`rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 shadow-sm ${
              filterStep === 0 ? "p-3" : "p-4"
            }`}
          >
            {StepContent()}
          </div>
          {/* Actions */}
          {/* Actions */}
          <div
            className={`${
              // ✅ SOLO NO-admin + Dates: reducir aire entre filtros y botones
              !isAdmin && filterStep === 0
                ? "mt-2 pt-2"
                : // ✅ SOLO NO-admin + Core Filters
                  !isAdmin && filterStep === 1
                  ? "mt-3 pt-3"
                  : compactCoreActions
                    ? "mt-6 pt-4"
                    : "mt-3 pt-3"
            } ${
              !isAdmin && filterStep === 0 ? "" : "border-t border-slate-200/70"
            }`}
          >
            <div className="relative flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
              {isAdmin && (
                <button
                  className={btnPrimary}
                  onClick={() => {
                    playSound();
                    openConfirm({
                      title: "Confirm Execution",
                      message:
                        "This will execute the Database Query with the selected filters applied",
                      confirmText: "Generate",
                      danger: false,
                      onConfirm: () => {
                        setButtonClick("filter");
                        handleDBQuery("filter");
                      },
                    });
                  }}
                  disabled={buttonDisable}
                >
                  {buttonText}
                </button>
              )}

              <button
                className={btnPrimary}
                onClick={() => {
                  playSound();
                  openConfirm({
                    title: "Confirm Execution",
                    message:
                      "This will generate Short Report Metrics based on the selected filters applied",
                    confirmText: "Generate",
                    danger: false,
                    onConfirm: () => {
                      setButtonClick("conciso");
                      handleDBQuery("conciso");
                    },
                  });
                }}
                disabled={buttonDisable}
              >
                {buttonConcisoText}
              </button>

              <button
                className={btnPrimary}
                onClick={() => {
                  playSound();
                  openConfirm({
                    title: "Confirm Execution",
                    message:
                      "This will generate Score Scene Report Metrics based on the selected filters applied",
                    confirmText: "Generate",
                    danger: false,
                    onConfirm: () => {
                      setButtonClick("scoreScene");
                      handleDBQuery("scoreScene");
                    },
                  });
                }}
                disabled={buttonDisable}
              >
                {buttonScoreText}
              </button>

              {/* ✅ CLEAR BUTTON (idéntico a APICall) */}
              <button
                type="button"
                className={`${btnDanger} !px-0 !py-0 !gap-0 h-11 w-12 sm:self-center lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2`}
                onClick={() => {
                  if (isLoading || isLoadingExcel) return;

                  playSound();
                  openConfirm({
                    title: "Confirm reset",
                    message:
                      "This will clear filters, logs, records, notifications and cached data for this user.",
                    confirmText: "Clear",
                    danger: true,
                    onConfirm: () => handleClearAll(),
                  });
                }}
                disabled={isLoading || isLoadingExcel}
                title="Clear filters, logs, data and cache"
              >
                {/* trash icon */}
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"
                  />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* System Status */}
        <aside className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6 lg:col-span-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-950 to-slate-700 shadow-sm">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Execution Monitor
              </h3>
              <p className="text-xs text-slate-500">
                Logs and runtime status updates
              </p>
            </div>
          </div>

          <div className={"flex-1 flex"}>{StatusCardBody()}</div>
        </aside>
      </div>

      {/* Table */}
      <section className="w-full overflow-hidden rounded-2xl bg-white shadow-md border border-slate-200">
        <div className="w-full overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-center font-semibold whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {records.length > 0 ? (
                records.slice(0, 20).map((record, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50">
                    {columns.map((col) => {
                      // 1) Formatos numéricos que ya tenías
                      if (col === "Scene Score" || col === "Engagement Rate") {
                        let rawValue = record[col];
                        if (rawValue == "Not found: N/A") rawValue = "0";
                        const numValue = parseFloat(rawValue) || 0;
                        const formatted = numValue.toFixed(2);

                        return (
                          <td
                            key={col}
                            className="px-4 py-3 whitespace-nowrap text-center"
                          >
                            {formatted}
                          </td>
                        );
                      }

                      if (
                        col === "View Average" ||
                        col === "Interaction Average" ||
                        col === "# of Hashtags" ||
                        col === "Interactions" ||
                        col === "Saves" ||
                        col === "Reposted" ||
                        col === "Comments" ||
                        col === "Likes" ||
                        col === "Views"
                      ) {
                        let rawValue = record[col];
                        if (rawValue == "Not found: N/A") rawValue = "0";
                        const numValue = Number(rawValue) || 0;

                        return (
                          <td
                            key={col}
                            className="px-4 py-3 whitespace-nowrap text-center"
                          >
                            {numValue}
                          </td>
                        );
                      }

                      // 2) Post URL + Sound URL (mismo look que APICall)
                      if (col === "Post URL" || col === "Sound URL") {
                        const url = record[col] || "";
                        const hasUrl =
                          isHttpUrl(url) && url !== "Not found: N/A";
                        const id = hasUrl ? extractTikTokId(url) : "";

                        return (
                          <td
                            key={col}
                            className="px-4 py-3 whitespace-nowrap text-center"
                          >
                            {hasUrl ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-semibold text-slate-900 hover:text-slate-700"
                                title={url}
                              >
                                {id || "Open"}
                              </a>
                            ) : (
                              <span>{url || "Not found: N/A"}</span>
                            )}
                          </td>
                        );
                      }

                      if (col === "Hashtags") {
                        const texto = String(record[col] ?? "");

                        return (
                          <td key={col} className="px-4 py-3 text-center">
                            <span
                              className="block max-w-[600px] truncate"
                              title={texto}
                            >
                              {texto}
                            </span>
                          </td>
                        );
                      }

                      if (col === "Scene Name") {
                        const texto = String(record[col] ?? "");

                        return (
                          <td key={col} className="px-4 py-3 text-center">
                            <span
                              className="block max-w-[400px] truncate"
                              title={texto}
                            >
                              {texto}
                            </span>
                          </td>
                        );
                      }

                      // 3) Default: centrado
                      return (
                        <td
                          key={col}
                          className="px-4 py-3 whitespace-nowrap text-center"
                        >
                          {record[col] ?? "Not found: N/A"}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1)}
                    className="px-6 py-10"
                  >
                    <div className="text-center">
                      <h2 className="text-xl font-extrabold text-slate-900">
                        No Data Found
                      </h2>
                      <p className="text-slate-600 mt-2">
                        We couldn't find any data to display.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Export button ONLY when there is data */}
        {records.length > 0 && (
          <div className="p-5 sm:p-6 flex justify-center">
            <button
              className={btnExportExcel}
              onClick={() => {
                handleExportToExcel();
                playSound();
              }}
            >
              Export to Excel
            </button>
          </div>
        )}
      </section>

      {isLoadingExcel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* overlay (NO clickeable, no se cierra) */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/20 to-slate-900/10 backdrop-blur-[2px]" />

          {/* dialog */}
          <div className="relative w-[360px] max-w-[100vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

            <div className="p-7 text-center">
              {/* spinner ROJO (idéntico a APICall) */}
              <div className="mx-auto relative h-15 w-15">
                <div className="h-15 w-15 animate-spin rounded-full border-[5px] border-slate-200 border-t-red-600" />
                <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-red-600/15" />
              </div>

              <p className="mt-4 text-[15px] font-semibold text-slate-800">
                Processing...
              </p>
              <p className="mt-1.5 text-[13px] text-slate-500">
                Please keep this tab open until completion
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBaseQueries;
