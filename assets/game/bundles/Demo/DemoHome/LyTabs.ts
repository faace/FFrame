import { _decorator, assetManager, Node, Prefab, UITransform } from 'cc';
import { GMFrame, gu, PfGMTabs } from 'db://gmajor/index';
import { PfGMTabPageDemo } from './PfGMTabPageDemo';

const { ccclass } = _decorator;

/** 页签例子。三页：概况、背包、记录。尺寸与默认 620×800 不同 */
@ccclass('LyTabs')
export class LyTabs extends GMFrame {
    width = 640;
    height = 480;

    protected onLayerInit(): void {
        this.setTitle('页签');
        const body = this.body;
        if (!body) return;
        const bundle = assetManager.getBundle('GMUI');
        if (!bundle) return console.error('[LyTabs] 没有 GMUI');
        bundle.load('PfGMTabs', Prefab, (err, prefab) => {
            if (err || !prefab) return console.error('[LyTabs] 加载失败', err);
            if (!body.isValid) return;
            const tabs = gu.createTs(prefab, { parent: body, x: 0, y: 0 });
            if (!(tabs instanceof PfGMTabs)) return console.error('[LyTabs] 页签控件没有挂上');
            const uit = body.getComponent(UITransform);
            if (uit) tabs.node.getComponent(UITransform)?.setContentSize(uit.width, uit.height);
            for (const text of ['概况', '背包', '记录']) {
                const node = new Node(text);
                node.layer = body.layer;
                const page = node.addComponent(PfGMTabPageDemo);
                page.text = text;
                tabs.insert(node);
            }
            tabs.setIndex(0);
        });
    }
}
