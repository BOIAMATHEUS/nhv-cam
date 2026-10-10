# NHV Cam

Câmera do iPhone direto no OBS, pelo navegador, sem Camo e sem Iriun. O celular abre uma página, o OBS abre outra (fonte Navegador) e o vídeo vai por WebRTC, em 9:16, com zoom controlado pelo celular. Até 5 celulares ao mesmo tempo: cada um é uma sala (`cam1` a `cam5`) com a sua fonte no OBS.

Site: https://boiamatheus.github.io/nhv-cam/

## Como usar

1. **No PC**, abra o painel: https://boiamatheus.github.io/nhv-cam/painel.html. Ele gera uma **chave da equipe** (5 letras) e mostra, para cada câmera, o link do OBS, o QR para o celular e uma prévia. A chave vai dentro do QR e dos links; só quem tem a chave entra nas câmeras.
2. **No OBS:** Fontes, +, Navegador. URL = link da câmera copiado do painel (ex.: `.../view.html?r=cam1&k=xxxxx`), largura 1080, altura 1920. Deixe "Desligar a fonte quando não estiver visível" desmarcado. Uma fonte por câmera.
3. **No iPhone (Safari):** leia o QR da câmera no painel, confira qual CAM é aquele celular, toque em "Iniciar câmera" e permita a câmera. Em menos de 1 segundo a imagem aparece no OBS.

## Controles no celular

- **Pinça** na imagem dá zoom, **arrastar** move o enquadramento, **toque duplo** volta ao 1x. A prévia do celular mostra exatamente o que sai no OBS.
- Zoom **Digital** é aplicado na página do OBS (não mexe na captura, não trava nem perde quadros). **Nativo** só aparece quando o iPhone expõe o zoom da lente pelo Safari (raro).
- **Guia 9:16:** mostra no preview as faixas que o Instagram cobre na live (topo 250 px e rodapé 420 px de 1920, a mesma zona segura dos stories) e a grade de terços. Serve para enquadrar; não sai no OBS.
- **Escurecer:** apaga a prévia para o celular ficar no tripé sem brilhar. A câmera continua; um toque volta. A tela escura mostra o status do OBS e se a tela está sendo mantida acesa.
- **Câmera:** lista todas as lentes (traseira, frontal, ultra wide, teleobjetiva). **Qualidade:** 4K, 1080p ou 720p, o que o iPhone aceitar.
- **Linha de estatísticas** (acima do zoom): resolução, fps, bitrate, o que o OBS está recebendo, **por onde o vídeo passa** (direto na rede local, direto pelo Acesso Pessoal, via internet, via relay) e a **latência** em ms. Em amarelo quando está indo pela internet ou por relay.
- **Config:** sala, chave da equipe, bitrate (4 a 30 Mbps, padrão 8), 30 ou 60 fps, codec (H264 usa o chip do iPhone), preencher ou caber no 9:16, **manter a tela ligada** (com o estado do pedido), inverter largura e altura, link do OBS, reconectar.
- **Áudio:** manda o microfone do celular junto (desligado por padrão). No OBS, marque "Controlar áudio via OBS" na fonte se for usar.

## Live de horas: o que o sistema faz sozinho e o que é checklist

O que acontece sozinho:
- Oscilou o Wi-Fi: em 5 s o celular tenta um **reinício de ICE** (mesma conexão, novos caminhos); se em 12 s não voltou, os dois lados recomeçam do zero (cerca de 1 s). O OBS **segura o último quadro** e nunca escreve texto na tela depois da primeira conexão.
- Caiu o sinal (Supabase): o vídeo não depende dele depois de conectado; a sinalização reconecta sozinha e os dois lados se reapresentam.
- A câmera do iOS travou ou parou com a página na frente: o celular **religa a câmera sozinho** (até 5 tentativas).
- A tela: o celular pede ao iOS para não apagar (Screen Wake Lock, iOS 16.4 ou mais novo) e religa o pedido ao voltar para a página.
- OBS recarregou a fonte ou o celular recarregou a página: reconecta em cerca de 1 s.

Checklist antes de ir ao ar:
- **Modo Avião com Wi-Fi ligado** em cada iPhone (uma ligação recebida derruba a câmera no Safari). Não Perturbe também ajuda.
- **Bloqueio de orientação** em retrato na Central de Controle antes de pôr no tripé.
- **Carregador na tomada** o tempo todo. Modo de Baixo Consumo desligado. Feche os outros apps.
- Config no celular: **Manter a tela ligada** ativo. Se o iOS negar, Ajustes, Tela e Brilho, Bloqueio Automático, Nunca. Use **Escurecer** no tripé.
- A mesma **chave da equipe** em tudo (QR e links do OBS). Depois de conferir, **pause as prévias** do painel.
- Linha de estatísticas em verde com "direto" e poucos ms. Se aparecer "via internet" ou "via relay", celular e PC não estão na mesma rede.
- Não recarregue as fontes do OBS no ar. "Desligar a fonte quando não estiver visível" desmarcado.

## Dicas de rede

- Celular e PC no **mesmo Wi-Fi** (5 GHz de preferência): a conexão é direta e a qualidade é a máxima. Com 5 celulares a 8 Mbps chegam 40 Mbps no PC.
- **Por cabo (USB):** o navegador não fala com o cabo; o que existe é o **Acesso Pessoal por USB** do iPhone, que cria uma rede entre iPhone e PC pelo cabo (o PC fica em 172.20.10.x). O vídeo então passa pelo cabo e a linha de estatísticas mostra "direto pelo Acesso Pessoal". Veja a seção abaixo.
- Em 4G também funciona, mas passa por STUN/TURN e a latência sobe.
- A prévia do painel pede um segundo vídeo ao celular (meia resolução). Pause as prévias durante a live.
- No OBS, se a imagem vier pesada: Configurações, Avançado, "Aceleração de hardware da fonte Navegador" ligada.

## USB (Acesso Pessoal por cabo)

Ver a seção "USB" do painel e a memória do projeto; resumo: ligue o Acesso Pessoal no iPhone, conecte pelo cabo no PC (com o app Apple Devices ou o iTunes instalado para o driver de rede), confira que o Windows continua usando a internet de casa (métrica da interface do iPhone alta) e abra o site normalmente. O indicador de caminho confirma se o vídeo está indo pelo cabo.

## Parâmetros do link do OBS

`view.html?r=cam1&k=xxxxx&codec=h264&fit=cover&hud=1`

| parâmetro | valores | efeito |
|---|---|---|
| `r` | nome da sala | mesma sala escolhida no celular |
| `k` | chave da equipe | mesma chave do celular (o painel gera) |
| `codec` | `auto` (H264), `h264`, `vp9`, `vp8`, `av1` | preferência de codec na negociação |
| `fit` | `cover`, `contain` | preencher (corta sobras) ou caber (barras) |
| `hud` | `1`, `0` | texto de estado sempre ou nunca; sem o parâmetro aparece só até a primeira conexão |
| `audio` | `1` | tenta tocar o som fora do OBS (no OBS já toca) |
| `preview` | `1` | pede meia resolução (usado pelo painel) |
| `bg` | cor hex | fundo da página quando não há vídeo |

## Como funciona

- `index.html`: celular (captura, zoom, controles, vigias). `view.html`: página que o OBS abre. `painel.html`: painel do PC. `core.js`: sinalização e utilidades. `config.js`: chaves e servidores.
- Sinalização (troca de ofertas WebRTC) pelo **Supabase Realtime** (broadcast, canal `nhvcam:<sala>-<chave>`), com a chave publicável do projeto da NHV. Nenhum vídeo passa pelo Supabase, só as mensagens de conexão; conectado, não passa nada.
- Vídeo e áudio: WebRTC ponto a ponto (STUN do Google; TURN do Open Relay só de reserva). Tudo em `config.js`.
- Hospedagem: GitHub Pages do repositório `BOIAMATHEUS/nhv-cam`. Ícones: `node tools/make-icons.mjs`.
- Teste de ponta a ponta (5 celulares falsos + 5 OBS + painel, chave única por rodada, com o Chromium do Playwright): `node tools/servir.mjs` e depois `node tools/teste-e2e.mjs http://localhost:8787/`, ou direto contra o site publicado. Cobre conexão, zoom, espelho, gestos, guia, tela escura, reinício de ICE, reconexões, painel, pausa das prévias, caminho e latência, opção da tela ligada.
