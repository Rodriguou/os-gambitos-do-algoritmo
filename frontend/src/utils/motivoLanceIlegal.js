import { Chess } from "chess.js";

// Explica por que um lance foi recusado pelo chess.js.
// Puro e sem React: recebe a instância do jogo e devolve { tipo, mensagem },
// ou null quando não há o que avisar (lance legal, soltou na mesma casa...).
//
// O chess.js só diz "Invalid move"; o motivo a gente descobre perguntando
// ao tabuleiro: rei em xeque, peça cravada, casa atacada e assim por diante.

const JOGADOR = "w";
const ADVERSARIO = "b";

const AVISOS = {
  "peca-da-ia": "Essa peça é da IA. Você joga com as brancas.",
  "casa-ocupada": "Essa casa já tem uma peça sua.",
  "em-xeque":
    "Seu rei está em xeque! Capture o atacante, bloqueie o ataque ou mova o rei.",
  cravada: "Essa peça está cravada: movê-la deixaria seu rei em xeque.",
  "casa-atacada": "O rei não pode ir para uma casa atacada.",
  "roque-em-xeque": "Você não pode rocar estando em xeque.",
  "roque-indisponivel":
    "Não dá pra rocar agora: rei ou torre já se moveram, há peças no caminho ou o rei passaria por uma casa atacada.",
  "rei-uma-casa": "O rei só anda uma casa por vez.",
  impossivel: "Esse movimento não é permitido para essa peça.",
};

function aviso(tipo) {
  return { tipo, mensagem: AVISOS[tipo] };
}

function temLance(jogo, from, to) {
  return jogo.moves({ square: from, verbose: true }).some((lance) => lance.to === to);
}

// Cópia do tabuleiro sem o rei do jogador. Sem ele, o chess.js deixa de
// filtrar lances por segurança do rei: sobra só a geometria da peça.
// Isso separa "cravada" de "movimento impossível", e deixa ver os ataques
// que passam por cima da casa do rei (ele não "faz sombra" pra si mesmo).
function semReiDoJogador(jogo) {
  const casaDoRei = jogo
    .board()
    .flat()
    .find((casa) => casa && casa.type === "k" && casa.color === JOGADOR)?.square;

  const copia = new Chess(jogo.fen());
  if (casaDoRei) copia.remove(casaDoRei);
  return copia;
}

function explicarRei(jogo, from, to) {
  const colunas = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const linhas = Math.abs(Number(from[1]) - Number(to[1]));

  // Roque: o rei anda duas casas saindo de e1
  if (from === "e1" && linhas === 0 && colunas === 2) {
    return aviso(jogo.inCheck() ? "roque-em-xeque" : "roque-indisponivel");
  }

  if (colunas > 1 || linhas > 1) return aviso("rei-uma-casa");

  if (semReiDoJogador(jogo).isAttacked(to, ADVERSARIO)) return aviso("casa-atacada");

  return aviso("impossivel");
}

export function explicarLanceIlegal(jogo, { from, to }) {
  if (!from || !to || from === to) return null;

  const peca = jogo.get(from);
  if (!peca) return null;

  if (peca.color !== JOGADOR) return aviso("peca-da-ia");

  // Se o lance é legal, não tem nada a explicar
  if (temLance(jogo, from, to)) return null;

  const alvo = jogo.get(to);
  if (alvo && alvo.color === peca.color) return aviso("casa-ocupada");

  if (peca.type === "k") return explicarRei(jogo, from, to);

  if (jogo.inCheck()) return aviso("em-xeque");

  // Sem o rei no tabuleiro o lance passa? Então só o rei exposto o barra
  return temLance(semReiDoJogador(jogo), from, to) ? aviso("cravada") : aviso("impossivel");
}
