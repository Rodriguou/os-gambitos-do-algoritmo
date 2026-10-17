import { Lightbulb } from "lucide-react";
import { CartaoDica } from "./cartaoDica";


// Reposta da API Desembarca aqui para as dicas
// Só passar a resposta para o cartao (tem os exemplo ai embaixo)

export function PainelDicas({ dicas, onPedirDica }) {
  const { jogada, pontoForte, pontoFraco } = dicas;

  return (
    <aside className="flex w-full flex-col gap-2">
      <CartaoDica
        titulo={jogada.titulo}
        descricao={jogada.descricao}
        selo={jogada.selo}
        variante="destaque"
      />

      <CartaoDica titulo="Ponto Forte" descricao={pontoForte} variante="forte" />

      <CartaoDica titulo="Ponto Fraco" descricao={pontoFraco} variante="fraco" />

      <button
        type="button"
        onClick={onPedirDica}
        className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-painel px-4 py-2 font-semibold text-texto-painel shadow-sm transition hover:bg-white"
      >
        <Lightbulb className="h-5 w-5" />
        Pedir dica pra IA
      </button>
    </aside>
  );
}
