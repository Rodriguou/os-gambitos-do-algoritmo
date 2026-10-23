import { CartaoDica } from "./cartaoDica";
import { ROTULOS_CLASSIFICACAO } from "../constants/dicas";


// Painel de análise do último lance.
// A resposta da API chega pronta da página: aqui só decidimos como mostrar.

// Pros/cons chegam como listas; o cartão mostra tudo numa linha só
function juntar(itens, vazio) {
  return itens?.length ? itens.join(" · ") : vazio;
}

export function PainelDicas({
  analise,
  analisando = false,
  erro = null,
  usarAzure = false,
}) {
  const explicacao = analise?.explanation;
  const lance = analise?.move?.san;

  return (
    <aside className="flex w-full flex-col gap-2">
      {analisando && (
        <p className="px-1 text-xs text-white/80">Analisando o último lance...</p>
      )}

      {/* Pedimos Azure mas veio "rule": ela caiu e o backend segurou as pontas */}
      {usarAzure && explicacao?.mode === "rule" && (
        <p className="px-1 text-xs text-white/80">
          Azure indisponível — esta explicação veio do Stockfish puro.
        </p>
      )}

      {erro && (
        <p className="rounded-2xl bg-painel-fraco px-4 py-3 text-sm font-semibold text-fraco">
          {erro}
        </p>
      )}

      {!analise && !erro && !analisando && (
        <p className="rounded-2xl bg-painel/80 px-4 py-3 text-sm text-texto-painel">
          Jogue um lance pra receber a análise.
        </p>
      )}

      {analise && explicacao && (
        <>
          {/* 1. Avaliação geral da jogada */}
          <CartaoDica
            titulo="Avaliação geral"
            descricao={lance ? `${lance} · ${explicacao.summary}` : explicacao.summary}
            selo={ROTULOS_CLASSIFICACAO[explicacao.classification]}
            variante="destaque"
          />

          {/* 2. O que foi bom */}
          <CartaoDica
            titulo="Pontos positivos"
            descricao={juntar(explicacao.pros, "Nenhum destaque por aqui.")}
            variante="forte"
          />

          {/* 3. O que custou (ou pode custar) a posição */}
          <CartaoDica
            titulo="Pontos negativos"
            descricao={juntar(explicacao.cons, "Nada grave nesse lance.")}
            variante="fraco"
          />
        </>
      )}
    </aside>
  );
}
