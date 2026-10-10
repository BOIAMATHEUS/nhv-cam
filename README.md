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
- **Áudio:** desligado por padrão (a fonte do OBS fica sem som). O primeiro toque em Áudio liga o microfone do celular (pede permissão); depois disso o mesmo botão alterna o **mudo** na hora, sem interromper a imagem ("off", "ligado", "mudo"). Desligar o microfone de vez: Config, "Microfone do celular". No OBS, marque "Controlar áudio via OBS" na fonte se for usar o som do celular; o mute do mixer do OBS também serve. Config, "Qual microfone": escolhe o microfone do iPhone mesmo com fone Bluetooth ligado.
- **Sala:** liga uma chamada entre os celulares da mesma chave da equipe (inclusive quem está longe). Veja a seção abaixo.

## Sala da equipe e collab de longe

Quem toca em **Sala** no celular passa a ver e ouvir, na hora, os outros celulares que também ligaram a Sala com a mesma chave: as vinhetas aparecem no canto da prévia (toque numa para ver a pessoa grande; a própria câmera vira uma janelinha). O OBS não muda: continua pegando cada câmera separada pela sua fonte, com o som de cada uma. É o que faz uma collab com alguém de longe funcionar como uma chamada do Meet, sem Meet: a convidada vê e ouve quem apresenta sem atraso, e quem apresenta ouve a convidada.

- A Sala liga o microfone do celular (precisa falar). O botão Áudio continua alternando o mudo, para a sala e para o OBS ao mesmo tempo.
- O vídeo entre os celulares vai em resolução reduzida (cerca de 360 x 640, 0,6 Mbps por pessoa) para não pesar no iPhone nem na internet; o OBS continua recebendo a resolução cheia.
- **Fone em todo mundo que está na sala** (qualquer fone Bluetooth serve; com lapela no conector, só Bluetooth). Sem fone, o som dos outros sai no alto-falante, entra no microfone e pode virar eco; o iPhone cancela boa parte (é o que a Sala pede ao Safari), então teste 2 minutos antes com o volume baixo. Se ecoar, Config, **"Ouvir a sala neste celular"** desligado: a pessoa continua sendo vista e ouvida, só não toca o som dos outros naquele aparelho. Com fone Bluetooth, o iOS costuma trocar o microfone para o fone; Config, "Qual microfone", devolve o microfone do iPhone (ou a lapela) para a live.
- Quem está longe: Config, **Rede fraca** (720p e 4 Mbps). A convidada não assiste à live pelo Instagram enquanto fala (chega com 10 a 20 s de atraso).
- O painel do PC pode entrar na sala para ouvir e falar com quem está nela, fora do ar; use fone no PC.
- Técnica: malha ponto a ponto por WebRTC no canal `nhvcam:sala-<chave>` (quem tem o id menor chama); áudio e vídeo nunca passam por servidor; sem chave, a sala é pública.

**Duas câmeras numa fonte só do OBS:** o painel gera um link `collab.html?a=cam1&b=cam3&k=xxxxx&layout=dividido` para uma fonte Navegador 1080 x 1920 com as duas câmeras já montadas: `dividido` (A em cima, B embaixo), `pip` (A inteira, B em 360 x 640 no canto direito, acima da faixa dos comentários do Instagram) ou `lado` (duas metades de 540 x 960, lado a lado). `&na=Sanny&nb=Convidada` escreve os nomes. Use essa fonte no lugar das fontes separadas dessas duas câmeras, senão cada celular manda o vídeo duas vezes.

## Live de horas: o que o sistema faz sozinho e o que é checklist

O que acontece sozinho:
- Oscilou o Wi-Fi: em 5 s o celular tenta um **reinício de ICE** (mesma conexão, novos caminhos); se em 12 s não voltou, os dois lados recomeçam do zero (cerca de 1 s). O OBS **segura o último quadro** e nunca escreve texto na tela depois da primeira conexão.
- Caiu o sinal (Supabase): o vídeo não depende dele depois de conectado; a sinalização reconecta sozinha e os dois lados se reapresentam.
- A câmera do iOS travou ou parou com a página na frente: o celular **religa a câmera sozinho** (até 5 tentativas).
- A tela: o celular pede ao iOS para não apagar (Screen Wake Lock, iOS 16.4 ou mais novo) e religa o pedido ao voltar para a página.
- OBS recarregou a fonte ou o celular recarregou a página: reconecta em cerca de 1 s.

Checklist antes de ir ao ar:
- **Modo Avião com Wi-Fi ligado** em cada iPhone: ligação ou Siri mudam a câmera no Safari sem aviso (bug conhecido do WebKit; o celular religa sozinho e Config tem "Religar a câmera"). Não Perturbe e Siri desligada por cima. Com Acesso Pessoal por USB, Modo Avião não dá.
- **Acesso Guiado** (triplo clique no botão lateral) prende o iPhone no Safari. Trocar de app, abrir a Central de Notificações ou bloquear a tela pausa a câmera.
- **Bloqueio de orientação** em retrato na Central de Controle antes de pôr no tripé.
- **Carregador de 20 W na tomada**, não na porta do PC. Modo de Baixo Consumo desligado (força a tela a apagar em 30 s). Feche os outros apps. Tire a capa: se esquentar, o iOS baixa os fps e pode desligar a câmera; caia para 720p em Qualidade.
- Config no celular: **Manter a tela ligada** ativo. No iOS 17 ou mais novo o Safari já segura a tela enquanto a câmera está ligada; por garantia, Ajustes, Tela e Brilho, Bloqueio Automático, Nunca. Use **Escurecer** no tripé.
- A mesma **chave da equipe** em tudo (QR e links do OBS). Depois de conferir, **pause as prévias** do painel.
- Linha de estatísticas em verde com "direto" e poucos ms. Se aparecer "via internet" ou "via relay", celular e PC não estão na mesma rede.
- Não recarregue as fontes do OBS no ar. "Desligar a fonte quando não estiver visível" desmarcado.

## Dicas de rede

- Celular e PC no **mesmo Wi-Fi** (5 GHz de preferência): a conexão é direta e a qualidade é a máxima. Com 5 celulares a 8 Mbps chegam 40 Mbps no PC.
- **Por cabo (USB):** o navegador não fala com o cabo; o que existe é o **Acesso Pessoal por USB** do iPhone, que cria uma rede entre iPhone e PC pelo cabo (o PC fica em 172.20.10.x). O vídeo então passa pelo cabo e a linha de estatísticas mostra "direto pelo Acesso Pessoal". Veja a seção abaixo.
- Em 4G também funciona, mas passa por STUN/TURN e a latência sobe.
- A prévia do painel pede um segundo vídeo ao celular (meia resolução). Pause as prévias durante a live.
- No OBS, se a imagem vier pesada: Configurações, Avançado, "Aceleração de hardware da fonte Navegador" ligada.

## Por cabo (USB)

O Safari não manda vídeo pelo USB: a Apple não implementa WebUSB nem nada parecido, e todo "iPhone como webcam USB" no Windows (Camo, DroidCam, iVCam) é app no iPhone + driver no PC. Para um site, o cabo só serve como rede. Duas formas:

1. **Adaptador USB-C (ou Lightning) para Ethernet no iPhone, ligado no roteador.** É o cabo que funciona: o iPhone entra na rede de casa por cabo, sem plano de dados e sem mexer no Windows; o iOS usa o cabo como rota principal e o Safari anuncia esse IP ao WebRTC (é o que o VDO.Ninja recomenda). Adaptador com entrada de energia carrega junto. Estatísticas mostram "direto na rede local".
2. **Acesso Pessoal por USB: não serve para a live.** Compartilha só os dados móveis (exige plano com hotspot, app Apple Devices ou iTunes no PC, "Confiar" no iPhone) e cria no PC um adaptador "Apple Mobile Device Ethernet" (172.20.10.x). O problema é o WebKit: o Safari só anuncia ao WebRTC a interface da rota padrão e a que carregou a página, e no hotspot as duas são o 4G, não a ponte USB. Então o vídeo tende a sair pela internet (4G até o provedor de casa e volta), com latência alta, mesmo com o cabo plugado. Ninguém documentou esse arranjo funcionando. Se testar, as estatísticas precisam dizer "direto pelo Acesso Pessoal"; qualquer outra coisa é pior que o Wi-Fi.

Risco que vale mesmo sem querer USB: com "Permitir Acesso a Outros" ligado, basta plugar o iPhone no PC para carregar e o Windows pode trocar a internet do PC (e a transmissão do OBS) para o 4G do celular, por dois mecanismos (métrica automática e o Gerenciador de Conexões, que prefere qualquer "Ethernet" e desliga o Wi-Fi automático). Durante a live: Acesso Pessoal desligado e carregador na tomada. Se precisar do cabo no PC: no adaptador do iPhone, IP fixo `172.20.10.14`, máscara `255.255.255.240`, sem gateway e sem DNS, IPv6 desmarcado; conferir com `tracert -d 8.8.8.8` (primeiro salto tem que ser o roteador de casa) ou `Get-NetRoute -DestinationPrefix 0.0.0.0/0,::/0`. Subir a métrica do adaptador não é conserto confiável.

Em qualquer caso o Firewall do Windows precisa permitir o OBS em redes privadas (mDNS, UDP 5353), senão a conexão cai para "via internet" ou não fecha.

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
| `cheio` | `1` | preenche a fonte inteira, em qualquer proporção, sem avisar o celular (usado pelo `collab.html`) |
| `bg` | cor hex | fundo da página quando não há vídeo |

## Como funciona

- `index.html`: celular (captura, zoom, controles, vigias, Sala). `view.html`: página que o OBS abre. `collab.html`: duas páginas do OBS numa fonte só. `painel.html`: painel do PC (também entra na Sala). `core.js`: sinalização, a malha da Sala e utilidades. `config.js`: chaves e servidores.
- Sinalização (troca de ofertas WebRTC) pelo **Supabase Realtime** (broadcast, canal `nhvcam:<sala>-<chave>`), com a chave publicável do projeto da NHV. Nenhum vídeo passa pelo Supabase, só as mensagens de conexão; conectado, não passa nada.
- Vídeo e áudio: WebRTC ponto a ponto (STUN do Google; TURN do Open Relay só de reserva). Tudo em `config.js`.
- Hospedagem: GitHub Pages do repositório `BOIAMATHEUS/nhv-cam`. Ícones: `node tools/make-icons.mjs`.
- Teste de ponta a ponta (5 celulares falsos + 5 OBS + painel, chave única por rodada, com o Chromium do Playwright): `node tools/servir.mjs` e depois `node tools/teste-e2e.mjs http://localhost:8787/`, ou direto contra o site publicado. Cobre conexão, zoom, espelho, gestos, guia, tela escura, reinício de ICE, reconexões, painel, pausa das prévias, caminho e latência, opção da tela ligada. A Sala e o `collab.html` têm teste próprio: `node tools/teste-sala.mjs http://localhost:8787/` (dois celulares falsos se veem e se ouvem, o PC entra na sala, a fonte collab recebe as duas câmeras, saída e volta, reentrada depois de recarregar).
