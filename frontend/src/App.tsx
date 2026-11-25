import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Cadastrar from "./pages/Cadastrar";
import Entrar from "./pages/Entrar";
import Home from "./pages/Home";
import MeusAgendamentos from "./pages/MeusAgendamentos";
import NegocioDetalhe from "./pages/NegocioDetalhe";
import Negocios from "./pages/Negocios";
import NotFound from "./pages/NotFound";
import Painel from "./pages/Painel";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="negocios" element={<Negocios />} />
        <Route path="negocios/:id" element={<NegocioDetalhe />} />
        <Route path="entrar" element={<Entrar />} />
        <Route path="cadastrar" element={<Cadastrar />} />
        <Route element={<RequireAuth />}>
          <Route path="meus-agendamentos" element={<MeusAgendamentos />} />
          <Route path="painel" element={<Painel />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
