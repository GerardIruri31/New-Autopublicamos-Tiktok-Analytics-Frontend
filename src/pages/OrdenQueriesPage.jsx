import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { downloadOrderQueriesService } from "../services/order-queries/DownloadOrderQueriesService";
import FiltersShell from "../components/generacionOrden/FiltersShell";
import SelectField from "../components/generacionOrden/SelectField";
import OrderDetailsModal from "../components/generacionOrden/OrderDetailsModal";
import NoDataFound from "../components/generacionOrden/NoDataFound";
import OrdenGenerationTable from "../components/generacionOrden/OrdenGenerationTable";
import NotificationToast from "../components/common/NotificationToast";
import { deleteOrderService } from "../services/order-queries/DeleteOrderService";

import { AuthUserContext } from "../context/AuthUserContext";
import { useOrderQueriesFilters } from "../hooks/useOrderQueriesFilters";

export default function OrderQueries() {
  const { jwt, role, userEmail } = useContext(AuthUserContext);

  const [toast, setToast] = useState(null);
  const [loadingDownload, setLoadingDownload] = useState(false);

  const isPaUser =
    String(role || "")
      .trim()
      .toLowerCase() === "pa";

  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const tomorrowDate = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateLocal(tomorrow);
  })();

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

  const notify = (title, message, type = "info") => {
    setToast({ title, message, type });
  };

  const {
    filters,
    requestPayload,
    catalog,
    editCatalog,
    editFilters,
    loadingCatalog,
    loadingSearch,
    ordersRows,
    ordersColumns,
    dataLoaded,
    actions,
    filterStep,
    setFilterStep,
    selectedOrder,
    detailsOpen,
    isEditing,
    draftOrder,
    requiredImageVideoFields,
    notifOpen,
    generationAlerts,
  } = useOrderQueriesFilters({ token: jwt, notifySearchValidation: notify });

  const handleRowClick = (row) => {
    actions.openDetails(row);
  };

  const handleCloseDetails = () => {
    if (isEditing) {
      openConfirm({
        title: "Unsaved changes",
        message:
          "Are you sure you want to leave this order without saving it first?",
        confirmText: "Exit",
        danger: true,
        onConfirm: () => actions.closeDetails(),
      });
      return;
    }

    actions.closeDetails();
  };

  const handleDownload = async () => {
    if (!ordersRows || ordersRows.length === 0) {
      notify("No data", "There is no data available to download.", "warning");
      return;
    }

    setLoadingDownload(true);

    try {
      await downloadOrderQueriesService({
        token: jwt,
        request: requestPayload,
      });

      notify(
        "Download completed",
        "The Excel file was downloaded successfully.",
        "success",
      );
    } catch (error) {
      console.error("Order queries download failed:", error);
      notify(
        "Download failed",
        error?.message || "Error downloading Order Queries Excel.",
        "error",
      );
    } finally {
      setLoadingDownload(false);
    }
  };

  const statusOptions = [
    { value: 1, label: "Assigned" },
    { value: 2, label: "Flagged" },
    { value: 3, label: "-100 Views" },
    { value: 4, label: "Posted" },
    { value: 5, label: "Drafted" },
    { value: 6, label: "Deleted" },
  ];

  const btnClear =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white " +
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 " +
    "ring-1 ring-rose-600/20";

  const iconWrap =
    "h-5 w-5 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  const inputClass = [
    "w-full rounded-xl bg-white/60 px-4 py-1.5",
    "text-sm text-slate-900 shadow-sm ring-1 ring-slate-200",
    "focus:outline-none focus:ring-2 focus:ring-slate-900/10",
  ].join(" ");

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

  const btnDanger =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white " +
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 " +
    "ring-1 ring-rose-500/20";

  const steps = [
    {
      key: "group1",
      title: "Core Filters",
      desc: "PA, book, status and flags",
    },
    {
      key: "group2",
      title: "Meta Filters",
      desc: "Sound, TikTok user, creator and dates",
    },
  ];

  const notifButtonRef = useRef(null);
  const notifDropdownRef = useRef(null);

  const [notifPos, setNotifPos] = useState({
    top: -9999,
    left: -9999,
    width: 360,
    maxHeight: 260,
  });

  const notifCount = generationAlerts.length;

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

      actions.closeNotifications();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notifOpen, actions]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const LabelWithIcon = ({ icon, title }) => (
    <div className="flex items-center gap-2">
      <div className={iconWrap}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 leading-none py-0.5">
          {title}
        </div>
      </div>
    </div>
  );

  const TextField = ({
    label,
    value,
    onChange,
    placeholder,
    disabled = false,
  }) => {
    return (
      <div className="w-full">
        <div className="mb-1.5 mt-0.5">{label}</div>

        <input
          type="text"
          value={value ?? ""}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={[
            inputClass,
            disabled ? "opacity-60 cursor-not-allowed bg-slate-50/60" : "",
          ].join(" ")}
        />
      </div>
    );
  };

  const yesNoOptions = [
    { value: "S", label: "Y" },
    { value: "N", label: "N" },
  ];

  const tipoRegistroOptions = [
    { value: "AUTO", label: "AUTO" },
    { value: "MANUAL", label: "MANUAL" },
  ];

  const StepPill = ({ active, done, idx, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold ring-1 transition",
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

  const StepContent = () => {
    if (filterStep === 0) {
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <SelectField
            label={
              <LabelWithIcon
                title="Publisher (PA)"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M12 12a4 4 0 100-8 4 4 0 000 8z"
                    />
                  </svg>
                }
              />
            }
            value={filters.codPosteador}
            disabled={loadingCatalog || isPaUser}
            options={catalog.posteadores}
            placeholder={
              loadingCatalog ? "Loading..." : "— Select a publisher —"
            }
            onChange={(v) => actions.setCodPosteador(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Telephone(s)"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013 5.18 2 2 0 015 3h3a2 2 0 012 1.72c.12.86.32 1.7.6 2.5a2 2 0 01-.45 2.11L9 10a16 16 0 007 7l.67-.15a2 2 0 012.11.45c.8.28 1.64.48 2.5.6A2 2 0 0122 16.92z"
                    />
                  </svg>
                }
              />
            }
            value={filters.codTelefono ?? null}
            disabled={loadingCatalog || !filters.codPosteador}
            options={catalog.telefonos}
            placeholder={
              !filters.codPosteador
                ? "— Select a publisher first —"
                : "— Select a telephone —"
            }
            dropdownWidthClass="w-[270px]"
            onChange={(v) => actions.setCodTelefono(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Author(s)"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M16 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                }
              />
            }
            value={filters.codAutora}
            disabled={loadingCatalog || !filters.codPosteador}
            options={catalog.autoras}
            placeholder={
              !filters.codPosteador
                ? "— Select a publisher first —"
                : "— Select an author —"
            }
            dropdownWidthClass="w-[270px]"
            onChange={(v) => actions.setCodAutora(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Book(s)"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
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
                }
              />
            }
            value={
              filters.codLibros && filters.codLibros[0]
                ? filters.codLibros[0]
                : null
            }
            disabled={loadingCatalog || !filters.codAutora}
            options={catalog.libros}
            placeholder={
              !filters.codAutora
                ? "— Select an author first —"
                : "— Select a book —"
            }
            dropdownWidthClass="w-[280px]"
            onChange={(v) => actions.setCodLibros(v ? [v] : [])}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Post Type"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
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
                }
              />
            }
            value={filters.codTipoPosteo ?? null}
            disabled={
              loadingCatalog || !(filters.codLibros && filters.codLibros[0])
            }
            options={catalog.tiposPosteo}
            placeholder={
              !(filters.codLibros && filters.codLibros[0])
                ? "— Select a book first —"
                : "— Select a post type —"
            }
            dropdownWidthClass="w-[220px]"
            onChange={(v) => actions.setCodTipoPosteo(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Scene(s)"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 7h16M4 17h16M7 4v16M17 4v16"
                    />
                  </svg>
                }
              />
            }
            value={filters.codEscena ?? null}
            disabled={
              loadingCatalog ||
              !(filters.codLibros && filters.codLibros[0]) ||
              !filters.codTipoPosteo
            }
            options={catalog.escenas}
            placeholder={
              !(filters.codLibros && filters.codLibros[0]) ||
              !filters.codTipoPosteo
                ? "— Select book and post type first —"
                : "— Select a scene —"
            }
            dropdownWidthClass="w-[320px]"
            onChange={(v) => actions.setCodEscena(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Order Status"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4"
                    />
                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  </svg>
                }
              />
            }
            value={filters.codEstadoOrden ?? null}
            disabled={false}
            options={statusOptions}
            placeholder="— Select status —"
            onChange={(v) => actions.setCodEstadoOrden(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Complete Order Flag"
                icon={
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                }
              />
            }
            value={filters.flgOrdenCompleta ?? null}
            disabled={false}
            options={yesNoOptions}
            placeholder="— Select Y/N —"
            onChange={(v) => actions.setFlgOrdenCompleta(v)}
          />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="mt-0.5">
          <div className="mb-1 mt-0.5">
            <LabelWithIcon
              title="Sound code"
              icon={
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 18V5l12-2v13"
                  />
                  <circle cx="6" cy="18" r="3" strokeWidth="2" />
                  <circle cx="18" cy="16" r="3" strokeWidth="2" />
                </svg>
              }
            />
          </div>

          <input
            type="text"
            inputMode="numeric"
            value={filters.codSonido ?? ""}
            placeholder="Enter sound code"
            onChange={(e) =>
              actions.setCodSonido(e.target.value.replace(/\D/g, ""))
            }
            className={inputClass}
          />
        </div>

        <div className="mt-0.5">
          <div className="mb-1 mt-0.5">
            <LabelWithIcon
              title="TikTok Username"
              icon={
                <svg
                  className="pl-1 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 3v12a4 4 0 1 1-4-4"
                  />
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 3c1.5 2.5 3.5 4 6 4"
                  />
                </svg>
              }
            />
          </div>
          <input
            type="text"
            value={filters.codCuentaTiktok ?? ""}
            onChange={(e) => actions.setCodCuentaTiktok(e.target.value)}
            placeholder="Enter TikTok account"
            className={inputClass}
          />
        </div>

        <SelectField
          label={
            <LabelWithIcon
              title="Created By User"
              icon={
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M12 12a4 4 0 100-8 4 4 0 000 8z"
                  />
                </svg>
              }
            />
          }
          value={filters.codusuarioauditoriacreareg ?? null}
          disabled={false}
          options={catalog.usuariosCreacion || []}
          placeholder="— Select a creator user —"
          onChange={(v) => actions.setCodUsuarioAuditoriaCreaReg(v)}
        />

        <SelectField
          label={
            <LabelWithIcon
              title="Order Record Type"
              icon={
                <svg
                  className="h-2.5 w-2.5"
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
              }
            />
          }
          value={filters.tipRegistroOrden ?? null}
          disabled={false}
          options={tipoRegistroOptions}
          placeholder="— Select type —"
          onChange={(v) => actions.setTipRegistroOrden(v)}
        />

        <div className="mt-0.5">
          <div className="mb-1 block">
            <LabelWithIcon
              title="Planned Posting (From)"
              icon={
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              }
            />
          </div>
          <input
            type="date"
            value={filters.fecPlanPosteoFrom || ""}
            max={undefined}
            onChange={(e) => actions.setFecPlanPosteoFrom(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-0.5">
          <div className="mb-1 block">
            <LabelWithIcon
              title="Planned Posting (To)"
              icon={
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              }
            />
          </div>
          <input
            type="date"
            value={filters.fecPlanPosteoTo || ""}
            min={filters.fecPlanPosteoFrom || undefined}
            max={undefined}
            onChange={(e) => actions.setFecPlanPosteoTo(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-0.5">
          <div className="mb-1 block">
            <LabelWithIcon
              title="Record Creation (From)"
              icon={
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              }
            />
          </div>
          <input
            type="date"
            value={filters.fecCreacionRegistroFrom || ""}
            onChange={(e) => actions.setFecCreacionRegistroFrom(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-0.5">
          <div className="mb-1 block">
            <LabelWithIcon
              title="Record Creation (To)"
              icon={
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              }
            />
          </div>
          <input
            type="date"
            value={filters.fecCreacionRegistroTo || ""}
            min={filters.fecCreacionRegistroFrom || undefined}
            onChange={(e) => actions.setFecCreacionRegistroTo(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
    );
  };

  const handleDeleteOrder = async (order) => {
    const request = {
      correo: userEmail,
      codordentrabajo: order.codordentrabajo,
      codescena: order.codescena,
      tippublicacion: order.tippublicacion,
      codlibro: order.codlibro,
      codcuentatiktok: order.codcuentatiktok,
      codtelefono: order.codtelefono,
      codimagenprincipal: order.ncodimagenprincipal,
      codimagenscreenshot: order.ncodimagenscreenshot,
      codimagendialogo: order.ncodimagendialogo,
      codvideo: order.ncodvideo,
      codsonido: order.ncodsonido,
    };

    try {
      await deleteOrderService({
        token: jwt,
        request,
      });

      actions.removeOrderRow(order.codordentrabajo);

      notify("Order deleted", "The order was deleted successfully.", "success");
    } catch (error) {
      console.error("Delete order failed:", error);

      notify(
        "Delete failed",
        error?.message || "Error deleting order.",
        "error",
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100/70">
      <NotificationToast toast={toast} onClose={() => setToast(null)} />

      {loadingSearch &&
        createPortal(
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            {/* overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/20 to-slate-900/10 backdrop-blur-[2px]" />

            {/* dialog */}
            <div className="relative w-[360px] max-w-[100vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

              <div className="p-7 text-center">
                {/* spinner ROJO */}
                <div className="mx-auto relative h-15 w-15">
                  <div className="h-15 w-15 animate-spin rounded-full border-[5px] border-slate-200 border-t-red-600" />
                  <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-red-600/15" />
                </div>

                <p className="mt-4 text-[15px] font-semibold text-slate-800">
                  Processing.
                </p>
                <p className="mt-1.5 text-[13px] text-slate-500">
                  Please keep this tab open until completion
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {confirmOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/20 to-slate-900/10 backdrop-blur-[2px]"
              onClick={closeConfirm}
            />

            <div className="relative w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

              <div className="p-6 text-center">
                <div
                  className={
                    confirmOpen.danger
                      ? "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                      : "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/5 text-slate-900 ring-1 ring-slate-200"
                  }
                >
                  {confirmOpen.danger ? (
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
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
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
          </div>,
          document.body,
        )}
      <FiltersShell
        title="Order Query Filters"
        subtitle="Configure the filters to query posting orders"
        rightAction={
          <div className="flex flex-wrap items-center justify-end gap-x-20 gap-y-2 pt-0">
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={notifButtonRef}
                type="button"
                onClick={actions.toggleNotifications}
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
              <button
                className={btnPrimary}
                title="Search"
                onClick={() => {
                  openConfirm({
                    title: "Confirm search",
                    message:
                      "This action will run Order Queries based on the filters to retrieve the matching order records.",
                    confirmText: "Search",
                    danger: false,
                    onConfirm: () => actions.validateAndSearch(),
                  });
                }}
                disabled={loadingSearch}
              >
                {loadingSearch ? "Searching..." : "Search"}
              </button>

              <button
                type="button"
                className={`${btnDanger} !px-0 !py-0 !gap-0 h-11 w-12`}
                onClick={() => {
                  openConfirm({
                    title: "Confirm reset",
                    message:
                      "This will clear filters, cached catalogs, and current query results from this page.",
                    confirmText: "Clear",
                    danger: true,
                    onConfirm: () => actions.reset(),
                  });
                }}
                disabled={loadingSearch}
                title="Clear filters"
              >
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
        }
        icon={
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
        }
      >
        {StepContent()}
      </FiltersShell>

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
                  Order query summary alerts
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={actions.clearNotifications}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100 active:bg-red-200"
                  title="Clear notifications"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={actions.closeNotifications}
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
              {generationAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    No pending notifications
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Order query alerts will appear here
                  </p>
                </div>
              ) : (
                generationAlerts.map((alert, index) => {
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
                            {alert.title ?? "Order query result"}
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
                            Records
                          </p>
                          <p className="mt-0.5 text-sm font-bold leading-none text-slate-900">
                            {alert.recordsCount ?? 0}
                          </p>
                        </div>

                        <div
                          className={[
                            "min-w-[120px] rounded-lg border px-2.5 py-1.5",
                            isError
                              ? "border-red-200 bg-red-50"
                              : isWarning
                                ? "border-amber-200 bg-amber-50"
                                : "border-emerald-200 bg-emerald-50",
                          ].join(" ")}
                        >
                          <p
                            className={[
                              "text-[10px] font-semibold uppercase tracking-wide",
                              isError
                                ? "text-red-700"
                                : isWarning
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                            ].join(" ")}
                          >
                            Status
                          </p>
                          <p
                            className={[
                              "mt-0.5 text-sm font-bold leading-none",
                              isError
                                ? "text-red-800"
                                : isWarning
                                  ? "text-amber-800"
                                  : "text-emerald-800",
                            ].join(" ")}
                          >
                            {isError
                              ? "Error"
                              : isWarning
                                ? "No data"
                                : "Success"}
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

      <div className="mt-5">
        {ordersRows.length > 0 ? (
          <>
            <OrdenGenerationTable
              rows={ordersRows}
              columns={ordersColumns}
              onRowClick={handleRowClick}
              onDeleteRow={(order) => {
                openConfirm({
                  title: "Confirm delete",
                  message: `Are you sure you want to delete order #${order?.codordentrabajo ?? "N/A"}? This action cannot be undone`,
                  confirmText: "Delete",
                  danger: true,
                  onConfirm: () => handleDeleteOrder(order),
                });
              }}
              footerAction={
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/20 transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleDownload}
                  disabled={
                    loadingDownload || loadingSearch || ordersRows.length === 0
                  }
                  title="Download Excel"
                >
                  {loadingDownload ? "Downloading..." : "Download Excel"}
                </button>
              }
            />
          </>
        ) : dataLoaded ? (
          <NoDataFound
            title="No Data Found"
            message="We couldn't find any data to display."
          />
        ) : null}
      </div>

      <OrderDetailsModal
        open={detailsOpen}
        order={selectedOrder}
        draft={draftOrder}
        isEditing={isEditing}
        catalog={catalog}
        editCatalog={editCatalog}
        editFilters={editFilters}
        requiredImageVideoFields={requiredImageVideoFields}
        onClose={handleCloseDetails}
        onEdit={actions.editDetails}
        onChange={actions.changeDraft}
        onSave={(...args) => {
          openConfirm({
            title: "Confirm update",
            message: "This will save the changes made to the current order.",
            confirmText: "Save",
            danger: false,
            onConfirm: () => actions.saveDetails(...args),
          });
        }}
        onManualSelectPublisher={() => {}}
        onManualSelectTelephone={() => {}}
        onManualSelectAuthor={() => {}}
        onManualSelectBook={() => {}}
        onManualSelectPostType={() => {}}
        onManualSelectScene={() => {}}
        onEditSelectPublisher={actions.setEditCodPosteador}
        onEditSelectTelephone={actions.setEditCodTelefono}
        onEditSelectAuthor={actions.setEditCodAutora}
        onEditSelectBook={actions.setEditCodLibro}
        onEditSelectPostType={actions.setEditCodTipoPosteo}
        onEditSelectScene={actions.setEditCodEscena}
      />
    </div>
  );
}
