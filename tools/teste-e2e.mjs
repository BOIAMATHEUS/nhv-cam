// Teste de ponta a ponta: 5 celulares (câmera falsa do Chromium) + 5 páginas do OBS + painel.
// Uso: node tools/teste-e2e.mjs [baseUrl] [pastaDasCapturas]
// Precisa do Playwright (usa o instalado em Projetos/nhv-lp-deploy).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PW = 'file:///C:/Users/Matheus/Projetos/nhv-lp-deploy/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const BASE = (process.argv[2] || 'http://localhost:8787/').replace(/\/?$/, '/');
const CAPTURAS = process.argv[3] || join(process.cwd(), 'capturas-teste');
mkdirSync(CAPTURAS, { recursive: true });
const N = 5;
const SALAS = Array.from({ length: N }, (_, i) => 'cam' + (i + 1));
// chave única por rodada: nunca colide com um painel aberto em outro lugar nem com outra rodada
const CHAVE = 't' + Math.random().toString(36).slice(2, 6);
console.log('chave da rodada:', CHAVE);
const falhas = [];
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) falhas.push(msg); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const agora = () => performance.now();

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream=fps=30', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const ctxCel = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone'] });
const ctxPc = await browser.newContext({ viewport: { width: 1080, height: 1920 } }); // igual à fonte Navegador do OBS
for (const c of [ctxCel, ctxPc]) c.on('weberror', (e) => console.log('  erro de página:', e.error().message));

// 1) OBS abre as 5 fontes antes dos celulares (ordem mais comum numa live)
const viewers = {};
for (const sala of SALAS) {
  const p = await ctxPc.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('  [' + sala + ' obs] ' + m.text()); });
  await p.goto(BASE + 'view.html?r=' + sala + '&k=' + CHAVE + '&hud=1');
  viewers[sala] = p;
}
await espera(1500);

// 2) celulares entram, um por vez, medindo o tempo até "OBS conectado"
const senders = {};
const tempos = {};
for (const sala of SALAS) {
  const p = await ctxCel.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('  [' + sala + ' cel] ' + m.text()); });
  // 1080p na cam1, 720p nas outras para não derrubar a CPU do teste; bitrate baixo pelo mesmo motivo
  await p.addInitScript(({ sala, q }) => { localStorage.setItem('nhvcam.celular', JSON.stringify({ sala, qualidade: q, bitrateMbps: 4, guia: false })); }, { sala, q: sala === 'cam1' ? '1080' : '720' });
  await p.goto(BASE + '?r=' + sala + '&k=' + CHAVE);
  if (sala === 'cam1') await p.screenshot({ path: join(CAPTURAS, 'celular-inicio.png') });
  ok((await p.locator('#segSala button.on').getAttribute('data-sala')) === sala, sala + ': tela inicial destaca a sala certa');
  ok((await p.locator('#linkObs').textContent()).includes('view.html?r=' + sala + '&k=' + CHAVE), sala + ': link do OBS na tela inicial leva a chave');
  const t0 = agora();
  await p.click('#btIniciar');
  try {
    await p.locator('#stObs', { hasText: 'OBS conectado' }).waitFor({ timeout: 30000 });
    tempos[sala] = Math.round(agora() - t0);
    ok(true, sala + ': OBS conectado em ' + tempos[sala] + ' ms');
  } catch (e) {
    ok(false, sala + ': não conectou ao OBS em 30 s (status: ' + (await p.locator('#stObs').textContent()) + ')');
  }
  senders[sala] = p;
}

// 3) cada OBS tem imagem com tamanho e quadros chegando
await espera(4000);
for (const sala of SALAS) {
  const v = viewers[sala];
  const dims = await v.evaluate(() => { const e = document.getElementById('v'); return { w: e.videoWidth, h: e.videoHeight, hud: document.getElementById('hud').textContent }; });
  // a câmera falsa do Chromium é deitada; o iPhone na vertical entrega 1080x1920 e o view.html preenche o 9:16 com object-fit cover
  ok(dims.w > 0 && dims.h > 0, sala + ': OBS recebe vídeo ' + dims.w + 'x' + dims.h + ' (' + dims.hud + ')');
  const fps = parseInt((dims.hud.match(/(\d+) fps/) || [])[1] || '0', 10);
  ok(fps >= 25, sala + ': fps no OBS = ' + fps);
}

// 4) zoom digital e espelho chegam no OBS pelo canal de dados
const s1 = senders.cam1, v1 = viewers.cam1;
await s1.evaluate(() => { const z = document.getElementById('zoom'); z.value = '2'; z.dispatchEvent(new Event('input', { bubbles: true })); });
await espera(600);
// o navegador normaliza a serialização: "scale(2.000, 2.000)" vira "scale(2, 2)"
let tr = await v1.evaluate(() => document.getElementById('v').style.transform);
ok(/scale\(2, 2\)/.test(tr), 'cam1: zoom 2x aplicado no OBS (' + tr + ')');
ok(/scale\(2, 2\)/.test(await s1.evaluate(() => document.getElementById('preview').style.transform)), 'cam1: prévia do celular com o mesmo zoom');
await s1.click('#btEspelho');
await espera(600);
tr = await v1.evaluate(() => document.getElementById('v').style.transform);
ok(/scale\(-2, 2\)/.test(tr), 'cam1: espelho aplicado no OBS (' + tr + ')');
await s1.click('#btEspelho');

// 5) gestos: pinça (zoom) e arrasto (enquadramento) no quadro do celular
await s1.evaluate(() => {
  const q = document.getElementById('quadro'), r = q.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const toque = (id, x, y) => new Touch({ identifier: id, target: q, clientX: x, clientY: y, pageX: x, pageY: y });
  const ev = (tipo, ts) => new TouchEvent(tipo, { touches: ts, changedTouches: ts, targetTouches: ts, bubbles: true, cancelable: true });
  q.dispatchEvent(ev('touchstart', [toque(1, cx - 40, cy), toque(2, cx + 40, cy)]));
  q.dispatchEvent(ev('touchmove', [toque(1, cx - 60, cy), toque(2, cx + 60, cy)]));   // 80 px -> 120 px = 1,5x sobre o 2x = 3x
  q.dispatchEvent(ev('touchend', []));
});
await espera(300);
let zoomVal = await s1.locator('#zoomVal').textContent();
ok(zoomVal === '3.0x', 'cam1: pinça levou o zoom a ' + zoomVal);
await s1.evaluate(() => {
  const q = document.getElementById('quadro'), r = q.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const toque = (id, x, y) => new Touch({ identifier: id, target: q, clientX: x, clientY: y, pageX: x, pageY: y });
  const ev = (tipo, ts) => new TouchEvent(tipo, { touches: ts, changedTouches: ts, targetTouches: ts, bubbles: true, cancelable: true });
  q.dispatchEvent(ev('touchstart', [toque(1, cx, cy)]));
  q.dispatchEvent(ev('touchmove', [toque(1, cx + r.width * 0.2, cy)]));              // arrasta 20% da largura para a direita
  q.dispatchEvent(ev('touchend', []));
});
await espera(600);
tr = await v1.evaluate(() => document.getElementById('v').style.transform);
ok(/translate\(20%, 0%\) scale\(3, 3\)/.test(tr), 'cam1: arrasto moveu o enquadramento no OBS (' + tr + ')');
await s1.click('#btGuia');
await espera(300);
ok(await s1.evaluate(() => !document.getElementById('guia').hidden), 'cam1: guia 9:16 ligado');
await s1.screenshot({ path: join(CAPTURAS, 'celular-ao-vivo-zoom3x-guia.png') });
await v1.screenshot({ path: join(CAPTURAS, 'obs-cam1-zoom3x.png') });
await s1.click('#btZoomReset');
await espera(400);
ok(/translate\(0%, 0%\) scale\(1, 1\)/.test(await v1.evaluate(() => document.getElementById('v').style.transform)), 'cam1: 1x volta ao enquadramento cheio no OBS');
await s1.click('#btEscuro');
await espera(200);
ok(await s1.evaluate(() => document.getElementById('escuro').classList.contains('on') && /OBS conectado/.test(document.getElementById('escuroSt').textContent)), 'cam1: tela escura mostra o status do OBS');
await s1.screenshot({ path: join(CAPTURAS, 'celular-tela-escura.png') });
await s1.click('#escuro');

// 5b) reinício de ICE mantém a MESMA conexão no OBS (queda de Wi-Fi curta não recomeça do zero)
await viewers.cam2.evaluate(() => { window.__nhvcamView.pc().__marca = 'antes'; });
await senders.cam2.evaluate(() => { const p = Array.from(window.__nhvcam.peers.values()).find((x) => !x.preview); return window.__nhvcam.reiniciarIce(p); });
await espera(3000);
const rei = await viewers.cam2.evaluate(() => { const p = window.__nhvcamView.pc(); return { mesma: !!p && p.__marca === 'antes', estado: p && p.connectionState, hud: document.getElementById('hud').textContent }; });
ok(rei.mesma && rei.estado === 'connected', 'cam2: reinício de ICE manteve a mesma conexão (' + rei.estado + ', ' + rei.hud + ')');
ok(/fps/.test(rei.hud) && !/\b0 fps/.test(rei.hud), 'cam2: vídeo seguiu fluindo depois do reinício de ICE');

// 6) reconexão: OBS recarrega a fonte (cam2) e o celular recarrega a página (cam3)
let t0 = agora();
await viewers.cam2.reload();
await viewers.cam2.waitForFunction(() => document.getElementById('v').videoWidth > 0 && document.getElementById('hud').textContent.includes('fps'), null, { timeout: 30000 }).then(
  () => ok(true, 'cam2: OBS recarregou e voltou a receber em ' + Math.round(agora() - t0) + ' ms'),
  async () => ok(false, 'cam2: OBS recarregou e não voltou (' + (await viewers.cam2.locator('#hud').textContent()) + ')'));
t0 = agora();
await senders.cam3.reload();
await senders.cam3.click('#btIniciar');
await viewers.cam3.waitForFunction(() => document.getElementById('v').videoWidth > 0, null, { timeout: 30000 });
await senders.cam3.locator('#stObs', { hasText: 'OBS conectado' }).waitFor({ timeout: 30000 }).then(
  () => ok(true, 'cam3: celular recarregou e o OBS reconectou em ' + Math.round(agora() - t0) + ' ms'),
  async () => ok(false, 'cam3: celular recarregou e não reconectou (' + (await senders.cam3.locator('#stObs').textContent()) + ')'));

// 7) painel: 5 cartões, prévias conectam, celulares passam a mostrar "+ prévia"
const painel = await ctxPc.newPage();
await painel.setViewportSize({ width: 1400, height: 1000 });
await painel.goto(BASE + 'painel.html?k=' + CHAVE);
ok((await painel.locator('.card').count()) === N, 'painel: ' + N + ' cartões');
ok((await painel.locator('#inChave').inputValue()) === CHAVE, 'painel: chave da equipe = ' + CHAVE);
ok((await painel.locator('.card').nth(0).locator('.inObs').inputValue()) === BASE + 'view.html?r=cam1&k=' + CHAVE, 'painel: link do OBS da CAM 1 leva a chave');
ok((await painel.locator('.card').nth(0).locator('.inCel').inputValue()) === BASE + '?r=cam1&k=' + CHAVE, 'painel: link do celular da CAM 1 leva a chave');
ok((await painel.locator('.card').nth(4).locator('.qr img, .qr canvas').count()) >= 1, 'painel: QR gerado na CAM 5');
for (const sala of SALAS) {
  const card = painel.locator('.card[data-sala="' + sala + '"]');
  await card.locator('.estado', { hasText: 'celular conectado' }).waitFor({ timeout: 30000 }).then(
    () => ok(true, 'painel: prévia da ' + sala + ' conectou'),
    async () => ok(false, 'painel: prévia da ' + sala + ' não conectou (' + (await card.locator('.estado').textContent()) + ')'));
}
await espera(2500);
ok(/OBS conectado \+ prévia/.test(await senders.cam4.locator('#stObs').textContent()), 'cam4: celular vê OBS e prévia ao mesmo tempo');
await painel.screenshot({ path: join(CAPTURAS, 'painel.png'), fullPage: true });
await painel.click('#btTodas');
t0 = agora();
await senders.cam4.waitForFunction(() => !/prévia/.test(document.getElementById('stObs').textContent), null, { timeout: 8000 }).then(
  async () => ok(true, 'cam4: pausar as prévias libera o celular em ' + Math.round(agora() - t0) + ' ms (status: ' + (await senders.cam4.locator('#stObs').textContent()) + ')'),
  async () => ok(false, 'cam4: pausar as prévias não liberou o celular em 8 s (status: ' + (await senders.cam4.locator('#stObs').textContent()) + ')'));

// 8) estatísticas no celular (resolução, fps, bitrate, caminho, latência)
const bit = await senders.cam1.locator('#stBit').textContent();
ok(/\d+x\d+/.test(bit) && /fps/.test(bit), 'cam1: estatísticas no celular: ' + bit);
ok(/direto/.test(bit), 'cam1: caminho identificado como direto (' + (bit.match(/direto[^·]*/) || ['?'])[0].trim() + ')');
ok(/\d+ ms/.test(bit), 'cam1: latência de ida e volta exibida');

// 8b) fonte do OBS no tamanho errado (padrão 800x600): a página desenha um quadro 9:16 e o celular avisa
const errado = await ctxPc.newPage();
await errado.setViewportSize({ width: 800, height: 600 });
await errado.goto(BASE + 'view.html?r=cam5&k=' + CHAVE);
await errado.waitForFunction(() => document.getElementById('v').videoWidth > 0, null, { timeout: 30000 });
const q = await errado.evaluate(() => { const r = document.getElementById('quadro').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
ok(q.w === 338 && q.h === 600, 'fonte 800x600: quadro desenhado em 9:16 centralizado (' + q.w + 'x' + q.h + ')');
await senders.cam5.locator('#stFonte', { hasText: '800x600' }).waitFor({ timeout: 10000 }).then(
  async () => ok(true, 'cam5: celular avisa o tamanho errado da fonte: ' + (await senders.cam5.locator('#stFonte').textContent())),
  () => ok(false, 'cam5: celular não avisou a fonte em 800x600'));
ok(await senders.cam1.locator('#stFonte').isHidden(), 'cam1: sem aviso quando a fonte está em 1080x1920');
await errado.close();

// 9) opção de manter a tela ligada (wake lock) na Config
await senders.cam1.click('#btConfig');
await espera(300);
ok(await senders.cam1.locator('#cfgWake').isChecked(), 'cam1: "Manter a tela ligada" vem ligado');
const wakeSt = await senders.cam1.locator('#cfgWakeSt').textContent();
ok(wakeSt.length > 10, 'cam1: estado do wake lock: ' + wakeSt);
await senders.cam1.click('#btFechar');

console.log('\nTempos até OBS conectado (ms):', tempos);
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S):\n - ' + falhas.join('\n - ') : '\nTUDO PASSOU');
await browser.close();
process.exit(falhas.length ? 1 : 0);
