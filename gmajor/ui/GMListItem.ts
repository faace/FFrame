import { _decorator } from 'cc';
import { GMComponent } from './GMComponent';

const { ccclass } = _decorator;

/** 列表行基类。没有预制体，游戏的行继承它。列表只写序号，不画内容 */
@ccclass('GMListItem')
export class GMListItem extends GMComponent {
    index = -1;

    /** 铺进行号。子类先 super，再填自己的字或图 */
    setIndex(index: number): void {
        this.index = index | 0;
    }

    /** 列表改完这一行的宽高后调用。基类空着，子类在这里重画 */
    onLayout(): void {}
}
