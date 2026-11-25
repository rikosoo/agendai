/** Contrato compartilhado entre site, API e modo demonstração. */

export const CATEGORIAS = ["Salão de beleza", "Barbearia", "Clínica", "Consultório", "Estética", "Outros"] as const;

export interface Servico {
  id: string;
  nome: string;
  duracaoMin: number;
  preco: number; // em reais
}

/** Horário de funcionamento de um dia da semana (0 = domingo ... 6 = sábado). */
export interface HorarioDia {
  aberto: boolean;
  inicio: string; // "09:00"
  fim: string; // "18:00"
}

export interface NegocioInput {
  nome: string;
  categoria: string;
  descricao: string;
  cidade: string;
  endereco?: string;
  telefone?: string;
  horarios: HorarioDia[]; // sempre 7 itens
}

export interface Negocio extends NegocioInput {
  id: string;
  servicos: Servico[];
}

export interface ServicoInput {
  nome: string;
  duracaoMin: number;
  preco: number;
}

export interface Agendamento {
  id: string;
  negocioId: string;
  negocioNome: string;
  servicoId: string;
  servicoNome: string;
  duracaoMin: number;
  preco: number;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  clienteId: string;
  clienteNome: string;
  clienteEmail: string;
  criadoEm: string;
}

export interface NovoAgendamento {
  negocioId: string;
  servicoId: string;
  data: string;
  hora: string;
}

export const HORARIOS_PADRAO: HorarioDia[] = [
  { aberto: false, inicio: "09:00", fim: "18:00" },
  { aberto: true, inicio: "09:00", fim: "18:00" },
  { aberto: true, inicio: "09:00", fim: "18:00" },
  { aberto: true, inicio: "09:00", fim: "18:00" },
  { aberto: true, inicio: "09:00", fim: "18:00" },
  { aberto: true, inicio: "09:00", fim: "18:00" },
  { aberto: true, inicio: "09:00", fim: "13:00" },
];

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
