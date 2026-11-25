import { agoraSaoPaulo, somarDias } from "@agendai/shared";
import { agendamentosDoDia, listarNegocios } from "./db";
import { enviarLembrete } from "./email";

/** Roda todo dia de manhã (EventBridge) e avisa quem tem horário amanhã. */
export async function handler(): Promise<{ enviados: number }> {
  const amanha = somarDias(agoraSaoPaulo().data, 1);
  let enviados = 0;
  for (const n of await listarNegocios()) {
    for (const ag of await agendamentosDoDia(n.id, amanha)) {
      if (ag.clienteEmail) {
        await enviarLembrete(ag);
        enviados++;
      }
    }
  }
  console.log(`Lembretes enviados para ${amanha}: ${enviados}`);
  return { enviados };
}
