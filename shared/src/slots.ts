import type { HorarioDia } from "./types";

/** Tamanho do "bloco" de agenda. Cada serviço ocupa ceil(duração / 30) blocos. */
export const SLOT_MIN = 30;

export function paraMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function deMinutos(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD, sem depender de fuso. */
export function diaDaSemana(data: string): number {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Data e hora atuais em São Paulo (o Brasil não tem mais horário de verão). */
export function agoraSaoPaulo(now: Date = new Date()): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const p = (t: string) => partes.find((x) => x.type === t)!.value;
  return { data: `${p("year")}-${p("month")}-${p("day")}`, hora: `${p("hour")}:${p("minute")}` };
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function blocosNecessarios(duracaoMin: number): number {
  return Math.max(1, Math.ceil(duracaoMin / SLOT_MIN));
}

/** Blocos (HH:MM) ocupados por um agendamento que começa em `hora`. */
export function blocosDoAgendamento(hora: string, duracaoMin: number): string[] {
  const ini = paraMinutos(hora);
  return Array.from({ length: blocosNecessarios(duracaoMin) }, (_, i) => deMinutos(ini + i * SLOT_MIN));
}

interface Entrada {
  horario: HorarioDia;
  duracaoMin: number;
  ocupados: Iterable<string>; // blocos HH:MM já ocupados nesse dia
  data: string;
  agora?: { data: string; hora: string };
}

/** Horários de início livres para um serviço em um dia. */
export function horariosDisponiveis({ horario, duracaoMin, ocupados, data, agora }: Entrada): string[] {
  if (!horario.aberto) return [];
  const ocupado = new Set(ocupados);
  const fim = paraMinutos(horario.fim);
  const { data: hoje, hora: horaAgora } = agora ?? agoraSaoPaulo();
  if (data < hoje) return [];
  const limite = data === hoje ? paraMinutos(horaAgora) : -1;
  const livres: string[] = [];
  for (let t = paraMinutos(horario.inicio); t + duracaoMin <= fim; t += SLOT_MIN) {
    if (t <= limite) continue;
    const hora = deMinutos(t);
    if (blocosDoAgendamento(hora, duracaoMin).every((b) => !ocupado.has(b))) livres.push(hora);
  }
  return livres;
}
