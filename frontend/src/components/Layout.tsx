import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../lib/app";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Agendaí — início">
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#ff9a1f" />
        <rect x="14" y="18" width="36" height="32" rx="6" fill="none" stroke="#111b2b" strokeWidth="4" />
        <path d="M14 28h36M24 12v10M40 12v10" stroke="#111b2b" strokeWidth="4" strokeLinecap="round" />
        <path d="M25 39l5 5 9-10" fill="none" stroke="#111b2b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Agendaí</span>
    </Link>
  );
}

export default function Layout() {
  const { sessao, sair, demo, reiniciarDemo } = useApp();
  const [aberto, setAberto] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    setAberto(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <>
      {demo && (
        <div className="faixa-demo" role="status">
          Modo demonstração — os dados ficam só neste navegador.{" "}
          <button className="link" onClick={() => confirm("Apagar os dados de demonstração e recomeçar?") && reiniciarDemo()}>
            Reiniciar demo
          </button>
        </div>
      )}
      <header className="topo">
        <div className="container topo-in">
          <Logo />
          <button className="menu-btn" aria-label="Abrir menu" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
            <span />
            <span />
            <span />
          </button>
          <nav className={`nav ${aberto ? "aberto" : ""}`}>
            <NavLink to="/negocios">Explorar</NavLink>
            {sessao && <NavLink to="/meus-agendamentos">Meus agendamentos</NavLink>}
            <NavLink to="/painel">Para negócios</NavLink>
            {sessao ? (
              <>
                <span className="ola">Olá, {sessao.nome.split(" ")[0]}</span>
                <button
                  className="btn btn-sec btn-peq"
                  onClick={async () => {
                    await sair();
                    nav("/");
                  }}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <NavLink to="/entrar">Entrar</NavLink>
                <Link to="/cadastrar" className="btn btn-peq">
                  Criar conta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="container principal">
        <Outlet />
      </main>
      <footer className="rodape">
        <div className="container">
          <Logo />
          <p>Agendamento online para salões, barbearias e consultórios.</p>
          <p className="pequeno">© {new Date().getFullYear()} Agendaí</p>
        </div>
      </footer>
    </>
  );
}
