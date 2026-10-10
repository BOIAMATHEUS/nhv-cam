// Teste rápido dos redirecionamentos entre a página do celular e a do OBS.
// Uso: node tools/teste-redirect.mjs [baseUrl]
const PW = 'file:///C:/Users/Matheus/Projetos/nhv-lp-deploy/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const BASE = (process.argv[2] || 'http://localhost:8787/').replace(/\/?$/, '/');
const UA_OBS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 OBS/30.2.3';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const falhas = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) falhas.push(m); };
const browser = await chromium.launch();

async function abrir(ua, url) { const ctx = await browser.newContext(ua ? { userAgent: ua } : {}); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(1200); return { ctx, p }; }

let r = await abrir(UA_OBS, BASE + '?r=cam2&k=abc12');
ok(/view\.html\?r=cam2&k=abc12$/.test(r.p.url()), 'página do celular aberta no OBS vai para a do OBS: ' + r.p.url()); await r.ctx.close();

r = await abrir(UA_IPHONE, BASE + 'view.html?r=cam3&k=abc12');
ok(/index\.html\?r=cam3&k=abc12$/.test(r.p.url()), 'página do OBS aberta no iPhone vai para a do celular: ' + r.p.url());
ok((await r.p.locator('#segSala button.on').getAttribute('data-sala')) === 'cam3', 'e a CAM 3 vem destacada');
ok((await r.p.locator('#chaveInfo b').textContent()) === 'abc12', 'com a chave abc12'); await r.ctx.close();

r = await abrir(UA_IPHONE, BASE + 'view.html?r=cam3&k=abc12&ver=1');
ok(/view\.html/.test(r.p.url()), 'com &ver=1 o celular pode ficar como monitor'); await r.ctx.close();

r = await abrir(UA_OBS, BASE + 'view.html?r=cam1&k=abc12');
ok(/view\.html\?r=cam1&k=abc12$/.test(r.p.url()), 'página do OBS no OBS fica onde está'); await r.ctx.close();

r = await abrir(null, BASE + '?r=cam1');
ok(await r.p.locator('#btIniciar').isVisible(), 'página do celular no desktop fica onde está'); await r.ctx.close();

await browser.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTUDO PASSOU');
process.exit(falhas.length ? 1 : 0);
