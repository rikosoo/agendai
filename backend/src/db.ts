import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  blocosDoAgendamento,
  idAleatorio,
  slugify,
  type Agendamento,
  type Negocio,
  type NegocioInput,
  type Servico,
  type ServicoInput,
} from "@agendai/shared";

/**
 * Modelo de tabela única (agendai-main):
 *   NEG#<id>  | META                      dados do negócio  (GSI1PK = NEGOCIOS, GSI1SK = nome)
 *   NEG#<id>  | SERVICO#<id>              um serviço
 *   NEG#<id>  | AGENDA#<data>T<hora>      um bloco de 30 min ocupado (o 1º bloco guarda o agendamento)
 *   USR#<sub> | NEGOCIO                   ponteiro para o negócio do dono
 *   USR#<sub> | AGENDAMENTO#<id>          agendamento visto pelo cliente
 */
export const TABLE = () => process.env.TABLE_NAME!;

export const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export class Conflito extends Error {}

const NEG = (id: string) => `NEG#${id}`;
const USR = (sub: string) => `USR#${sub}`;

function paraNegocio(meta: Record<string, any>, servicos: Servico[]): Negocio {
  const { id, nome, categoria, descricao, cidade, endereco, telefone, horarios } = meta;
  return { id, nome, categoria, descricao, cidade, endereco, telefone, horarios, servicos };
}

export async function listarServicos(negocioId: string): Promise<Servico[]> {
  const r = await doc.send(
    new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": NEG(negocioId), ":sk": "SERVICO#" },
    }),
  );
  return (r.Items ?? []).map((i) => ({ id: i.id, nome: i.nome, duracaoMin: i.duracaoMin, preco: i.preco }));
}

export async function obterNegocio(id: string): Promise<Negocio | null> {
  const meta = await doc.send(new GetCommand({ TableName: TABLE(), Key: { PK: NEG(id), SK: "META" } }));
  if (!meta.Item) return null;
  return paraNegocio(meta.Item, await listarServicos(id));
}

export async function obterDonoDoNegocio(id: string): Promise<string | null> {
  const meta = await doc.send(new GetCommand({ TableName: TABLE(), Key: { PK: NEG(id), SK: "META" } }));
  return meta.Item?.donoId ?? null;
}

export async function listarNegocios(): Promise<Omit<Negocio, "servicos">[]> {
  const itens: Record<string, any>[] = [];
  let key: Record<string, any> | undefined;
  do {
    const r = await doc.send(
      new QueryCommand({
        TableName: TABLE(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :p",
        ExpressionAttributeValues: { ":p": "NEGOCIOS" },
        ExclusiveStartKey: key,
      }),
    );
    itens.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey;
  } while (key);
  return itens.map((i) => {
    const { servicos: _s, ...n } = paraNegocio(i, []);
    return n;
  });
}

export async function negocioDoDono(sub: string): Promise<string | null> {
  const r = await doc.send(new GetCommand({ TableName: TABLE(), Key: { PK: USR(sub), SK: "NEGOCIO" } }));
  return r.Item?.negocioId ?? null;
}

export async function criarNegocio(sub: string, input: NegocioInput): Promise<Negocio> {
  const id = `${slugify(input.nome)}-${idAleatorio(4)}`;
  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE(),
              Item: { PK: NEG(id), SK: "META", GSI1PK: "NEGOCIOS", GSI1SK: input.nome.toLowerCase(), id, donoId: sub, criadoEm: new Date().toISOString(), ...input },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: TABLE(),
              Item: { PK: USR(sub), SK: "NEGOCIO", negocioId: id },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );
  } catch (e: any) {
    if (e.name === "TransactionCanceledException") throw new Conflito("Você já possui um negócio cadastrado");
    throw e;
  }
  return paraNegocio({ id, ...input }, []);
}

export async function atualizarNegocio(id: string, input: NegocioInput): Promise<Negocio> {
  const atual = await doc.send(new GetCommand({ TableName: TABLE(), Key: { PK: NEG(id), SK: "META" } }));
  if (!atual.Item) throw new Conflito("Negócio não encontrado");
  await doc.send(
    new PutCommand({
      TableName: TABLE(),
      Item: { ...atual.Item, GSI1SK: input.nome.toLowerCase(), ...input },
      ConditionExpression: "attribute_exists(PK)",
    }),
  );
  return (await obterNegocio(id))!;
}

export async function adicionarServico(negocioId: string, input: ServicoInput): Promise<Servico> {
  const servico: Servico = { id: idAleatorio(6), ...input };
  await doc.send(new PutCommand({ TableName: TABLE(), Item: { PK: NEG(negocioId), SK: `SERVICO#${servico.id}`, ...servico } }));
  return servico;
}

export async function removerServico(negocioId: string, servicoId: string): Promise<void> {
  await doc.send(new DeleteCommand({ TableName: TABLE(), Key: { PK: NEG(negocioId), SK: `SERVICO#${servicoId}` } }));
}

/** Itens de agenda de um dia (blocos ocupados e agendamentos). */
export async function agendaDoDia(negocioId: string, data: string): Promise<Record<string, any>[]> {
  const r = await doc.send(
    new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": NEG(negocioId), ":sk": `AGENDA#${data}T` },
    }),
  );
  return r.Items ?? [];
}

export async function blocosOcupados(negocioId: string, data: string): Promise<string[]> {
  return (await agendaDoDia(negocioId, data)).map((i) => String(i.SK).slice(-5));
}

export async function agendamentosDoDia(negocioId: string, data: string): Promise<Agendamento[]> {
  return (await agendaDoDia(negocioId, data)).filter((i) => i.agendamento).map((i) => i.agendamento as Agendamento);
}

/** Reserva todos os blocos de uma vez; se algum já estiver ocupado, nada é gravado (409). */
export async function criarAgendamento(a: Omit<Agendamento, "id" | "criadoEm">): Promise<Agendamento> {
  const id = `${a.data}T${a.hora.replace(":", "")}-${idAleatorio(6)}`;
  const agendamento: Agendamento = { ...a, id, criadoEm: new Date().toISOString() };
  const blocos = blocosDoAgendamento(a.hora, a.duracaoMin);
  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          ...blocos.map((b, i) => ({
            Put: {
              TableName: TABLE(),
              Item: {
                PK: NEG(a.negocioId),
                SK: `AGENDA#${a.data}T${b}`,
                agendamentoId: id,
                clienteId: a.clienteId,
                ...(i === 0 ? { agendamento, blocos } : {}),
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          })),
          { Put: { TableName: TABLE(), Item: { PK: USR(a.clienteId), SK: `AGENDAMENTO#${id}`, ...agendamento } } },
        ],
      }),
    );
  } catch (e: any) {
    if (e.name === "TransactionCanceledException") throw new Conflito("Esse horário acabou de ser reservado. Escolha outro.");
    throw e;
  }
  return agendamento;
}

export async function agendamentosDoCliente(sub: string): Promise<Agendamento[]> {
  const r = await doc.send(
    new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": USR(sub), ":sk": "AGENDAMENTO#" },
    }),
  );
  return (r.Items ?? []).map(({ PK: _a, SK: _b, ...rest }) => rest as Agendamento);
}

/**
 * Cancela um agendamento. Pode cancelar o cliente que reservou ou o dono do negócio.
 * Retorna o agendamento cancelado ou null se não existir / sem permissão.
 */
export async function cancelarAgendamento(id: string, sub: string, negocioDoUsuario: string | null): Promise<Agendamento | null> {
  const meu = await doc.send(new GetCommand({ TableName: TABLE(), Key: { PK: USR(sub), SK: `AGENDAMENTO#${id}` } }));
  let negocioId: string | null = meu.Item?.negocioId ?? negocioDoUsuario;
  if (!negocioId) return null;
  const inicio = id.slice(0, 15); // 2026-11-20T1000 -> AGENDA#2026-11-20T10:00
  const sk = `AGENDA#${inicio.slice(0, 13)}:${inicio.slice(13, 15)}`;
  const slot = await doc.send(new GetCommand({ TableName: TABLE(), Key: { PK: NEG(negocioId), SK: sk } }));
  const ag = slot.Item?.agendamento as Agendamento | undefined;
  if (!ag || ag.id !== id) return null;
  if (ag.clienteId !== sub && negocioId !== negocioDoUsuario) return null;
  const blocos: string[] = slot.Item!.blocos;
  await doc.send(
    new TransactWriteCommand({
      TransactItems: [
        ...blocos.map((b) => ({ Delete: { TableName: TABLE(), Key: { PK: NEG(negocioId!), SK: `AGENDA#${ag.data}T${b}` } } })),
        { Delete: { TableName: TABLE(), Key: { PK: USR(ag.clienteId), SK: `AGENDAMENTO#${id}` } } },
      ],
    }),
  );
  return ag;
}
