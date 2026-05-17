import { mapOrderQueriesResponseItem } from "../../interfaces/order-queries/OrderQueriesResponse";

export async function searchOrderQueriesService({ token, request }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;

  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!request) throw new Error("Manual order body is required");

  const response = await fetch(azureURL + "/order/queries/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Failed to search order queries");
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => mapOrderQueriesResponseItem(item));
}
