// 拍高分辨率底图（隐藏界面，纯场景）＋记录兴趣点在图上的屏幕坐标
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Users\\天天\\.cache\\hyperframes\\chrome\\chrome-headless-shell\\win64-152.0.7977.30\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const FILE = 'file:///C:/Users/%E5%A4%A9%E5%A4%A9/Desktop/%E6%88%90%E9%95%BF%E4%B8%8E%E5%A2%9E%E6%94%B6/04_%E4%B8%AA%E4%BA%BA%E4%BD%9C%E5%93%81%E7%AB%99/village/index.html';
const OUT = 'C:\\Users\\天天\\Desktop\\成长与增收\\04_个人作品站\\渲染图\\_plates';
fs.mkdirSync(OUT, { recursive: true });

const W = 3200, H = 1800;
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-device-scale-factor=1']
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const client = await page.createCDPSession();
const ev = async (e) => { const r = await client.send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.exceptionDetails ? 'EXC' : r.result.value; };
page.on('pageerror', e => console.log('!! ' + e.message));

await page.goto(FILE, { waitUntil: 'load', timeout: 90000 });
await new Promise(r => setTimeout(r, 3500));
// 隐藏所有界面元素，只留纯场景
await page.addStyleTag({ content: '.panel,.views,.side,.card,.hint,.loading,#vig,#grain{display:none!important}' });

const VIEWS = [
  { name: '01-俯瞰全景',   fly: [150, 150, 330, 0.98, 0.45] },
  { name: '02-戏台广场',   fly: null, preset: 1 },
  { name: '03-台仓侧后',   fly: [150, 150, 118, 1.12, 3.55] },
  { name: '04-沿溪远山',   fly: [150, 150, 205, 1.34, 3.05] },
  { name: '05-水平视高',   fly: null, preset: 3 },
  { name: '06-戏台近景',   fly: null, preset: 1, extra: 'zoom' }
];

const report = {};
for (const v of VIEWS) {
  if (v.preset !== undefined) {
    await ev(`document.querySelectorAll('.vbtn')[${v.preset}].click()`);
    await new Promise(r => setTimeout(r, 3400));
    if (v.extra === 'zoom') {
      await ev('window.__village.cam.tdist = 46');
      await new Promise(r => setTimeout(r, 2600));
    }
  } else {
    const [x, z, d, pol, az] = v.fly;
    await ev(`window.__village.flyTo(${x}, ${z}, ${d}, ${pol}, ${az})`);
    await new Promise(r => setTimeout(r, 3400));
  }
  // 记录兴趣点投影坐标（CSS 像素 = 图像像素，DPR=1）
  const pins = JSON.parse(await ev(`JSON.stringify(window.__village.pins.map(p => {
    const v = new THREE.Vector3(p.x, window.__village.heightAt(p.x, p.y) + 1.5, p.y).project(window.__village.camera);
    return { t: p.t, x: Math.round((v.x*0.5+0.5)*window.innerWidth), y: Math.round((-v.y*0.5+0.5)*window.innerHeight), vis: Math.abs(v.x)<1 && Math.abs(v.y)<1 };
  }))`));
  report[v.name] = pins;
  await page.screenshot({ path: `${OUT}\\${v.name}.png` });
  console.log(v.name, '→ 兴趣点：', pins.filter(p => p.vis).map(p => `${p.t}(${p.x},${p.y})`).join(' ') || '（多数不在画面内）');
}
fs.writeFileSync(`${OUT}\\pins.json`, JSON.stringify(report, null, 1));
await browser.close();
console.log('底图完成 →', OUT);
