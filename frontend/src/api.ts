export const API = import.meta.env.VITE_API_URL ?? "/api";

export type Player = "player-one" | "israel";

export function authHeaders(player: Player) {
  return { "x-mymemo-player": player };
}

export async function request<T>(path: string, options: RequestInit = {}, player: Player = "player-one"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...authHeaders(player), ...options.headers }
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Erro na API.");
  if (res.status === 204) return undefined as T;
  return res.json();
}
