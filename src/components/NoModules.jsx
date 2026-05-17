import React from "react";
import { useMsal } from "@azure/msal-react";

const NoModules = () => {
  const { instance } = useMsal();

  const handleLogout = async () => {
    try {
      localStorage.clear();
    } catch {}

    try {
      await instance.logoutRedirect();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 px-6 overflow-hidden">
      {/* soft vignette (non-blocking) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.07),rgba(15,23,42,0.00)_60%)]" />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_30px_90px_-40px_rgba(2,6,23,0.35)] px-10 py-10">
          {/* ring / accent */}
          <div className="flex justify-center mb-5">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-[5px] border-slate-200" />
              <div className="absolute inset-0 rounded-full border-[5px] border-transparent border-t-red-500 border-r-red-500 animate-spin" />
              <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-red-100" />
            </div>
          </div>

          <h1 className="text-center text-xl font-semibold text-slate-900">
            No access modules assigned
          </h1>

          <p className="mt-2 text-center text-sm text-slate-600 leading-relaxed">
            Please contact the{" "}
            <span className="font-medium">Autopublicamos</span> staff to get
            access.
          </p>

          <div className="mt-7">
            <button
              onClick={handleLogout}
              className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold shadow-sm hover:bg-slate-800 active:scale-[0.99] transition"
            >
              Click here to log out
            </button>

            <div className="mt-4 text-center text-xs text-slate-500">
              If this is unexpected, share a screenshot with the staff.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoModules;
