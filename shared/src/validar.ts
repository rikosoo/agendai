import type { HorarioDia, NegocioInput, ServicoInput } from "./types";
import { paraMinutos } from "./slots";

export class ErroValidacao extends Error {}

export const ehData = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
export const ehHora = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function texto(v: unknown, campo: string, min: number, max: number, obrigatorio = true): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s && !obrigatorio) return "";
  if (s.length < min || s.length > max) throw new ErroValidacao(`${campo} deve ter entre ${min} e ${max} caracteres`);
  return s;
}

export function validarNegocio(b: any): NegocioInput {
  if (!b || typeof b !== "object") throw new ErroValidacao("Corpo inválido");
  if (!Array.isArray(b.horarios) || b.horarios.length !== 7) throw new ErroValidacao("Informe os horários dos 7 dias da semana");
  const horarios: HorarioDia[] = b.horarios.map((h: any) => {
    if (!ehHora(h?.inicio) || !ehHora(h?.fim)) throw new ErroValidacao("Horário inválido");
    if (paraMinutos(h.inicio) >= paraMinutos(h.fim)) throw new ErroValidacao("O fim deve ser depois do início");
    return { aberto: !!h.aberto, inicio: h.inicio, fim: h.fim };
  });
  return {
    nome: texto(b.nome, "Nome", 2, 80),
    categoria: texto(b.categoria, "Categoria", 2, 40),
    descricao: texto(b.descricao, "Descrição", 0, 500, false),
    cidade: texto(b.cidade, "Cidade", 2, 60),
    endereco: texto(b.endereco, "Endereço", 0, 120, false),
    telefone: texto(b.telefone, "Telefone", 0, 20, false),
    horarios,
  };
}

export function validarServico(b: any): ServicoInput {
  if (!b || typeof b !== "object") throw new ErroValidacao("Corpo inválido");
  const duracaoMin = Number(b.duracaoMin);
  const preco = Number(b.preco);
  if (!Number.isInteger(duracaoMin) || duracaoMin < 15 || duracaoMin > 480) throw new ErroValidacao("Duração deve ser entre 15 e 480 minutos");
  if (!Number.isFinite(preco) || preco < 0 || preco > 100000) throw new ErroValidacao("Preço inválido");
  return { nome: texto(b.nome, "Nome do serviço", 2, 60), duracaoMin, preco: Math.round(preco * 100) / 100 };
}

export function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "negocio";
}

export function idAleatorio(n = 6): string {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < n; i++) out += c[Math.floor(Math.random() * c.length)];
  return out;
}
