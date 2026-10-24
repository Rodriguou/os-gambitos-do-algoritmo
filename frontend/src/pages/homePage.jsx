import { useEffect, useRef, useState } from "react";
import { Header } from "../components/header";
import { BarraVantagem } from "../components/barraVantagem";
import { Tabuleiro } from "../components/tabuleiro";
import { PainelDicas } from "../components/painelDicas";
import { ControlesPartida } from "../components/controlesPartida";
import { AvisoFim } from "../components/avisoFim";
import { ModalConfiguracoes } from "../components/modalConfiguracoes";
import { ModalConfirmacao } from "../components/modalConfirmacao";
import { ModalPromocao } from "../components/modalPromocao";
import { AvisosToaster } from "../components/avisosToaster";
import { usePartida } from "../hooks/usePartida";
import { useRelogioPartida } from "../hooks/useRelogio";
import { useAnalise } from "../hooks/useAnalise";
import { useAvaliacaoPosicao } from "../hooks/useAvaliacaoPosicao";
import { useConfig } from "../hooks/useConfig";
import { NIVEL_PADRAO } from "../constants/partida";
import { vantagemDasBrancas } from "../utils/vantagem";
import { carregarFundo, salvarFundo } from "../utils/fundoSalvo";
import { avisarLanceIlegal } from "../utils/avisos";


// Aqui só mora o que é assunto da página: estado da interface e a ligação
// entre os componentes. Regra de xadrez é do usePartida.js (via chess.js).

export default function HomePage() {
  const [configAberto, setConfigAberto] = useState(false);
  const [nivel, setNivel] = useState(NIVEL_PADRAO);
  const [fundo, setFundo] = useState(carregarFundo);

  // Promoção pendente ({ from, to }) e confirmação pendente ("desistir" | "reiniciar")
  const [promocao, setPromocao] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);

  // Capacidades do backend: por enquanto, se a Azure está configurada
  const config = useConfig();

  // Análise do último lance (cards do painel)
  const {
    analise,
    analisando,
    erro,
    analisar,
    limpar: limparAnalise,
    usarAzure,
    definirUsarAzure,
  } = useAnalise();

  // Partida (regras e lance da IA no usePartida.js)
  const {
    posicao,
    acabou,
    fim,
    pensando,
    erroIA,
    podeVoltar,
    jogar,
    explicarLance,
    tentarNovamenteIA,
    voltarJogada,
    reiniciar,
    desistir,
  } = usePartida({
    nivel,
    onLanceJogador: analisar,
    onLanceIlegal: avisarLanceIlegal,
  });

  // Relógio único de partida: cresce enquanto a partida está viva
  const { tempoPartida, reiniciarRelogio } = useRelogioPartida({
    rodando: !acabou,
  });

  // Barra de vantagem: avalia a posição de agora, não o último lance analisado
  const { avaliacao: avaliacaoPosicao } = useAvaliacaoPosicao(posicao);

  // Desistência não é uma posição pior: é a partida perdida. A barra vai
  // pro extremo da IA; xeque-mate e empates já vêm certos da avaliação.
  const vantagemBrancas =
    fim?.motivo === "desistencia" ? 0 : vantagemDasBrancas(avaliacaoPosicao);

  // A configuração só é aplicada uma vez: se a Azure existe, o modo llm
  // passa a ser o padrão; se não, seguimos no Stockfish puro.
  const configAplicadaRef = useRef(false);
  useEffect(() => {
    if (!config || configAplicadaRef.current) return;
    configAplicadaRef.current = true;
    definirUsarAzure(Boolean(config.llm_available));
  }, [config, definirUsarAzure]);

  // Fundo novo vale na hora e fica salvo pra próxima visita
  function escolherFundo(novoFundo) {
    setFundo(novoFundo);
    salvarFundo(novoFundo);
  }

  // Reinício é sempre a mesma receita: tabuleiro, relógio e análise
  function comecarNovaPartida() {
    reiniciar();
    reiniciarRelogio();
    limparAnalise();
    setPromocao(null);
  }

  // Voltar a jogada também invalida a análise antiga; a barra se reavalia
  // sozinha porque a posição (FEN) mudou.
  function voltarUmaJogada() {
    voltarJogada();
    limparAnalise();
    setPromocao(null);
  }

  function confirmarAcao() {
    if (confirmacao === "desistir") desistir();
    if (confirmacao === "reiniciar") comecarNovaPartida();
    setConfirmacao(null);
  }

  function escolherPromocao(peca) {
    if (promocao) jogar({ ...promocao, promotion: peca });
    setPromocao(null);
  }

  // O modal de promoção só abre se o lance for legal; senão o jogador
  // recebe o motivo em vez de escolher uma peça que nunca vai entrar.
  function pedirPromocao(lance) {
    const aviso = explicarLance(lance);
    if (aviso) avisarLanceIlegal(aviso);
    else setPromocao(lance);
  }

  return (
    <div
      className="min-h-svh bg-cover bg-center"
      style={{ backgroundImage: `url(${fundo.imagem})` }}
    >
      {/* Véu escuro por cima da madeira */}
      <div className="flex min-h-svh flex-col bg-black/20 px-4 pb-6 backdrop-blur-[1px]">
        <Header nivelAtual={nivel} onTrocarNivel={setNivel} />

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 lg:flex-row lg:items-start">
          <section className="flex flex-1 flex-col gap-4">
            {/* Barra de vantagem: estado atual da partida */}
            <BarraVantagem vantagemBrancas={vantagemBrancas} />

            <Tabuleiro
              posicao={posicao}
              onJogar={jogar}
              onSolicitarPromocao={pedirPromocao}
              travado={pensando || Boolean(erroIA) || acabou}
              tempoPartida={tempoPartida}
            />

            {/* A IA falhou: a partida fica pausada até o jogador decidir */}
            {erroIA && !acabou && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-painel-fraco px-4 py-3 text-sm font-semibold text-fraco">
                <span>A IA não conseguiu jogar. A partida está pausada.</span>
                <button
                  type="button"
                  onClick={tentarNovamenteIA}
                  className="rounded-full bg-fraco px-4 py-1.5 text-white transition hover:opacity-90"
                >
                  Tentar de novo
                </button>
              </div>
            )}

            <ControlesPartida
              onVoltarJogada={voltarUmaJogada}
              voltarDesabilitado={podeVoltar === false}
              onDesistir={() => setConfirmacao("desistir")}
              onAbrirConfiguracoes={() => setConfigAberto(true)}
            />
          </section>

          <div className="w-full lg:w-72 xl:w-80">
            <PainelDicas
              analise={analise}
              analisando={analisando}
              erro={erro?.message ?? null}
              usarAzure={usarAzure}
            />
          </div>
        </main>
      </div>

      <ModalConfiguracoes
        aberto={configAberto}
        fundoAtual={fundo}
        usarAzure={usarAzure}
        azureDisponivel={Boolean(config?.llm_available)}
        onFechar={() => setConfigAberto(false)}
        onEscolherFundo={escolherFundo}
        onDefinirUsarAzure={definirUsarAzure}
        onReiniciar={() => {
          setConfigAberto(false);
          setConfirmacao("reiniciar");
        }}
      />

      <ModalPromocao
        aberto={promocao !== null}
        onEscolher={escolherPromocao}
        onCancelar={() => setPromocao(null)}
      />

      <ModalConfirmacao
        aberto={confirmacao !== null}
        titulo={
          confirmacao === "desistir"
            ? "Desistir da partida?"
            : "Começar uma nova partida?"
        }
        mensagem={
          confirmacao === "desistir"
            ? "A IA vence por desistência. Você pode começar outra partida quando quiser."
            : "O tabuleiro, o relógio e a análise serão zerados."
        }
        rotuloConfirmar={confirmacao === "desistir" ? "Desistir" : "Nova partida"}
        variante={confirmacao === "desistir" ? "perigo" : "normal"}
        onConfirmar={confirmarAcao}
        onCancelar={() => setConfirmacao(null)}
      />

      <AvisoFim fim={fim} onReiniciar={comecarNovaPartida} />

      <AvisosToaster />
    </div>
  );
}
