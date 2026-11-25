import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  agoraSaoPaulo,
  diaDaSemana,
  ehData,
  ehHora,
  horariosDisponiveis,
  paraMinutos,
  validarNegocio,
  validarServico,
  ErroValidacao,
  type Agendamento,
} from "@agendai/shared";
import * as db from "./db";
import { enviarCancelamento, enviarConfirmacao } from "./email";

class HttpErro extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (status: number, body?: unknown): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: body === undefined ? "" : JSON.stringify(body),
});

function corpo(event: APIGatewayProxyEventV2): any {
  if (!event.body) throw new HttpErro(400, "Corpo da requisição ausente");
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body);
  } catch {
    throw new HttpErro(400, "JSON inválido");
  }
}

interface Usuario {
  sub: string;
  email: string;
  nome: string;
}

function usuario(event: APIGatewayProxyEventV2): Usuario {
  const c = (event.requestContext as any).authorizer?.jwt?.claims;
  if (!c?.sub) throw new HttpErro(401, "Não autenticado");
  return { sub: c.sub, email: c.email ?? "", nome: c.name ?? String(c.email ?? "Cliente").split("@")[0] };
}

async function meuNegocioId(u: Usuario): Promise<string> {
  const id = await db.negocioDoDono(u.sub);
  if (!id) throw new HttpErro(404, "Você ainda não cadastrou um negócio");
  return id;
}

type Rota = (event: APIGatewayProxyEventV2, p: Record<string, string>) => Promise<APIGatewayProxyResultV2>;

const rotas: [string, RegExp, Rota][] = [];
const rota = (metodo: string, caminho: string, fn: Rota) =>
  rotas.push([metodo, new RegExp("^" + caminho.replace(/\{(\w+)\}/g, "(?<$1>[^/]+)") + "/?$"), fn]);

rota("GET", "/negocios", async (e) => {
  const q = (e.queryStringParameters?.q ?? "").toLowerCase();
  const categoria = e.queryStringParameters?.categoria;
  const lista = (await db.listarNegocios()).filter(
    (n) => (!q || `${n.nome} ${n.cidade} ${n.descricao}`.toLowerCase().includes(q)) && (!categoria || n.categoria === categoria),
  );
  return json(200, lista);
});

rota("GET", "/negocios/{id}", async (_e, p) => {
  const n = await db.obterNegocio(p.id);
  return n ? json(200, n) : json(404, { erro: "Negócio não encontrado" });
});

rota("GET", "/horarios", async (e) => {
  const { negocioId, servicoId, data } = e.queryStringParameters ?? {};
  if (!negocioId || !servicoId || !ehData(data)) throw new HttpErro(400, "Informe negocioId, servicoId e data (YYYY-MM-DD)");
  const n = await db.obterNegocio(negocioId);
  const servico = n?.servicos.find((s) => s.id === servicoId);
  if (!n || !servico) throw new HttpErro(404, "Negócio ou serviço não encontrado");
  const ocupados = await db.blocosOcupados(negocioId, data);
  return json(200, horariosDisponiveis({ horario: n.horarios[diaDaSemana(data)], duracaoMin: servico.duracaoMin, ocupados, data }));
});

rota("POST", "/agendamentos", async (e) => {
  const u = usuario(e);
  const b = corpo(e);
  if (typeof b.negocioId !== "string" || typeof b.servicoId !== "string" || !ehData(b.data) || !ehHora(b.hora)) throw new HttpErro(400, "Dados do agendamento inválidos");
  const n = await db.obterNegocio(b.negocioId);
  const servico = n?.servicos.find((s) => s.id === b.servicoId);
  if (!n || !servico) throw new HttpErro(404, "Negócio ou serviço não encontrado");
  const ocupados = await db.blocosOcupados(n.id, b.data);
  const livres = horariosDisponiveis({ horario: n.horarios[diaDaSemana(b.data)], duracaoMin: servico.duracaoMin, ocupados, data: b.data });
  if (!livres.includes(b.hora)) throw new HttpErro(409, "Horário indisponível");
  const ag = await db.criarAgendamento({
    negocioId: n.id,
    negocioNome: n.nome,
    servicoId: servico.id,
    servicoNome: servico.nome,
    duracaoMin: servico.duracaoMin,
    preco: servico.preco,
    data: b.data,
    hora: b.hora,
    clienteId: u.sub,
    clienteNome: u.nome,
    clienteEmail: u.email,
  });
  await enviarConfirmacao(ag);
  return json(201, ag);
});

rota("GET", "/agendamentos", async (e) => {
  const lista = await db.agendamentosDoCliente(usuario(e).sub);
  return json(200, lista.sort((a, b) => (a.id < b.id ? -1 : 1)));
});

rota("DELETE", "/agendamentos/{id}", async (e, p) => {
  const u = usuario(e);
  const ag = await db.cancelarAgendamento(decodeURIComponent(p.id), u.sub, await db.negocioDoDono(u.sub));
  if (!ag) throw new HttpErro(404, "Agendamento não encontrado");
  await enviarCancelamento(ag as Agendamento);
  return json(204);
});

rota("GET", "/meu-negocio", async (e) => {
  const n = await db.obterNegocio(await meuNegocioId(usuario(e)));
  return n ? json(200, n) : json(404, { erro: "Negócio não encontrado" });
});

rota("POST", "/negocios", async (e) => json(201, await db.criarNegocio(usuario(e).sub, validarNegocio(corpo(e)))));

rota("PUT", "/meu-negocio", async (e) => json(200, await db.atualizarNegocio(await meuNegocioId(usuario(e)), validarNegocio(corpo(e)))));

rota("POST", "/meu-negocio/servicos", async (e) => json(201, await db.adicionarServico(await meuNegocioId(usuario(e)), validarServico(corpo(e)))));

rota("DELETE", "/meu-negocio/servicos/{id}", async (e, p) => {
  await db.removerServico(await meuNegocioId(usuario(e)), p.id);
  return json(204);
});

rota("GET", "/meu-negocio/agendamentos", async (e) => {
  const data = e.queryStringParameters?.data ?? agoraSaoPaulo().data;
  if (!ehData(data)) throw new HttpErro(400, "Data inválida");
  const lista = await db.agendamentosDoDia(await meuNegocioId(usuario(e)), data);
  return json(200, lista.sort((a, b) => paraMinutos(a.hora) - paraMinutos(b.hora)));
});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const metodo = event.requestContext.http.method;
  const caminho = event.rawPath;
  try {
    for (const [m, re, fn] of rotas) {
      const match = m === metodo && re.exec(caminho);
      if (match) return await fn(event, { ...match.groups });
    }
    return json(404, { erro: "Rota não encontrada" });
  } catch (e) {
    if (e instanceof HttpErro) return json(e.status, { erro: e.message });
    if (e instanceof ErroValidacao) return json(400, { erro: e.message });
    if (e instanceof db.Conflito) return json(409, { erro: e.message });
    console.error("Erro inesperado", e);
    return json(500, { erro: "Erro interno" });
  }
}
