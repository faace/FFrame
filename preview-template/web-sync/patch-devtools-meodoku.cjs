/**
 * Meodoku ccc-devtools 定制 patch（可重复执行）：
 * 1. 数值属性步长：x/y/z/width/height 等为 1，scale/anchor 为 0.1
 * 2. 暴露 window.__ccDevToolsLocateNodeUuid — 展开路径并滚动，不触发搜索过滤
 * 3. 节点树搜索：保留完整树 + 高亮匹配，不再切换为过滤列表
 * 4. cc.UIOpacity：属性面板可编辑 opacity（0–255）
 *
 * 更新 cccdev 后先跑 patch-devtools-tree-refresh.cjs，再跑本脚本。
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../devtools/assets/index.js');
let src = fs.readFileSync(target, 'utf8');
let changed = false;

const MARKER = '__ccDevToolsMeodokuPatchV1';

function replaceOnce(label, oldStr, newStr) {
    if (src.includes(newStr)) {
        console.log(`[patch] ${label}：已是目标版，跳过`);
        return;
    }
    if (!src.includes(oldStr)) {
        console.error(`[patch] ${label}：未找到可替换片段`);
        process.exit(1);
    }
    src = src.replace(oldStr, newStr);
    changed = true;
    console.log(`[patch] ${label}：已写入`);
}

// 1. 属性步长
replaceOnce(
    'prop-step',
    'step:"0.1",onInput:o=>{const i=parseFloat(o.target.value);isNaN(i)||(t[e]=i)}})}function cn({model:t,propKey:e})',
    'step:(e==="scaleX"||e==="scaleY"||e==="scaleZ"||e==="anchorX"||e==="anchorY")?"0.1":"1",onInput:o=>{const i=parseFloat(o.target.value);isNaN(i)||(t[e]=i)}})}function cn({model:t,propKey:e})',
);

// 2. Ne 组件支持搜索高亮（完整树模式下）
replaceOnce(
    'tree-ne-query',
    'function Ne({node:t,depth:e}){const n=E(()=>$.value.has(t.uuid)),o=E(()=>{var s;return((s=H.value)==null?void 0:s.uuid)===t.uuid}),i=t.children.length>0,r=A(s=>{s.stopPropagation();const _=mt(t.path);H.value=_??null},[t.path]),l=A(s=>{s.stopPropagation();const _=new Set($.value);_.has(t.uuid)?_.delete(t.uuid):_.add(t.uuid),$.value=_},[t.uuid]);return u("div",{class:"tree-node",children:[u("div",{class:`tree-row${o.value?" selected":""}${t.active?"":" inactive"}`,style:{paddingLeft:`${e*14+6}px`},onClick:r,children:[u("span",{class:`tree-arrow${i?"":" invisible"}${n.value?" expanded":""}`,onClick:l,children:"›"}),u("span",{class:"tree-label",children:t.name})]}),i&&n.value&&u("div",{class:"tree-children",children:t.children.map(s=>u(Ne,{node:s,depth:e+1},s.uuid))})]})}',
    'function Ne({node:t,depth:e,query:a}){const n=E(()=>$.value.has(t.uuid)),o=E(()=>{var s;return((s=H.value)==null?void 0:s.uuid)===t.uuid}),i=t.children.length>0,r=A(s=>{s.stopPropagation();const _=mt(t.path);H.value=_??null},[t.path]),l=A(s=>{s.stopPropagation();const _=new Set($.value);_.has(t.uuid)?_.delete(t.uuid):_.add(t.uuid),$.value=_},[t.uuid]);return u("div",{class:"tree-node",children:[u("div",{class:`tree-row${o.value?" selected":""}${t.active?"":" inactive"}`,style:{paddingLeft:`${e*14+6}px`},onClick:r,children:[u("span",{class:`tree-arrow${i?"":" invisible"}${n.value?" expanded":""}`,onClick:l,children:"›"}),u(en,{text:t.name,query:a||""})]}),i&&n.value&&u("div",{class:"tree-children",children:t.children.map(s=>u(Ne,{node:s,depth:e+1,query:a},s.uuid))})]})}',
);

// 3. 搜索时保留完整树，仅高亮 + 计数
replaceOnce(
    'tree-search-full',
    'u("div",{class:"tree-scroll",children:t.value?o.value!==null?o.value.length===0?u("div",{class:"tree-empty",children:"未找到匹配节点"}):u(L,{children:[u("div",{class:"tree-search-count",children:[o.value.length," 个结果"]}),o.value.map(({node:s})=>u(tn,{node:s,query:n.value},s.uuid))]}):q.value.length===0?u("div",{class:"tree-empty",children:"场景为空"}):q.value.map(s=>u(Ne,{node:s,depth:0},s.uuid)):u("div",{class:"tree-empty",children:"等待引擎初始化…"})})',
    'u("div",{class:"tree-scroll",children:t.value?q.value.length===0?u("div",{class:"tree-empty",children:"场景为空"}):u(L,{children:[n.value&&o.value&&o.value.length===0?u("div",{class:"tree-empty",children:"未找到匹配节点"}):null,n.value&&o.value&&o.value.length>0?u("div",{class:"tree-search-count",children:[o.value.length," 个结果"]}):null,q.value.map(s=>u(Ne,{node:s,depth:0,query:n.value},s.uuid))]}):u("div",{class:"tree-empty",children:"等待引擎初始化…"})})',
);

// 4. 搜索时自动展开并滚动到首个匹配
replaceOnce(
    'tree-search-scroll',
    'M(()=>{if(!n.value)return;const s=Qt(q.value,n.value);s.size!==0&&($.value=new Set([...$.value,...s]))},[n.value])',
    'M(()=>{if(!n.value)return;const s=Qt(q.value,n.value);s.size!==0&&($.value=new Set([...$.value,...s]));requestAnimationFrame(()=>{var d,c;const h=(c=(d=e.current)==null?void 0:d.closest(".tree-panel"))==null?void 0:c.querySelector(".tree-scroll"),f=h==null?void 0:h.querySelector(".tree-highlight"),p=f==null?void 0:f.closest(".tree-row");p==null||p.scrollIntoView({block:"center",behavior:"smooth"})})},[n.value])',
);

// 5. 按 uuid 定位 API（供 WebSync 点选 / 当前页）
const locateApi =
    'window.__ccDevToolsLocateNodeUuid=function(uuid){if(!uuid)return!1;ve.value="";const path=bt(q.value,uuid);if(!path)return!1;const node=mt(path);if(!node)return!1;H.value=node;if(path.length>1){const expanded=new Set($.value);for(let i=0;i<path.length-1;i++)expanded.add(path[i]);$.value=expanded}requestAnimationFrame(()=>{const scroll=document.querySelector("#cc-devtools .tree-scroll");const row=scroll==null?void 0:scroll.querySelector(".tree-row.selected");row==null||row.scrollIntoView({block:"center",behavior:"smooth"})});return!0};';

if (src.includes('window.__ccDevToolsLocateNodeUuid')) {
    console.log('[patch] locate-api：已是目标版，跳过');
} else if (!src.includes('const ve=T("");')) {
    console.error('[patch] locate-api：未找到插入点');
    process.exit(1);
} else {
    src = src.replace('const ve=T("");', `const ve=T("");${locateApi}`);
    changed = true;
    console.log('[patch] locate-api：已写入');
}

// 6. cc.UIOpacity 属性编辑
replaceOnce(
    'ui-opacity-switch',
    'case"cc.Sprite":return new dn(e);default:return null}}class un',
    'case"cc.Sprite":return new dn(e);case"cc.UIOpacity":return new gn(e);default:return null}}class un',
);
replaceOnce(
    'ui-opacity-class',
    'class dn{constructor(e){this.getter=e,this.props=[{name:"Color",key:"color"}]}get color(){var e;return(e=this.getter())==null?void 0:e.color}set color(e){const n=this.getter();n&&(n.color=e)}}function fn({name:t,component:e,updateKey:n})',
    'class dn{constructor(e){this.getter=e,this.props=[{name:"Color",key:"color"}]}get color(){var e;return(e=this.getter())==null?void 0:e.color}set color(e){const n=this.getter();n&&(n.color=e)}}class gn{constructor(e){this.getter=e,this.props=[{name:"Opacity",key:"opacity"}]}get opacity(){var e;return((e=this.getter())==null?void 0:e.opacity)??255}set opacity(e){const n=this.getter();n&&(n.opacity=e)}}function fn({name:t,component:e,updateKey:n})',
);

if (!src.includes(MARKER)) {
    src = src.replace(
        '(function(){"use strict";',
        `(function(){"use strict";window.${MARKER}=1;`,
    );
    changed = true;
}

if (changed) {
    fs.writeFileSync(target, src, 'utf8');
    console.log('[patch] 完成 →', target);
} else {
    console.log('[patch] 无需变更');
}
