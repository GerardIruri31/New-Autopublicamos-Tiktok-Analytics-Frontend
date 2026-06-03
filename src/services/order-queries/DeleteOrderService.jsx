export const deleteOrderService = async ({ token, request }) => {
  const baseUrl = import.meta.env.VITE_AZURE_API_URL;

  const response = await fetch(`${baseUrl}/order/delete`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(message || "Error deleting order.");
  }

  return;
};
