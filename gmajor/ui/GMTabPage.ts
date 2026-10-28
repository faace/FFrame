import { _decorator, Node } from 'cc';
import { GMComponent } from './GMComponent';

const { ccclass, property } = _decorator;

/** 页签内容基类。根上挂这个，才能绑进 PfGMTabs */
@ccclass('GMTabPage')
export class GMTabPage extends GMComponent {
    @property
    text = ''; // 页签上的字。编辑器填，或 setText

    /** 改字，并让外面的页签条跟着改 */
    setText(text: string): void {
        this.text = text;
        this.noteTabs();
    }

    /** 变成当前页时调用。做完必须 done。默认立刻 done */
    onShow(done: () => void): void {
        done();
    }

    /** 离开当前页时调用。做完必须 done。默认立刻 done */
    onHide(done: () => void): void {
        done();
    }

    private noteTabs(): void {
        let node: Node | null = this.node;
        while (node) {
            const host = node.getComponent('PfGMTabs') as { noteText?: () => void } | null;
            if (host?.noteText) return host.noteText();
            node = node.parent;
        }
    }
}
