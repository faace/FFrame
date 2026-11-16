const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../devtools/assets/index.js');
const oldRaf =
    'M(()=>{let s,_=!1;function a(){pt()&&(_||(_=!0,t.value=!0),q.value=yt(pe().children,[]),He.value=-He.value),s=requestAnimationFrame(a)}const d=setInterval(()=>{pt()&&(clearInterval(d),s=requestAnimationFrame(a))},500);return()=>{clearInterval(d),cancelAnimationFrame(s)}},[])';
const oldInterval =
    'M(()=>{let iv,_=!1;function a(){pt()&&(_||(_=!0,t.value=!0),q.value=yt(pe().children,[]),He.value=-He.value)}function r(){clearInterval(iv);iv=null;var g=window.__ccDevToolsTreeRefreshMs;if(g===0)return;iv=setInterval(a,g);a()}window.__ccDevToolsRescheduleTree=r;const d=setInterval(()=>{pt()&&(clearInterval(d),r())},500);return()=>{clearInterval(d);clearInterval(iv)}},[])';
const newBlock =
    'M(()=>{let iv,rafId,_=!1,rafTick=0;function a(){pt()&&(_||(_=!0,t.value=!0),q.value=yt(pe().children,[]),He.value=-He.value)}function rafLoop(){rafTick++;var m=window.__ccDevToolsTreeRefreshMode;if(m==="half"&&rafTick%2!==0){rafId=requestAnimationFrame(rafLoop);return}a();rafId=requestAnimationFrame(rafLoop)}function r(){clearInterval(iv);iv=null;if(rafId){cancelAnimationFrame(rafId);rafId=0}rafTick=0;var m=window.__ccDevToolsTreeRefreshMode;if(!m||m==="off")return;if(m==="full"){rafId=requestAnimationFrame(rafLoop);a();return}if(m==="half"){rafId=requestAnimationFrame(rafLoop);a();return}var ms=parseInt(m,10);if(!isNaN(ms)&&ms>0){iv=setInterval(a,ms);a()}}window.__ccDevToolsRescheduleTree=r;const d=setInterval(()=>{pt()&&(clearInterval(d),r())},500);return()=>{clearInterval(d);clearInterval(iv);rafId&&cancelAnimationFrame(rafId)}},[])';
let src = fs.readFileSync(target, 'utf8');
if (src.includes('__ccDevToolsTreeRefreshMode')) {
    console.log('[patch] 已是 mode 版，跳过');
    process.exit(0);
}
if (src.includes(oldInterval)) src = src.replace(oldInterval, newBlock);
else if (src.includes(oldRaf)) src = src.replace(oldRaf, newBlock);
else {
    console.error('[patch] 未找到可替换片段');
    process.exit(1);
}
fs.writeFileSync(target, src, 'utf8');
console.log('[patch] 已写入', target);
