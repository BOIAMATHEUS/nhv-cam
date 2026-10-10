// Teste da Sala da equipe e do layout collab: dois celulares (câmera e microfone falsos do Chromium)
// se veem e se ouvem, a fonte collab.html recebe as duas câmeras numa página só, o painel entra na sala,
// um celular sai e volta, e um celular recarregado reentra sozinho.
// Uso: node tools/teste-sala.mjs [baseUrl] [pastaDasCapturas]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PW = 'file:///C:/Users/Matheus/Projetos/nhv-lp-deploy/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const BASE = (process.argv[2] || 'http://localhost:8787/').replace(/\/?$/, '/');
const CAPTURAS = process.argv[3] || join(process.cwd(), 'capturas-teste');
mkdirSync(CAPTURAS, { recursive: true });
const CHAVE = 's' + Math.random().toString(36).slice(2, 6);
console.log('chave da rodada:', CHAVE);
const falhas = [];
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) falhas.push(msg); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const agora = () => performance.now();

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream=fps=30', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const ctxPc = await browser.newContext({ viewport: { width: 1080, height: 1920 }, permissions: ['microphone'] });
ctxPc.on('weberror', (e) => console.log('  erro de página (pc):', e.error().message));

// 1) a fonte collab do OBS abre antes, com as duas câmeras e os nomes
const collab = await ctxPc.newPage();
collab.on('console', (m) => { if (m.type() === 'error') console.log('  [collab] ' + m.text()); });
await collab.goto(BASE + 'collab.html?a=cam1&b=cam2&k=' + CHAVE + '&na=Sanny&nb=Convidada');
ok(await collab.evaluate(() => document.getElementById('stage').className === 'dividido' && document.getElementById('na').textContent === 'Sanny' && document.getElementById('nb').textContent === 'Convidada'), 'collab: layout dividido com os nomes');
ok(await collab.evaluate(() => Array.from(document.querySelectorAll('iframe')).map((f) => f.getAttribute('src')).every((s) => /cheio=1/.test(s) && new RegExp('k=' + location.search.match(/k=(\w+)/)[1]).test(s))), 'collab: as duas páginas do OBS levam a chave e o modo cheio');

// 2) dois celulares com nome, cada um no seu contexto (localStorage separado, como dois iPhones)
const cels = {}, ctxs = {}, tempos = {};
for (const [sala, nome] of [['cam1', 'Sanny'], ['cam2', 'Convidada']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone'] });
  ctx.on('weberror', (e) => console.log('  erro de página (' + sala + '):', e.error().message));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('  [' + sala + '] ' + m.text()); });
  // só na primeira carga; depois disso o que a página salvar (inclusive a Sala ligada) fica
  await p.addInitScript(({ sala, nome }) => { if (!localStorage.getItem('nhvcam.celular')) localStorage.setItem('nhvcam.celular', JSON.stringify({ sala, nome, qualidade: '720', bitrateMbps: 3, guia: false })); }, { sala, nome });
  await p.goto(BASE + '?r=' + sala + '&k=' + CHAVE);
  const t0 = agora();
  await p.click('#btIniciar');
  await p.locator('#stObs', { hasText: 'OBS conectado' }).waitFor({ timeout: 30000 }).then(
    () => { tempos[sala] = Math.round(agora() - t0); ok(true, sala + ': OBS (fonte collab) conectado em ' + tempos[sala] + ' ms'); },
    async () => ok(false, sala + ': não conectou ao OBS (' + (await p.locator('#stObs').textContent()) + ')'));
  cels[sala] = p; ctxs[sala] = ctx;
}

// 3) a fonte collab mostra as duas câmeras nos lugares certos
await espera(3000);
const dims = () => collab.evaluate(() => Array.from(document.querySelectorAll('iframe')).map((f) => { const v = f.contentDocument && f.contentDocument.getElementById('v'); return v ? { w: v.videoWidth, h: v.videoHeight } : null; }));
let d = await dims();
ok(d.length === 2 && d.every((x) => x && x.w > 0), 'collab: duas câmeras com imagem ' + JSON.stringify(d));
const geo = await collab.evaluate(() => ['a', 'b'].map((c) => { const r = document.querySelector('.cam.' + c).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
ok(JSON.stringify(geo) === JSON.stringify([[0, 0, 1080, 958], [0, 962, 1080, 958]]), 'collab: metades em 1080x958 com 4 px entre elas (' + JSON.stringify(geo) + ')');
ok(await collab.evaluate(() => document.getElementById('aviso').style.display === 'none'), 'collab: sem aviso de tamanho (fonte em 1080x1920)');
await collab.screenshot({ path: join(CAPTURAS, 'collab-dividido.png') });
ok(await cels.cam1.locator('#stFonte').isHidden(), 'cam1: sem aviso de fonte errada com o modo cheio (metade de 1080x1920)');

// 4) os dois ligam a Sala e se veem e se ouvem
let t0 = agora();
for (const sala of ['cam1', 'cam2']) await cels[sala].click('#btSala');
for (const [sala, outro] of [['cam1', 'Convidada'], ['cam2', 'Sanny']]) {
  const p = cels[sala];
  await p.waitForFunction(() => { const v = document.querySelector('#salaTiles .tile video'); return v && v.videoWidth > 0; }, null, { timeout: 30000 }).then(
    async () => ok(true, sala + ': vê o outro celular na sala em ' + Math.round(agora() - t0) + ' ms (' + (await p.locator('#stSala').textContent()) + ')'),
    async () => ok(false, sala + ': não viu o outro celular (' + (await p.locator('#stSala').textContent()) + ')'));
  ok((await p.locator('#salaTiles .tile span').first().textContent()).includes(outro), sala + ': vinheta com o nome "' + outro + '"');
  const audio = await p.evaluate(() => { const v = document.querySelector('#salaTiles .tile video'); const s = v && v.srcObject; return s ? s.getAudioTracks().length : 0; });
  ok(audio === 1, sala + ': recebe o áudio do outro celular');
  ok(await p.evaluate(() => document.getElementById('btSala').classList.contains('on') && document.getElementById('subSala').textContent === '1 pessoa'), sala + ': botão Sala aceso com "1 pessoa"');
  ok(await p.evaluate(() => window.__nhvcam.estado().audio === true && window.__nhvcam.estado().colab === true), sala + ': a Sala ligou o microfone e ficou salva');
}
await espera(1500);
ok(/^Sala: Convidada · CAM 2$/.test((await cels.cam1.locator('#stSala').textContent()).trim()), 'cam1: estado da sala em palavras (' + (await cels.cam1.locator('#stSala').textContent()) + ')');

// 5) toque na vinheta: a outra pessoa fica grande, a própria câmera vira janelinha; toque na grande volta
await cels.cam2.locator('#salaTiles .tile').first().click();
await espera(500);
ok(await cels.cam2.evaluate(() => document.getElementById('quadro').classList.contains('grande') && !document.getElementById('salaGrande').hidden && document.getElementById('salaGrande').videoWidth > 0), 'cam2: toque na vinheta mostra a Sanny grande');
ok(await cels.cam2.evaluate(() => { const r = document.getElementById('preview').getBoundingClientRect(), q = document.getElementById('quadro').getBoundingClientRect(); return r.width < q.width * 0.35 && r.top - q.top < 20; }), 'cam2: a própria câmera virou janelinha no canto');
await cels.cam2.screenshot({ path: join(CAPTURAS, 'celular-sala-grande.png') });
await cels.cam2.click('#salaGrande');
await espera(300);
ok(await cels.cam2.evaluate(() => !document.getElementById('quadro').classList.contains('grande') && document.getElementById('salaGrande').hidden), 'cam2: toque na imagem grande volta ao normal');
await cels.cam1.screenshot({ path: join(CAPTURAS, 'celular-sala-vinheta.png') });

// 6) o OBS continua recebendo as duas câmeras com a Sala ligada
d = await dims();
ok(d.every((x) => x && x.w > 0), 'collab: OBS segue com as duas câmeras com a Sala ligada ' + JSON.stringify(d));
const hud = await collab.evaluate(() => Array.from(document.querySelectorAll('iframe')).map((f) => f.contentWindow.__nhvcamView && f.contentWindow.__nhvcamView.conectado()));
ok(hud.every(Boolean), 'collab: as duas páginas do OBS seguem conectadas');

// 7) o painel entra na sala e vê as duas câmeras; os celulares veem o PC
const painel = await ctxPc.newPage();
painel.on('console', (m) => { if (m.type() === 'error') console.log('  [painel] ' + m.text()); });
await painel.setViewportSize({ width: 1400, height: 1100 });
await painel.goto(BASE + 'painel.html?k=' + CHAVE);
ok((await painel.locator('#inCollab').inputValue()) === BASE + 'collab.html?a=cam1&b=cam2&k=' + CHAVE, 'painel: link do layout collab com a chave (' + (await painel.locator('#inCollab').inputValue()) + ')');
await painel.selectOption('#colB', 'cam3'); await painel.selectOption('#colLayout', 'pip');
ok((await painel.locator('#inCollab').inputValue()) === BASE + 'collab.html?a=cam1&b=cam3&k=' + CHAVE + '&layout=pip', 'painel: link muda com câmera e layout');
await painel.click('#btTodas'); // sem prévias, para não pedir um terceiro vídeo aos celulares
t0 = agora();
await painel.click('#btSalaPc');
await painel.waitForFunction(() => { const vs = Array.from(document.querySelectorAll('#salaPcTiles .tile video')); return vs.length === 2 && vs.every((v) => v.videoWidth > 0); }, null, { timeout: 30000 }).then(
  async () => ok(true, 'painel: PC entrou na sala e vê as duas câmeras em ' + Math.round(agora() - t0) + ' ms (' + (await painel.locator('#salaCard .estado').textContent()) + ')'),
  async () => ok(false, 'painel: PC não viu as duas câmeras (' + (await painel.locator('#salaCard .estado').textContent()) + ')'));
await cels.cam1.waitForFunction(() => /PC do painel/.test(document.getElementById('stSala').textContent), null, { timeout: 10000 }).then(
  async () => ok(true, 'cam1: vê o PC do painel na sala (' + (await cels.cam1.locator('#stSala').textContent()) + ')'),
  async () => ok(false, 'cam1: não viu o PC (' + (await cels.cam1.locator('#stSala').textContent()) + ')'));
ok(await cels.cam1.evaluate(() => { const t = document.querySelectorAll('#salaTiles .tile'); const a = document.querySelector('#salaTiles .tile.audio'); return t.length === 2 && !!a && /PC do painel/.test(a.textContent) && a.querySelector('video').srcObject.getVideoTracks().length === 0 && a.querySelector('video').srcObject.getAudioTracks().length === 1; }), 'cam1: o PC aparece como vinheta só de áudio (o som do PC toca no celular)');
await painel.screenshot({ path: join(CAPTURAS, 'painel-sala.png'), fullPage: true });
await painel.click('#btSalaPc');
await cels.cam1.waitForFunction(() => !/PC do painel/.test(document.getElementById('stSala').textContent), null, { timeout: 8000 }).then(
  () => ok(true, 'cam1: PC saiu da sala e sumiu da lista'),
  async () => ok(false, 'cam1: PC não sumiu da lista (' + (await cels.cam1.locator('#stSala').textContent()) + ')'));

// 8) cam2 sai da sala: cam1 perde a vinheta; cam2 volta: reconecta
await cels.cam2.click('#btSala');
t0 = agora();
await cels.cam1.waitForFunction(() => document.querySelectorAll('#salaTiles .tile').length === 0, null, { timeout: 8000 }).then(
  () => ok(true, 'cam1: vinheta some quando a cam2 sai (' + Math.round(agora() - t0) + ' ms)'),
  () => ok(false, 'cam1: vinheta não sumiu em 8 s'));
ok(await cels.cam2.evaluate(() => !document.getElementById('btSala').classList.contains('on') && document.getElementById('stSala').hidden), 'cam2: fora da sala, botão apagado e sem estado');
await cels.cam2.click('#btSala');
t0 = agora();
await cels.cam1.waitForFunction(() => { const v = document.querySelector('#salaTiles .tile video'); return v && v.videoWidth > 0; }, null, { timeout: 30000 }).then(
  () => ok(true, 'cam1: cam2 voltou à sala em ' + Math.round(agora() - t0) + ' ms'),
  () => ok(false, 'cam1: cam2 não voltou à sala'));

// 9) cam2 recarrega a página: com a Sala salva, entra sozinha depois de Iniciar câmera
await cels.cam2.reload();
await cels.cam2.click('#btIniciar');
t0 = agora();
await cels.cam2.waitForFunction(() => { const v = document.querySelector('#salaTiles .tile video'); return v && v.videoWidth > 0; }, null, { timeout: 30000 }).then(
  () => ok(true, 'cam2: depois de recarregar entrou na sala sozinha em ' + Math.round(agora() - t0) + ' ms'),
  async () => ok(false, 'cam2: não reentrou na sala após recarregar (' + (await cels.cam2.locator('#stSala').textContent().catch(() => '?')) + ')'));
await cels.cam1.waitForFunction(() => { const v = document.querySelector('#salaTiles .tile video'); return v && v.videoWidth > 0 && document.querySelectorAll('#salaTiles .tile').length === 1; }, null, { timeout: 30000 }).then(
  () => ok(true, 'cam1: uma vinheta só da cam2 nova (a antiga foi embora)'),
  async () => ok(false, 'cam1: vinhetas: ' + (await cels.cam1.locator('#salaTiles .tile').count())));

// 10) o mudo vale para a sala e para o OBS (mesma trilha)
await cels.cam1.click('#btAudio');
ok(await cels.cam1.evaluate(() => window.__nhvcam.estado().mudo === true && document.getElementById('subAudio').textContent === 'mudo'), 'cam1: Áudio alterna o mudo com a Sala ligada');
await cels.cam1.click('#btAudio');

// 11) "Ouvir a sala" desligado silencia as vinhetas neste celular sem sair da sala; ligado de novo, volta
await cels.cam1.click('#btConfig');
await espera(300);
ok(await cels.cam1.locator('#cfgOuvir').isChecked(), 'cam1: "Ouvir a sala" vem ligado');
await cels.cam1.click('#cfgOuvir');
await espera(200);
ok(await cels.cam1.evaluate(() => Array.from(document.querySelectorAll('#salaTiles .tile video')).every((v) => v.muted) && window.__nhvcam.sala() && document.getElementById('btSala').classList.contains('on')), 'cam1: som da sala desligado, vinhetas mudas, ainda na sala');
await cels.cam1.click('#cfgOuvir');
await espera(200);
ok(await cels.cam1.evaluate(() => Array.from(document.querySelectorAll('#salaTiles .tile video')).every((v) => !v.muted)), 'cam1: som da sala ligado de novo');
// 12) "Ver os outros" desligado esconde as vinhetas, mas o som segue e a pessoa continua na sala
await cels.cam1.click('#cfgVer');
await espera(200);
ok(await cels.cam1.evaluate(() => { const c = document.getElementById('salaTiles'); const v = c.querySelector('.tile video'); return c.classList.contains('oculto') && getComputedStyle(c).opacity === '0' && v && !v.muted && !v.paused && document.getElementById('btSala').classList.contains('on'); }), 'cam1: vinhetas escondidas, som tocando, ainda na sala');
await cels.cam1.click('#cfgVer');
await espera(200);
ok(await cels.cam1.evaluate(() => !document.getElementById('salaTiles').classList.contains('oculto')), 'cam1: vinhetas de volta');
await cels.cam1.click('#btFechar');

console.log('\nTempos até OBS conectado (ms):', tempos);
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S):\n - ' + falhas.join('\n - ') : '\nTUDO PASSOU');
await browser.close();
process.exit(falhas.length ? 1 : 0);
