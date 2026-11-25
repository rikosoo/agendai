import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../lib/app";
import { ErroAuth } from "../lib/auth";
import { USUARIO_DEMO } from "../lib/mock";

export default function Entrar() {
  const { entrar, demo } = useApp();
  const nav = useNavigate();
  const de = (useLocation().state as { de?: string } | null)?.de ?? "/meus-agendamentos";
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await entrar(login, senha);
      nav(de, { replace: true });
    } catch (err) {
      if (err instanceof ErroAuth && err.codigo === "NAO_CONFIRMADO") return nav("/cadastrar", { state: { confirmar: login } });
      setErro((err as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="caixa-auth">
      <h1>Entrar</h1>
      {demo && (
        <div className="aviso-demo">
          <p>
            <strong>Usuário de demonstração</strong>
            <br />
            Login: <code>{USUARIO_DEMO.login}</code> · Senha: <code>{USUARIO_DEMO.senha}</code>
          </p>
          <button type="button" className="btn btn-sec btn-peq" onClick={() => { setLogin(USUARIO_DEMO.login); setSenha(USUARIO_DEMO.senha); }}>
            Preencher
          </button>
        </div>
      )}
      <form className="form" onSubmit={enviar}>
        <label>
          {demo ? "E-mail ou usuário" : "E-mail"}
          <input required type={demo ? "text" : "email"} autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
        </label>
        <label>
          Senha
          <input required type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn btn-bloco" disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="mudo">Ainda não tem conta? <Link to="/cadastrar" state={{ de }}>Criar conta</Link></p>
    </div>
  );
}
