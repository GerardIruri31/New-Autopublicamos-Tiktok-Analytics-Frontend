import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function SelectField({
  label,
  value,
  options,
  placeholder = "— Selecciona —",
  disabled,
  onChange,
  icon,
  variant = "default",
  dropdownWidthClass = "",
  getOptionClassName,
  selectedDisplayClassName = "",
  selectedButtonClassName = "",
  placeholderClassName = "",
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

  const selectedOption = useMemo(() => {
    return normalizedOptions.find(
      (o) => String(o?.value ?? "") === String(value ?? ""),
    );
  }, [normalizedOptions, value]);

  const updateDropdownPosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const GAP = 8;
    const SIDE_PADDING = 8;

    const availableBelow =
      window.innerHeight - rect.bottom - GAP - SIDE_PADDING;
    const availableAbove = rect.top - GAP - SIDE_PADDING;

    const shouldOpenAbove =
      availableBelow < 160 && availableAbove > availableBelow;

    const maxHeight = Math.max(
      160,
      Math.min(320, shouldOpenAbove ? availableAbove : availableBelow),
    );

    const width = Math.min(rect.width, window.innerWidth - SIDE_PADDING * 2);

    const left = Math.min(
      Math.max(SIDE_PADDING, rect.left),
      window.innerWidth - width - SIDE_PADDING,
    );

    const top = shouldOpenAbove
      ? Math.max(SIDE_PADDING, rect.top - GAP - maxHeight)
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

    const onUpdatePosition = () => updateDropdownPosition();

    window.addEventListener("resize", onUpdatePosition);
    window.addEventListener("scroll", onUpdatePosition, true);

    return () => {
      window.removeEventListener("resize", onUpdatePosition);
      window.removeEventListener("scroll", onUpdatePosition, true);
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
          "w-full rounded-xl bg-white/60 pl-4 pr-10 py-1.5 text-sm text-left text-slate-900",
          "shadow-sm ring-1 ring-slate-200",
          "focus:outline-none focus:ring-2 focus:ring-slate-900/10",
          disabled
            ? "opacity-60 cursor-not-allowed bg-slate-50/60"
            : "cursor-pointer",
        ].join(" ");

  const selectedLabel = selectedOption?.label ?? placeholder;

  const selectedOptionClassName = selectedOption
    ? (getOptionClassName?.(selectedOption, true) ?? "")
    : "";

  const selectedTextClassName = selectedOption
    ? selectedDisplayClassName || selectedOptionClassName
    : placeholderClassName;

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
          className={
            variant === "compact"
              ? "relative w-full sm:w-auto"
              : "relative w-full"
          }
        >
          <button
            ref={buttonRef}
            type="button"
            disabled={!!disabled}
            onClick={() => {
              if (disabled) return;
              setOpen((prev) => !prev);
            }}
            className={[
              baseButtonClass,
              selectedOption ? selectedButtonClassName : "",
            ].join(" ")}
            title={selectedOption?.label ?? placeholder}
          >
            <span
              className={["block truncate", selectedTextClassName].join(" ")}
            >
              {selectedLabel}
            </span>
          </button>

          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-sm">
            <span className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
          </div>

          {open
            ? createPortal(
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
                  <div className="flex items-center gap-2 border-b border-slate-200/60 px-2 py-2">
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                      {normalizedOptions.length} options
                    </span>

                    <div className="flex-1" />

                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                      onClick={() => {
                        onChange?.(null);
                        setOpen(false);
                      }}
                      title="Clear"
                    >
                      Clear
                    </button>
                  </div>

                  <div
                    className="overflow-auto px-2 py-1"
                    style={{
                      maxHeight: dropdownStyle.maxHeight,
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      {normalizedOptions.map((o) => {
                        const isSelected =
                          String(o?.value ?? "") === String(value ?? "");

                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                              onChange?.(o.value);
                              setOpen(false);
                            }}
                            className={[
                              "w-full rounded-md px-2 py-1.5 text-left text-[12px] leading-4 font-medium transition",
                              !getOptionClassName ? "hover:bg-slate-50" : "",
                              isSelected && !getOptionClassName
                                ? "bg-slate-100 text-slate-900"
                                : !getOptionClassName
                                  ? "text-slate-700"
                                  : "",
                              getOptionClassName?.(o, isSelected) ?? "",
                            ].join(" ")}
                            title={o.label}
                          >
                            <span className="block truncate">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>
    </div>
  );
}
