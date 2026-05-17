import React from "react";

const LoadingScreen = () => {
  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center px-6">
      <div className="relative w-[340px] max-w-[72vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5 drop-shadow-[0_28px_55px_rgba(15,23,42,0.24)]">
        {/* Top accent bar */}

        <div className="px-10 py-12 text-center">
          {/* Spinner */}
          <div className="mx-auto relative h-16 w-16">
            <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-slate-200 border-t-red-600" />
            <div className="absolute inset-0 m-auto h-7 w-7 rounded-full bg-red-600/12" />
          </div>

          {/* Text */}
          <div className="mt-6">
            <p className="text-[18px] font-semibold text-slate-900 tracking-tight">
              Loading ...
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              Please wait while we prepare the system
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
