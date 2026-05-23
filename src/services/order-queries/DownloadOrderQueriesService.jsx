export async function downloadOrderQueriesService({ token, request }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;

  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!request) throw new Error("Order queries filters request is required");

  const response = await fetch(azureURL + "/order/queries/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Failed to download order queries Excel");
  }

  const blob = await response.blob();

  const now = new Date();

  const pad = (value) => String(value).padStart(2, "0");

  const fecha =
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    "_" +
    pad(now.getHours()) +
    "-" +
    pad(now.getMinutes()) +
    "-" +
    pad(now.getSeconds());

  const fileName = `tiktok_order_queries_${fecha}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(url);
}
