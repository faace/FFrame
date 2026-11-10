import { _decorator } from 'cc';
import { GMTabPage } from 'db://gmajor/index';

const { ccclass } = _decorator;

/** 控件展示窗的一页。只当容器，控件由 LyControls.prefab 摆好 */
@ccclass('PfControlPage')
export class PfControlPage extends GMTabPage {
}
