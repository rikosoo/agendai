import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../lib/app";

export default function RequireAuth() {
  const { sessao } = useApp();
  const loc = useLocation();
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: loc.pathname + loc.search }} />;
  return <Outlet />;
}
