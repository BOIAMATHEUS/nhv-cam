// NHV Cam: configuração.
// Tudo aqui é público por natureza: a chave é a publicável do Supabase, a mesma que já viaja
// no site da NHV. Pelo Supabase passam só as mensagens de conexão (oferta, resposta, candidatos
// ICE), nunca o vídeo. Para trocar de projeto, mude as duas primeiras linhas.
window.NHVCAM_CONFIG = {
  supabaseUrl: 'https://ghvscicrzghruqimwmln.supabase.co',
  supabaseKey: 'sb_publishable_-KWAuZBY9B61sxuh3TtJEw_Hkm0kXS3',

  // Prefixo dos canais de sinalização: a sala "cam1" vira o canal "nhvcam:cam1".
  channelPrefix: 'nhvcam',

  // Servidores ICE. STUN descobre o caminho direto (no mesmo Wi-Fi nem chega a ser usado).
  // Os TURN do Open Relay são reserva pública: só entram se a conexão direta falhar
  // (celular no 4G com operadora fechada, por exemplo). Dá para apagar se não quiser.
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};
