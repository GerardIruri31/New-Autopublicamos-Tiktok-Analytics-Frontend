export default function NotificationToast({ toast, onClose }) {
  if (!toast) return null;

  const toastBarClass =
    toast?.type === "success"
      ? "bg-emerald-600"
      : toast?.type === "warning"
        ? "bg-rose-400"
        : toast?.type === "error"
          ? "bg-rose-500"
          : "bg-slate-900";

  return (
    <div className="fixed right-5 top-5 z-[10000] w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{toast.title}</p>
          <p className="mt-1 text-xs text-slate-600">{toast.message}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className={`h-1 w-full ${toastBarClass}`} />
    </div>
  );
}
