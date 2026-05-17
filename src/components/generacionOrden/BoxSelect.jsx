import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function BoxSelect({
  label,
  value,
  options,
  placeholder = "— Select —",
  disabled = false,
  onChange,
  icon,
  variant = "default",
  dropdownWidthClass = "",
  selectionMode = "single", // "single" | "multiple"
  summaryMap = null, // opcional: map value -> display label personalizado
  selectAllEnabled = true,
}) {
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 260,
  });

  const normalizedOptions = Array.isArray(options) ? options : [];

  const normalizedValue = useMemo(() => {
    if (selectionMode === "multiple") {
      return Array.isArray(value) ? value.map((v) => String(v)) : [];
    }
    return value == null ? null : String(value);
  }, [value, selectionMode]);

  const labelByValue = useMemo(() => {
    const map = {};
    normalizedOptions.forEach((o) => {
      const rawValue = String(o?.value ?? "");
      map[rawValue] =
        summaryMap?.[rawValue] ?? String(o?.label ?? rawValue).trim();
    });
    return map;
  }, [normalizedOptions, summaryMap]);

  const selectedLabels = useMemo(() => {
    if (selectionMode === "multiple") {
      return normalizedValue
        .map((v) => labelByValue[String(v)] ?? String(v))
        .filter(Boolean);
    }

    if (normalizedValue == null) return [];
    const raw = String(normalizedValue);
    const selected = normalizedOptions.find(
      (o) => String(o?.value ?? "") === raw,
    );
    return selected ? [labelByValue[raw] ?? selected.label] : [];
  }, [normalizedValue, selectionMode, normalizedOptions, labelByValue]);

  const selectedText = useMemo(() => {
    if (selectedLabels.length === 0) return placeholder;

    if (selectionMode === "multiple") {
      const n = selectedLabels.length;
      const first = selectedLabels[0];
      return n <= 1 ? first : `${first}, +${n - 1} more`;
    }

    return selectedLabels[0];
  }, [selectedLabels, selectionMode, placeholder]);

  const allOptionValues = useMemo(
    () => normalizedOptions.map((o) => String(o?.value ?? "")).filter(Boolean),
    [normalizedOptions],
  );

  const updateDropdownPosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    const width = Math.min(rect.width, window.innerWidth - 16);
    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    const GAP = 8;
    const estimatedHeight = dropdownRef.current?.offsetHeight ?? 260;

    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;

    const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, openUp ? spaceAbove : spaceBelow);

    const top = openUp
      ? Math.max(GAP, rect.top - Math.min(estimatedHeight, maxHeight))
      : rect.bottom + GAP;

    setDropdownStyle({
      top,
      left,
      width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
  }, [open, normalizedOptions.length]);

  useEffect(() => {
    if (!open) return;

    const onMove = () => updateDropdownPosition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);

    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e) => {
      const wrap = wrapperRef.current;
      const drop = dropdownRef.current;

      if (wrap && wrap.contains(e.target)) return;
      if (drop && drop.contains(e.target)) return;

      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, {
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [open]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  const baseButtonClass =
    variant === "compact"
      ? [
          "w-full rounded-lg bg-white/70 px-2 py-1.5 text-sm text-slate-900 text-center sm:w-[105px]",
          "shadow-sm ring-1 ring-slate-200",
          "focus:outline-none focus:ring-2 focus:ring-slate-900/10",
          disabled
            ? "opacity-60 cursor-not-allowed bg-slate-50/60"
            : "cursor-pointer",
        ].join(" ")
      : [
          "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between mt-0",
          disabled
            ? "opacity-60 cursor-not-allowed bg-slate-50/60"
            : "cursor-pointer",
        ].join(" ");

  const isChecked = (optionValue) => {
    const raw = String(optionValue ?? "");

    if (selectionMode === "multiple") {
      return normalizedValue.includes(raw);
    }

    return String(normalizedValue ?? "") === raw;
  };

  const toggleOption = (optionValue) => {
    const raw = String(optionValue ?? "");

    if (selectionMode === "multiple") {
      const current = Array.isArray(normalizedValue) ? normalizedValue : [];
      const exists = current.includes(raw);

      const next = exists
        ? current.filter((v) => v !== raw)
        : [...current, raw];

      onChange?.(next);
      return;
    }

    const current = normalizedValue == null ? null : String(normalizedValue);
    const next = current === raw ? null : raw;
    onChange?.(next);
  };

  return (
    <div className="w-full min-w-0">
      {variant === "default" ? (
        <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-600">
          {icon ? (
            <span className="inline-flex h-4 w-4 items-center justify-center">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 truncate text-sm font-medium text-slate-700 leading-none py-0.5">
            {label}
          </span>
        </label>
      ) : null}

      <div
        className={
          variant === "compact"
            ? [
                "flex flex-col items-stretch justify-between gap-2 rounded-xl sm:flex-row sm:items-center sm:gap-3",
                "bg-white/60 shadow-sm ring-1 ring-slate-200",
                "px-3 py-2",
                disabled ? "opacity-60 cursor-not-allowed bg-slate-50/60" : "",
              ].join(" ")
            : "py-0"
        }
      >
        {variant === "compact" ? (
          <span className="w-full truncate text-left text-sm font-medium text-slate-700 leading-none py-1 sm:w-[140px] sm:text-center">
            {label}
          </span>
        ) : null}

        <div
          ref={wrapperRef}
          className={variant === "compact" ? "relative" : "relative w-full"}
        >
          <button
            ref={buttonRef}
            type="button"
            disabled={!!disabled}
            onClick={() => {
              if (disabled) return;
              setOpen((prev) => !prev);
            }}
            className={baseButtonClass}
            title={selectedText}
          >
            <span className="truncate">{selectedText}</span>

            <svg
              className={`h-4 w-4 shrink-0 text-slate-500 transition ${
                open ? "rotate-180" : ""
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

          {open &&
            normalizedOptions.length > 0 &&
            createPortal(
              <div
                ref={dropdownRef}
                style={{
                  position: "fixed",
                  top: dropdownStyle.top,
                  left: dropdownStyle.left,
                  width: dropdownStyle.width,
                  maxHeight: dropdownStyle.maxHeight,
                }}
                className={[
                  "z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5",
                  dropdownWidthClass || "",
                ].join(" ")}
              >
                <div className="flex items-center px-2 py-2 border-b border-slate-200/60">
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                    {selectionMode === "multiple"
                      ? `${normalizedValue.length} selected`
                      : `${normalizedOptions.length} options`}
                  </span>

                  <div className="flex-1" />

                  <div className="flex items-center gap-1 shrink-0">
                    {selectionMode === "multiple" && selectAllEnabled ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange?.(allOptionValues);
                        }}
                      >
                        Select all
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange?.(selectionMode === "multiple" ? [] : null);
                      }}
                      title="Clear"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  className="overflow-auto px-2 py-1"
                  style={{
                    maxHeight: Math.max(120, dropdownStyle.maxHeight - 44),
                  }}
                >
                  <div className="flex flex-col gap-1">
                    {normalizedOptions.map((o) => {
                      const rawValue = String(o?.value ?? "");
                      const checked = isChecked(rawValue);

                      return (
                        <label
                          key={rawValue}
                          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                            checked={checked}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleOption(rawValue);
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-medium text-slate-700">
                            {labelByValue[rawValue] ?? o?.label ?? rawValue}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}
