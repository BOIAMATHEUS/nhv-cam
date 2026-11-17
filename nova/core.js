/* NHV Cam · núcleo compartilhado entre o celular (index.html) e o OBS (view.html).
   Sinalização pelo Supabase Realtime (broadcast): uma sala = um canal.
   Mensagem = { from, to, role, kind, data, t }. role: "cam" (celular) ou "view" (OBS/prévia). */
(function () {
  'use strict';

  const cfg = window.NHVCAM_CONFIG;

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  }

  // Só letras, números, hífen e sublinhado; devolve '' se não sobrar nada.
  function limparSala(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  }

  class Signal {
    constructor(sala, role) {
      if (!window.supabase) throw new Error('A biblioteca de sinal não carregou (sem internet?)');
      this.sala = limparSala(sala) || 'cam1';
      this.role = role;
      this.id = role + '-' + uid();
      this.status = 'idle';
      this.onmessage = null;
      this.onstatus = null;
      this._client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        realtime: { params: { eventsPerSecond: 30 } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this._canal = null;
      this._resolvido = false;
    }

    conectar() {
      return new Promise((resolve, reject) => {
        const canal = this._client.channel(cfg.channelPrefix + ':' + this.sala, {
          config: { broadcast: { self: false, ack: false } },
        });
        canal.on('broadcast', { event: 'sig' }, ({ payload }) => {
          if (!payload || payload.from === this.id) return;
          if (payload.to && payload.to !== '*' && payload.to !== this.id) return;
          if (this.onmessage) this.onmessage(payload);
        });
        canal.subscribe((status, err) => {
          this.status = status;
          if (this.onstatus) this.onstatus(status, err);
          if (this._resolvido) return;
          if (status === 'SUBSCRIBED') { this._resolvido = true; resolve(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { this._resolvido = true; reject(err || new Error(status)); }
        });
        this._canal = canal;
      });
    }

    enviar(kind, data, to) {
      if (!this._canal) return Promise.resolve('closed');
      return this._canal.send({
        type: 'broadcast',
        event: 'sig',
        payload: { from: this.id, to: to || '*', role: this.role, kind: kind, data: data || {}, t: Date.now() },
      });
    }

    fechar() {
      if (this._canal) { this._client.removeChannel(this._canal); this._canal = null; }
      this.status = 'closed';
    }
  }

  // Junta candidatos ICE por ~120 ms e manda num pacote só (evita rajada de mensagens).
  class LoteIce {
    constructor(enviar) { this._enviar = enviar; this._fila = []; this._timer = null; }
    add(c) {
      this._fila.push(c);
      if (!this._timer) this._timer = setTimeout(() => this.flush(), 120);
    }
    flush() {
      clearTimeout(this._timer); this._timer = null;
      if (!this._fila.length) return;
      const lote = this._fila; this._fila = [];
      this._enviar(lote);
    }
  }

  // Transformação CSS do enquadramento (zoom digital, deslocamento e espelho).
  // Mesma função no celular e no OBS, então a prévia mostra exatamente o que sai no ar.
  // translate vem por último na cadeia, logo é em coordenadas de tela: arrastar para a
  // direita move a imagem para a direita mesmo com espelho ligado.
  function transformCss(v) {
    const s = Math.max(1, Number(v.scale) || 1);
    const lim = (s - 1) / 2 * 100;
    const x = Math.max(-lim, Math.min(lim, Number(v.x) || 0));
    const y = Math.max(-lim, Math.min(lim, Number(v.y) || 0));
    const mx = v.mirror ? -1 : 1;
    return 'translate(' + x.toFixed(2) + '%, ' + y.toFixed(2) + '%) scale(' + (s * mx).toFixed(3) + ', ' + s.toFixed(3) + ')';
  }

  // Reordena a lista de codecs pondo o preferido na frente. "auto" prefere H264
  // (codificado pelo chip do iPhone, decodificado pelo OBS). Os auxiliares (rtx, red, fec)
  // ficam no fim, como vieram.
  function ordenarCodecs(codecs, pref) {
    const mapa = { auto: 'H264', h264: 'H264', vp9: 'VP9', vp8: 'VP8', av1: 'AV1' };
    const alvo = ('video/' + (mapa[String(pref || 'auto').toLowerCase()] || 'H264')).toUpperCase();
    const aux = (c) => /\/(rtx|red|ulpfec|flexfec-03)$/i.test(c.mimeType);
    const bate = (c) => c.mimeType.toUpperCase() === alvo;
    return []
      .concat(codecs.filter((c) => bate(c) && !aux(c)))
      .concat(codecs.filter((c) => !bate(c) && !aux(c)))
      .concat(codecs.filter(aux));
  }

  // Par de candidatos ICE em uso (por onde o vídeo está passando) e a latência de ida e volta.
  function parSelecionado(st) {
    let par = null;
    st.forEach((r) => { if (!par && r.type === 'transport' && r.selectedCandidatePairId) par = st.get(r.selectedCandidatePairId); });
    if (!par) st.forEach((r) => { if (!par && r.type === 'candidate-pair' && (r.selected || (r.nominated && r.state === 'succeeded'))) par = r; });
    if (!par) return null;
    return {
      par,
      loc: st.get(par.localCandidateId) || null,
      rem: st.get(par.remoteCandidateId) || null,
      rtt: typeof par.currentRoundTripTime === 'number' ? Math.round(par.currentRoundTripTime * 1000) : null,
    };
  }

  // Classifica o caminho: direto pelo Acesso Pessoal (172.20.10.x), direto na rede local,
  // pela internet (NAT) ou por relay (TURN). Endereços .local (mDNS) não dizem nada, então
  // cai no tipo do candidato.
  const PRIVADO = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|127\.|fe80:|fd|fc|::1$)/i;
  function caminho(loc, rem) {
    const tipos = [loc && loc.candidateType, rem && rem.candidateType].filter(Boolean);
    if (tipos.indexOf('relay') >= 0) return { nome: 'via relay (TURN)', grau: 'relay' };
    const ips = [loc && (loc.address || loc.ip), rem && (rem.address || rem.ip)].filter((a) => a && !/\.local$/i.test(a));
    if (ips.some((a) => /^172\.20\.10\./.test(a))) return { nome: 'direto pelo Acesso Pessoal', grau: 'direto' };
    if (ips.length && ips.every((a) => PRIVADO.test(a))) return { nome: 'direto na rede local', grau: 'direto' };
    if (tipos.indexOf('srflx') >= 0) return { nome: 'via internet (NAT)', grau: 'internet' };
    if (tipos.length && tipos.every((t) => t === 'host')) return { nome: 'direto na rede local', grau: 'direto' };
    if (tipos.indexOf('prflx') >= 0) return { nome: 'direto (provável)', grau: 'direto' };
    return { nome: '', grau: '' };
  }

  // Sala da equipe: malha ponto a ponto entre os celulares (e, se quiser, o PC do painel) da mesma
  // chave, para se verem e se ouvirem como numa chamada. Não mexe nas conexões com o OBS: cada
  // câmera continua sendo uma fonte separada. Quem tem o id menor chama; o outro responde.
  // opts: { nome, meta, enviar: { video, audio }, enc, tracks: () => ({ video, audio }),
  //         onEntrou(id, meta, stream), onSaiu(id), onMeta(id, meta), onEstado() }
  const SALA_OLA_MS = 4000;      // "oi" periódico: quem chega descobre quem já está
  const SALA_DESCONECTADO_MS = 5000;
  const SALA_MORTE_MS = 15000;   // sem conexão nesse prazo, derruba e espera o próximo "oi"
  class Sala {
    constructor(opts) {
      this.opts = Object.assign({ enviar: { video: true, audio: true }, enc: [{ maxBitrate: 6e5, scaleResolutionDownBy: 3 }] }, opts);
      this.sig = null; this.peers = new Map(); this.timer = null; this.ativa = false;
    }
    get id() { return this.sig ? this.sig.id : null; }
    get status() { return this.sig ? this.sig.status : 'idle'; }
    async entrar() {
      if (this.ativa) return;
      this.ativa = true;
      const sig = new Signal(this.opts.nome, 'sala');
      this.sig = sig;
      sig.onmessage = (m) => { if (this.sig === sig) this._receber(m); };
      sig.onstatus = (st) => { if (this.sig !== sig) return; if (st === 'SUBSCRIBED') this._ola(); this._estado(); };
      try { await sig.conectar(); }
      catch (e) { this.ativa = false; this.sig = null; throw e; }
      this.timer = setInterval(() => this._ola(), SALA_OLA_MS);
      this._estado();
    }
    sair() {
      this.ativa = false; clearInterval(this.timer); this.timer = null;
      const sig = this.sig; this.sig = null;
      if (sig) { for (const id of this.peers.keys()) sig.enviar('bye', {}, id); setTimeout(() => sig.fechar(), 300); }
      for (const id of Array.from(this.peers.keys())) this._fechar(id, true);
      this._estado();
    }
    membros() { return Array.from(this.peers.values()).map((p) => ({ id: p.id, meta: p.meta || {}, estado: p.pc.connectionState, stream: p.stream })); }
    atualizarMeta(meta) { this.opts.meta = meta; this._ola(); }
    atualizarTracks() {
      const t = (this.opts.tracks && this.opts.tracks()) || {};
      for (const p of this.peers.values()) {
        if (p.vs) p.vs.replaceTrack(t.video || null).catch(() => {});
        if (p.as) p.as.replaceTrack(t.audio || null).catch(() => {});
      }
    }
    _estado() { if (this.opts.onEstado) { try { this.opts.onEstado(); } catch (e) { console.warn(e); } } }
    _ola(to) { if (this.sig) this.sig.enviar('hello', { meta: this.opts.meta || {} }, to); }
    _souChamador(id) { return !!this.sig && this.sig.id < id; }
    _receber(m) {
      if (m.role !== 'sala') return;
      const id = m.from, d = m.data || {};
      const p = this.peers.get(id);
      if (m.kind === 'hello') {
        if (p && d.meta) { p.meta = d.meta; if (this.opts.onMeta) this.opts.onMeta(id, d.meta); }
        const morto = !p || p.pc.connectionState === 'failed' || p.pc.connectionState === 'closed';
        if (morto) {
          if (m.to === '*') this._ola(id); // responde direto, para quem chegou me conhecer
          if (this._souChamador(id)) this._oferecer(id, d.meta || (p && p.meta) || {}).catch((e) => console.warn('sala oferta', e));
        }
        this._estado();
      }
      else if (m.kind === 'offer') this._aoReceberOferta(id, d).catch((e) => console.warn('sala offer', e));
      else if (m.kind === 'answer') {
        if (!p) return;
        if (d.meta) { p.meta = d.meta; if (this.opts.onMeta) this.opts.onMeta(id, d.meta); }
        p.pc.setRemoteDescription(d.sdp).then(() => this._drenar(p)).catch((e) => console.warn('sala answer', e));
      }
      else if (m.kind === 'ice') { if (p) { p.pendentes.push.apply(p.pendentes, d.candidates || []); this._drenar(p); } }
      else if (m.kind === 'bye') this._fechar(id);
    }
    _drenar(p) {
      if (!p.pc.remoteDescription) return;
      const fila = p.pendentes; p.pendentes = [];
      for (const c of fila) p.pc.addIceCandidate(c).catch((e) => console.warn('sala ice', e));
    }
    _criar(id, meta, chamador, sessao) {
      this._fechar(id, true);
      const pc = new RTCPeerConnection({ iceServers: cfg.iceServers, bundlePolicy: 'max-bundle' });
      const p = { id, meta: meta || {}, pc, chamador, sessao, pendentes: [], vs: null, as: null, stream: null, entrou: false, timerDesc: null, timerMorte: null, reiniciando: false, lote: null };
      this.peers.set(id, p);
      p.lote = new LoteIce((cands) => this.sig && this.sig.enviar('ice', { candidates: cands }, id));
      pc.onicecandidate = (e) => { if (e.candidate) p.lote.add(e.candidate.toJSON()); else p.lote.flush(); };
      pc.ontrack = (e) => {
        const s = (e.streams && e.streams[0]) || null;
        if (!p.stream) p.stream = s || new MediaStream();
        if (!s && !p.stream.getTracks().includes(e.track)) p.stream.addTrack(e.track);
        if (!p.entrou) { p.entrou = true; if (this.opts.onEntrou) this.opts.onEntrou(id, p.meta, p.stream); }
        this._estado();
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') { clearTimeout(p.timerDesc); clearTimeout(p.timerMorte); }
        else if (st === 'failed') { if (p.chamador) this._reiniciar(p); this._armarMorte(p, SALA_MORTE_MS); }
        else if (st === 'disconnected') {
          clearTimeout(p.timerDesc);
          p.timerDesc = setTimeout(() => { if (pc.connectionState !== 'connected') { if (p.chamador) this._reiniciar(p); this._armarMorte(p, SALA_MORTE_MS); } }, SALA_DESCONECTADO_MS);
        }
        else if (st === 'closed') this._fechar(id);
        this._estado();
      };
      // Quem chama cria os transceptores; quem responde adota os que vêm na oferta (_adotar),
      // porque transceptores criados com addTransceiver não casam com uma oferta remota.
      if (chamador) {
        const t = (this.opts.tracks && this.opts.tracks()) || {};
        const env = this.opts.enviar || {};
        const abrir = (kind, track, manda, enc) => {
          const dir = manda ? 'sendrecv' : 'recvonly';
          try { return pc.addTransceiver(track || kind, Object.assign({ direction: dir }, manda && enc ? { sendEncodings: enc } : {})); }
          catch (e) { return pc.addTransceiver(track || kind, { direction: dir }); }
        };
        const tv = abrir('video', t.video, !!env.video, this.opts.enc);
        const ta = abrir('audio', t.audio, !!env.audio, null);
        p.vs = env.video ? tv.sender : null; p.as = env.audio ? ta.sender : null;
        try {
          if (tv.setCodecPreferences && window.RTCRtpSender && RTCRtpSender.getCapabilities) tv.setCodecPreferences(ordenarCodecs(RTCRtpSender.getCapabilities('video').codecs, 'h264'));
        } catch (e) {}
      }
      this._armarMorte(p, SALA_MORTE_MS);
      return p;
    }
    // Lado que responde: liga as trilhas locais nos transceptores que a oferta trouxe.
    _adotar(p) {
      const t = (this.opts.tracks && this.opts.tracks()) || {};
      const env = this.opts.enviar || {};
      for (const tr of p.pc.getTransceivers()) {
        const kind = tr.receiver && tr.receiver.track && tr.receiver.track.kind;
        if (!kind || tr.stopped) continue;
        const manda = kind === 'video' ? !!env.video : !!env.audio;
        if (!manda) { try { tr.direction = 'recvonly'; } catch (e) {} continue; }
        try { tr.direction = 'sendrecv'; } catch (e) {}
        const track = kind === 'video' ? t.video : t.audio;
        if (track && tr.sender.track !== track) tr.sender.replaceTrack(track).catch(() => {});
        if (kind === 'video') p.vs = tr.sender; else p.as = tr.sender;
      }
    }
    _aplicarEnc(p) {
      if (!p.vs || !this.opts.enc || !this.opts.enc.length) return;
      try {
        const prm = p.vs.getParameters();
        if (!prm.encodings || !prm.encodings.length) prm.encodings = [{}];
        Object.assign(prm.encodings[0], this.opts.enc[0]);
        p.vs.setParameters(prm).catch(() => {});
      } catch (e) {}
    }
    async _oferecer(id, meta) {
      const p = this._criar(id, meta, true, uid());
      const oferta = await p.pc.createOffer();
      if (this.peers.get(id) !== p) return;
      await p.pc.setLocalDescription(oferta);
      if (this.peers.get(id) !== p || !this.sig) return;
      this.sig.enviar('offer', { sdp: { type: p.pc.localDescription.type, sdp: p.pc.localDescription.sdp }, sessao: p.sessao, meta: this.opts.meta || {} }, id);
    }
    async _aoReceberOferta(id, d) {
      let p = this.peers.get(id);
      if (!p || p.sessao !== d.sessao || p.pc.signalingState === 'closed') p = this._criar(id, d.meta || (p && p.meta) || {}, false, d.sessao);
      else if (d.meta) p.meta = d.meta;
      await p.pc.setRemoteDescription(d.sdp);
      if (this.peers.get(id) !== p) return;
      this._adotar(p);
      this._drenar(p);
      const resposta = await p.pc.createAnswer();
      if (this.peers.get(id) !== p) return;
      await p.pc.setLocalDescription(resposta);
      if (this.peers.get(id) !== p || !this.sig) return;
      this._aplicarEnc(p);
      this.sig.enviar('answer', { sdp: { type: p.pc.localDescription.type, sdp: p.pc.localDescription.sdp }, meta: this.opts.meta || {} }, id);
      if (this.opts.onMeta) this.opts.onMeta(id, p.meta);
      this._estado();
    }
    async _reiniciar(p) {
      if (p.reiniciando || !this.sig || this.peers.get(p.id) !== p) return;
      p.reiniciando = true;
      try {
        let o;
        if (p.pc.restartIce) { p.pc.restartIce(); o = await p.pc.createOffer(); } else o = await p.pc.createOffer({ iceRestart: true });
        if (this.peers.get(p.id) !== p) return;
        await p.pc.setLocalDescription(o);
        if (this.peers.get(p.id) !== p || !this.sig) return;
        this.sig.enviar('offer', { sdp: { type: p.pc.localDescription.type, sdp: p.pc.localDescription.sdp }, sessao: p.sessao, meta: this.opts.meta || {}, renegociar: true }, p.id);
      } catch (e) { console.warn('sala reinício', e); }
      finally { p.reiniciando = false; }
    }
    _armarMorte(p, ms) {
      clearTimeout(p.timerMorte);
      p.timerMorte = setTimeout(() => { if (this.peers.get(p.id) === p && p.pc.connectionState !== 'connected') this._fechar(p.id); }, ms);
    }
    _fechar(id, silencio) {
      const p = this.peers.get(id); if (!p) return;
      this.peers.delete(id);
      clearTimeout(p.timerDesc); clearTimeout(p.timerMorte);
      try { p.pc.onconnectionstatechange = null; p.pc.ontrack = null; p.pc.close(); } catch (e) {}
      if (p.entrou && this.opts.onSaiu) { try { this.opts.onSaiu(id); } catch (e) { console.warn(e); } }
      if (!silencio) this._estado();
    }
  }

  window.NHVCam = { Signal, LoteIce, Sala, uid, limparSala, transformCss, ordenarCodecs, parSelecionado, caminho };
})();
