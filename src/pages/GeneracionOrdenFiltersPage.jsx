import FiltersShell from "../components/generacionOrden/FiltersShell";
import SelectField from "../components/generacionOrden/SelectField";
import NumberField from "../components/generacionOrden/NumberField";
import NoDataFound from "../components/generacionOrden/NoDataFound";
import OrdenGenerationTable from "../components/generacionOrden/OrdenGenerationTable";
import { useGeneracionOrdenFilters } from "../hooks/useGeneracionOrdenFilters";
import OrderDetailsModal from "../components/generacionOrden/OrderDetailsModal";
import { AuthUserContext } from "../context/AuthUserContext";
import NotificationToast from "../components/common/NotificationToast";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export default function GeneracionOrdenFiltersPage() {
  const { jwt } = useContext(AuthUserContext);

  const [toast, setToast] = useState(null);

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

  const handleCloseOrderModal = () => {
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
  const {
    filters,
    catalog,
    editCatalog,
    editFilters,
    loadingCatalog,
    isGeneratingOrders,
    actions,
    ordersRows,
    ordersColumns,
    dataLoaded,
    selectedOrder,
    detailsOpen,
    isEditing,
    draftOrder,
    notifOpen,
    generationAlerts,
    requiredImageVideoFields,
  } = useGeneracionOrdenFilters({
    token: jwt,
    notifyManualValidation: notify,
  });

  const prioridadOptions = [
    { value: "S", label: "Yes" },
    { value: "N", label: "No" },
  ];

  const todayISO = (() => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  })();
  const addDaysISO = (isoDate, days) => {
    const d = new Date(isoDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const startDateValue = filters.fecinicioplanposteo || todayISO;
  const endDateValue = filters.fecfinplanposteo || startDateValue;

  useEffect(() => {
    if (!filters.fecinicioplanposteo) {
      actions.setStartPostingDate(todayISO);
    }
  }, [filters.fecinicioplanposteo, actions, todayISO]);

  useEffect(() => {
    const effectiveStart = filters.fecinicioplanposteo || todayISO;

    if (filters.fecfinplanposteo !== effectiveStart) {
      actions.setEndPostingDate(effectiveStart);
    }
  }, [
    filters.fecfinplanposteo,
    filters.fecinicioplanposteo,
    actions,
    todayISO,
  ]);

  const btnClear =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white " +
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 " +
    "ring-1 ring-rose-600/20";

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50 px-4 min-w-[145px] py-3";

  const iconWrap =
    "h-5 w-5 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  const LabelWithIcon = ({ icon, title }) => (
    <div className="flex items-center gap-2">
      <div className={iconWrap}>{icon}</div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 leading-none">
          {title}
        </div>
      </div>
    </div>
  );

  const notifButtonRef = useRef(null);
  const notifDropdownRef = useRef(null);

  const [notifPos, setNotifPos] = useState({
    top: -9999,
    left: -9999,
    width: 360,
    maxHeight: 260,
  });

  const notifCount = generationAlerts.length;

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
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

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

  return (
    <div className="min-h-screen w-full bg-slate-100/70">
      <NotificationToast toast={toast} onClose={() => setToast(null)} />
      {isGeneratingOrders &&
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
        title="Order Generation"
        subtitle="Configure the filters to generate posting orders."
        rightAction={
          <div className="flex items-center gap-2">
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
              title="Generate"
              onClick={() => {
                openConfirm({
                  title: "Confirm Auto Order",
                  message:
                    "This action will generate posting orders based on the selected filters and the criteria provided",
                  confirmText: "Generate",
                  danger: false,
                  onConfirm: () => actions.validateAndGenerate(),
                });
              }}
            >
              Auto Order
            </button>

            <button
              type="button"
              className={btnPrimary}
              title="Manual"
              onClick={actions.openManualOrder}
            >
              Manual Order
            </button>

            <button
              onClick={() => {
                openConfirm({
                  title: "Confirm reset",
                  message:
                    "This will clear filters, generated data, and current selections from this page.",
                  confirmText: "Clear",
                  danger: true,
                  onConfirm: () => actions.reset(),
                });
              }}
              className={btnClear}
              title="Clear"
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
        }
      >
        {/* LINE 1: Publisher / Telephone / Author / Book */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <SelectField
            label={
              <LabelWithIcon
                title="Publisher (PA)"
                subtitle="Required"
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
            value={filters.codposteador}
            disabled={loadingCatalog}
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
                subtitle="Optional"
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
            value={filters.codtelefono ?? null}
            disabled={loadingCatalog || !filters.codposteador}
            options={catalog.telefonos}
            placeholder={
              !filters.codposteador
                ? "— Select a publisher first —"
                : "— Optional —"
            }
            dropdownWidthClass="w-[270px]"
            onChange={(v) => actions.setCodTelefono(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Author(s)"
                subtitle="Required"
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
            value={filters.codautora}
            disabled={loadingCatalog || !filters.codposteador}
            options={catalog.autoras}
            placeholder={
              !filters.codposteador
                ? "— Select a publisher first —"
                : loadingCatalog
                  ? "Loading..."
                  : "— Select an author —"
            }
            dropdownWidthClass="w-[270px]"
            onChange={(v) => actions.setCodAutora(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Book(s)"
                subtitle="Required"
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
            value={filters.codlibro ?? null}
            disabled={loadingCatalog || !filters.codautora}
            options={catalog.libros}
            placeholder={
              !filters.codautora
                ? "— Select an author first —"
                : "— Select a book —"
            }
            dropdownWidthClass=" w-[280px]"
            onChange={(v) => actions.setCodLibro(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Post Type"
                subtitle="Required"
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
            value={filters.tippublicacion ?? null}
            disabled={loadingCatalog || !filters.codlibro}
            options={catalog.tiposPosteo}
            placeholder={
              !filters.codlibro
                ? "— Select a book first —"
                : "— Select a post type —"
            }
            dropdownWidthClass=" w-[220px]"
            onChange={(v) => actions.setCodTipoPosteo(v)}
          />

          <SelectField
            label={
              <LabelWithIcon
                title="Scene(s)"
                subtitle="Required"
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
            value={filters.codescena ?? null}
            disabled={
              loadingCatalog || !filters.codlibro || !filters.tippublicacion
            }
            options={catalog.escenas}
            placeholder={
              !filters.codlibro || !filters.tippublicacion
                ? "— Select book and post type first —"
                : "— Select a scene —"
            }
            dropdownWidthClass="w-[320px]"
            onChange={(v) => actions.setCodEscena(v)}
          />

          {/* Start Date */}
          <div>
            <div className="mb-1 block">
              <LabelWithIcon
                title="Posting Start Date"
                subtitle="Default: today"
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
            <div className="pt-[5px]">
              <input
                type="date"
                value={startDateValue}
                min={todayISO}
                onChange={(e) => actions.setStartPostingDate(e.target.value)}
                className={[
                  "w-full rounded-xl bg-white/60 px-4 py-1.5",
                  "text-sm text-slate-900 shadow-sm ring-1 ring-slate-200",
                  "focus:outline-none focus:ring-2 focus:ring-slate-900/10",
                ].join(" ")}
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <div className="mb-1 block">
              <LabelWithIcon
                title="Posting End Date"
                subtitle="Same as start date"
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
            <div className="pt-[5px]">
              <input
                type="date"
                value={endDateValue}
                min={todayISO}
                onChange={(e) => actions.setEndPostingDate(e.target.value)}
                className={[
                  "w-full rounded-xl bg-white/60 px-4 py-1.5",
                  "text-sm text-slate-900 shadow-sm ring-1 ring-slate-200",
                  "focus:outline-none focus:ring-2 focus:ring-slate-900/10",
                ].join(" ")}
              />
            </div>
          </div>
        </div>

        {/* LINE 3: Sound Priority / Image Priority / Start Date / End Date */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <NumberField
            variant="compact"
            label="Quantity of Orders"
            value={filters.ctdordenesmetamanual}
            placeholder="e.g. 20"
            min={1}
            disabled={Boolean(filters.codescena)}
            onChange={(v) => actions.setCantidadOrdenesGenerar(v)}
          />

          <SelectField
            variant="compact"
            label="Scene Priority (Y/N)"
            value={filters.flgprioridadescena ?? "N"}
            options={prioridadOptions}
            placeholder="No"
            buttonWidthClassName="w-[72px]"
            dropdownWidthClass="w-[151px]"
            onChange={(v) => actions.setPrioridadEscenas(v)}
          />
          <SelectField
            variant="compact"
            label="Sound Priority (Y/N)"
            value={filters.flgprioridasonido ?? "N"}
            options={prioridadOptions}
            placeholder="No"
            buttonWidthClassName="w-[72px]"
            dropdownWidthClass="w-[151px]"
            onChange={(v) => actions.setPrioridadSonido(v)}
          />

          <SelectField
            variant="compact"
            label="Image/Video Priority"
            value={filters.flgprioridadimagenvideo ?? "N"}
            options={prioridadOptions}
            placeholder="No"
            buttonWidthClassName="w-[72px]"
            dropdownWidthClass="w-[151px]"
            onChange={(v) => actions.setPrioridadImagenVideo(v)}
          />
        </div>
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
                  System generation alerts
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
                    System generation alerts will appear here
                  </p>
                </div>
              ) : (
                generationAlerts.map((alerta, index) => (
                  <div
                    key={`${alerta.codcabeceraordentrabajo ?? "sin-cabecera"}-${alerta.createdAt ?? index}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Auto generation result
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Header Order:{" "}
                          {alerta.codcabeceraordentrabajo ?? "N/A"}
                        </p>
                        {alerta.createdAt && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {new Date(alerta.createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <span className="inline-flex rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <div className="min-w-[84px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Orders
                        </p>
                        <p className="mt-0.5 text-sm font-bold leading-none text-slate-900">
                          {alerta.ctdordenes ?? 0}
                        </p>
                      </div>

                      <div className="min-w-[84px] rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          Complete
                        </p>
                        <p className="mt-0.5 text-sm font-bold leading-none text-emerald-800">
                          {alerta.ctdordenescompleta ?? 0}
                        </p>
                      </div>

                      <div className="min-w-[84px] rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">
                          Incomplete
                        </p>
                        <p className="mt-0.5 text-sm font-bold leading-none text-red-800">
                          {alerta.ctdordenesincompleta ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Error log
                      </p>

                      <div className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                          {alerta.msj_error_log?.trim()
                            ? alerta.msj_error_log
                            : "No error log"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
      <div className="mt-5">
        {ordersRows.length > 0 ? (
          <OrdenGenerationTable
            rows={ordersRows}
            columns={ordersColumns}
            onRowClick={(row) => actions.openDetails(row)}
          />
        ) : dataLoaded ? (
          <NoDataFound />
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
        onClose={handleCloseOrderModal}
        onEdit={actions.editDetails}
        onChange={actions.changeDraft}
        onSave={(...args) => {
          const isEditSave = !!selectedOrder?.codordentrabajo;

          openConfirm({
            title: isEditSave ? "Confirm update" : "Confirm save",
            message: isEditSave
              ? "This will save the changes made to the current order."
              : "This will save the current order information.",
            confirmText: "Save",
            danger: false,
            onConfirm: () => actions.saveDetails(...args),
          });
        }}
        onManualSelectPublisher={actions.setManualCodPosteador}
        onManualSelectTelephone={actions.setManualCodTelefono}
        onManualSelectAuthor={actions.setManualCodAutora}
        onManualSelectBook={actions.setManualCodLibro}
        onManualSelectPostType={actions.setManualCodTipoPosteo}
        onManualSelectScene={actions.setManualCodEscena}
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
