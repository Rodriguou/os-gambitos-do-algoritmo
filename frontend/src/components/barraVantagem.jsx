// Barra de vantagem da posição atual
// Recebe a chance das brancas (0 = IA dominando, 1 = jogador dominando)
// Desenho de cabo de guerra: o branco cresce da direita, o escuro que sobra é a IA

export function BarraVantagem({ vantagemBrancas = 0.5 }) {
  // Trava entre 0 e 1 pra um número torto não vazar do container
  const percentualBrancas = Math.min(Math.max(vantagemBrancas, 0), 1) * 100;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-white">Vantagem na posição</span>

      <div className="relative h-8 overflow-hidden rounded-lg bg-black/60">
        {/* O branco avança da direita; o que sobra escuro é a vantagem das pretas */}
        <div
          className="absolute inset-y-0 right-0 bg-white transition-[width] duration-500"
          style={{ width: `${percentualBrancas}%` }}
        />

        {/* Marquinho do equilíbrio, só pra dar aquela impressão de precisão */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-black/20" />
      </div>

      {/* Rótulos embaixo pra não brigar com o contraste do preenchimento */}
      <div className="flex justify-between text-xs text-white/80">
        <span>IA (Pretas)</span>
        <span>Equilíbrio</span>
        <span>Você (Brancas)</span>
      </div>
    </div>
  );
}
