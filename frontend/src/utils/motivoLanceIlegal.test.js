import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { explicarLanceIlegal } from "./motivoLanceIlegal";

// Devolve só o tipo do aviso (ou null), pra o teste ler fácil
function tipoDe(fen, from, to) {
  const jogo = fen ? new Chess(fen) : new Chess();
  return explicarLanceIlegal(jogo, { from, to })?.tipo ?? null;
}

describe("explicarLanceIlegal", () => {
  it("avisa quando a peça está cravada", () => {
    expect(tipoDe("4r2k/8/8/8/8/8/4B3/4K3 w - - 0 1", "e2", "d3")).toBe("cravada");
  });

  it("avisa quando o rei está em xeque e o lance não resolve", () => {
    expect(tipoDe("4r2k/8/8/8/8/8/3B4/4K3 w - - 0 1", "d2", "c3")).toBe("em-xeque");
  });

  it("avisa quando o rei vai para uma casa atacada", () => {
    expect(tipoDe("4k3/8/8/8/8/8/r7/4K3 w - - 0 1", "e1", "e2")).toBe("casa-atacada");
  });

  it("pega o ataque que passa por trás do rei", () => {
    // A torre em a1 dá xeque: recuar pela linha continua atacado
    expect(tipoDe("4k3/8/8/8/8/8/8/r3K3 w - - 0 1", "e1", "f1")).toBe("casa-atacada");
  });

  it("avisa quando a casa já tem peça do jogador", () => {
    expect(tipoDe(null, "a1", "a2")).toBe("casa-ocupada");
  });

  it("avisa quando a peça é da IA", () => {
    expect(tipoDe(null, "e7", "e5")).toBe("peca-da-ia");
  });

  it("avisa quando o movimento é impossível para a peça", () => {
    expect(tipoDe(null, "b1", "b3")).toBe("impossivel");
  });

  it("avisa que o rei só anda uma casa", () => {
    expect(tipoDe("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "e1", "e3")).toBe("rei-uma-casa");
  });

  it("avisa que não dá pra rocar em xeque", () => {
    expect(tipoDe("4k3/8/8/8/8/8/8/r3K2R w K - 0 1", "e1", "g1")).toBe("roque-em-xeque");
  });

  it("avisa quando o roque não está disponível", () => {
    expect(tipoDe("4k3/8/8/8/8/8/8/R3K2R w - - 0 1", "e1", "g1")).toBe("roque-indisponivel");
  });

  it("explica o peão cravado indo para a oitava fileira (promoção)", () => {
    // O bispo em a8 crava o peão de b7 ao rei em h1
    expect(tipoDe("b3k3/1P6/8/8/8/8/8/7K w - - 0 1", "b7", "b8")).toBe("cravada");
  });

  it("não avisa nada para um lance legal", () => {
    expect(tipoDe(null, "e2", "e4")).toBeNull();
  });

  it("não avisa nada quando o lance dá xeque-mate (é legal)", () => {
    expect(tipoDe("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1", "a8")).toBeNull();
  });

  it("não avisa nada quando solta a peça na mesma casa", () => {
    expect(tipoDe(null, "e2", "e2")).toBeNull();
  });

  it("devolve uma mensagem em português junto do tipo", () => {
    const aviso = explicarLanceIlegal(new Chess(), { from: "b1", to: "b3" });
    expect(aviso.mensagem).toMatch(/não é permitido/);
  });
});
