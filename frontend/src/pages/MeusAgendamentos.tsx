import type { Agendamento } from "@agendai/shared";
import { agoraSaoPaulo } from "@agendai/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../lib/app";
import { dataLonga, duracao, preco } from "../lib/format";

export default function MeusAgendamentos() {
  const { api } = useApp();
  const ok = (useLocation().state as { ok?: string } | null)?.ok;
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(() => api.meusAgendamentos().then(setLista, (e) => setErro(e.message)), [api]);
  useEffect(() => void carregar(), [carregar]);

  async function cancelar(a: Agendamento) {
    if (!confirm(`Cancelar ${a.servicoNome} em ${a.negocioNome}?`)) return;
    setErro("");
    try {
      await api.cancelar(a.id);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const { data: hoje, hora: agora } = agoraSaoPaulo();
  const futuro = (a: Agendamento) => a.data > hoje || (a.data === hoje && a.hora > agora);
  const proximos = lista?.filter(futuro) ?? [];
  const passados = (lista?.filter((a) => !futuro(a)) ?? []).reverse();

  const Item = ({ a, pode }: { a: Agendamento; pode: boolean }) => (
    <li className="agendamento">
      <div className="quando">
        <strong>{a.hora}</strong>
        <span className="capitalizar">{dataLonga(a.data)}</span>
      </div>
      <div className="info">
        <strong>{a.servicoNome}</strong>
        <Link to={`/negocios/${a.negocioId}`}>{a.negocioNome}</Link>
        <span className="mudo">{duracao(a.duracaoMin)} · {preco(a.preco)}</span>
      </div>
      {pode && <button className="btn btn-sec btn-peq" onClick={() => cancelar(a)}>Cancelar</button>}
    </li>
  );

  return (
    <>
      <h1>Meus agendamentos</h1>
      {ok && <p className="sucesso" role="status">{ok}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!lista && !erro && <p className="mudo">Carregando…</p>}
      {lista && (
        <>
          <h2>Próximos</h2>
          {proximos.length === 0 ? (
            <p className="vazio">Você não tem agendamentos futuros. <Link to="/negocios">Encontrar um horário</Link></p>
          ) : (
            <ul className="lista-ag">{proximos.map((a) => <Item key={a.id} a={a} pode />)}</ul>
          )}
          {passados.length > 0 && (
            <>
              <h2>Anteriores</h2>
              <ul className="lista-ag passado">{passados.map((a) => <Item key={a.id} a={a} pode={false} />)}</ul>
            </>
          )}
        </>
      )}
    </>
  );
}
