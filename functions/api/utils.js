export const json = (data, options) => {
  return new Response(JSON.stringify(data), {
    status: options?.status || 200,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
};

export const error = (status, data) => {
  return json(data, { status });
};
