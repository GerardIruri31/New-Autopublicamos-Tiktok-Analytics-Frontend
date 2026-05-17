import GeneracionOrdenFiltersResponse from "../../interfaces/orden-generation/GeneracionOrdenFiltersResponse";

export async function GenerateOrdenService({ token, request }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;

  if (!azureURL) {
    throw new Error("VITE_AZURE_API_URL no está definido");
  }

  if (!token) {
    throw new Error("No JWT available");
  }

  if (!request) {
    throw new Error("Request is required");
  }

  const resp = await fetch(`${azureURL}/order/auto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    mode: "cors",
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Error ${resp.status} al generar órdenes: ${text || resp.statusText}`,
    );
  }

  const data = await resp.json();

  return {
    ...GeneracionOrdenFiltersResponse,
    ...data,
    ordenes: Array.isArray(data?.ordenes) ? data.ordenes : [],
  };
}
