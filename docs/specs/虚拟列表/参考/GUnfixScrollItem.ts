import GPrefabBase from '../../gCore/GPrefabBase';

const { ccclass, property } = cc._decorator;




@ccclass
export default class GUnfixScrollItem extends GPrefabBase { // 非固定可以用的item
    _typeIdx: number; // 用于记录是什么类型的item，是GUnfixScrollView的预制体列表中的索引
    _idx: number; // 完整列表中的idx
    _childList: Array<[cc.Node, any]> = [];

    init(parm) { // 通过这个接口，可以预先加载若干内容
        // console.log(1);
    }

    setData(...args: any[]) { }

    getIdx() {
        return this._idx;
    }
    setIdx(idx) {
        this._idx = idx;
    }
    isSamveIdx(idx) {
        return this._idx == idx;
    }
    getTypeIdx() {
        return this._typeIdx
    }
    setTypeIdx(typeIdx) {
        this._typeIdx = typeIdx;
    }
    isSamveTypeIdx(typeIdx) {
        return this._typeIdx == typeIdx;
    }
    updateSubInfo() {
        this._childList.forEach(one => {
            one[0].x = this.node.x + one[1].x;
            one[0].y = this.node.y + one[1].y;
        })
    }
    setAttr(parm) {
        for (let i in parm) {
            this.node[i] = parm[i];

            this._childList.forEach(one => {
                switch (i) {
                    case 'active': {
                        one[0][i] = parm[i];
                        break;
                    }
                    case 'x':
                    case 'y': {
                        one[0][i] = one[1][i] + parm[i];
                        break;
                    }
                }

            });
        }
    }
    setActive(active: boolean) { // 注意！ 实际是用透明模式，可以减少排序消耗，这个时候，本身节点和子节点不能使用透明功能！！！
        this.node.opacity = active ? 255 : 0;
        if (!active) {
            this.node.x = -10000;
            this.node.y = -10000;
        }
        this._childList.forEach(one => one[0].opacity = active ? 255 : 0);
    }
    setX(x: number) {
        this.node.x = x;
        this._childList.forEach(one => one[0].x = one[1].x + x);
    }
    setY(y: number) {
        this.node.y = y;
        this._childList.forEach(one => one[0].y = one[1].y + y);
    }
    recordChild(child: cc.Node) { // 记录分离的节点
        // 自行找到父节点为止，修改相关的内容
        // let childPos = child.convertToWorldSpaceAR(cc.v2(0, 0));

        let info = {
            x: 0, // child.x * child.scaleX,
            y: 0, // child.y * child.scaleY,
            scaleX: child.scaleX,
            scaleY: child.scaleY,
        }

        let p = child.parent;
        let c = child;

        while (p && p != this.node.parent) {
            info.scaleX *= p.scaleX;
            info.scaleY *= p.scaleY;

            info.x += c.x;
            info.y += c.y;
            info.x *= p.scaleX;
            info.y *= p.scaleY;




            c = p;
            p = p.parent;
        }

        child.x = info.x;
        child.y = info.y;
        child.scaleX = info.scaleX;
        child.scaleY = info.scaleY;


        // let childPos = child.convertToWorldSpaceAR(cc.v2(0, 0));
        // let pos = this.node.convertToNodeSpaceAR(childPos);
        // let info = {
        //     x: pos.x,
        //     y: pos.y,
        // };
        // child.x = pos.x;
        // child.y = pos.y;
        this._childList.push([child, info])
    }
}
