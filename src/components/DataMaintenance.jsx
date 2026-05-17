import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import clickSound from "../Sounds/clicksound.mp3";
import { useMsal } from "@azure/msal-react";
import { useAuthUser } from "../context/useAuthUser.js";

const DataMaintenance = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [log, setLog] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [file, SetFile] = useState(null);
  const [isLoadingImportExcel, setIsLoadingImportExcel] = useState(false);

  const [isLoadingExcel, setIsLoadingExcel] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [toast, setToast] = useState(null);
  // toast: { title: string, message: string, type?: "success"|"warning"|"error"|"info" } | null

  const CATEGORY_GROUPS = {
    "Core Section": [
      "Authors",
      "Books",
      "Scene name",
      "Publisher",
      "Type post",
      "Post meta PA",
      "Post meta Author",
      "Post meta Book",
      "User - Role",
      "App - Role Module",
    ],

    "Order Generation": [
      "Scene - Text",
      "Sound - Genre",
      "Sounds",
      "Telephone",
      //"TikTok Accounts",
      "Post type Elements",
      "Book - Telephone - Account",
      "Book - Hashtag",
      "Order Parameters",
      "Scene - Image - Video",
      "Book - Image - Video",
      "PA - Telephone",
    ],
  };

  const GROUP_ORDER = ["Core Section", "Order Generation"];
  const groupSteps = [
    { title: "Core Section", key: "Core Section" },
    { title: "Order Generation", key: "Order Generation" },
  ];
  const [selectedGroup, setSelectedGroup] = useState("Core Section");

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // ====== Notifications (reemplazo de alert) ======
  const notify = (title, message, type = "info") => {
    setToast({ title, message, type });
  };

  const [notifOpen, setNotifOpen] = useState(false);
  const [dataMaintenanceAlerts, setDataMaintenanceAlerts] = useState([]);

  const notifButtonRef = useRef(null);
  const notifDropdownRef = useRef(null);

  const [notifPos, setNotifPos] = useState({
    top: -9999,
    left: -9999,
    width: 360,
    maxHeight: 260,
  });

  const notifCount = dataMaintenanceAlerts.length;

  const addDataMaintenanceAlert = ({
    title = "Data maintenance error",
    category = selectedCategory,
    tableName = null,
    action = "Data Maintenance",
    errorMessage = "",
    recordsCount = 0,
    status = "error",
  }) => {
    setDataMaintenanceAlerts((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        category,
        tableName,
        action,
        errorMessage:
          errorMessage?.toString?.()?.trim?.() ||
          "No technical error detail was returned.",
        recordsCount,
        status,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const extractBackendErrorMessage = async (response) => {
    try {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();

        return (
          data?.message ||
          data?.error ||
          `Server responded with status ${response.status}`
        );
      }

      const text = await response.text();

      if (!text) {
        return `Server responded with status ${response.status}`;
      }

      try {
        const parsed = JSON.parse(text);
        return parsed?.message || parsed?.error || text;
      } catch {
        return text;
      }
    } catch (error) {
      return `Server responded with status ${response.status}`;
    }
  };

  const toggleNotifications = () => {
    setNotifOpen((prev) => !prev);
  };

  const closeNotifications = () => {
    setNotifOpen(false);
  };

  const clearNotifications = () => {
    setDataMaintenanceAlerts([]);
  };

  const formatAlertDate = (createdAt) => {
    if (!createdAt) return "N/A";

    try {
      return new Date(createdAt).toLocaleDateString();
    } catch {
      return "N/A";
    }
  };

  const formatAlertTime = (createdAt) => {
    if (!createdAt) return "N/A";

    try {
      return new Date(createdAt).toLocaleTimeString();
    } catch {
      return "N/A";
    }
  };

  const updateNotifPos = () => {
    const WIDTH = Math.min(360, Math.floor(window.innerWidth * 0.92));
    const maxHeight = Math.max(260, Math.floor(window.innerHeight * 0.85));

    setNotifPos({ width: WIDTH, maxHeight });
  };

  useLayoutEffect(() => {
    if (!notifOpen) return;
    updateNotifPos();
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;

    const onResize = () => updateNotifPos();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;

    const onPointerDown = (e) => {
      const btn = notifButtonRef.current;
      const drop = notifDropdownRef.current;

      if (btn && btn.contains(e.target)) return;
      if (drop && drop.contains(e.target)) return;

      closeNotifications();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notifOpen]);

  const toastBarClass =
    toast?.type === "success"
      ? "bg-emerald-600"
      : toast?.type === "warning"
        ? "bg-rose-400"
        : toast?.type === "error"
          ? "bg-rose-500"
          : "bg-slate-900";

  const { instance } = useMsal();
  const [userId, setUserId] = useState("");
  const { jwt, refreshJwt } = useAuthUser();

  const formatearDescripcionTexto = (texto) => {
    if (!texto) return "";

    // Inserta salto de línea antes de cada "n." cuando viene después de un espacio
    // Ej: "2. aaa 3. bbb 4. ccc" -> "2. aaa\n3. bbb\n4. ccc"
    const conSaltos = String(texto).replace(/\s(?=\d+\.\s)/g, "\n");
    // Limpieza simple
    return conSaltos.replace(/\n{2,}/g, "\n").trim();
  };

  useEffect(() => {
    const account = instance.getActiveAccount();
    const id = account?.idTokenClaims?.emails[0]
      ? account.idTokenClaims.emails[0].toLowerCase()
      : "null";
    setUserId(id);
  }, [instance]);

  // ===== Persistencia overlay Export Excel (DataMaintenance) =====
  const EXCEL_DOWNLOAD_TTL_MS = 10 * 60 * 1000; // 10 min anti-stuck
  const dmExcelKey = userId ? `dm_excel_downloading_${userId}` : null;

  const dmExportToastKey = userId ? `dm_excel_export_toast_${userId}` : null;

  // ===== Persistencia overlay Import Excel (DataMaintenance) =====
  const EXCEL_IMPORT_TTL_MS = 10 * 60 * 1000; // 10 min anti-stuck
  const dmImportKey = userId ? `dm_excel_importing_${userId}` : null;

  const dmImportRefreshKey = userId
    ? `dm_excel_import_refresh_${userId}`
    : null;

  // ===== Persistencia: categoría seleccionada + data (DataMaintenance) =====
  const DM_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h (ajústalo si quieres)
  const dmCacheKey = userId ? `dm_cache_${userId}` : null;

  // Restore Excel downloading state on mount / user change (with TTL)
  useEffect(() => {
    try {
      if (!dmExcelKey) return;

      const raw = localStorage.getItem(dmExcelKey);
      if (!raw) {
        setIsLoadingExcel(false);
        return;
      }

      const saved = JSON.parse(raw);
      const startedAt = Number(saved?.startedAt || 0);

      if (!saved?.inProgress) {
        localStorage.removeItem(dmExcelKey);
        setIsLoadingExcel(false);
        return;
      }

      if (startedAt && Date.now() - startedAt > EXCEL_DOWNLOAD_TTL_MS) {
        localStorage.removeItem(dmExcelKey);
        setIsLoadingExcel(false);
        return;
      }

      setIsLoadingExcel(true);
    } catch (_) {
      try {
        if (dmExcelKey) localStorage.removeItem(dmExcelKey);
      } catch (_) {}
      setIsLoadingExcel(false);
    }
  }, [dmExcelKey]);

  // Watcher: si el key desaparece (porque terminó), apaga overlay (evita infinito)
  useEffect(() => {
    if (!dmExcelKey) return;
    if (!isLoadingExcel) return;

    const id = setInterval(() => {
      try {
        const raw = localStorage.getItem(dmExcelKey);

        if (!raw) {
          setIsLoadingExcel(false);
          clearInterval(id);
          return;
        }

        const saved = JSON.parse(raw);
        const startedAt = Number(saved?.startedAt || 0);

        if (!saved?.inProgress) {
          try {
            localStorage.removeItem(dmExcelKey);
          } catch (_) {}
          setIsLoadingExcel(false);
          clearInterval(id);
          return;
        }

        if (startedAt && Date.now() - startedAt > EXCEL_DOWNLOAD_TTL_MS) {
          try {
            localStorage.removeItem(dmExcelKey);
          } catch (_) {}
          setIsLoadingExcel(false);
          clearInterval(id);
        }
      } catch (_) {
        try {
          localStorage.removeItem(dmExcelKey);
        } catch (_) {}
        setIsLoadingExcel(false);
        clearInterval(id);
      }
    }, 800);

    return () => clearInterval(id);
  }, [dmExcelKey, isLoadingExcel]);

  useEffect(() => {
    try {
      if (!dmExportToastKey) return;

      // Si el export sigue corriendo (estado o localStorage), no consumas todavía
      const exportStillRunning = (() => {
        if (isLoadingExcel) return true;
        if (!dmExcelKey) return false;

        try {
          const raw = localStorage.getItem(dmExcelKey);
          if (!raw) return false;

          const saved = JSON.parse(raw);
          const startedAt = Number(saved?.startedAt || 0);

          return (
            saved?.inProgress &&
            (!startedAt || Date.now() - startedAt <= EXCEL_DOWNLOAD_TTL_MS)
          );
        } catch (_) {
          return false;
        }
      })();

      if (exportStillRunning) return;

      const raw = localStorage.getItem(dmExportToastKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (saved?.toast) setToast(saved.toast);

      localStorage.removeItem(dmExportToastKey);
    } catch (_) {
      try {
        if (dmExportToastKey) localStorage.removeItem(dmExportToastKey);
      } catch (_) {}
    }
  }, [dmExportToastKey, dmExcelKey, isLoadingExcel]);

  // Restore cached category + data on mount / user change
  // Restore cached category + data on mount / user change
  useEffect(() => {
    try {
      if (!dmCacheKey) {
        setIsHydrated(true);
        return;
      }

      const raw = localStorage.getItem(dmCacheKey);
      if (!raw) {
        setIsHydrated(true);
        return;
      }

      const saved = JSON.parse(raw);
      const savedAt = Number(saved?.savedAt || 0);

      if (savedAt && Date.now() - savedAt > DM_CACHE_TTL_MS) {
        localStorage.removeItem(dmCacheKey);
        setIsHydrated(true);
        return;
      }

      if (saved?.selectedCategory) setSelectedCategory(saved.selectedCategory);
      if (saved?.selectedGroup) setSelectedGroup(saved.selectedGroup);

      if (Array.isArray(saved?.records)) setRecords(saved.records);
      if (Array.isArray(saved?.log)) setLog(saved.log);
      if (typeof saved?.dataLoaded === "boolean")
        setDataLoaded(saved.dataLoaded);

      setIsHydrated(true);
    } catch (_) {
      try {
        if (dmCacheKey) localStorage.removeItem(dmCacheKey);
      } catch (_) {}
      setIsHydrated(true);
    }
  }, [dmCacheKey]);

  // Persist category + data (merge-safe: no pisa records/log con vacíos durante loading)
  useEffect(() => {
    try {
      if (!dmCacheKey) return;

      const prev = (() => {
        try {
          return JSON.parse(localStorage.getItem(dmCacheKey) || "{}");
        } catch (_) {
          return {};
        }
      })();

      const merged = {
        savedAt: Date.now(),

        // Siempre guarda el botón seleccionado
        selectedCategory: selectedCategory ?? prev.selectedCategory ?? null,

        // No pises records/log con [] cuando el módulo está "en transición"
        records:
          Array.isArray(records) && records.length > 0
            ? records
            : Array.isArray(prev.records)
              ? prev.records
              : [],

        log:
          Array.isArray(log) && log.length > 0
            ? log
            : Array.isArray(prev.log)
              ? prev.log
              : [],

        dataLoaded:
          typeof dataLoaded === "boolean"
            ? dataLoaded
            : (prev.dataLoaded ?? false),
        selectedGroup: selectedGroup ?? prev.selectedGroup ?? "Core Section",
      };

      localStorage.setItem(dmCacheKey, JSON.stringify(merged));
    } catch (_) {}
  }, [dmCacheKey, selectedCategory, records, log, dataLoaded]);

  // Consume import result written while component was unmounted (so logs show after returning)
  useEffect(() => {
    try {
      if (!dmImportRefreshKey) return;

      // ✅ Si el import sigue corriendo (por estado o por localStorage), NO consumas todavía
      const importStillRunning = (() => {
        if (isLoadingImportExcel) return true;
        if (!dmImportKey) return false;

        try {
          const raw = localStorage.getItem(dmImportKey);
          if (!raw) return false;

          const saved = JSON.parse(raw);
          const startedAt = Number(saved?.startedAt || 0);

          return (
            saved?.inProgress &&
            (!startedAt || Date.now() - startedAt <= EXCEL_IMPORT_TTL_MS)
          );
        } catch (_) {
          return false;
        }
      })();

      if (importStillRunning) return;

      const raw = localStorage.getItem(dmImportRefreshKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      const entries = Array.isArray(saved?.entries) ? saved.entries : [];

      if (entries.length > 0) {
        setLog(entries);
        setDataLoaded(true);

        // ✅ Toast solo si existe (y ahora tú lo guardas solo cuando estabas desmontado)
        if (saved?.toast) setToast(saved.toast);
      }

      localStorage.removeItem(dmImportRefreshKey);
    } catch (_) {
      try {
        if (dmImportRefreshKey) localStorage.removeItem(dmImportRefreshKey);
      } catch (_) {}
    }
  }, [dmImportRefreshKey, dmImportKey, isLoadingImportExcel]);

  // Restore Excel importing state on mount / user change (with TTL)
  useEffect(() => {
    try {
      if (!dmImportKey) return;

      const raw = localStorage.getItem(dmImportKey);
      if (!raw) {
        setIsLoadingImportExcel(false);
        return;
      }

      const saved = JSON.parse(raw);
      const startedAt = Number(saved?.startedAt || 0);

      if (!saved?.inProgress) {
        localStorage.removeItem(dmImportKey);
        setIsLoadingImportExcel(false);
        return;
      }

      if (startedAt && Date.now() - startedAt > EXCEL_IMPORT_TTL_MS) {
        localStorage.removeItem(dmImportKey);
        setIsLoadingImportExcel(false);
        return;
      }

      setIsLoadingImportExcel(true);
    } catch (_) {
      try {
        if (dmImportKey) localStorage.removeItem(dmImportKey);
      } catch (_) {}
      setIsLoadingImportExcel(false);
    }
  }, [dmImportKey]);

  // Watcher: si el key desaparece (porque terminó), apaga overlay (evita infinito)
  useEffect(() => {
    if (!dmImportKey) return;
    if (!isLoadingImportExcel) return;

    const id = setInterval(() => {
      try {
        const raw = localStorage.getItem(dmImportKey);

        if (!raw) {
          setIsLoadingImportExcel(false);
          clearInterval(id);
          return;
        }

        const saved = JSON.parse(raw);
        const startedAt = Number(saved?.startedAt || 0);

        if (!saved?.inProgress) {
          try {
            localStorage.removeItem(dmImportKey);
          } catch (_) {}
          setIsLoadingImportExcel(false);
          clearInterval(id);
          return;
        }

        if (startedAt && Date.now() - startedAt > EXCEL_IMPORT_TTL_MS) {
          try {
            localStorage.removeItem(dmImportKey);
          } catch (_) {}
          setIsLoadingImportExcel(false);
          clearInterval(id);
        }
      } catch (_) {
        try {
          localStorage.removeItem(dmImportKey);
        } catch (_) {}
        setIsLoadingImportExcel(false);
        clearInterval(id);
      }
    }, 800);

    return () => clearInterval(id);
  }, [dmImportKey, isLoadingImportExcel]);

  const audioRef = useRef(new Audio(clickSound));
  const playSound = () => {
    audioRef.current.volume = 0.5;
    audioRef.current.loop = false;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  // Track mount/unmount to persist import result when user navigates away
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const categories = {
    Authors: "m_autora",
    Books: "m_libro",
    "Scene name": "m_escenalibro",
    "Type post": "m_tipopost",
    Publisher: "m_posteadorasistente",
    "Post meta PA": "m_metaposteadorasistente",
    "Post meta Author": "m_metapostautora",
    "Post meta Book": "m_metapostlibro",
    "Scene - Text": "m_escenaslidetexto",
    "Sound - Genre": "m_relacionsonidogenero",
    Sounds: "m_sonido",
    "TikTok Accounts": "m_cuenta",
    "User - Role": "m_usuariorol",
    "App - Role Module": "m_relacionrolmoduloapp",
    "Post type Elements": "m_elementostipoposteo",
    "Book - Telephone - Account": "m_librotelefonocuenta",
    "Book - Hashtag": "m_librohashtag",
    "Order Parameters": "m_parametroordentrabajo",
    "Scene - Image - Video": "m_escenaimagenvideo",
    "Book - Image - Video": "m_librotipopostimagenvideo",
    Telephone: "m_telefono",
    "PA - Telephone": "m_posteadortelefono",
  };

  const Tables = {
    Authors: {
      "Author Code": "codautora" || "Not found: N/A",
      "First Name": "nbautora" || "Not found: N/A",
      "Last Name": "apeautora" || "Not found: N/A",
      Correo: "autora_correo",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    Books: {
      "Book Code": "codlibro" || "Not found: N/A",
      "Book Name": "deslibro" || "Not found: N/A",
      "Author Code": "codautora",
      "Daily Post Count": "numposteodia" || "Not found: N/A",
      "Trope Description": "destropo" || "Not found: N/A",
      "Slide 1 hidden keyword": "desslide1keywordshide" || "Not found: N/A",
      "Slide 2 hidden keyword": "desslide2keywordshide" || "Not found: N/A",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Scene name": {
      "Scene Code": "codescena" || "Not found: N/A",
      "Scene Code (no version)": "codescenasinversion" || "Not found: N/A",
      "Version Number": "numversion" || "Not found: N/A",
      "Root Scene Code": "codescenaraiz" || "Not found: N/A",
      "Scene Name": "desscena" || "Not found: N/A",
      Caption: "descaption" || "Not found: N/A",
      "Book Code": "codlibro" || "Not found: N/A",
      "Post Type": "tippublicacion" || "Not found: N/A",
      "Vibe Code": "codvibe" || "Not found: N/A",
      "Genre Code": "codgenero" || "Not found: N/A",
      "Scene Status Code": "codestadoescena" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Type post": {
      "Type Code": "tippublicacion" || "Not found: N/A",
      "Type Name": "despost" || "Not found: N/A",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    Publisher: {
      "PA Code": "codposteador" || "Not found: N/A",
      "PA Email": "pa_correo" || "Not found: N/A",
      "PA DNI": "dniposteador" || "Not found: N/A",
      "PA Name": "nbposteador" || "Not found: N/A",
      "PA Paternal Name": "apepatposteador" || "Not found: N/A",
      "PA Maternal Name": "apematposteador" || "Not found: N/A",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Post meta PA": {
      "PA Code": "codposteador" || "Not found: N/A",
      "Start Date": "fecinicioperiodometa" || "Not found: N/A",
      "Finish Date": "fecfinperiodometa" || "Not found: N/A",
      "Post Meta": "numpostemeta" || "Not found: N/A",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Post meta Author": {
      "Author Code": "codautora" || "Not found: N/A",
      "Month Code": "codmes" || "Not found: N/A",
      "Post Meta": "numposteometa" || "Not found: N/A",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Post meta Book": {
      "Book Code": "codlibro" || "Not found: N/A",
      "Month Code": "codmes" || "Not found: N/A",
      "Post Meta": "numposteometa" || "Not found: N/A",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },
    "Scene - Text": {
      "Scene Code (no version)": "codescenasinversion" || "Not found: N/A",
      "Version Number": "numversion" || "Not found: N/A",
      "Slide Number": "numslide" || "Not found: N/A",
      "Text Code": "codtexto" || "Not found: N/A",
      "Text Description": "destexto" || "Not found: N/A",
      "Active Record?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Sound - Genre": {
      "Sound Code": "codsonido" || "Not found: N/A",
      "Genre Code": "codgenero" || "Not found: N/A",
      "Genre Name": "desgenero" || "Not found: N/A",
      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    Sounds: {
      "Sound Code": "codsonido" || "Not found: N/A",
      "Sound URL": "urlsonido" || "Not found: N/A",
      "Vibe Code": "codvibe" || "Not found: N/A",
      "Vibe Description": "desvibeemoji" || "Not found: N/A",
      "Sound Description": "dessonido" || "Not found: N/A",
      "Sound Notes": "descomentario" || "Not found: N/A",
      "Sound Status Code": "codestadosonido" || "Not found: N/A",
      //"Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },
    "TikTok Accounts": {
      "TikTok Username": "codcuenta" || "Not found: N/A",
      "Account Type Code": "codtipocuenta" || "Not found: N/A",
      "Account Status Code": "codestadocuenta" || "Not found: N/A",
      "Telephone code": "codtelefono" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "User - Role": {
      "User Code": "codusuario" || "Not found: N/A",
      "Given name": "nbusuario" || "Not found: N/A",
      "Paternal surname": "apepatusuario" || "Not found: N/A",
      "Maternal surname": "apematusuario" || "Not found: N/A",
      "User Role": "tiprol" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },
    "App - Role Module": {
      "User Role": "tiprol" || "Not found: N/A",
      "App Module": "codmoduloapp" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Post type Elements": {
      "Publication Type": "tippublicacion" || "Not found: N/A",
      "Image-Video Type": "tipimagenvideo" || "Not found: N/A",
      "Assigment-Level Type": "tipnivelasignacion" || "Not found: N/A",
      "Active?": "flvigente" || "Not found: N/A",

      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Book - Telephone - Account": {
      "Book Code": "codlibro" || "Not found: N/A",
      "Telephone Code": "codtelefono" || "Not found: N/A",
      "Account Code": "codcuenta" || "Not found: N/A",
      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Book - Hashtag": {
      "Book Code": "codlibro" || "Not found: N/A",
      "Hashtag Code": "codhashtag" || "Not found: N/A",
      "Hashtag Description": "deshashtag" || "Not found: N/A",

      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Order Parameters": {
      "Parameter Code": "codparametro" || "Not found: N/A",
      "Parameter Description": "desparametro" || "Not found: N/A",
      "Numeric Parameter Value": "numvalorparametro" || "Not found: N/A",
      "Text Parameter Value": "textvalorparametro" || "Not found: N/A",
      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Scene - Image - Video": {
      "Scene Code (no version)": "codescenasinversion" || "Not found: N/A",
      "Version Number": "numversion" || "Not found: N/A",
      "Image-Video Type": "tipimagenvideo" || "Not found: N/A",
      "Image-Video Code": "codimagenvideo" || "Not found: N/A",
      "Image-Video URL": "urlimagenvideo" || "Not Found: N/A",
      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "Book - Image - Video": {
      "Book Code": "codlibro" || "Not found: N/A",
      "Publication Type": "tippublicacion" || "Not found: N/A",
      "Image-Video Type": "tipimagenvideo" || "Not found: N/A",
      "Image-Video Code": "codimagenvideo" || "Not found: N/A",
      "Image-Video URL": "urlimagenvideo" || "Not Found: N/A",
      "Priority Flag": "flgprioridad" || "Not Found: N/A",
      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },
    Telephone: {
      "Telephone Code": "codtelefono" || "Not Found: N/A",
      "Telephone Type": "tiptelefono" || "Not Found: N/A",
      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },

    "PA - Telephone": {
      "PA Code": "codposteador" || "Not Found: N/A",
      "Telephone Code": "codtelefono" || "Not Found: N/A",
      "Active?": "flvigente" || "Not found: N/A",
      "Audit User": "codusuarioauditoria" || "Not found: N/A",
      "Creation Date": "fecreacionregistro" || "Not found: N/A",
      "Creation Hour": "horacreacionregistro" || "Not found: N/A",
      "Actualization Date": "fecactualizacionregistro" || "Not found: N/A",
      "Actualization Hour": "horaactualizacionregistro" || "Not found: N/A",
    },
  };

  const categoryLabels = {
    "Post meta PA": "Post Meta - PA",
    "Post meta Author": "Post Meta - Author",
    "Post meta Book": "Post Meta - Book",
    "Scene name": "Scene Names",
    "Type post": "Post Types ",
    Publisher: "Publisher Details",
    Authors: "Authors Catalog",
    Books: "Books Catalog",
    "Scene - Text": "Scene - Text",
    "Sound - Genre": "Sound - Genre",
    Sounds: "Sounds",
    "TikTok Accounts": "TikTok Accounts",
    "User - Role": "User - Role",
    "App - Role Module": "App - Role Module",
    "Post type Elements": "Post type Elements",
    "Book - Telephone - Account": "Book - Telephone - Account",
    "Book - Hashtag": "Book - Hashtag",
    "Order Parameters": "Order Parameters",
    "Scene - Image - Video": "Scene - Image - Video",
    "Book - Image - Video": "Book - Image - Video",
    Telephone: "Telephone",
    "PA - Telephone": "PA - Telephone",
  };
  const isInitialView =
    isHydrated &&
    !dataLoaded &&
    !isLoading &&
    !isLoadingImportExcel &&
    !isLoadingExcel &&
    records.length === 0 &&
    !selectedCategory;

  const getBearerToken = async () => {
    // 1) Si ya existe en contexto, úsalo
    if (jwt) return jwt;

    // 2) Si no existe, intenta refrescarlo (silent)
    const nuevo = await refreshJwt();
    return nuevo || null;
  };

  const handleExportToExcel = async () => {
    // Evita doble export
    if (isLoadingExcel) return;
    if (dmExportToastKey) {
      try {
        localStorage.removeItem(dmExportToastKey);
      } catch (_) {}
    }

    // Si el módulo se desmontó y volvió, puede existir key en localStorage
    if (dmExcelKey) {
      try {
        const raw = localStorage.getItem(dmExcelKey);
        if (raw) {
          const saved = JSON.parse(raw);
          const startedAt = Number(saved?.startedAt || 0);

          if (
            saved?.inProgress &&
            (!startedAt || Date.now() - startedAt <= EXCEL_DOWNLOAD_TTL_MS)
          ) {
            setIsLoadingExcel(true);
            return;
          }

          // expirado/ inválido
          localStorage.removeItem(dmExcelKey);
        }
      } catch (_) {}
    }

    if (!dataLoaded) {
      notify("Action required", "You must select a category first!", "warning");
      return;
    }

    const azureURL = import.meta.env.VITE_AZURE_API_URL;
    const tablaReal = categories[selectedCategory];

    if (!tablaReal) {
      notify(
        "Action required",
        "You must select a valid category first!",
        "warning",
      );
      return;
    }

    try {
      const URL = `${azureURL}/datamaintenance/download?TableName=${encodeURIComponent(
        tablaReal.toLowerCase(),
      )}`;

      const token = await getBearerToken();
      if (!token) {
        notify("Authentication required", "Please sign in again.", "error");
        setIsLoadingExcel(false);
        if (dmExcelKey) {
          try {
            localStorage.removeItem(dmExcelKey);
          } catch (_) {}
        }
        return;
      }

      if (dmExcelKey) {
        try {
          localStorage.setItem(
            dmExcelKey,
            JSON.stringify({ inProgress: true, startedAt: Date.now() }),
          );
        } catch (_) {}
      }

      setIsLoadingExcel(true);

      const response = await fetch(URL, {
        method: "GET",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

          Authorization: `Bearer ${token}`,
        },

        mode: "cors",
      });

      if (!response.ok) {
        console.error(
          "❌ Error in server response (DataMaintenance - handleExportExcel):",
        );
        throw new Error(
          "❌ Error downloading the Excel file (DataMaintenance - handleExportExcel)",
        );
      }

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

      const fileName = `Maestras_tiktok_${selectedCategory}_${timestamp}.xlsx`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      // Si el usuario se fue de módulo, persiste el toast para mostrarlo al volver
      if (!isMountedRef.current && dmExportToastKey) {
        try {
          localStorage.setItem(
            dmExportToastKey,
            JSON.stringify({
              toast: {
                title: "Success",
                message: "Excel file exported successfully.",
                type: "success",
              },
              at: Date.now(),
            }),
          );
        } catch (_) {}
      }

      notify("Success", "Excel file exported successfully.", "success");

      /*console.log(
        "✅ Excel File exported with success (DataMaintenance - handleExportExcel): " +
          fileName
      );*/
    } catch (error) {
      console.error(
        "❌ Error downloading the Excel File (DataMaintenance - handleExportExcel):",
        error,
      );

      addDataMaintenanceAlert({
        title: "Excel export failed",
        category: selectedCategory,
        tableName: tablaReal,
        action: "Export Excel",
        errorMessage:
          error?.message ||
          "We couldn’t download the Excel file. If it persists, please try again or refresh the page.",
        status: "error",
      });

      notify(
        "Download failed",
        "We couldn’t download the Excel file.",
        "error",
      );

      if (!isMountedRef.current && dmExportToastKey) {
        try {
          localStorage.setItem(
            dmExportToastKey,
            JSON.stringify({
              toast: {
                title: "Download failed",
                message:
                  "We couldn’t download the Excel file. If it persists, please try again or refresh the page.",
                type: "error",
              },
              at: Date.now(),
            }),
          );
        } catch (_) {}
      }
    } finally {
      setIsLoadingExcel(false);
      if (dmExcelKey) {
        try {
          localStorage.removeItem(dmExcelKey);
        } catch (_) {}
      }
    }
  };

  const SelectTable = (TableName) => {
    if (isLoading || isLoadingExcel || isLoadingImportExcel) return;

    setSelectedCategory(TableName);

    switch (TableName) {
      case "Authors":
        handleShowDbRecords(categories["Authors"], Tables["Authors"]);
        break;
      case "Books":
        handleShowDbRecords(categories["Books"], Tables["Books"]);
        break;
      case "Scene name":
        handleShowDbRecords(categories["Scene name"], Tables["Scene name"]);
        break;
      case "Type post":
        handleShowDbRecords(categories["Type post"], Tables["Type post"]);
        break;
      case "Publisher":
        handleShowDbRecords(categories["Publisher"], Tables["Publisher"]);
        break;
      case "Post meta PA":
        handleShowDbRecords(categories["Post meta PA"], Tables["Post meta PA"]);
        break;
      case "Post meta Author":
        handleShowDbRecords(
          categories["Post meta Author"],
          Tables["Post meta Author"],
        );
        break;
      case "Post meta Book":
        handleShowDbRecords(
          categories["Post meta Book"],
          Tables["Post meta Book"],
        );
        break;
      case "Scene - Text":
        handleShowDbRecords(categories["Scene - Text"], Tables["Scene - Text"]);
        break;
      case "Sound - Genre":
        handleShowDbRecords(
          categories["Sound - Genre"],
          Tables["Sound - Genre"],
        );
        break;
      case "Sounds":
        handleShowDbRecords(categories["Sounds"], Tables["Sounds"]);
        break;
      case "TikTok Accounts":
        handleShowDbRecords(
          categories["TikTok Accounts"],
          Tables["TikTok Accounts"],
        );
        break;
      case "User - Role":
        handleShowDbRecords(categories["User - Role"], Tables["User - Role"]);
        break;
      case "App - Role Module":
        handleShowDbRecords(
          categories["App - Role Module"],
          Tables["App - Role Module"],
        );
        break;
      case "Post type Elements":
        handleShowDbRecords(
          categories["Post type Elements"],
          Tables["Post type Elements"],
        );
        break;

      case "Book - Telephone - Account":
        handleShowDbRecords(
          categories["Book - Telephone - Account"],
          Tables["Book - Telephone - Account"],
        );
        break;

      case "Book - Hashtag":
        handleShowDbRecords(
          categories["Book - Hashtag"],
          Tables["Book - Hashtag"],
        );
        break;

      case "Order Parameters":
        handleShowDbRecords(
          categories["Order Parameters"],
          Tables["Order Parameters"],
        );
        break;

      case "Scene - Image - Video":
        handleShowDbRecords(
          categories["Scene - Image - Video"],
          Tables["Scene - Image - Video"],
        );
        break;

      case "Book - Image - Video":
        handleShowDbRecords(
          categories["Book - Image - Video"],
          Tables["Book - Image - Video"],
        );
        break;

      case "Telephone":
        handleShowDbRecords(categories["Telephone"], Tables["Telephone"]);
        break;

      case "PA - Telephone":
        handleShowDbRecords(
          categories["PA - Telephone"],
          Tables["PA - Telephone"],
        );
        break;
      default:
        console.warn(
          "⚠️ Invalid table selected (DataMaintenance - SelectTable)",
        );
    }
  };

  const handleShowDbRecords = async (tableName, RendererTable) => {
    if (!tableName || isLoading) return;
    setLog([]);

    setIsLoading(true);
    setRecords([]);
    setDataLoaded(false);

    try {
      const startTime = new Date();

      const azureURL = import.meta.env.VITE_AZURE_API_URL;

      const token = await getBearerToken();
      if (!token) {
        notify("Authentication required", "Please sign in again.", "error");
        setIsLoading(false);
        return;
      }
      const response = await fetch(azureURL + "/datamaintenance/tablerecords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          TableName: tableName.toLowerCase(),
        }),
      });

      if (!response.ok) {
        console.error(
          "❌ Error in server response (DataMaintenance - handleShowDbRecords):",
        );
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();

      const filteredData = data.map((record) => {
        let transformedRecord = {};
        Object.keys(RendererTable).forEach((key) => {
          if (record.hasOwnProperty(RendererTable[key])) {
            transformedRecord[key] = record[RendererTable[key]];
          } else {
            console.warn(
              `Field "${RendererTable[key]}" not found on record (DataMaintenance - handleShowRecords)`,
              record,
            );
            transformedRecord[key] = "Not found: N/A";
          }
        });
        return transformedRecord;
      });

      setRecords(filteredData);

      const processedRecords =
        data?.length > 0 && data?.[0]?.count != null
          ? Number(data[0].count)
          : data.length;
      if (data.length > 0) {
        setLog((prev) => [
          ...prev,
          `✅ Request completed successfully. Retrieved ${processedRecords} record(s). You may now export or import updates`,
        ]);
      } else {
        setLog((prevLog) => [
          ...prevLog,
          `❌ Execution not completed. No data available`,
        ]);
      }

      const endTime = new Date();
      const durationInSeconds = Math.floor((endTime - startTime) / 1000);
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      setLog((prevLog) => [
        ...prevLog,
        `⏳ Total function execution time: ${formattedTime} minutes`,
      ]);

      setDataLoaded(true);
    } catch (error) {
      console.error(
        "❌ Error extracting information from DB (DataMaintenance - handleShowDbRecords): ",
        error,
      );

      addDataMaintenanceAlert({
        title: "Table records request failed",
        category: selectedCategory,
        tableName,
        action: "Load table records",
        errorMessage: error?.message || "Error extracting information from DB",
        status: "error",
      });

      notify("Request failed", "Error extracting information from DB", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      SetFile(selectedFile);
      handleImportExcel(selectedFile);
      event.target.value = "";
    }
  };

  const handleImportExcel = async (file) => {
    // Evita doble import
    if (isLoadingImportExcel) return;
    // 🔒 Evita que al volver al módulo se consuman resultados viejos de un import anterior
    if (dmImportRefreshKey) {
      try {
        localStorage.removeItem(dmImportRefreshKey);
      } catch (_) {}
    }

    // Si el módulo se desmontó y volvió, puede existir key en localStorage
    if (dmImportKey) {
      try {
        const raw = localStorage.getItem(dmImportKey);
        if (raw) {
          const saved = JSON.parse(raw);
          const startedAt = Number(saved?.startedAt || 0);

          if (
            saved?.inProgress &&
            (!startedAt || Date.now() - startedAt <= EXCEL_IMPORT_TTL_MS)
          ) {
            setIsLoadingImportExcel(true);
            return;
          }

          // expirado/ inválido
          localStorage.removeItem(dmImportKey);
        }
      } catch (_) {}
    }

    if (!file) {
      notify(
        "Action required",
        "You must import an Excel file first!",
        "warning",
      );
      return;
    }
    //setLog([]);
    setIsLoadingImportExcel(true);
    //setDataLoaded(false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    try {
      const startTime = new Date();

      const azureURL = import.meta.env.VITE_AZURE_API_URL;
      const token = await getBearerToken();
      if (!token) {
        notify("Authentication required", "Please sign in again.", "error");
        setIsLoadingImportExcel(false);
        if (dmImportKey) {
          try {
            localStorage.removeItem(dmImportKey);
          } catch (_) {}
        }
        return;
      }

      if (dmImportKey) {
        try {
          localStorage.setItem(
            dmImportKey,
            JSON.stringify({
              inProgress: true,
              startedAt: Date.now(),
              fileName: file?.name || null,
            }),
          );
        } catch (_) {}
      }

      const response = await fetch(azureURL + "/datamaintenance/uploadexcel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        mode: "cors",
      });

      if (!response.ok) {
        const backendError = await extractBackendErrorMessage(response);
        const fileName = file?.name || "Unknown file";

        console.error(
          `Server responded with status (DataMaintenance - handleImportExcel) ${response.status}`,
          backendError,
        );

        addDataMaintenanceAlert({
          title: "Excel import failed",
          category: selectedCategory,
          tableName: selectedCategory ? categories[selectedCategory] : null,
          action: "Import Excel",
          errorMessage: backendError,
          status: "error",
        });

        const entries = [
          `❌ Execution not completed. Attempted to import Excel: ${fileName}`,
          `📊 Saved records in the Database Process: 0`,
        ];

        if (dmImportRefreshKey) {
          try {
            localStorage.setItem(
              dmImportRefreshKey,
              JSON.stringify({
                entries,
                toast: isMountedRef.current
                  ? null
                  : {
                      title: "Import failed",
                      message: "Error importing Excel file.",
                      type: "error",
                    },
                at: Date.now(),
              }),
            );
          } catch (_) {}
        }

        if (isMountedRef.current) {
          setLog(entries);
          setDataLoaded(true);
        }

        notify("Import failed", "Error importing Excel file.", "error");
        SetFile(null);
        return;
      }

      const data = await response.json();
      const fileName = file.name;

      const backendError = data?.message || data?.error;
      if (backendError) {
        // 1) log entries
        const entries = [
          `❌ Import failed. File: ${fileName}`,
          `${backendError}`,
        ];

        // 2) persist resultado para cuando vuelvas al módulo
        if (dmImportRefreshKey) {
          try {
            localStorage.setItem(
              dmImportRefreshKey,
              JSON.stringify({
                entries,
                toast: isMountedRef.current
                  ? null
                  : {
                      title: "Import failed",
                      message: backendError,
                      type: "error",
                    },
                at: Date.now(),
              }),
            );
          } catch (_) {}
        }

        // 3) setState si está montado
        if (isMountedRef.current) {
          setLog(entries);
          setDataLoaded(true);
        }

        // 4) notify con el error real
        addDataMaintenanceAlert({
          title: "Excel import failed",
          category: selectedCategory,
          tableName: selectedCategory ? categories[selectedCategory] : null,
          action: "Import Excel",
          errorMessage: backendError,
          status: "error",
        });

        // 4) popup simple, el detalle real queda en la campanita
        notify("Import failed", "Error importing Excel file.", "error");

        // 5) limpiar file y salir
        SetFile(null);
        return;
      }

      /*console.log("API Response (DataMaintenance - handleImportExcel):", data);*/
      const processedRecords = data["message"] || 0;

      const entries =
        Object.keys(data).length === 0
          ? [
              `❌ Execution not completed. Attempted to import Excel: ${fileName}`,
              `📊 Saved records in the Database Process: ${processedRecords}`,
            ]
          : [
              `✅ Data imported from file: ${fileName}`,
              `📊 Saved records in the Database Process: ${processedRecords}`,
            ];

      // ✅ Guarda SIEMPRE el resultado del import para poder mostrarlo al volver (aunque navegues)
      if (dmImportRefreshKey) {
        try {
          // ✅ Toast que queremos mostrar (si el import terminó fuera del módulo)
          const toastToPersist =
            Object.keys(data).length === 0
              ? {
                  title: "Import failed",
                  message: "Error importing Excel file",
                  type: "error",
                }
              : {
                  title: "Success",
                  message: "Excel file imported successfully.",
                  type: "success",
                };

          if (dmImportRefreshKey) {
            try {
              localStorage.setItem(
                dmImportRefreshKey,
                JSON.stringify({
                  entries,
                  // ✅ Solo guardar toast si el import terminó cuando el componente NO estaba montado
                  toast: isMountedRef.current ? null : toastToPersist,
                  at: Date.now(),
                }),
              );
            } catch (_) {}
          }
        } catch (_) {}
      }

      // Si el componente sigue montado, muestra inmediatamente.
      // Si NO, no hagas setState (evitas warnings) y al volver se consumirá del localStorage.
      if (isMountedRef.current) {
        setLog(entries);
        setDataLoaded(true);
      }

      SetFile(null);

      // Si el usuario cambió de módulo y este componente ya no está montado,
      // guarda el resultado para que al volver se muestre en el monitor.

      /*const endTime = new Date();
      const durationInSeconds = Math.floor((endTime - startTime) / 1000);
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      setLog((prevLog) => [
        ...prevLog,
        `⏳ Total function execution time: ${formattedTime} minutes`,
      ]);
*/

      if (Object.keys(data).length === 0) {
        addDataMaintenanceAlert({
          title: "Excel import failed",
          category: selectedCategory,
          tableName: selectedCategory ? categories[selectedCategory] : null,
          action: "Import Excel",
          errorMessage: error?.message || "Error at importing Excel file.",
          status: "error",
        });
        console.error(
          "❌ Error at importing Excel file (DataMaintenance - handleImportExcel)",
        );
      } else {
        notify("Success", "Excel file imported successfully.", "success");
        /*console.log(
          "✅ Excel file imported with success (DataMaintenance - handleImportExcel): " +
            fileName
        );*/
      }
    } catch (error) {
      console.error(
        "❌ Error at importing Excel file (DataMaintenance - handleImportExcel): ",
        error,
      );
      const fileName = file.name;
      if (dmImportRefreshKey) {
        try {
          localStorage.setItem(
            dmImportRefreshKey,
            JSON.stringify({
              entries: [
                `❌ Execution not completed. Attempted to import Excel: ${fileName}`,

                `📊 Saved records in the Database Process: 0`,
              ],
              at: Date.now(),
            }),
          );
        } catch (_) {}
      }
      if (isMountedRef.current) {
        setLog((prev) => [
          ...(prev || []),
          `❌ Execution not completed. Attempted to import Excel: ${fileName}`,

          `📊 Saved records in the Database Process: 0`,
        ]);
        setDataLoaded(true);
      }

      addDataMaintenanceAlert({
        title: "Excel import failed",
        category: selectedCategory,
        tableName: selectedCategory ? categories[selectedCategory] : null,
        action: "Import Excel",
        errorMessage: error?.message || "Error at importing Excel file.",
        status: "error",
      });
      notify("Import failed", "Error at importing Excel file.", "error");
    } finally {
      setIsLoadingImportExcel(false);
      if (dmImportKey) {
        try {
          localStorage.removeItem(dmImportKey);
        } catch (_) {}
      }
    }
  };

  // ===== UI TOKENS (solo estilo) =====
  const chipBase =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ring-1";
  const chipIdle = "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50";
  const chipActive =
    "bg-slate-900 text-white ring-slate-900 hover:bg-slate-800";
  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50";
  const btnSuccess =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/20 transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";

  const stripLeadingLogEmoji = (s = "") =>
    s
      .trimStart()
      .replace(/^(\s*(?:✅|☑️|❌|⚠️|⏳|📊|📡|🔎|🧠|🚀)\s*)+/u, "")
      .trim();

  useLayoutEffect(() => {
    if (!selectedCategory) return;

    const foundGroup = GROUP_ORDER.find((g) =>
      (CATEGORY_GROUPS[g] || []).includes(selectedCategory),
    );

    if (!foundGroup) return;

    if (foundGroup !== selectedGroup) {
      setSelectedGroup(foundGroup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // ===== Carousel (4 buttons) logic =====
  const groupKeys = (CATEGORY_GROUPS[selectedGroup] || []).filter(
    (k) => categories[k],
  );

  const top4CategoryKeys = groupKeys.slice(0, 5);
  const restCategoryKeys = groupKeys.slice(5);

  return (
    <div className="space-y-6">
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

      {notifOpen &&
        createPortal(
          <div
            ref={notifDropdownRef}
            className="fixed z-[9999] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: `${notifPos.width}px`,
              maxHeight: `${notifPos.maxHeight}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Notifications
                </p>
                <p className="text-xs text-slate-500">
                  Data maintenance error alerts
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100 active:bg-red-200"
                  title="Clear notifications"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={closeNotifications}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-3 space-y-3"
              style={{ maxHeight: `${notifPos.maxHeight}px` }}
            >
              {dataMaintenanceAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    No pending notifications
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Data maintenance error details will appear here
                  </p>
                </div>
              ) : (
                dataMaintenanceAlerts.map((alert, index) => {
                  const isError = alert.status === "error";
                  const isWarning = alert.status === "warning";

                  return (
                    <div
                      key={alert.id ?? `${alert.createdAt ?? "alert"}-${index}`}
                      className={[
                        "rounded-2xl border p-4 shadow-sm",
                        isError
                          ? "border-red-200 bg-red-50/80"
                          : isWarning
                            ? "border-amber-200 bg-amber-50/80"
                            : "border-slate-200 bg-slate-50/80",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={[
                              "text-sm font-bold",
                              isError
                                ? "text-red-900"
                                : isWarning
                                  ? "text-amber-900"
                                  : "text-slate-900",
                            ].join(" ")}
                          >
                            {alert.title ?? "Data maintenance result"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Date: {formatAlertDate(alert.createdAt)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Time: {formatAlertTime(alert.createdAt)}
                          </p>
                        </div>

                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                            isError
                              ? "bg-red-600 text-white"
                              : isWarning
                                ? "bg-amber-500 text-white"
                                : "bg-slate-900 text-white",
                          ].join(" ")}
                        >
                          #{index + 1}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <div className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Action
                          </p>
                          <p className="mt-0.5 text-sm font-bold leading-none text-slate-900">
                            {alert.action ?? "N/A"}
                          </p>
                        </div>

                        <div className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Category
                          </p>
                          <p className="mt-0.5 text-sm font-bold leading-none text-slate-900">
                            {alert.category ?? "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Error log
                        </p>

                        <div className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                            {alert.errorMessage?.trim()
                              ? alert.errorMessage
                              : "No error log"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Categories */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-4 lg:col-span-8 self-stretch flex flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 shadow-sm">
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
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Categories
                </h2>
                <p className="text-xs text-slate-500">
                  Select a master table to load its current records
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                ref={notifButtonRef}
                type="button"
                onClick={toggleNotifications}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                title="Notifications"
              >
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
                    d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0"
                  />
                </svg>

                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                    {notifCount}
                  </span>
                )}
              </button>

              {groupSteps.map((step, idx) => {
                const active = selectedGroup === step.key;

                const activeIdx = groupSteps.findIndex(
                  (s) => s.key === selectedGroup,
                );
                const done = idx < activeIdx;

                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => {
                      setSelectedGroup(step.key);
                      playSound();
                    }}
                    className={[
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                      active
                        ? "bg-slate-900 text-white ring-slate-900/10"
                        : done
                          ? "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
                          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                    aria-current={active ? "step" : undefined}
                    disabled={
                      isLoading || isLoadingExcel || isLoadingImportExcel
                    }
                    title={step.title}
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
                      {idx + 1}
                    </span>

                    <span className="whitespace-nowrap">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* El wrapper ahora “rellena” para que el card mantenga altura pareja */}
          <div className="flex-1 flex">
            <div
              className={`w-full rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm flex flex-col items-center transition-npne
  ${isInitialView ? "pt-6.5" : "pt-3"}`}
            >
              <div className="w-full">
                {/* Carousel row: prev / buttons / next */}
                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Fila superior: flecha - top4 - flecha */}
                  <div className="flex items-center justify-center gap-3 ">
                    {/* 4 buttons visible */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {top4CategoryKeys.map((categoryKey) => {
                        const isActive = selectedCategory === categoryKey;
                        return (
                          <button
                            key={categoryKey}
                            className={`${chipBase} ${isActive ? chipActive : chipIdle}`}
                            onClick={() => {
                              SelectTable(categoryKey);
                              playSound();
                            }}
                            disabled={
                              isLoading ||
                              isLoadingExcel ||
                              isLoadingImportExcel
                            }
                            title={categoryKey}
                          >
                            {categoryLabels[categoryKey] || categoryKey}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Debajo: resto de botones */}
                  {restCategoryKeys.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {restCategoryKeys.map((categoryKey) => {
                        const isActive = selectedCategory === categoryKey;
                        return (
                          <button
                            key={categoryKey}
                            className={`${chipBase} ${isActive ? chipActive : chipIdle}`}
                            onClick={() => {
                              SelectTable(categoryKey);
                              playSound();
                            }}
                            disabled={
                              isLoading ||
                              isLoadingExcel ||
                              isLoadingImportExcel
                            }
                            title={categoryKey}
                          >
                            {categoryLabels[categoryKey] || categoryKey}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick steps (visual only) */}
              <div className="mt-3 w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-700">
                  {/* Step 1 */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      1
                    </span>
                    <span>Select Category</span>
                  </div>

                  <span className="hidden sm:inline-block h-px w-8 bg-slate-200" />

                  {/* Step 2 */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                      2
                    </span>
                    <span>Import Excel</span>
                  </div>

                  <span className="hidden sm:inline-block h-px w-8 bg-slate-200" />

                  {/* Step 3 */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                      3
                    </span>
                    <span>Export Excel</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Monitor */}
        <aside className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6 lg:col-span-4 self-stretch flex flex-col">
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

          {/* ✅ Este wrapper hace que el “cuerpo” del monitor siempre ocupe el mismo alto */}
          <div className="flex-1 flex">
            {isLoading ? (
              <div className="flex w-full min-h-[180px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/60 p-6 text-center shadow-sm">
                <div className="relative">
                  <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

                  <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-red-600/15" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">
                  Processing...
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Please keep this tab open until completion
                </p>
              </div>
            ) : !isHydrated ? (
              <div className="flex w-full min-h-[180px] rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70" />
            ) : !dataLoaded ? (
              <div className="flex w-full min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70 p-6 text-center">
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
                <h2 className="text-sm font-bold text-slate-900">
                  No logs yet
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Select a category to Import or Export an Excel file
                </p>
              </div>
            ) : (
              <div className="w-full max-h-[340px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white/60 p-4">
                {log.map((entry, index) => {
                  const isOk = entry.includes("✅");
                  const isErr = entry.includes("❌");
                  const isWarn = entry.includes("⚠️");
                  const isChart = entry.includes("📊");
                  const isTime = entry.includes("⏳");

                  const badgeClass = isOk
                    ? "bg-emerald-100 text-emerald-700"
                    : isErr
                      ? "bg-red-100 text-red-700"
                      : isWarn || isTime
                        ? "bg-indigo-100 text-indigo-700"
                        : isChart
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-indigo-100 text-indigo-700";

                  const badgeChar = isOk
                    ? "✓"
                    : isErr
                      ? "×"
                      : isWarn
                        ? "!"
                        : isChart
                          ? "📊"
                          : isTime
                            ? "⏳"
                            : "i";

                  const message = stripLeadingLogEmoji(entry);

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

                      {/* IMPORTANTE: ya NO renders entry, sino message */}
                      <span className="flex-1 leading-relaxed">{message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Data table */}
      <section className="w-full overflow-hidden rounded-2xl bg-white shadow-md border border-slate-200">
        {records.length > 0 && selectedCategory && Tables[selectedCategory] ? (
          <div className="w-full overflow-x-auto ">
            <table className="min-w-[980px] w-full text-sm  ">
              <thead className="bg-slate-900 text-white">
                <tr>
                  {Object.keys(Tables[selectedCategory]).map((header) => (
                    <th
                      key={header}
                      className={`px-4 py-3 font-semibold whitespace-nowrap 
                         "text-center" 
                       ${header === "Text Description" ? "min-w-[250px]" : ""}`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {records.slice(0, 20).map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    {Object.keys(Tables[selectedCategory]).map((field, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3 ${
                          field === "Text Description"
                            ? "text-left align-top"
                            : "whitespace-nowrap text-center"
                        }`}
                      >
                        {(() => {
                          const valor =
                            row[field] === null
                              ? "null"
                              : row[field] !== undefined
                                ? row[field]
                                : "Not found: N/A";

                          if (
                            field === "Scene Name" ||
                            field === "Trope Description" ||
                            field === "Slide 1 hidden keyword" ||
                            field === "Slide 2 hidden keyword"
                          ) {
                            const texto =
                              typeof valor === "string" ? valor : String(valor);
                            return (
                              <span
                                className="block max-w-[400px] truncate"
                                title={texto}
                              >
                                {texto}
                              </span>
                            );
                          }

                          if (
                            field === "Parameter Description" ||
                            field === "Hashtag Description" ||
                            field === "Image-Video URL" ||
                            field === "Sound URL"
                          ) {
                            const texto =
                              typeof valor === "string" ? valor : String(valor);
                            return (
                              <span
                                className="block max-w-[550px] truncate"
                                title={texto}
                              >
                                {texto}
                              </span>
                            );
                          }

                          if (field !== "Text Description") return valor;

                          const texto =
                            typeof valor === "string" ? valor : String(valor);

                          return (
                            <div
                              style={{
                                whiteSpace: "pre-line", // respeta \n (saltos de línea)
                                wordBreak: "break-word", // evita que reviente por palabras largas
                                maxWidth: "1100px", // ajusta si quieres
                                display: "-webkit-box", // clamp multi-línea
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2, // 3 líneas (cambia a 4 si quieres)
                                overflow: "hidden", // oculta el resto
                              }}
                              title={texto} // hover para ver completo
                            >
                              {formatearDescripcionTexto(texto)}
                            </div>
                          );
                        })()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-10">
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-slate-900">
                No Data Found
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                We couldn&apos;t find any data to display.
              </p>
            </div>
          </div>
        )}

        {((dataLoaded && selectedCategory) ||
          isLoadingExcel ||
          isLoadingImportExcel) && (
          <div className="border-t border-slate-200 bg-white px-6 py-5">
            <div className="flex flex-wrap justify-center gap-3">
              <button
                className={btnSuccess}
                onClick={() => {
                  playSound();
                  handleExportToExcel();
                }}
              >
                Export to Excel
              </button>

              <label className={`${btnPrimary} cursor-pointer`}>
                Import Excel
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={(event) => {
                    playSound();
                    handleFileChange(event);
                  }}
                  disabled={isLoadingImportExcel}
                />
              </label>
            </div>
          </div>
        )}
      </section>

      {(isLoadingExcel || isLoadingImportExcel) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* overlay (NO clickeable, no se cierra) */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/20 to-slate-900/10 backdrop-blur-[2px]" />

          {/* dialog */}
          <div className="relative w-[360px] max-w-[100vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

            <div className="p-7 text-center">
              {/* spinner ROJO (idéntico a APICall / DB Queries) */}
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

export default DataMaintenance;
