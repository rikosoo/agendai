import { CATEGORIAS } from "@agendai/shared";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/app";
import type { NegocioResumo } from "../lib/api";

export default function Negocios() {
  const { api } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const categoria = params.get("categoria") ?? "";
  const [lista, setLista] = useState<NegocioResumo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    setErro("");
    const t = setTimeout(() => {
      api.listarNegocios({ q, categoria }).then(
        (r) => !cancelado && setLista(r),
        (e) => !cancelado && setErro(e.message),
      );
    }, 200);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [api, q, categoria]);

  const mudar = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };

  return (
    <>
      <h1>Explorar negócios</h1>
      <div className="filtros">
        <input type="search" placeholder="Buscar por nome ou cidade…" value={q} onChange={(e) => mudar("q", e.target.value)} aria-label="Buscar" />
        <select value={categoria} onChange={(e) => mudar("categoria", e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!lista && !erro && <p className="mudo">Carregando…</p>}
      {lista?.length === 0 && <p className="vazio">Nenhum negócio encontrado. Tente outra busca.</p>}
      <div className="cards3">
        {lista?.map((n) => (
          <Link key={n.id} to={`/negocios/${n.id}`} className="card card-link">
            <span className="tag">{n.categoria}</span>
            <h3>{n.nome}</h3>
            <p className="mudo">{n.cidade}</p>
            <p>{n.descricao}</p>
            <span className="seta">Ver horários →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
