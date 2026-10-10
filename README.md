# NHV Cam

Câmera do iPhone direto no OBS, pelo navegador, sem Camo e sem Iriun. O celular abre uma página, o OBS abre outra (fonte Navegador) e o vídeo vai por WebRTC, em 9:16, com zoom controlado pelo celular. Até 5 celulares ao mesmo tempo: cada um é uma sala (`cam1` a `cam5`) com a sua fonte no OBS.

Site: https://boiamatheus.github.io/nhv-cam/

## Como usar

1. **No PC**, abra o painel: https://boiamatheus.github.io/nhv-cam/painel.html. Ele mostra, para cada câmera, o link do OBS, o QR para o celular e uma prévia.
2. **No OBS:** Fontes, +, Navegador. URL = link da câmera (ex.: `.../view.html?r=cam1`), largura 1080, altura 1920. Deixe "Desligar a fonte quando não estiver visível" desmarcado. Uma fonte por câmera.
3. **No iPhone (Safari):** leia o QR ou abra `https://boiamatheus.github.io/nhv-cam/?r=cam1`, escolha qual CAM é aquele celular, toque em "Iniciar câmera" e permita a câmera. Em poucos segundos a imagem aparece no OBS.

## Controles no celular

- **Pinça** na imagem dá zoom, **arrastar** move o enquadramento, **toque duplo** volta ao 1x. A prévia do celular mostra exatamente o que sai no OBS.
- Zoom **Digital** é aplicado na página do OBS (não mexe na captura, não trava nem perde quadros). **Nativo** só aparece quando o iPhone expõe o zoom da lente pelo Safari (raro).
- **Guia 9:16:** mostra no preview as faixas que o Instagram cobre na live (topo 250 px e rodapé 420 px de 1920, a mesma zona segura dos stories) e a grade de terços. Serve para enquadrar; não sai no OBS.
- **Escurecer:** apaga a prévia para o celular ficar no tripé sem brilhar. A câmera continua; um toque volta.
- **Câmera:** lista todas as lentes (traseira, frontal, ultra wide, teleobjetiva). **Qualidade:** 4K, 1080p ou 720p, o que o iPhone aceitar; a resolução real aparece no topo.
- **Config:** sala, bitrate (4 a 30 Mbps, padrão 8), 30 ou 60 fps, codec (H264 usa o chip do iPhone), preencher ou caber no 9:16, inverter largura e altura, link do OBS, reconectar.
- **Áudio:** manda o microfone do celular junto (desligado por padrão). No OBS, marque "Controlar áudio via OBS" na fonte se for usar.

## Dicas

- Celular e PC no **mesmo Wi-Fi** (5 GHz de preferência): a conexão é direta e a qualidade é a máxima. Em 4G também funciona, mas passa por STUN/TURN. Com 5 celulares a 8 Mbps chegam 40 Mbps no PC.
- **Por cabo:** ligue o Acesso Pessoal no iPhone e conecte pelo USB. O Windows ganha uma rede pelo cabo e a câmera passa por ela. Cuidado: o PC pode passar a usar a internet do celular; confira antes de ir ao ar.
- Deixe a tela do celular ligada e o Safari em primeiro plano. A página pede "wake lock" para a tela não apagar. Se trocar de app, a câmera pausa; ao voltar ela religa sozinha.
- Adicione à Tela de Início (Compartilhar, Adicionar à Tela de Início) para abrir em tela cheia.
- Se o Camo ou o Iriun estiverem abertos, feche: eles seguram a câmera e o Safari recebe "câmera em uso".
- A prévia do painel pede um segundo vídeo ao celular (meia resolução). Pause as prévias durante a live.
- No OBS, se a imagem vier pesada: Configurações, Avançado, "Aceleração de hardware da fonte Navegador" ligada.

## Parâmetros do link do OBS

`view.html?r=cam1&codec=h264&fit=cover&hud=1`

| parâmetro | valores | efeito |
|---|---|---|
| `r` | nome da sala | mesma sala escolhida no celular |
| `codec` | `auto` (H264), `h264`, `vp9`, `vp8`, `av1` | preferência de codec na negociação |
| `fit` | `cover`, `contain` | preencher (corta sobras) ou caber (barras) |
| `hud` | `1`, `0` | texto de estado sempre ou nunca; sem o parâmetro aparece só enquanto desconectado |
| `audio` | `1` | tenta tocar o som fora do OBS (no OBS já toca) |
| `preview` | `1` | pede meia resolução (usado pelo painel) |
| `bg` | cor hex | fundo da página quando não há vídeo |

## Como funciona

- `index.html`: celular (captura, zoom, controles). `view.html`: página que o OBS abre. `painel.html`: painel do PC. `core.js`: sinalização e utilidades. `config.js`: chaves e servidores.
- Sinalização (troca de ofertas WebRTC) pelo **Supabase Realtime** (broadcast, canal `nhvcam:<sala>`), com a chave publicável do projeto da NHV. Nenhum vídeo passa pelo Supabase, só as mensagens de conexão.
- Vídeo e áudio: WebRTC ponto a ponto (STUN do Google; TURN do Open Relay só de reserva). Tudo em `config.js`.
- Hospedagem: GitHub Pages do repositório `BOIAMATHEUS/nhv-cam`. Ícones: `node tools/make-icons.mjs`.
- Teste de ponta a ponta (5 celulares falsos + 5 OBS + painel, com o Chromium do Playwright): `node tools/teste-e2e.mjs http://localhost:8787/` com `node tools/servir.mjs` rodando, ou direto contra o site publicado.
