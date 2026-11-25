import {
  HORARIOS_PADRAO,
  agoraSaoPaulo,
  blocosDoAgendamento,
  diaDaSemana,
  horariosDisponiveis,
  idAleatorio,
  slugify,
  somarDias,
  validarNegocio,
  validarServico,
  type Agendamento,
  type Negocio,
} from "@agendai/shared";
import { ApiErro, type Api } from "./api";
import { ErroAuth, type Auth, type Sessao } from "./auth";

/**
 * Modo demonstração: tudo roda no navegador (localStorage), sem AWS.
 * Usuário padrão já salvo:  login 123456 · senha 123456
 */
export const USUARIO_DEMO = { login: "123456", senha: "123456" };

interface Usuario {
  id: string;
  login: string; // e-mail ou "123456"
  email: string;
  nome: string;
  senha: string;
}
type NegocioDB = Negocio & { donoId: string };
interface DB {
  usuarios: Usuario[];
  negocios: NegocioDB[];
  agendamentos: Agendamento[];
}

const DB_KEY = "agendai-demo-db-v1";
const SESSAO_KEY = "agendai-demo-sessao";

function semear(): DB {
  const hoje = agoraSaoPaulo().data;
  const demo: Usuario = { id: "u-demo", login: "123456", email: "demo@agendai.com.br", nome: "Usuário Demo", senha: "123456" };
  const outros: Usuario[] = [
    { id: "u-zeca", login: "zeca@exemplo.com", email: "zeca@exemplo.com", nome: "Zeca", senha: "Demo1234" },
    { id: "u-sofia", login: "sofia@exemplo.com", email: "sofia@exemplo.com", nome: "Sofia", senha: "Demo1234" },
  ];
  const svc = (nome: string, duracaoMin: number, preco: number) => ({ id: idAleatorio(6), nome, duracaoMin, preco });
  const negocios: NegocioDB[] = [
    {
      id: "studio-bella",
      donoId: demo.id,
      nome: "Studio Bella",
      categoria: "Salão de beleza",
      cidade: "São Paulo",
      endereco: "Rua das Flores, 120 — Pinheiros",
      telefone: "(11) 99999-0001",
      descricao: "Cortes, coloração e tratamentos capilares com profissionais apaixonadas pelo que fazem.",
      horarios: HORARIOS_PADRAO,
      servicos: [svc("Corte feminino", 60, 90), svc("Escova", 45, 60), svc("Coloração", 120, 220), svc("Hidratação", 60, 110)],
    },
    {
      id: "barbearia-do-ze",
      donoId: outros[0].id,
      nome: "Barbearia do Zé",
      categoria: "Barbearia",
      cidade: "Belo Horizonte",
      endereco: "Av. Afonso Pena, 800 — Centro",
      telefone: "(31) 99999-0002",
      descricao: "Corte na régua, barba com toalha quente e cerveja gelada na espera.",
      horarios: HORARIOS_PADRAO.map((h, i) => (i === 0 ? h : { ...h, inicio: "10:00", fim: i === 6 ? "16:00" : "20:00" })),
      servicos: [svc("Corte", 30, 45), svc("Barba", 30, 35), svc("Corte + barba", 60, 70)],
    },
    {
      id: "clinica-sorriso",
      donoId: outros[1].id,
      nome: "Clínica Sorriso",
      categoria: "Clínica",
      cidade: "Curitiba",
      endereco: "Rua XV de Novembro, 55 — Centro",
      telefone: "(41) 99999-0003",
      descricao: "Odontologia geral, limpeza e clareamento em um ambiente tranquilo e acolhedor.",
      horarios: HORARIOS_PADRAO.map((h, i) => (i === 6 ? { ...h, aberto: false } : { ...h, inicio: "08:00", fim: "17:00" })),
      servicos: [svc("Consulta de avaliação", 30, 120), svc("Limpeza", 60, 180), svc("Clareamento", 90, 600)],
    },
  ];
  const cb = negocios[1];
  const agendamentos: Agendamento[] = [
    {
      id: `${somarDias(hoje, 2)}T1000-demo01`,
      negocioId: cb.id,
      negocioNome: cb.nome,
      servicoId: cb.servicos[2].id,
      servicoNome: cb.servicos[2].nome,
      duracaoMin: 60,
      preco: 70,
      data: somarDias(hoje, 2),
      hora: "10:00",
      clienteId: demo.id,
      clienteNome: demo.nome,
      clienteEmail: demo.email,
      criadoEm: new Date().toISOString(),
    },
  ];
  // Um agendamento na agenda do Studio Bella (dono = usuário demo), para o painel não nascer vazio.
  const sb = negocios[0];
  agendamentos.push({
    id: `${somarDias(hoje, 1)}T1400-demo02`,
    negocioId: sb.id,
    negocioNome: sb.nome,
    servicoId: sb.servicos[0].id,
    servicoNome: sb.servicos[0].nome,
    duracaoMin: 60,
    preco: 90,
    data: somarDias(hoje, 1),
    hora: "14:00",
    clienteId: outros[1].id,
    clienteNome: outros[1].nome,
    clienteEmail: outros[1].email,
    criadoEm: new Date().toISOString(),
  });
  return { usuarios: [demo, ...outros], negocios, agendamentos };
}

function carregar(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* localStorage indisponível: segue com dados novos */
  }
  const db = semear();
  salvar(db);
  return db;
}
function salvar(db: DB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* ignora */
  }
}
const espera = () => new Promise((r) => setTimeout(r, 120));

export function reiniciarDemo() {
  try {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSAO_KEY);
  } catch {
    /* ignora */
  }
}

// ───────────────────────── Auth demo ─────────────────────────
export function criarAuthDemo(): Auth {
  const paraSessao = (u: Usuario): Sessao => ({ id: u.id, email: u.email, nome: u.nome });
  const lerSessao = (): Sessao | null => {
    try {
      return JSON.parse(localStorage.getItem(SESSAO_KEY) ?? "null");
    } catch {
      return null;
    }
  };
  return {
    async atual() {
      return lerSessao();
    },
    async token() {
      return lerSessao() ? "demo" : null;
    },
    async entrar(login, senha) {
      await espera();
      const l = login.trim().toLowerCase();
      const u = carregar().usuarios.find((x) => x.login === l || x.email === l);
      if (!u || u.senha !== senha) throw new ErroAuth("Usuário ou senha incorretos.");
      localStorage.setItem(SESSAO_KEY, JSON.stringify(paraSessao(u)));
      return paraSessao(u);
    },
    async cadastrar(nome, email, senha) {
      await espera();
      const db = carregar();
      const e = email.trim().toLowerCase();
      if (db.usuarios.some((u) => u.login === e)) throw new ErroAuth("Já existe uma conta com esse e-mail.");
      db.usuarios.push({ id: `u-${idAleatorio(8)}`, login: e, email: e, nome: nome.trim(), senha });
      salvar(db);
      return { precisaConfirmar: false };
    },
    async confirmar() {},
    async reenviarCodigo() {},
    async sair() {
      localStorage.removeItem(SESSAO_KEY);
    },
  };
}

// ───────────────────────── API demo ─────────────────────────
export function criarApiDemo(auth: Auth): Api {
  const eu = async (): Promise<Sessao> => {
    const s = await auth.atual();
    if (!s) throw new ApiErro(401, "Faça login para continuar");
    return s;
  };
  const meuNegocioDB = (db: DB, id: string) => db.negocios.find((n) => n.donoId === id);
  const publico = ({ donoId: _d, ...n }: NegocioDB): Negocio => n;
  const ocupados = (db: DB, negocioId: string, data: string) =>
    db.agendamentos.filter((a) => a.negocioId === negocioId && a.data === data).flatMap((a) => blocosDoAgendamento(a.hora, a.duracaoMin));

  return {
    async listarNegocios(f) {
      await espera();
      const q = (f?.q ?? "").toLowerCase();
      return carregar()
        .negocios.filter((n) => (!q || `${n.nome} ${n.cidade} ${n.descricao}`.toLowerCase().includes(q)) && (!f?.categoria || n.categoria === f.categoria))
        .map((n) => {
          const { servicos: _s, donoId: _d, ...r } = n;
          return r;
        });
    },
    async obterNegocio(id) {
      await espera();
      const n = carregar().negocios.find((x) => x.id === id);
      if (!n) throw new ApiErro(404, "Negócio não encontrado");
      return publico(n);
    },
    async horarios(negocioId, servicoId, data) {
      await espera();
      const db = carregar();
      const n = db.negocios.find((x) => x.id === negocioId);
      const s = n?.servicos.find((x) => x.id === servicoId);
      if (!n || !s) throw new ApiErro(404, "Negócio ou serviço não encontrado");
      return horariosDisponiveis({ horario: n.horarios[diaDaSemana(data)], duracaoMin: s.duracaoMin, ocupados: ocupados(db, negocioId, data), data });
    },
    async agendar(novo) {
      const u = await eu();
      await espera();
      const db = carregar();
      const n = db.negocios.find((x) => x.id === novo.negocioId);
      const s = n?.servicos.find((x) => x.id === novo.servicoId);
      if (!n || !s) throw new ApiErro(404, "Negócio ou serviço não encontrado");
      const livres = horariosDisponiveis({ horario: n.horarios[diaDaSemana(novo.data)], duracaoMin: s.duracaoMin, ocupados: ocupados(db, n.id, novo.data), data: novo.data });
      if (!livres.includes(novo.hora)) throw new ApiErro(409, "Esse horário acabou de ser reservado. Escolha outro.");
      const ag: Agendamento = {
        id: `${novo.data}T${novo.hora.replace(":", "")}-${idAleatorio(6)}`,
        negocioId: n.id,
        negocioNome: n.nome,
        servicoId: s.id,
        servicoNome: s.nome,
        duracaoMin: s.duracaoMin,
        preco: s.preco,
        data: novo.data,
        hora: novo.hora,
        clienteId: u.id,
        clienteNome: u.nome,
        clienteEmail: u.email,
        criadoEm: new Date().toISOString(),
      };
      db.agendamentos.push(ag);
      salvar(db);
      return ag;
    },
    async meusAgendamentos() {
      const u = await eu();
      await espera();
      return carregar()
        .agendamentos.filter((a) => a.clienteId === u.id)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    },
    async cancelar(id) {
      const u = await eu();
      await espera();
      const db = carregar();
      const meuNeg = meuNegocioDB(db, u.id);
      const i = db.agendamentos.findIndex((a) => a.id === id && (a.clienteId === u.id || a.negocioId === meuNeg?.id));
      if (i < 0) throw new ApiErro(404, "Agendamento não encontrado");
      db.agendamentos.splice(i, 1);
      salvar(db);
    },
    async meuNegocio() {
      const u = await eu();
      await espera();
      const n = meuNegocioDB(carregar(), u.id);
      return n ? publico(n) : null;
    },
    async criarNegocio(input) {
      const u = await eu();
      const dados = validarNegocio(input);
      const db = carregar();
      if (meuNegocioDB(db, u.id)) throw new ApiErro(409, "Você já possui um negócio cadastrado");
      const n: NegocioDB = { ...dados, id: `${slugify(dados.nome)}-${idAleatorio(4)}`, donoId: u.id, servicos: [] };
      db.negocios.push(n);
      salvar(db);
      return publico(n);
    },
    async atualizarNegocio(input) {
      const u = await eu();
      const dados = validarNegocio(input);
      const db = carregar();
      const n = meuNegocioDB(db, u.id);
      if (!n) throw new ApiErro(404, "Você ainda não cadastrou um negócio");
      Object.assign(n, dados);
      salvar(db);
      return publico(n);
    },
    async adicionarServico(input) {
      const u = await eu();
      const dados = validarServico(input);
      const db = carregar();
      const n = meuNegocioDB(db, u.id);
      if (!n) throw new ApiErro(404, "Você ainda não cadastrou um negócio");
      const s = { id: idAleatorio(6), ...dados };
      n.servicos.push(s);
      salvar(db);
      return s;
    },
    async removerServico(id) {
      const u = await eu();
      const db = carregar();
      const n = meuNegocioDB(db, u.id);
      if (!n) throw new ApiErro(404, "Você ainda não cadastrou um negócio");
      n.servicos = n.servicos.filter((s) => s.id !== id);
      salvar(db);
    },
    async agendaDoDia(data) {
      const u = await eu();
      await espera();
      const db = carregar();
      const n = meuNegocioDB(db, u.id);
      if (!n) throw new ApiErro(404, "Você ainda não cadastrou um negócio");
      return db.agendamentos.filter((a) => a.negocioId === n.id && a.data === data).sort((a, b) => a.hora.localeCompare(b.hora));
    },
  };
}
