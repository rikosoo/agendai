import { CATEGORIAS, DIAS_SEMANA, HORARIOS_PADRAO, type Negocio, type NegocioInput } from "@agendai/shared";
import { useState, type FormEvent } from "react";

interface Props {
  inicial?: Negocio;
  rotuloBotao: string;
  onSalvar: (dados: NegocioInput) => Promise<void>;
}

export default function NegocioForm({ inicial, rotuloBotao, onSalvar }: Props) {
  const [d, setD] = useState<NegocioInput>({
    nome: inicial?.nome ?? "",
    categoria: inicial?.categoria ?? CATEGORIAS[0],
    descricao: inicial?.descricao ?? "",
    cidade: inicial?.cidade ?? "",
    endereco: inicial?.endereco ?? "",
    telefone: inicial?.telefone ?? "",
    horarios: inicial?.horarios ?? HORARIOS_PADRAO,
  });
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const set = <K extends keyof NegocioInput>(k: K, v: NegocioInput[K]) => {
    setOk(false);
    setD((x) => ({ ...x, [k]: v }));
  };
  const setHorario = (i: number, patch: Partial<NegocioInput["horarios"][number]>) => set("horarios", d.horarios.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await onSalvar(d);
      setOk(true);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="grade2">
        <label>
          Nome do negócio
          <input required minLength={2} maxLength={80} value={d.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Studio Bella" />
        </label>
        <label>
          Categoria
          <select value={d.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Cidade
          <input required minLength={2} value={d.cidade} onChange={(e) => set("cidade", e.target.value)} />
        </label>
        <label>
          Telefone
          <input value={d.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" />
        </label>
      </div>
      <label>
        Endereço
        <input value={d.endereco} onChange={(e) => set("endereco", e.target.value)} />
      </label>
      <label>
        Descrição
        <textarea rows={3} maxLength={500} value={d.descricao} onChange={(e) => set("descricao", e.target.value)} />
      </label>

      <fieldset className="horarios">
        <legend>Horário de funcionamento</legend>
        {d.horarios.map((h, i) => (
          <div key={i} className="linha-horario">
            <label className="check">
              <input type="checkbox" checked={h.aberto} onChange={(e) => setHorario(i, { aberto: e.target.checked })} />
              {DIAS_SEMANA[i]}
            </label>
            {h.aberto ? (
              <span className="faixa">
                <input type="time" step={1800} value={h.inicio} onChange={(e) => setHorario(i, { inicio: e.target.value })} aria-label={`Abre ${DIAS_SEMANA[i]}`} />
                às
                <input type="time" step={1800} value={h.fim} onChange={(e) => setHorario(i, { fim: e.target.value })} aria-label={`Fecha ${DIAS_SEMANA[i]}`} />
              </span>
            ) : (
              <span className="mudo">Fechado</span>
            )}
          </div>
        ))}
      </fieldset>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="sucesso" role="status">Salvo com sucesso.</p>}
      <button className="btn" disabled={salvando}>
        {salvando ? "Salvando…" : rotuloBotao}
      </button>
    </form>
  );
}
