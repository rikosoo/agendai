import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HORARIOS_PADRAO, somarDias, agoraSaoPaulo } from "@agendai/shared";

process.env.TABLE_NAME = "t";
const { handler } = await import("../src/handler");
const ddb = mockClient(DynamoDBDocumentClient);

const evento = (method: string, path: string, opts: { body?: unknown; query?: Record<string, string>; sub?: string } = {}) =>
  ({
    rawPath: path,
    queryStringParameters: opts.query,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    requestContext: {
      http: { method },
      authorizer: opts.sub ? { jwt: { claims: { sub: opts.sub, email: `${opts.sub}@x.com`, name: "Fulana" } } } : undefined,
    },
  }) as any;

const amanha = somarDias(agoraSaoPaulo().data, 1);
const meta = { PK: "NEG#n1", SK: "META", id: "n1", nome: "Studio", categoria: "Salão de beleza", descricao: "", cidade: "SP", horarios: HORARIOS_PADRAO.map((h) => ({ ...h, aberto: true })), donoId: "dono" };
const servico = { PK: "NEG#n1", SK: "SERVICO#s1", id: "s1", nome: "Corte", duracaoMin: 60, preco: 50 };

beforeEach(() => {
  ddb.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  ddb.on(GetCommand).resolves({ Item: meta });
  ddb.on(QueryCommand, { KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)", ExpressionAttributeValues: { ":pk": "NEG#n1", ":sk": "SERVICO#" } }).resolves({ Items: [servico] });
  ddb.on(QueryCommand, { ExpressionAttributeValues: { ":pk": "NEG#n1", ":sk": `AGENDA#${amanha}T` } }).resolves({ Items: [] });
});

describe("API", () => {
  it("rotas protegidas exigem usuário", async () => {
    const r: any = await handler(evento("POST", "/agendamentos", { body: {} }));
    expect(r.statusCode).toBe(401);
  });

  it("lista horários livres de um serviço", async () => {
    const r: any = await handler(evento("GET", "/horarios", { query: { negocioId: "n1", servicoId: "s1", data: amanha } }));
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toContain("09:00");
  });

  it("cria agendamento reservando 2 blocos de 30 min em uma transação", async () => {
    ddb.on(TransactWriteCommand).resolves({});
    const r: any = await handler(evento("POST", "/agendamentos", { sub: "cli", body: { negocioId: "n1", servicoId: "s1", data: amanha, hora: "10:00" } }));
    expect(r.statusCode).toBe(201);
    const itens = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
    expect(itens.map((i) => i.Put!.Item!.SK)).toEqual([`AGENDA#${amanha}T10:00`, `AGENDA#${amanha}T10:30`, expect.stringMatching(/^AGENDAMENTO#/)]);
  });

  it("retorna 409 quando outro cliente reservou no mesmo instante", async () => {
    const e: any = new Error("conflict");
    e.name = "TransactionCanceledException";
    ddb.on(TransactWriteCommand).rejects(e);
    const r: any = await handler(evento("POST", "/agendamentos", { sub: "cli", body: { negocioId: "n1", servicoId: "s1", data: amanha, hora: "10:00" } }));
    expect(r.statusCode).toBe(409);
  });

  it("recusa horário já ocupado", async () => {
    ddb.on(QueryCommand, { ExpressionAttributeValues: { ":pk": "NEG#n1", ":sk": `AGENDA#${amanha}T` } }).resolves({ Items: [{ SK: `AGENDA#${amanha}T10:30` }] });
    const r: any = await handler(evento("POST", "/agendamentos", { sub: "cli", body: { negocioId: "n1", servicoId: "s1", data: amanha, hora: "10:00" } }));
    expect(r.statusCode).toBe(409);
  });

  it("cancelamento só vale para o cliente ou o dono", async () => {
    const ag = { id: `${amanha}T1000-abc`, clienteId: "cli", data: amanha, hora: "10:00", clienteEmail: "", clienteNome: "" };
    ddb.on(GetCommand, { Key: { PK: "USR#estranho", SK: `AGENDAMENTO#${ag.id}` } }).resolves({});
    ddb.on(GetCommand, { Key: { PK: "USR#estranho", SK: "NEGOCIO" } }).resolves({});
    const r: any = await handler(evento("DELETE", `/agendamentos/${ag.id}`, { sub: "estranho" }));
    expect(r.statusCode).toBe(404);
    expect(ddb.commandCalls(DeleteCommand).length + ddb.commandCalls(TransactWriteCommand).length).toBe(0);
  });

  it("valida o cadastro de serviço", async () => {
    ddb.on(GetCommand, { Key: { PK: "USR#dono", SK: "NEGOCIO" } }).resolves({ Item: { negocioId: "n1" } });
    const r: any = await handler(evento("POST", "/meu-negocio/servicos", { sub: "dono", body: { nome: "X", duracaoMin: 1, preco: 5 } }));
    expect(r.statusCode).toBe(400);
    ddb.on(PutCommand).resolves({});
    const ok: any = await handler(evento("POST", "/meu-negocio/servicos", { sub: "dono", body: { nome: "Corte", duracaoMin: 30, preco: 40 } }));
    expect(ok.statusCode).toBe(201);
  });

  it("rota inexistente retorna 404", async () => {
    const r: any = await handler(evento("GET", "/nada"));
    expect(r.statusCode).toBe(404);
  });
});
