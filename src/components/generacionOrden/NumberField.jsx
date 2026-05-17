import React from "react";

export default function NumberField({
  label,
  value,
  placeholder,
  min = 0,
  disabled,
  onChange,
  icon,
  variant = "default",
}) {
  const clamp = (n) => {
    if (n == null || Number.isNaN(n)) return null;
    if (min != null && n < min) return min;
    return n;
  };

  const stepUp = () => {
    const current = typeof value === "number" ? value : (min ?? 0);
    onChange(clamp(current + 1));
  };

  const stepDown = () => {
    const current = typeof value === "number" ? value : (min ?? 0);
    onChange(clamp(current - 1));
  };

  return (
    <div className="w-full">
      {variant === "default" ? (
        <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-600">
          {icon ? (
            <span className="inline-flex h-4 w-4 items-center justify-center">
              {icon}
            </span>
          ) : null}
          <span>{label}</span>
        </label>
      ) : null}

      {variant === "compact" ? (
        <div
          className={[
            "flex flex-col items-stretch justify-between gap-2 rounded-xl sm:flex-row sm:items-center sm:gap-3",
            "bg-white/60 shadow-sm ring-1 ring-slate-200",
            "px-3 py-2",
            disabled ? "opacity-60 cursor-not-allowed bg-slate-50/60" : "",
          ].join(" ")}
        >
          <span className="w-full truncate text-left text-sm font-medium text-slate-700 leading-none py-1 sm:w-[140px] sm:text-center">
            {label}
          </span>

          <div className="flex w-full items-stretch gap-2 sm:ml-auto sm:w-auto">
            {" "}
            <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 bg-white/70">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={!!disabled}
                value={value ?? ""}
                placeholder={placeholder}
                onChange={(e) => {
                  const raw = e.target.value;

                  // permitir vacío
                  if (raw === "") return onChange(null);

                  // solo dígitos
                  const cleaned = raw.replace(/[^\d]/g, "");
                  const n = Number(cleaned);
                  if (Number.isNaN(n)) return onChange(null);

                  onChange(clamp(n));
                }}
                className={[
                  "w-[85px] px-2 py-1.5 text-sm text-slate-900 text-center",
                  "bg-transparent focus:outline-none",
                  disabled ? "cursor-not-allowed" : "",
                ].join(" ")}
              />
            </div>
            {/* Divider */}
            <div className="flex flex-col overflow-hidden rounded-lg ring-1 ring-slate-200 bg-white/70">
              <button
                type="button"
                disabled={!!disabled}
                onClick={stepUp}
                className={[
                  "h-1/2 w-[34px] flex items-center justify-center",
                  "text-slate-500 hover:bg-white/60 active:bg-white",
                  disabled ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
                aria-label="Increase"
              >
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
                    d="M6 14l6-6 6 6"
                  />
                </svg>
              </button>

              <div className="h-px bg-slate-200" />

              <button
                type="button"
                disabled={!!disabled}
                onClick={stepDown}
                className={[
                  "h-1/2 w-[34px] flex items-center justify-center",
                  "text-slate-500 hover:bg-white/60 active:bg-white",
                  disabled ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
                aria-label="Decrease"
              >
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
                    d="M6 10l6 6 6-6"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <input
          className={[
            "w-full rounded-xl bg-white/60 px-4 py-2.5",
            "text-sm text-slate-900 shadow-sm ring-1 ring-slate-200",
            "focus:outline-none focus:ring-2 focus:ring-slate-900/10",
            disabled ? "opacity-60 cursor-not-allowed bg-slate-50/60" : "",
          ].join(" ")}
          type="number"
          min={min}
          placeholder={placeholder}
          disabled={!!disabled}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(null);

            const n = Number(raw);
            if (Number.isNaN(n)) return onChange(null);

            onChange(n);
          }}
        />
      )}
    </div>
  );
}
