import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { descreverFim } from "./fimPartida";

// Monta um tabuleiro e aplica os lances (SAN) em sequência
function apos(...lances) {
  const jogo = new Chess();
  for (const lance of lances) jogo.move(lance);
  return jogo;
}

describe("descreverFim", () => {
  it("detecta xeque-mate com a IA (pretas) vencendo", () => {
    // Mate do pastor ao contrário: as brancas é que levam mate
    const jogo = apos("f3", "e5", "g4", "Qh4#");
    expect(descreverFim(jogo)).toEqual({ motivo: "xeque-mate", vencedor: "pretas" });
  });

  it("detecta xeque-mate com o jogador (brancas) vencendo", () => {
    const jogo = apos("e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#");
    expect(descreverFim(jogo)).toEqual({ motivo: "xeque-mate", vencedor: "brancas" });
  });

  it("detecta afogamento", () => {
    const jogo = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(descreverFim(jogo)).toEqual({ motivo: "afogamento", vencedor: null });
  });

  it("detecta empate por material insuficiente", () => {
    const jogo = new Chess("8/8/4k3/8/8/4K3/8/8 w - - 0 1");
    expect(descreverFim(jogo)).toEqual({ motivo: "material-insuficiente", vencedor: null });
  });

  it("detecta empate por repetição de posição", () => {
    const jogo = apos("Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8");
    expect(descreverFim(jogo)).toEqual({ motivo: "repeticao", vencedor: null });
  });

  it("devolve null enquanto o jogo está em andamento", () => {
    expect(descreverFim(new Chess())).toBeNull();
  });
});
