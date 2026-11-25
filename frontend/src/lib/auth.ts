import { AuthenticationDetails, CognitoUser, CognitoUserAttribute, CognitoUserPool, type CognitoUserSession } from "amazon-cognito-identity-js";

export interface Sessao {
  id: string;
  email: string;
  nome: string;
}

export class ErroAuth extends Error {
  constructor(
    message: string,
    public codigo?: "NAO_CONFIRMADO",
  ) {
    super(message);
  }
}

export interface Auth {
  atual(): Promise<Sessao | null>;
  token(): Promise<string | null>;
  entrar(login: string, senha: string): Promise<Sessao>;
  cadastrar(nome: string, email: string, senha: string): Promise<{ precisaConfirmar: boolean }>;
  confirmar(email: string, codigo: string): Promise<void>;
  reenviarCodigo(email: string): Promise<void>;
  sair(): Promise<void>;
}

const MENSAGENS: Record<string, string> = {
  NotAuthorizedException: "E-mail ou senha incorretos.",
  UserNotFoundException: "E-mail ou senha incorretos.",
  UsernameExistsException: "Já existe uma conta com esse e-mail.",
  InvalidPasswordException: "A senha precisa ter 8+ caracteres, com maiúscula, minúscula e número.",
  CodeMismatchException: "Código incorreto.",
  ExpiredCodeException: "Código expirado. Peça um novo.",
  LimitExceededException: "Muitas tentativas. Aguarde um pouco.",
  TooManyRequestsException: "Muitas tentativas. Aguarde um pouco.",
  InvalidParameterException: "Dados inválidos. Confira e tente de novo.",
};
const traduzir = (e: any) => new ErroAuth(MENSAGENS[e?.code ?? e?.name] ?? e?.message ?? "Erro inesperado");

function sessaoDoToken(s: CognitoUserSession): Sessao {
  const p = s.getIdToken().decodePayload();
  return { id: p.sub, email: p.email, nome: p.name ?? String(p.email).split("@")[0] };
}

export function criarAuthCognito(userPoolId: string, clientId: string): Auth {
  const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
  const usuario = (email: string) => new CognitoUser({ Username: email.trim().toLowerCase(), Pool: pool });

  const sessaoAtual = () =>
    new Promise<CognitoUserSession | null>((resolve) => {
      const u = pool.getCurrentUser();
      if (!u) return resolve(null);
      u.getSession((err: Error | null, s: CognitoUserSession | null) => resolve(err || !s?.isValid() ? null : s));
    });

  return {
    async atual() {
      const s = await sessaoAtual();
      return s ? sessaoDoToken(s) : null;
    },
    async token() {
      return (await sessaoAtual())?.getIdToken().getJwtToken() ?? null;
    },
    entrar(login, senha) {
      return new Promise((resolve, reject) => {
        const u = usuario(login);
        u.authenticateUser(new AuthenticationDetails({ Username: login.trim().toLowerCase(), Password: senha }), {
          onSuccess: (s) => resolve(sessaoDoToken(s)),
          onFailure: (e) => reject(e?.code === "UserNotConfirmedException" ? new ErroAuth("Confirme seu e-mail para entrar.", "NAO_CONFIRMADO") : traduzir(e)),
          totpRequired: () => reject(new ErroAuth("Sua conta exige MFA, ainda não suportado nesta tela.")),
          mfaRequired: () => reject(new ErroAuth("Sua conta exige MFA, ainda não suportado nesta tela.")),
          newPasswordRequired: () => reject(new ErroAuth("É preciso definir uma nova senha antes de entrar.")),
        });
      });
    },
    cadastrar(nome, email, senha) {
      return new Promise((resolve, reject) => {
        pool.signUp(
          email.trim().toLowerCase(),
          senha,
          [new CognitoUserAttribute({ Name: "email", Value: email.trim().toLowerCase() }), new CognitoUserAttribute({ Name: "name", Value: nome.trim() })],
          [],
          (err, r) => (err ? reject(traduzir(err)) : resolve({ precisaConfirmar: !r?.userConfirmed })),
        );
      });
    },
    confirmar(email, codigo) {
      return new Promise((resolve, reject) => usuario(email).confirmRegistration(codigo.trim(), true, (err) => (err ? reject(traduzir(err)) : resolve())));
    },
    reenviarCodigo(email) {
      return new Promise((resolve, reject) => usuario(email).resendConfirmationCode((err) => (err ? reject(traduzir(err)) : resolve())));
    },
    async sair() {
      pool.getCurrentUser()?.signOut();
    },
  };
}
