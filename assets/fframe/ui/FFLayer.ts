import { _decorator } from 'cc';
import { FFComponent } from './FFComponent';

const { ccclass } = _decorator;

/**
 * Layer 脚本基类。`Ly*` 关联脚本继承本类（不要直接 extends Component / FFComponent）。
 * 第 1 刀与 FFComponent 同能；分层差异以后再加。
 */
@ccclass('FFLayer')
export class FFLayer extends FFComponent {}
