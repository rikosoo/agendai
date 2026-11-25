import { DIAS_SEMANA, agoraSaoPaulo, somarDias, type Negocio, type Servico } from "@agendai/shared";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../lib/app";
import { dataLonga, duracao, preco } from "../lib/format";

export default function NegocioDetalhe() {
  const { id } = useParams();
  const { api, sessao } = useApp();
  const nav = useNavigate();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [erro, setErro] = useState("");
  const [servico, setServico] = useState<Servico | null>(null);
  const [data, setData] = useState(() => somarDias(agoraSaoPaulo().data, 0));
  const [horas, setHoras] = useState<string[] | null>(null);
  const [hora, setHora] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroReserva, setErroReserva] = useState("");

  useEffect(() => {
    api.obterNegocio(id!).then(setNegocio, (e) => setErro(e.message));
  }, [api, id]);

  /** Ao escolher um serviço, já mostra o primeiro dia (até 14 dias à frente) com horário livre. */
  async function escolherServico(n: Negocio, s: Servico) {
    setServico(s);
    setErroReserva("");
    setHoras(null);
    let d = agoraSaoPaulo().data;
    try {
      for (let i = 0; i < 14; i++, d = somarDias(d, 1)) {
        if ((await api.horarios(n.id, s.id, d)).length > 0) break;
      }
      if (d >= somarDias(agoraSaoPaulo().data, 14)) d = agoraSaoPaulo().data;
    } catch {
      d = agoraSaoPaulo().data;
    }
    setData(d);
  }

  async function carregarHoras(n: Negocio, s: Servico, d: string) {
    setHoras(null);
    setHora("");
    try {
      setHoras(await api.horarios(n.id, s.id, d));
    } catch (e) {
      setErroReserva((e as Error).message);
      setHoras([]);
    }
  }
  useEffect(() => {
    if (negocio && servico && data) carregarHoras(negocio, servico, data);
  }, [negocio, servico, data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) return <p className="erro">{erro} <Link to="/negocios">Voltar</Link></p>;
  if (!negocio) return <p className="mudo">Carregando…</p>;

  async function confirmar() {
    if (!servico || !hora) return;
    if (!sessao) return nav("/entrar", { state: { de: `/negocios/${negocio!.id}` } });
    setEnviando(true);
    setErroReserva("");
    try {
      await api.agendar({ negocioId: negocio!.id, servicoId: servico.id, data, hora });
      nav("/meus-agendamentos", { state: { ok: "Agendamento confirmado! Enviamos os detalhes por e-mail." } });
    } catch (e) {
      setErroReserva((e as Error).message);
      carregarHoras(negocio!, servico, data);
    } finally {
      setEnviando(false);
    }
  }

  const hoje = agoraSaoPaulo().data;
  return (
    <>
      <Link to="/negocios" className="voltar">← Todos os negócios</Link>
      <div className="detalhe">
        <section>
          <span className="tag">{negocio.categoria}</span>
          <h1>{negocio.nome}</h1>
          <p className="mudo">{[negocio.endereco, negocio.cidade].filter(Boolean).join(" · ")}</p>
          {negocio.telefone && <p className="mudo">📞 {negocio.telefone}</p>}
          <p>{negocio.descricao}</p>

          <h2>Serviços</h2>
          {negocio.servicos.length === 0 && <p className="vazio">Este negócio ainda não cadastrou serviços.</p>}
          <ul className="lista-servicos">
            {negocio.servicos.map((s) => (
              <li key={s.id}>
                <button className={`servico ${servico?.id === s.id ? "sel" : ""}`} onClick={() => escolherServico(negocio, s)} aria-pressed={servico?.id === s.id}>
                  <strong>{s.nome}</strong>
                  <span className="mudo">{duracao(s.duracaoMin)}</span>
                  <span className="preco">{preco(s.preco)}</span>
                </button>
              </li>
            ))}
          </ul>

          <h2>Horário de funcionamento</h2>
          <ul className="tabela-horarios">
            {negocio.horarios.map((h, i) => (
              <li key={i}>
                <span>{DIAS_SEMANA[i]}</span>
                <span>{h.aberto ? `${h.inicio} – ${h.fim}` : "Fechado"}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="reserva">
          <h2>Agendar</h2>
          {!servico ? (
            <p className="mudo">Escolha um serviço ao lado para ver os horários.</p>
          ) : (
            <>
              <p><strong>{servico.nome}</strong> · {duracao(servico.duracaoMin)} · {preco(servico.preco)}</p>
              <label>
                Data
                <input type="date" min={hoje} value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
              </label>
              <p className="mudo capitalizar">{dataLonga(data)}</p>
              {horas === null ? (
                <p className="mudo">Buscando horários…</p>
              ) : horas.length === 0 ? (
                <p className="vazio">Sem horários livres nesse dia. Tente outra data.</p>
              ) : (
                <div className="slots" role="radiogroup" aria-label="Horários disponíveis">
                  {horas.map((h) => (
                    <button key={h} role="radio" aria-checked={hora === h} className={`slot ${hora === h ? "sel" : ""}`} onClick={() => setHora(h)}>
                      {h}
                    </button>
                  ))}
                </div>
              )}
              {erroReserva && <p className="erro" role="alert">{erroReserva}</p>}
              <button className="btn btn-bloco" disabled={!hora || enviando} onClick={confirmar}>
                {enviando ? "Confirmando…" : sessao ? "Confirmar agendamento" : "Entrar para confirmar"}
              </button>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
