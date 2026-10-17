
// Barra "Vantagem da IA"
// `vantagem` vai de 0 (IA tomando um baile) a 1 (IA dominando)
// Falta fazer o real funcionar, por enquanto esta estatico

export function BarraVantagem({ vantagem = 0.5 }) {
  // Trava entre 0 e 1 pra um número torto não vazar do container
  const percentual = Math.min(Math.max(vantagem, 0), 1) * 100;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-white">Vantagem da IA</span>

      <div className="relative h-8 overflow-hidden rounded-lg bg-painel/70">
        {/* O branco avançando da esquerda é a vantagem das pretas (IA) */}
        <div
          className="absolute inset-y-0 left-0 bg-white transition-[width] duration-500"
          style={{ width: `${percentual}%` }}
        />

        {/* Rótulos por cima da barra: são referência */}
        <div className="relative flex h-full items-center justify-between px-4 text-sm text-texto-painel">
          <span>Pretas</span>
          <span>Equilíbrio</span>
          <span>Brancas</span>
        </div>
      </div>
    </div>
  );
}
