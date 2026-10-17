// Descreve o fim da partida (ou null enquanto ela rola).
// Recebe a instância do chess.js e devolve o motivo (e o vencedor, quando há).
// Fica separado do hook pra ser testável sem React.
//
// A ordem importa: xeque-mate antes de afogamento/empate.
export function descreverFim(jogo) {
  if (jogo.isCheckmate()) {
    return { motivo: "xeque-mate", vencedor: jogo.turn() === "w" ? "pretas" : "brancas" };
  }
  if (jogo.isStalemate()) return { motivo: "afogamento", vencedor: null };
  if (jogo.isInsufficientMaterial()) return { motivo: "material-insuficiente", vencedor: null };
  if (jogo.isThreefoldRepetition()) return { motivo: "repeticao", vencedor: null };
  if (jogo.isDrawByFiftyMoves()) return { motivo: "cinquenta-lances", vencedor: null };
  if (jogo.isDraw()) return { motivo: "empate", vencedor: null };
  return null;
}
