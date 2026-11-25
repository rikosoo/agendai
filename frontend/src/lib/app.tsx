import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { criarApiHttp, type Api } from "./api";
import { criarAuthCognito, type Auth, type Sessao } from "./auth";
import { criarApiDemo, criarAuthDemo, reiniciarDemo } from "./mock";

interface Config {
  apiUrl?: string;
  userPoolId?: string;
  userPoolClientId?: string;
}

interface Ctx {
  api: Api;
  auth: Auth;
  sessao: Sessao | null;
  demo: boolean;
  entrar(login: string, senha: string): Promise<Sessao>;
  sair(): Promise<void>;
  atualizarSessao(): Promise<void>;
  reiniciarDemo(): void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
};

/** /config.json é gerado pelo CDK no deploy. Sem ele (npm run dev), roda em modo demonstração. */
async function carregarConfig(): Promise<Config> {
  try {
    const r = await fetch("/config.json", { cache: "no-store" });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return {};
    return await r.json();
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState<{ api: Api; auth: Auth; demo: boolean } | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(null);

  useEffect(() => {
    (async () => {
      const cfg = await carregarConfig();
      const real = cfg.apiUrl && cfg.userPoolId && cfg.userPoolClientId;
      const auth = real ? criarAuthCognito(cfg.userPoolId!, cfg.userPoolClientId!) : criarAuthDemo();
      const api = real ? criarApiHttp(cfg.apiUrl!, () => auth.token()) : criarApiDemo(auth);
      setSessao(await auth.atual());
      setPronto({ api, auth, demo: !real });
    })();
  }, []);

  const entrar = useCallback(
    async (login: string, senha: string) => {
      const s = await pronto!.auth.entrar(login, senha);
      setSessao(s);
      return s;
    },
    [pronto],
  );

  const valor = useMemo<Ctx | null>(
    () =>
      pronto && {
        ...pronto,
        sessao,
        entrar,
        sair: async () => {
          await pronto.auth.sair();
          setSessao(null);
        },
        atualizarSessao: async () => setSessao(await pronto.auth.atual()),
        reiniciarDemo: () => {
          reiniciarDemo();
          window.location.assign("/");
        },
      },
    [pronto, sessao, entrar],
  );

  if (!valor) return <div className="carregando">Carregando…</div>;
  return <AppCtx.Provider value={valor}>{children}</AppCtx.Provider>;
}
