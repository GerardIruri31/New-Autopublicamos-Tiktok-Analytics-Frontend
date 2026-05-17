import OrderGenerationDetailResponse from "../../interfaces/orden-generation/OrderGenerationDetailResponse";

const parseOrderResponse = async (resp) => {
  const text = await resp.text();
  if (!text) {
    return null;
  }
  const data = JSON.parse(text);
  return {
    ...OrderGenerationDetailResponse,
    ...data,
  };
};

export async function createManualOrderService({ token, body }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;

  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!body) throw new Error("Manual order body is required");

  const resp = await fetch(azureURL + "/order/manual", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    mode: "cors",
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Error ${resp.status} al crear manual order: ${text || resp.statusText}`,
    );
  }
  return parseOrderResponse(resp);
}

export async function updateManualOrderService({
  token,
  codordentrabajo,
  body,
}) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;

  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!body) throw new Error("Manual order body is required");

  const resp = await fetch(`${azureURL}/order/edit/${codordentrabajo}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    mode: "cors",
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Error ${resp.status} al actualizar manual order: ${text || resp.statusText}`,
    );
  }

  return parseOrderResponse(resp);
}
