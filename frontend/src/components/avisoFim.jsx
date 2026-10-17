// Aviso de fim de partida por cima do tabuleiro.
// Cobre xeque-mate, empates (afogamento, repetição, etc.) e desistência.

const MENSAGENS = {
  afogamento: "Empate por afogamento (rei sem lances).",
  "material-insuficiente": "Empate por material insuficiente.",
  repeticao: "Empate por repetição de posição.",
  "cinquenta-lances": "Empate pela regra dos 50 lances.",
  empate: "Empate.",
  desistencia: "Você desistiu. A IA venceu.",
};

function mensagemDe(fim) {
  // Xeque-mate depende de quem venceu
  if (fim.motivo === "xeque-mate") {
    return fim.vencedor === "brancas"
      ? "Xeque-mate! Você venceu 🎉"
      : "Xeque-mate! A IA venceu.";
  }
  return MENSAGENS[fim.motivo] ?? "Partida encerrada.";
}

// Só renderiza quando a partida acabou; caso contrário, nada
export function AvisoFim({ fim, onReiniciar }) {
  if (!fim) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-painel p-6 text-center text-texto-painel shadow-xl">
        <h2 className="text-xl font-bold">Fim de partida</h2>
        <p className="mt-2">{mensagemDe(fim)}</p>

        <button
          type="button"
          onClick={onReiniciar}
          className="mt-5 w-full rounded-full bg-black/80 px-5 py-2 font-semibold text-white transition hover:bg-black"
        >
          Nova partida
        </button>
      </div>
    </div>
  );
}
