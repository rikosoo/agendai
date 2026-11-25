import type { Agendamento, Negocio, NegocioInput, NovoAgendamento, Servico, ServicoInput } from "@agendai/shared";

export type NegocioResumo = Omit<Negocio, "servicos">;

export interface Api {
  listarNegocios(f?: { q?: string; categoria?: string }): Promise<NegocioResumo[]>;
  obterNegocio(id: string): Promise<Negocio>;
  horarios(negocioId: string, servicoId: string, data: string): Promise<string[]>;
  agendar(n: NovoAgendamento): Promise<Agendamento>;
  meusAgendamentos(): Promise<Agendamento[]>;
  cancelar(id: string): Promise<void>;
  meuNegocio(): Promise<Negocio | null>;
  criarNegocio(i: NegocioInput): Promise<Negocio>;
  atualizarNegocio(i: NegocioInput): Promise<Negocio>;
  adicionarServico(i: ServicoInput): Promise<Servico>;
  removerServico(id: string): Promise<void>;
  agendaDoDia(data: string): Promise<Agendamento[]>;
}

export class ApiErro extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function criarApiHttp(baseUrl: string, getToken: () => Promise<string | null>): Api {
  async function req<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (auth) {
      const token = await getToken();
      if (!token) throw new ApiErro(401, "Faça login para continuar");
      headers.authorization = token;
    }
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiErro(0, "Sem conexão com o servidor. Tente novamente.");
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiErro(res.status, data.erro ?? data.message ?? "Erro inesperado");
    return data as T;
  }
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
    return p ? `?${p}` : "";
  };

  return {
    listarNegocios: (f) => req("GET", `/negocios${qs({ q: f?.q, categoria: f?.categoria })}`),
    obterNegocio: (id) => req("GET", `/negocios/${encodeURIComponent(id)}`),
    horarios: (negocioId, servicoId, data) => req("GET", `/horarios${qs({ negocioId, servicoId, data })}`),
    agendar: (n) => req("POST", "/agendamentos", n, true),
    meusAgendamentos: () => req("GET", "/agendamentos", undefined, true),
    cancelar: (id) => req("DELETE", `/agendamentos/${encodeURIComponent(id)}`, undefined, true),
    meuNegocio: async () => {
      try {
        return await req<Negocio>("GET", "/meu-negocio", undefined, true);
      } catch (e) {
        if (e instanceof ApiErro && e.status === 404) return null;
        throw e;
      }
    },
    criarNegocio: (i) => req("POST", "/negocios", i, true),
    atualizarNegocio: (i) => req("PUT", "/meu-negocio", i, true),
    adicionarServico: (i) => req("POST", "/meu-negocio/servicos", i, true),
    removerServico: (id) => req("DELETE", `/meu-negocio/servicos/${encodeURIComponent(id)}`, undefined, true),
    agendaDoDia: (data) => req("GET", `/meu-negocio/agendamentos${qs({ data })}`, undefined, true),
  };
}
