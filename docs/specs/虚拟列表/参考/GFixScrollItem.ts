const { ccclass, property } = cc._decorator;




@ccclass
export default class GFixScrollItem extends ge.Component { // 固定可以用的item
    _idx: number;
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
    setActive(active: boolean) {
        this.node.active = active;
        this._childList.forEach(one => one[0].active = active);
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
        let childPos = child.convertToWorldSpaceAR(cc.v2(0, 0));
        let pos = this.node.convertToNodeSpaceAR(childPos);

        let info = {
            x: pos.x,
            y: pos.y,
            scaleX: child.scaleX,
            scaleY: child.scaleY,
        }

        let p = child.parent;
        while (p && p != this.node.parent) {
            info.scaleX *= p.scaleX;
            info.scaleY *= p.scaleY;
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
