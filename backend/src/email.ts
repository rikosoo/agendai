import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { Agendamento } from "@agendai/shared";

const ses = new SESv2Client({});

const fmtData = (d: string) => d.split("-").reverse().join("/");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function enviar(para: string, assunto: string, linhas: string[]) {
  const from = process.env.SES_FROM;
  if (!from) {
    console.log("SES_FROM não configurado; e-mail não enviado:", assunto);
    return;
  }
  const appUrl = process.env.APP_URL ?? "";
  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: `Agendaí <${from}>`,
        Destination: { ToAddresses: [para] },
        Content: {
          Simple: {
            Subject: { Data: assunto, Charset: "UTF-8" },
            Body: {
              Text: { Data: [...linhas, "", appUrl && `Gerencie em ${appUrl}/meus-agendamentos`].filter(Boolean).join("\n"), Charset: "UTF-8" },
              Html: { Data: `<div style="font-family:sans-serif">${linhas.map((l) => `<p>${esc(l)}</p>`).join("")}${appUrl ? `<p><a href="${esc(appUrl)}/meus-agendamentos">Ver meus agendamentos</a></p>` : ""}</div>`, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
  } catch (e) {
    // E-mail nunca deve derrubar a reserva (ex.: SES ainda no sandbox).
    console.error("Falha ao enviar e-mail", e);
  }
}

const resumo = (a: Agendamento) => `${a.servicoNome} em ${a.negocioNome} — ${fmtData(a.data)} às ${a.hora}`;

export const enviarConfirmacao = (a: Agendamento) =>
  enviar(a.clienteEmail, "Agendamento confirmado ✔", [`Olá, ${a.clienteNome}!`, `Seu agendamento está confirmado: ${resumo(a)}.`]);

export const enviarCancelamento = (a: Agendamento) =>
  enviar(a.clienteEmail, "Agendamento cancelado", [`Olá, ${a.clienteNome}.`, `O agendamento foi cancelado: ${resumo(a)}.`]);

export const enviarLembrete = (a: Agendamento) =>
  enviar(a.clienteEmail, "Lembrete: seu horário é amanhã", [`Olá, ${a.clienteNome}!`, `Lembrete do seu agendamento: ${resumo(a)}.`]);
