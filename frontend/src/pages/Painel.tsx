import { agoraSaoPaulo, somarDias, type Agendamento, type Negocio } from "@agendai/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import NegocioForm from "../components/NegocioForm";
import { useApp } from "../lib/app";
import { dataLonga, duracao, preco } from "../lib/format";

type Aba = "agenda" | "servicos" | "negocio";

export default function Painel() {
  const { api } = useApp();
  const [negocio, setNegocio] = useState<Negocio | null | undefined>(undefined);
  const [aba, setAba] = useState<Aba>("agenda");
  const [erro, setErro] = useState("");

  useEffect(() => {
    api.meuNegocio().then(setNegocio, (e) => setErro(e.message));
  }, [api]);

  if (erro) return <p className="erro">{erro}</p>;
  if (negocio === undefined) return <p className="mudo">Carregando…</p>;

  if (negocio === null) {
    return (
      <div className="caixa-larga">
        <h1>Cadastre seu negócio</h1>
        <p className="lead">Em poucos minutos seus clientes já podem agendar online. Depois você adiciona os serviços.</p>
        <NegocioForm rotuloBotao="Criar meu negócio" onSalvar={async (d) => setNegocio(await api.criarNegocio(d))} />
      </div>
    );
  }

  return (
    <>
      <div className="painel-topo">
        <div>
          <p className="eyebrow">Painel</p>
          <h1>{negocio.nome}</h1>
        </div>
        <Link className="btn btn-sec btn-peq" to={`/negocios/${negocio.id}`}>Ver página pública</Link>
      </div>
      <div className="abas" role="tablist">
        {(["agenda", "servicos", "negocio"] as Aba[]).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "ativa" : ""} onClick={() => setAba(a)}>
            {{ agenda: "Agenda", servicos: "Serviços", negocio: "Dados e horários" }[a]}
          </button>
        ))}
      </div>
      {aba === "agenda" && <Agenda />}
      {aba === "servicos" && <Servicos negocio={negocio} onChange={setNegocio} />}
      {aba === "negocio" && <NegocioForm inicial={negocio} rotuloBotao="Salvar alterações" onSalvar={async (d) => setNegocio(await api.atualizarNegocio(d))} />}
    </>
  );
}

function Agenda() {
  const { api } = useApp();
  const [data, setData] = useState(() => agoraSaoPaulo().data);
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(() => {
    setLista(null);
    return api.agendaDoDia(data).then(setLista, (e) => setErro(e.message));
  }, [api, data]);
  useEffect(() => void carregar(), [carregar]);

  async function cancelar(a: Agendamento) {
    if (!confirm(`Cancelar ${a.servicoNome} de ${a.clienteNome} às ${a.hora}?`)) return;
    try {
      await api.cancelar(a.id);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <div className="nav-dia">
        <button className="btn btn-sec btn-peq" onClick={() => setData(somarDias(data, -1))} aria-label="Dia anterior">←</button>
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} aria-label="Data" />
        <button className="btn btn-sec btn-peq" onClick={() => setData(somarDias(data, 1))} aria-label="Próximo dia">→</button>
        <button className="btn btn-sec btn-peq" onClick={() => setData(agoraSaoPaulo().data)}>Hoje</button>
      </div>
      <p className="mudo capitalizar">{dataLonga(data)}</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!lista ? (
        <p className="mudo">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="vazio">Nenhum agendamento neste dia.</p>
      ) : (
        <ul className="lista-ag">
          {lista.map((a) => (
            <li key={a.id} className="agendamento">
              <div className="quando"><strong>{a.hora}</strong><span>{duracao(a.duracaoMin)}</span></div>
              <div className="info">
                <strong>{a.servicoNome}</strong>
                <span>{a.clienteNome} <span className="mudo">· {a.clienteEmail}</span></span>
                <span className="mudo">{preco(a.preco)}</span>
              </div>
              <button className="btn btn-sec btn-peq" onClick={() => cancelar(a)}>Cancelar</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Servicos({ negocio, onChange }: { negocio: Negocio; onChange: (n: Negocio) => void }) {
  const { api } = useApp();
  const [nome, setNome] = useState("");
  const [dur, setDur] = useState(30);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const s = await api.adicionarServico({ nome, duracaoMin: dur, preco: Number(valor.replace(",", ".")) });
      onChange({ ...negocio, servicos: [...negocio.servicos, s] });
      setNome("");
      setValor("");
    } catch (err) {
      setErro((err as Error).message);
    }
  }
  async function remover(id: string) {
    if (!confirm("Remover este serviço?")) return;
    try {
      await api.removerServico(id);
      onChange({ ...negocio, servicos: negocio.servicos.filter((s) => s.id !== id) });
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <>
      {negocio.servicos.length === 0 ? (
        <p className="vazio">Nenhum serviço ainda. Adicione o primeiro abaixo.</p>
      ) : (
        <ul className="lista-ag">
          {negocio.servicos.map((s) => (
            <li key={s.id} className="agendamento">
              <div className="info"><strong>{s.nome}</strong><span className="mudo">{duracao(s.duracaoMin)} · {preco(s.preco)}</span></div>
              <button className="btn btn-sec btn-peq" onClick={() => remover(s.id)}>Remover</button>
            </li>
          ))}
        </ul>
      )}
      <h2>Novo serviço</h2>
      <form className="form linha-form" onSubmit={adicionar}>
        <label>Nome<input required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Corte" /></label>
        <label>
          Duração
          <select value={dur} onChange={(e) => setDur(Number(e.target.value))}>
            {[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{duracao(m)}</option>)}
          </select>
        </label>
        <label>Preço (R$)<input required inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="50,00" /></label>
        <button className="btn">Adicionar</button>
      </form>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </>
  );
}
