<p align="center">
  <img src="./og-image.png" alt="Rhyme — treinador de rima e freestyle em tempo real" width="640">
</p>

<h1 align="center">Rhyme</h1>

<p align="center">
  <strong>Treinador de rima e freestyle em tempo real.</strong><br>
  Fale no microfone e veja rimas — perfeitas e toantes — aparecerem na hora.
</p>

<p align="center">
  🔗 <a href="https://rhyme.bobagi.space"><strong>rhyme.bobagi.space</strong></a>
  &nbsp;·&nbsp; Google Chrome (precisa de microfone + HTTPS)
</p>

<p align="center"><a href="./README.md">English</a> · <strong>Português</strong></p>

---

## O que é

Rhyme é um app **100% no navegador** (sem build, sem backend) que usa a Web Speech API
nativa para transcrever o que você fala e **sugerir rimas em tempo real** — pensado para
treino de freestyle / improviso. Funciona em **português, inglês e espanhol**.

## Destaques

- 🎙️ **Transcrição ao vivo** — as sugestões atualizam enquanto você fala (interim).
- 🎯 **Rimas de verdade** — casadas pela vogal tônica (rima perfeita), com fallback para
  rimas **aproximadas e toantes** quando a palavra é difícil (ex.: `fácil` → `ágil`,
  `hábil`, `frágil`, `portátil`), então o painel **nunca fica vazio**.
- 🏆 **Modo treino** — avalia se seus versos seguidos rimaram (perfeita / aproximada /
  toante) com pontos, **sequência (streak)** e recorde, mais uma **palavra-desafio** que
  acompanha o idioma selecionado.
- 🥁 **Metrônomo (BPM)** embutido para treinar no tempo.
- 🌎 **PT · EN · ES** — idioma da interface auto-detectado (com seletor manual) e um
  seletor separado para o idioma das rimas.
- ⚡ **Offline-friendly** — listas de frequência cacheadas em `localStorage`.
- 📋 **Clique pra copiar** qualquer sugestão, sem parar o microfone.
- 🪶 **Sem dependências / sem build** — só `index.html` + ES modules.

## Stack

Vanilla JS (ES modules), Web Speech API e AudioContext. Servido como arquivos estáticos
(nginx). Sem framework e sem etapa de build.

## Arquitetura

Arquitetura em camadas (clean-ish) com domínio **puro e testável**, seguindo os princípios
**SOLID** e os padrões **Adapter / Repository / Observer**. Visão geral, mapa de diretórios
e fluxo de dados em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Rodar localmente

Na raiz do projeto, suba um servidor de arquivos estáticos:

```bash
python3 -m http.server 5500
```

Abra o app no Google Chrome:

```text
http://localhost:5500
```

Clique em **Começar** e permita o acesso ao microfone.

> A transcrição do microfone exige um **contexto seguro**. `localhost` conta como seguro,
> então o dev local funciona em HTTP puro; qualquer outro host precisa ser servido por **HTTPS**.

## Suporte de navegador

Use o Google Chrome. O Brave consegue capturar o áudio do microfone, mas costuma bloquear
o serviço de transcrição da Web Speech e retorna um erro de `network`. Se isso acontecer,
use o Google Chrome.

## Reconhecimento de voz

Usa a Web Speech API nativa: `SpeechRecognition` / `webkitSpeechRecognition`, reconhecimento
contínuo + resultados intermediários, locale selecionável (`pt-BR` padrão, `en-US`, `es-ES`)
que também troca a fonte das rimas, reinício automático em erros recuperáveis (`no-speech`,
`network`) com backoff, e um medidor de nível do microfone ao vivo via `AudioContext`.

## Motor de rimas

As rimas são calculadas localmente em `src/services/rhymeEngine.js`, sem chamadas de API:

- **Casamento pela tônica** — a rima é chaveada da vogal tônica em diante, não pelos N
  últimos caracteres, então `coração` rima com `paixão`/`canção` (`-ão`), enquanto `vida`
  (`-ida`) fica separada de `dia` (`-ia`).
- **Fallback em camadas** — rimas perfeitas são escassas para uma classe inteira de
  palavras (proparoxítonas e terminadas em consoante, como `fácil`/`rápido`). Quando a
  camada perfeita é fina, o motor relaxa para o mesmo esqueleto tônico **+** a mesma
  terminação (aproximada) e depois só o esqueleto vocálico (toante) — palavras comuns
  mantêm uma lista limpa só de perfeitas, e as difíceis ainda recebem sugestões úteis.
- **Palavras e frases** — frases rimam pela última palavra (ex.: `com todo meu valor`).
- **Ranqueado por frequência** — os candidatos vêm das listas `hermitdave/FrequencyWords`
  50k (pt/en/es), já ordenadas por uso, mais um catálogo curado de pt.

Clique em qualquer sugestão para copiá-la. Veja `docs/frequency-words.md` para dados / licença.
