// Traduz a avaliação do Stockfish em "quem está melhor", numa escala 0..1
// 1 = brancas ganhando, 0 = pretas ganhando, 0.5 = equilibrado

// Ela evita que +100cp pinte a barra inteira e deixa a leitura menos dramática
const ESCALA = 0.00368208;


// Recebe a avaliação da jogada e a perspectiva é sempre de quem jogou: o jogador, ou seja, as brancas
// Xeque-mate não tem conversa, vai direto pros extremos

export function vantagemDasBrancas(avaliacao) {
  if (!avaliacao) return 0.5;

  const { score_cp: scoreCp, mate_in: mateIn } = avaliacao;
  if (mateIn != null) return mateIn > 0 ? 1 : 0;
  if (scoreCp == null) return 0.5;

  return 1 / (1 + Math.exp(-ESCALA * scoreCp));
}

// A barra fala em vantagem da IA (pretas), então é só espelhar
export function vantagemDaIA(avaliacao) {
  return 1 - vantagemDasBrancas(avaliacao);
}
