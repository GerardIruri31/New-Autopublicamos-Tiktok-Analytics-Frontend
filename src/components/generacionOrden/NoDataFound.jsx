import React from "react";

export default function NoDataFound({
  title = "No Data Found",
  message = "We couldn't find any data to display.",
}) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="text-center">
          <h2 className="break-words text-lg font-extrabold text-slate-900 sm:text-xl">
            {title}
          </h2>
          <p className="mt-2 break-words text-sm text-slate-600">{message}</p>
        </div>
      </div>
    </section>
  );
}
