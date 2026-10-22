import { useState } from "react";
import { Header } from "../components/header";
import { MenuPartida } from "../components/menuPartida";
import { BarraVantagem } from "../components/barraVantagem";
import { Tabuleiro } from "../components/tabuleiro";
import { PainelDicas } from "../components/painelDicas";
import { ControlesPartida } from "../components/controlesPartida";
import { AvisoFim } from "../components/avisoFim";
import { ModalConfiguracoes } from "../components/modalConfiguracoes";
import { usePartida } from "../hooks/usePartida";
import { useRelogio } from "../hooks/useRelogio";
import { useAnalise } from "../hooks/useAnalise";
import { MODOS_PARTIDA, NIVEIS_DIFICULDADE, TEMPO_INICIAL } from "../constants/partida";
import { vantagemDasBrancas } from "../utils/vantagem";
import { carregarFundo, salvarFundo } from "../utils/fundoSalvo";


// Aqui só mora o que é assunto da página estado da interface e a ligação entre os componentes
// Regra de xadrez é do usePartida.js (via usePartida, com a lib chess)

export default function HomePage() {
 
  const [menuAberto, setMenuAberto] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const [modo, setModo] = useState(MODOS_PARTIDA[0]);
  const [nivel, setNivel] = useState(NIVEIS_DIFICULDADE[1]);

  // Fundo da mesa, começa com o que estiver salvo no navegador
  const [fundo, setFundo] = useState(carregarFundo);

  // Dica de próximo lance começa ligada, pra ninguém esquecer que ela existe
  const [mostrarDica, setMostrarDica] = useState(true);

  // Análise do último lance (barra de vantagem + cards de dica)
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
  const { posicao, turno, acabou, fim, pensando, podeVoltar, jogar, voltarJogada, reiniciar, desistir } =
    usePartida({ nivel, onLanceJogador: analisar });


  // Relógio (Só o lado da vez marca tempo, e o relógio para sozinho quando a partidaacaba)
  const { tempoBrancas, tempoPretas, reiniciarRelogio } = useRelogio({
    turno,
    tempoInicial: TEMPO_INICIAL,
    rodando: !acabou,
  });

  // Cards de análise saem da resposta da API (useAnalise), não de placeholder

  function escolherModo(novoModo) {
    setModo(novoModo);
    setMenuAberto(false);
    // Falta uma função pra realmente trocar o modo (Meu mano Rodrigo, precisamos ver se realmente vai ter algo assim ou é viagem)
  }

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
  }

  return (
    <div
      className="min-h-svh bg-cover bg-center"
      style={{ backgroundImage: `url(${fundo.imagem})` }}
    >
      {/* Véu escuro por cima da madeira*/}
      <div className="flex min-h-svh flex-col bg-black/20 px-4 pb-6 backdrop-blur-[1px]">
        <Header
          modoAtual={modo}
          nivelAtual={nivel}
          onAbrirMenu={() => setMenuAberto(true)}
          onTrocarNivel={setNivel}
        />

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 lg:flex-row lg:items-start">
          <section className="flex flex-1 flex-col gap-4">
            {/* Barra de vantagem: avaliação do último lance analisado */}
            <BarraVantagem vantagemBrancas={vantagemDasBrancas(analise?.move)} />

            <Tabuleiro
              posicao={posicao}
              onJogar={jogar}
              travado={pensando || acabou}
              tempoPretas={tempoPretas}
              tempoBrancas={tempoBrancas}
            />

            <ControlesPartida
              onVoltarJogada={() => {
                voltarJogada();
                // A posição mudou, então a análise velha não serve mais
                limparAnalise();
              }}
              voltarDesabilitado={podeVoltar === false}
              onReiniciar={comecarNovaPartida}
              onDesistir={() => desistir()}
              onAbrirConfiguracoes={() => setConfigAberto(true)}
            />
          </section>

          <div className="w-full lg:w-72 xl:w-80">
            <PainelDicas
              analise={analise}
              analisando={analisando}
              erro={erro?.message ?? null}
              usarAzure={usarAzure}
              mostrarDica={mostrarDica}
              onAlternarDica={setMostrarDica}
            />
          </div>
        </main>
      </div>

      <MenuPartida
        aberto={menuAberto}
        modoAtual={modo}
        onFechar={() => setMenuAberto(false)}
        onEscolherModo={escolherModo}
      />

      <ModalConfiguracoes
        aberto={configAberto}
        fundoAtual={fundo}
        usarAzure={usarAzure}
        onFechar={() => setConfigAberto(false)}
        onEscolherFundo={escolherFundo}
        onDefinirUsarAzure={definirUsarAzure}
      />

      <AvisoFim fim={fim} onReiniciar={comecarNovaPartida} />
    </div>
  );
}
