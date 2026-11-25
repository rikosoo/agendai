import { CATEGORIAS } from "@agendai/shared";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Agendamento online</p>
        <h1>Marque seu horário em segundos, sem ligar nem esperar resposta.</h1>
        <p className="lead">Salões, barbearias, clínicas e consultórios com a agenda aberta 24 horas. Escolha o serviço, veja os horários livres e confirme.</p>
        <div className="acoes">
          <Link to="/negocios" className="btn btn-grande">Encontrar um horário</Link>
          <Link to="/painel" className="btn btn-sec btn-grande">Sou um negócio</Link>
        </div>
      </section>

      <section>
        <h2>Como funciona</h2>
        <div className="cards3">
          {[
            ["01", "Escolha o negócio", "Busque por nome, cidade ou categoria e veja os serviços e preços."],
            ["02", "Veja horários livres", "A agenda é atualizada na hora — sem conflito de horário."],
            ["03", "Confirme e pronto", "Você recebe a confirmação por e-mail e um lembrete no dia anterior."],
          ].map(([n, t, p]) => (
            <article className="card" key={n}>
              <span className="num">{n}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Explore por categoria</h2>
        <div className="chips">
          {CATEGORIAS.map((c) => (
            <Link key={c} className="chip" to={`/negocios?categoria=${encodeURIComponent(c)}`}>{c}</Link>
          ))}
        </div>
      </section>

      <section className="faixa-cta">
        <div>
          <h2>Tem um negócio?</h2>
          <p>Cadastre seus serviços e horários, e deixe seus clientes agendarem sozinhos. Você acompanha tudo no painel.</p>
        </div>
        <Link to="/painel" className="btn btn-grande">Abrir meu painel</Link>
      </section>
    </>
  );
}
