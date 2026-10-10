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

  window.NHVCam = { Signal, LoteIce, uid, limparSala, transformCss, ordenarCodecs };
})();
