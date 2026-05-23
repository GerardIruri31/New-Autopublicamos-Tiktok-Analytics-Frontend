import React from "react";

export default function FiltersShell({
  title,
  subtitle,
  children,
  rightAction,
  icon,
  headerContent,
  footerContent,
  bodyClassName = "",
}) {
  return (
    <section className="relative overflow-visible rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm sm:p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />
      </div>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 pt-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 shadow-sm">
              {icon ? (
                icon
              ) : (
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
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              {subtitle ? (
                <p className="text-xs text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {rightAction ? (
            <div className="w-full pt-1.5 lg:w-auto lg:shrink-0 lg:self-start">
              {rightAction}
            </div>
          ) : null}
        </div>

        {headerContent ? <div>{headerContent}</div> : null}
      </div>
      <div
        className={`rounded-2xl border border-slate-200 bg-white/60 p-3 sm:p-4 ${bodyClassName}`}
      >
        {children}
      </div>
      {footerContent ? <div className="mt-2">{footerContent}</div> : null}
    </section>
  );
}
