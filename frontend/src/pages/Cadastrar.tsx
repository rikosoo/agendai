import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../lib/app";

export default function Cadastrar() {
  const { auth, entrar } = useApp();
  const nav = useNavigate();
  const estado = useLocation().state as { de?: string; confirmar?: string } | null;
  const de = estado?.de ?? "/meus-agendamentos";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(estado?.confirmar ?? "");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"dados" | "codigo">(estado?.confirmar ? "codigo" : "dados");
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function executar(fn: () => Promise<void>) {
    setErro("");
    setCarregando(true);
    try {
      await fn();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const criar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const r = await auth.cadastrar(nome, email, senha);
      if (r.precisaConfirmar) {
        setInfo(`Enviamos um código de 6 dígitos para ${email}.`);
        setEtapa("codigo");
      } else {
        await entrar(email, senha);
        nav(de, { replace: true });
      }
    });
  };

  const confirmar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      await auth.confirmar(email, codigo);
      if (senha) {
        await entrar(email, senha);
        nav(de, { replace: true });
      } else {
        nav("/entrar", { state: { de } });
      }
    });
  };

  return (
    <div className="caixa-auth">
      {etapa === "dados" ? (
        <>
          <h1>Criar conta</h1>
          <form className="form" onSubmit={criar}>
            <label>
              Nome
              <input required minLength={2} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label>
              E-mail
              <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Senha
              <input required type="password" minLength={8} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
              <small className="mudo">Mínimo 8 caracteres, com maiúscula, minúscula e número.</small>
            </label>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button className="btn btn-bloco" disabled={carregando}>{carregando ? "Criando…" : "Criar conta"}</button>
          </form>
          <p className="mudo">Já tem conta? <Link to="/entrar" state={{ de }}>Entrar</Link></p>
        </>
      ) : (
        <>
          <h1>Confirme seu e-mail</h1>
          {info && <p className="sucesso">{info}</p>}
          <form className="form" onSubmit={confirmar}>
            <label>
              E-mail
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Código
              <input required inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button className="btn btn-bloco" disabled={carregando}>Confirmar</button>
          </form>
          <button className="link" onClick={() => executar(async () => { await auth.reenviarCodigo(email); setInfo("Código reenviado."); })}>Reenviar código</button>
        </>
      )}
    </div>
  );
}
