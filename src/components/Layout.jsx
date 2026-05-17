import React from "react";
import Navbar from "./Navbar";
import { useMsal } from "@azure/msal-react";

const Layout = ({ children, allowedModules }) => {
  const { instance } = useMsal();
  const account = instance.getActiveAccount();
  const nombre = account?.idTokenClaims?.given_name || "User";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex flex-col">
      <Navbar name={nombre} allowedModules={allowedModules} />

      {/* FULL WIDTH wrapper */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-28">
        {/* Si quieres que TODO sea full width, deja solo {children} */}
        {children}
      </main>
    </div>
  );
};

export default Layout;
