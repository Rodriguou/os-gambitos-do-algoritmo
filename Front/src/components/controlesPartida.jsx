import { Flag, RotateCcw, Settings, Undo2 } from "lucide-react";


// Barra de botões embaixo do tabuleiro.
// Os handlers chegam por prop aqui é só apresentação, quem age é a página.

export function ControlesPartida({
  onVoltarJogada,
  onReiniciar,
  onDesistir,
  onAbrirConfiguracoes,
}) {
  // Estilo repetido numa const, quatro botões iguais, 1 unico estilo (vou trocar a cor deles) 
  const botao = "flex items-center justify-center gap-2 rounded-full bg-painel px-5 py-2 font-semibold text-texto-painel shadow-sm transition hover:bg-white";

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <button type="button" className={botao} onClick={onVoltarJogada}>
        <Undo2 className="h-5 w-5" />
        Voltar Jogada
      </button>

      <button type="button" className={botao} onClick={onReiniciar}>
        <RotateCcw className="h-5 w-5" />
        Reiniciar
      </button>

      <button type="button" className={botao} onClick={onDesistir}>
        <Flag className="h-5 w-5" />
        Desistir
      </button>

      {/* A engrenagem vai pro canto, de castigo, sozinha */}
      <button
        type="button"
        onClick={onAbrirConfiguracoes}
        aria-label="Abrir configurações"
        className="ml-auto rounded-xl bg-black/60 p-4 text-white transition hover:bg-black/80"
      >
        <Settings className="h-6 w-6" />
      </button>
    </div>
  );
}
