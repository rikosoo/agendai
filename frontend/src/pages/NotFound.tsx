import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="caixa-auth">
      <h1>Página não encontrada</h1>
      <p className="mudo">O endereço que você tentou abrir não existe.</p>
      <Link to="/" className="btn">Voltar ao início</Link>
    </div>
  );
}
