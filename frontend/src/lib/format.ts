export const preco = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (d: string) => d.split("-").reverse().join("/");

export function dataLonga(d: string): string {
  const [a, m, dia] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, dia)).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
}

export const duracao = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`);
