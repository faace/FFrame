import { _decorator } from 'cc';
import { FFLayer } from './FFLayer';

const { ccclass } = _decorator;

/**
 * 场景关联脚本基类。`Sc*` 脚本继承本类。
 * 继承链：FFScene → FFLayer → FFComponent（与参考工程 Scene→Layer→Component 对齐）。
 */
@ccclass('FFScene')
export class FFScene extends FFLayer {}
