import { Lightbulb } from "lucide-react";
import { CartaoDica } from "./cartaoDica";
import { Alternador } from "./alternador";
import { ROTULOS_CLASSIFICACAO } from "../constants/dicas";


// Painel de análise do último lance.
// A resposta da API chega pronta da página: aqui só decidimos como mostrar

// Pros/cons chegam como listas; o cartão mostra tudo numa linha só
function juntar(itens, vazio) {
  return itens?.length ? itens.join(" · ") : vazio;
}

// Avaliação em centipawns vira aquele número de todo dia: +0.34, mate em 2
function formatarAvaliacao(avaliacao) {
  if (!avaliacao) return null;
  if (avaliacao.mate_in != null) return `mate em ${Math.abs(avaliacao.mate_in)}`;
  if (avaliacao.score_cp == null) return null;

  const peoes = avaliacao.score_cp / 100;
  return `${peoes > 0 ? "+" : ""}${peoes.toFixed(2)}`;
}

export function PainelDicas({
  analise,
  mostrarDica,
  onAlternarDica,
  analisando = false,
  erro = null,
  usarAzure = true,
}) {
  const explicacao = analise?.explanation;
  const sugestao = analise?.alternatives?.[0];
  const avaliacaoSugestao = formatarAvaliacao(sugestao);

  return (
    <aside className="flex w-full flex-col gap-2">
      <Alternador
        ativo={mostrarDica}
        onAlternar={onAlternarDica}
        rotulo="Dica de próximo lance"
        icone={<Lightbulb className="h-5 w-5" />}
      />

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
          <CartaoDica
            titulo={analise.move?.san ?? "Jogada"}
            descricao={explicacao.summary}
            selo={ROTULOS_CLASSIFICACAO[explicacao.classification]}
            variante="destaque"
          />

          <CartaoDica
            titulo="Ponto Forte"
            descricao={juntar(explicacao.pros, "Nenhum destaque por aqui.")}
            variante="forte"
          />

          <CartaoDica
            titulo="Ponto Fraco"
            descricao={juntar(explicacao.cons, "Nada grave nesse lance.")}
            variante="fraco"
          />

          {/* A dica só aparece com o switch ligado */}
          {mostrarDica && sugestao && (
            <CartaoDica
              titulo={`Próximo lance: faça ${sugestao.san}`}
              descricao={
                avaliacaoSugestao ? `Avaliação da posição: ${avaliacaoSugestao}` : null
              }
              variante="destaque"
            />
          )}
        </>
      )}
    </aside>
  );
}
