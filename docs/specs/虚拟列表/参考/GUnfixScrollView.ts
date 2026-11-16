
import GUnfixScrollItem from "./GUnfixScrollItem";


// https://docs.cocos.com/creator/api/zh/class/ScrollView

const { ccclass, property, requireComponent } = cc._decorator;


interface FGetItemData {
    (idx: number, ts: GUnfixScrollItem): void
}

interface FUpdateVisibleIndex {
    (startIdx: number, endIndx: number): void
}

export interface GUnfixScrollViewInitParm {
    setItemData: FGetItemData;
    updateVisibleIndex?: FUpdateVisibleIndex;
    itemDataList?: Array<any>; // item对应的数值
    cb?: Function; // 加载结束后回调，cb(error, data);
    endNumAddMore?: number// 是否多显示几个节点
    beforeUpdateContent?: () => void; // 内容尺寸算完、首次绑定 item 之前，用来先把滚动位置摆好
}

enum TempType {
    Node = 1,
    Prefab = 2,
}

interface GUnfixIemInfo {
    idx: number,
    typeIdx: number,
    // 以下用于水平
    x?: number,
    width?: number,
    anchorX?: number,
    // 以下用于垂直
    y?: number,
    height?: number,
    anchorY?: number,
}


@ccclass
@requireComponent(cc.ScrollView)
export default class GUnfixScrollView extends ge.Component { // 只针对固定大小的item
    @property({ type: cc.Enum(TempType), tooltip: CC_DEV && '模板类型', })
    tempType: TempType = TempType.Node;

    @property({ type: cc.Node, tooltip: CC_DEV && '模板节点列表，影响typeIdx', visible() { return this.tempType == TempType.Node; } })
    ndTempList: Array<cc.Node> = [];

    @property({ type: cc.Prefab, tooltip: CC_DEV && '模板预制体，影响typeIdx', visible() { return this.tempType == TempType.Prefab; } })
    pfTempList: Array<cc.Prefab> = [];

    @property({ type: cc.Float, tooltip: CC_DEV && '同向开始间隔' })
    gapBegin: number = 0.0;

    @property({ type: cc.Float, tooltip: CC_DEV && '同向结束间隔' })
    gapEnd: number = 0.0;

    // @property({ type: cc.Float, tooltip: CC_DEV && '同向间隔' })
    // gapDirect: number = 0.0;


    @property({ type: cc.Float, tooltip: CC_DEV && '同向开始间隔', visible() { return this.lineCount > 1; } })
    gapBegin2: number = 0.0;

    @property({ type: cc.Float, tooltip: CC_DEV && '同向结束间隔', visible() { return this.lineCount > 1; } })
    gapEnd2: number = 0.0;

    // @property({ type: cc.Float, tooltip: CC_DEV && '垂直方向间隔，用于Grid模式', visible() { return this.lineCount > 1; } })
    // gapDirect2: number = 0.0;


    @property({ type: cc.String, tooltip: CC_DEV && '将 item 子节点拆到独立层；数组顺序=从底到顶，索引 < itemSubLayerIdx 的在 item 下层，>= 的在 item 上层' })
    strSubLayers: Array<string> = [];

    @property({ type: cc.Integer, tooltip: CC_DEV && 'item 根节点所在层(0=最底)。例：divider 在下则填 0 且 strSubLayers[0]=divider；item 在 divider 上则填 1' })
    itemSubLayerIdx: number = 0;

    _ndSubLayers: Array<cc.Node> = [];
    _itemSubLayerIdx: number = 0;



    _scrollView: cc.ScrollView = null;
    _isHorizontal: boolean;
    _scrollContent: cc.Node = null;
    _itemWidth: number = 0;
    _itemHeight: number = 0;
    _contentDefualtX: number = 0; // 默认content x的位置
    _contentDefualtY: number = 0; // 默认content y的位置
    _viewX: number = 0; // 实际content里面的可视起始x
    _viewY: number = 0; // 实际content里面的可视起始y
    _viewX2: number = 0; // 实际content里面的可视结束x
    _viewY2: number = 0; // 实际content里面的可视结束y
    _defalutViewY: number = 0;
    _endNumAddMore: number = 0;

    set defalutViewY(value: any) {
        this._defalutViewY = value;
    }


    _setItemData: FGetItemData = () => { };
    _updateVisibleIndex: FUpdateVisibleIndex = () => { };
    _itemNum: number = 0;
    _itemTsList: Array<any> = []; // 显示在列表中的ts
    _itemInfoList: Array<GUnfixIemInfo> = [];
    _itemInfoMaxNum: { [key: number]: number } = {}; // 每个类型最多可以出现多少个节点
    _itemTsMap: Array<Array<any>> = []; // 隐藏的ts
    _startIdx: number = -999999999;
    _endIdx: number = -999999999;


    init(parm: GUnfixScrollViewInitParm) { // 通过这个接口，可以预先加载若干内容
        this._setItemData = parm.setItemData;
        if (parm.updateVisibleIndex) this._updateVisibleIndex = parm.updateVisibleIndex;
        if (parm.endNumAddMore) this._endNumAddMore = parm.endNumAddMore;
        this._startIdx = -999999999;
        this._endIdx = -999999999;

        // 统一用this.ndTemp
        if (this.tempType == TempType.Prefab) {
            this.tempType = TempType.Node;
            this.ndTempList = [];
            this.pfTempList.forEach(pf => {
                this.ndTempList.push(cc.instantiate(pf));
            })
        }

        // this._itemWidth = this.ndTempList.width;
        // this._itemHeight = this.ndTempList.height;

        // 初始化相关坐标
        this._scrollView = this.node.getComponent(cc.ScrollView);
        this._isHorizontal = this._scrollView.horizontal;
        this._scrollContent = this._scrollView.content;
        // this.updateItemNum(0);
        this._scrollContent.removeAllChildren();

        // this._contentDefualtX = 0; // this._scrollContent.parent.width * this._scrollContent.parent.anchorX;
        // this._contentDefualtY = this._scrollContent.parent.height * (1 - this._scrollContent.parent.anchorY);


        this.initSubLayers();

        this.updateItemDataList(parm.itemDataList, true);

        parm.beforeUpdateContent?.();
        this.updateVisiblePos();
        this.updateContent();

        parm.cb && parm.cb();
    }

    onWinResizeCallback() {
        this.updateVisiblePos();
        this.updateContent();
    }

    /** item 根节点层序号（strSubLayers 为空时固定为 0） */
    getItemSubLayerIdx() {
        if (!this.strSubLayers.length) return 0;
        return Math.min(Math.max(0, this.itemSubLayerIdx | 0), this.strSubLayers.length);
    }

    /** strSubLayers 配置项对应的 SubLayer 序号 */
    getExtractSubLayerIdx(strSubLayerIdx: number) {
        let itemLayer = this.getItemSubLayerIdx();
        return strSubLayerIdx < itemLayer ? strSubLayerIdx : strSubLayerIdx + 1;
    }

    initSubLayers() {
        this._ndSubLayers.forEach(one => ge.isValid(one) && one.destroy());
        this._ndSubLayers = [];
        this._itemSubLayerIdx = this.getItemSubLayerIdx();
        let layerCount = this.strSubLayers.length + 1;
        for (let i = 0; i < layerCount; i++) {
            let ndLayer = new cc.Node();
            ndLayer.name = 'SubLayer' + i;
            ndLayer.x = 0;
            ndLayer.y = 0;
            ndLayer.anchorX = this._scrollContent.anchorX;
            ndLayer.anchorY = this._scrollContent.anchorY;
            this._ndSubLayers.push(ndLayer);
        }
        this._ndSubLayers.forEach(one => {
            one.parent = this._scrollContent;
        });
    }
    initItemTsMap() { // 插件节点缓存，放在_itemTsMap中
        let itemNumList; // 计算需要缓存多少，已经加一了
        if (this._isHorizontal) itemNumList = this.calcHorizonTalItemNumList(this._itemInfoList); // [1, 2, 3, 4];
        else itemNumList = this.calcVerticalItemNumList(this._itemInfoList); // [1, 2, 3, 4];
        this._itemTsMap = this._itemTsMap || [];

        while (this._itemTsList.length) { // 将现有节点放回缓存
            let ts = this._itemTsList.pop();
            ts.setActive(false);
            this._itemTsMap[ts._typeIdx].push(ts);
        }

        console.log('GUnfixScrollView initItemTsMap', itemNumList);
        console.time('GUnfixScrollView initItemTsMap');
        itemNumList.forEach((num, typeIdx) => {
            if (this._endNumAddMore) num += this._endNumAddMore;

            let itemTsList;
            if (this._itemTsMap[typeIdx]) itemTsList = this._itemTsMap[typeIdx];
            else itemTsList = this._itemTsMap[typeIdx] = [];

            for (let i = itemTsList.length; i < num; i++) {
                let ts = this.createItemTs(typeIdx);
                if (!ts) break;

                itemTsList.push(ts);
            }
        })
        // ge.log('_itemTsMap:', this._itemTsMap);
        console.timeEnd('GUnfixScrollView initItemTsMap');
    }
    createItemTs(typeIdx: number) {
        if (!this.ndTempList[typeIdx]) return null;

        let item = cc.instantiate(this.ndTempList[typeIdx]);
        item.parent = this._ndSubLayers[this._itemSubLayerIdx];
        let ndProgress = item.getChildByName("progress");
        if (ndProgress) {
            let pb = ndProgress.getComponent(cc.ProgressBar);
            if (pb) pb.progress = 0;
        }
        let ts = item.getComponent(GUnfixScrollItem);
        ts.setTypeIdx(typeIdx);
        ts.init && ts.init({});

        for (let ii = 0; ii < this.strSubLayers.length; ii++) {
            let list = this.strSubLayers[ii].split(';');
            let subLayerIdx = this.getExtractSubLayerIdx(ii);
            for (let j = 0; j < list.length; j++) {
                let child = this.findChild(ts.node, list[j]);
                if (!child) continue;
                ts.recordChild(child);
                child.parent = this._ndSubLayers[subLayerIdx];
            }
        }

        ts.setActive(false);
        return ts;
    }
    /** item 实际尺寸小于模板时，预创建的数量会不够，取空就补建，避免列表出现空档 */
    popItemTs(typeIdx: number) {
        let itemTsList = this._itemTsMap[typeIdx];
        if (!itemTsList) itemTsList = this._itemTsMap[typeIdx] = [];

        return itemTsList.pop() || this.createItemTs(typeIdx);
    }
    calcHorizonTalItemNumList(itemInfoList: Array<any>) { // 计算同时最多可以出现多少节点，预先创建。也可以用对象池做，但是怕最初会卡，先看看这个情况
        let viewLen = this._viewX2 - this._viewX + 1;
        let initNumList = () => {
            let list = [];
            this.ndTempList.forEach(() => { list.push(0) })
            return list;
        };
        let itemNumList = initNumList();

        for (let i = 0; i < itemInfoList.length; i++) {
            let tempNumList = initNumList();
            let len = 0;
            for (let j = i; j < itemInfoList.length; j++) {
                len += this._itemInfoList[j].width;
                tempNumList[itemInfoList[j].typeIdx]++;
                if (len > viewLen || j == itemInfoList.length - 1) { // 对比现有的，取最大值
                    for (let k = 0; k < itemNumList.length; k++) itemNumList[k] = Math.max(itemNumList[k], tempNumList[k]);
                    break;
                }
            }
        }
        if (itemInfoList.length) {
            for (let k = 0; k < itemNumList.length; k++) {
                // 多两个，显示出现次数最少的
                itemNumList[k] = Math.min(itemNumList[k] + 2, this._itemInfoMaxNum[k] || 0);
            }
        }
        return itemNumList;
    }
    initHorizontalItemTsList(itemDataList: Array<any>) { // 初始化所有节点，只生成可视范围内和最多额外多一个节点
        //1. 需要根据所有数据列表，重新计算所有节点的位置，宽度等，目前只算横屏
        this._itemInfoList = [];
        this._itemInfoMaxNum = {};
        let startX = this.gapBegin;
        for (let idx = 0; idx < itemDataList.length; idx++) {
            let typeIdx = itemDataList[idx].typeIdx;
            let nd = this.ndTempList[typeIdx];
            if (!nd) return ge.error('请设置_typeIdx，否则无法确定节点类型');

            this._itemInfoList.push({ idx, typeIdx, x: startX, width: nd.width, anchorX: nd.anchorX });
            startX += nd.width;

            if (!this._itemInfoMaxNum[typeIdx]) this._itemInfoMaxNum[typeIdx] = 0;
            this._itemInfoMaxNum[typeIdx]++;
        }


        // 2. 计算所有类型的预制体，需要预先插件多少各节点，先创建好
        this.initItemTsMap();

        // 3.设置滚动内容宽度
        this._scrollContent.width = Math.max(this._scrollContent.parent.width, startX + this.gapEnd);
    }
    calcVerticalItemNumList(itemInfoList: Array<any>) { // 计算同时最多可以出现多少节点，预先创建。也可以用对象池做，但是怕最初会卡，先看看这个情况
        let viewLen = this._viewY - this._viewY2 + 1;
        let initNumList = () => {
            let list = [];
            this.ndTempList.forEach(() => { list.push(0) })
            return list;
        };
        let itemNumList = initNumList();

        for (let i = 0; i < itemInfoList.length; i++) {
            let tempNumList = initNumList();
            let len = 0;
            for (let j = i; j < itemInfoList.length; j++) {
                len += this._itemInfoList[j].height;
                tempNumList[itemInfoList[j].typeIdx]++;
                if (len > viewLen || j == itemInfoList.length - 1) { // 对比现有的，取最大值
                    for (let k = 0; k < itemNumList.length; k++) itemNumList[k] = Math.max(itemNumList[k], tempNumList[k]);
                    break;
                }
            }
        }
        if (itemInfoList.length) {
            for (let k = 0; k < itemNumList.length; k++) {
                // 多两个，显示出现次数最少的
                itemNumList[k] = Math.min(itemNumList[k] + 2, this._itemInfoMaxNum[k] || 0);
            }
        }
        return itemNumList;
    }
    initVerticalItemTsList(itemDataList: Array<any>) { // 初始化所有节点，只生成可视范围内和最多额外多一个节点
        //1. 需要根据所有数据列表，重新计算所有节点的位置，宽度等，目前只算横屏
        this._itemInfoList = [];
        this._itemInfoMaxNum = {};
        let startY = -this.gapBegin;
        for (let idx = 0; idx < itemDataList.length; idx++) {
            let typeIdx = itemDataList[idx].typeIdx;
            let nd = this.ndTempList[typeIdx];
            if (!nd) return ge.error('请设置_typeIdx，否则无法确定节点类型');

            this._itemInfoList.push({ idx, typeIdx, y: startY, height: nd.height, anchorY: nd.anchorY });
            startY -= nd.height;

            if (!this._itemInfoMaxNum[typeIdx]) this._itemInfoMaxNum[typeIdx] = 0;
            this._itemInfoMaxNum[typeIdx]++;
        }


        // 2. 计算所有类型的预制体，需要预先插件多少各节点，先创建好
        this.initItemTsMap();

        // 3.设置滚动内容宽度
        this._scrollContent.height = Math.max(this._scrollContent.parent.height, Math.abs(startY - this.gapEnd));
    }
    updateItemDataList(itemDataList: Array<{ typeIdx: number }> = [], isFirtInit = false) { // 初始化所有节点，只生成可视范围内和最多额外多一个节点
        // 需要回收现有内容
        while (this._itemTsList.length) {
            let ts = this._itemTsList.pop();
            ts.setActive(false);
            this._itemTsMap[ts._typeIdx].push(ts);
        }
        if (isFirtInit) {
            this._contentDefualtX = this._scrollContent.x;
            this._contentDefualtY = this._scrollContent.y;
        }
        this.updateVisiblePos();

        if (this._isHorizontal) this.initHorizontalItemTsList(itemDataList);
        else this.initVerticalItemTsList(itemDataList);

        if (isFirtInit) {
            this._contentDefualtX = this._scrollContent.x;
            this._contentDefualtY = this._scrollContent.y;
        }

        this.updateVisiblePos();
    }
    findChild(node: cc.Node, path) {
        let p = path.split('.');
        for (let i = 0; i < p.length; i++) {
            node = node.getChildByName(p[i]);
            if (!node) break;
        }
        return node;
    }
    updateItemNum(itemDataList: Array<any>) {
        this.updateItemDataList(itemDataList);
    }

    /** setData 后回写 item 宽/高，并重算后续坐标与 content 尺寸；尺寸未变返回 false */
    updateItemInfoSize(idx: number, size: { width?: number, height?: number }) {
        const info = this._itemInfoList[idx];
        if (!info || !this._scrollContent) return false;

        if (this._isHorizontal) {
            const width = size.width;
            if (typeof width !== 'number' || info.width === width) return false;
            info.width = width;
            let startX = idx === 0 ? this.gapBegin : this._itemInfoList[idx - 1].x + this._itemInfoList[idx - 1].width;
            for (let i = idx; i < this._itemInfoList.length; i++) {
                this._itemInfoList[i].x = startX;
                startX += this._itemInfoList[i].width;
            }
            this._scrollContent.width = Math.max(this._scrollContent.parent.width, startX + this.gapEnd);
            return true;
        }

        const height = size.height;
        if (typeof height !== 'number' || info.height === height) return false;
        info.height = height;
        let startY = idx === 0 ? -this.gapBegin : this._itemInfoList[idx - 1].y - this._itemInfoList[idx - 1].height;
        for (let i = idx; i < this._itemInfoList.length; i++) {
            this._itemInfoList[i].y = startY;
            startY -= this._itemInfoList[i].height;
        }
        this._scrollContent.height = Math.max(this._scrollContent.parent.height, Math.abs(startY - this.gapEnd));
        return true;
    }

    resize() { // scrollview修改尺寸后需要调用
        this.updateVisiblePos();
        this.initItemTsMap();
        this._startIdx = -999999999; // 强制重新刷新
        this._endIdx = -999999999; // 强制重新刷新
        this._itemTsList.forEach((one, idx) => {
            one.setIdx(this._startIdx + idx)
        })
        this.updateContent();

    }
    resetPos() {
        this._scrollView.stopAutoScroll();
        if (this._isHorizontal) this._scrollView.scrollToLeft();
        else this._scrollView.scrollToTop();
    }
    updateAll() {
        this._startIdx = -999999999; // 强制重新刷新
        this._endIdx = -999999999; // 强制重新刷新
        this._itemTsList.forEach((one, idx) => {
            one.setIdx(this._startIdx + idx)
        })
        this.updateVisiblePos();
        this._itemTsList.forEach((one, idx) => {
            one.setIdx(this._startIdx + idx)
        })
        this.updateContent();
    }
    getItemTsByIdx(idx) {
        for (let i = 0; i < this._itemTsList.length; i++) {
            if (this._itemTsList[i].isSamveIdx(idx)) {
                return this._itemTsList[i];
            }
        }

    }
    updateItemData(idxList: Array<number> = []) {
        idxList.forEach(idx => {
            for (let i = 0; i < this._itemTsList.length; i++) {
                if (this._itemTsList[i].isSamveIdx(idx)) {
                    this._setItemData(idx, this._itemTsList[i]);
                    return;
                }
            }


        })
    }
    updateContent() {
        if (this._itemInfoList.length < 1) return;

        // setData 里可能回写 item 尺寸，可视范围会跟着漂移，最多补算两次，避免仍可见的边缘 item 被回收后留下空档
        for (let i = 0; i < 3; i++) {
            let isRangeChanged = this._isHorizontal ? this.updateContentHorizontal() : this.updateContentVertial();
            if (!isRangeChanged) return;
        }
    }
    calcVisibleIdxRange() { // 当前可视范围对应的首尾idx
        let startIdx: number, endIdx: number;
        if (this._isHorizontal) {
            startIdx = this.calcInfoIdxByX(Math.abs(Math.max(0, this._viewX)));
            endIdx = this.calcInfoIdxByX(Math.abs(this._viewX2));
        } else {
            startIdx = this.calcInfoIdxByY(-Math.abs(Math.min(0, this._viewY)));
            endIdx = this.calcInfoIdxByY(this._viewY2);
        }

        if (typeof startIdx == 'undefined') { // 没有显示合适的
            startIdx = endIdx = this._itemInfoList.length;
        } else if (typeof endIdx == 'undefined') { // 直接固定组后一个
            endIdx = this._itemInfoList.length - 1;
        }

        if (this._endNumAddMore) {
            if (startIdx > 0) {
                startIdx = Math.max(0, startIdx - this._endNumAddMore);
            }
            if (endIdx < this._itemInfoList.length - 1) {
                endIdx = Math.min(endIdx + this._endNumAddMore, this._itemInfoList.length - 1);
            }
        }

        return { startIdx, endIdx };
    }
    /** 摆放完对比一次可视范围，setData 回写尺寸导致范围变了就需要再补一轮 */
    isVisibleIdxRangeChanged(startIdx: number, endIdx: number) {
        if (this._itemInfoList.length < 1) return false;

        let range = this.calcVisibleIdxRange();
        return range.startIdx != startIdx || range.endIdx != endIdx;
    }
    calcInfoIdxByX(x: number) { // 二分法找，相对最快
        let min = 0, max = this._itemInfoList.length - 1;
        if (this._itemInfoList[0].x >= x) return 0;
        if (this._itemInfoList[max].x + this._itemInfoList[max].width <= x) return max;


        while (min <= max) {
            let idx = Math.floor((max + min) * 0.5);
            if (this._itemInfoList[idx].x > x) { // 如果当前的位置大于x，表示x在中间的左边
                max = idx - 1;
                continue;
            }
            if (this._itemInfoList[idx].x + this._itemInfoList[idx].width < x) {
                min = idx + 1;
                continue;
            }
            return idx;
            // return { x: this._itemInfoList[idx].x, idx };
        }
    }
    updateContentHorizontal() { // 水平移动 根据实际位置更新content内容

        let { startIdx, endIdx } = this.calcVisibleIdxRange();

        // ge.log('updateContentHorizontal', startIdx, endIdx);

        // ge.log(startIdx, this._startIdx);
        // 需要判断节点能否复用
        let itemLen = this._itemTsList.length;
        // ge.log(this._itemTsList, itemLen);
        if (startIdx < this._startIdx) { // 向右滚动，看到前面的
            for (let i = itemLen - 1; i >= 0; i--) { // 把后面的删了
                if (this._itemTsList[i].getIdx() > endIdx) {
                    let ts = this._itemTsList.pop();
                    ts.setActive(false);
                    // ge.log('_itemTsMap push1', ts._typeIdx)
                    this._itemTsMap[ts._typeIdx].push(ts);
                    continue;
                }
                break;
            }


            for (let idx = endIdx - this._itemTsList.length; idx >= startIdx; idx--) {
                // ge.log('_itemTsMap pop1', this._itemInfoList[idx].typeIdx)
                let ts = this.popItemTs(this._itemInfoList[idx].typeIdx);
                if (!ts) { // 需要看看是什么问题
                    ge.shushuDataReporter.track("client_error", { tag: 'GUnfixScrollView', sub_tag: 'updateContentHorizontal1', msg: 'idx:' + idx + ',this._itemInfoList[idx].typeIdx:' + this._itemInfoList[idx].typeIdx });
                    ge.error('GUnfixScrollView 立马找客户端看看1')
                    return;
                }
                this._itemTsList.unshift(ts);

                ts.setIdx(idx);
                ts.setActive(true);
                this._setItemData(idx, ts);
            }
        } else if (startIdx > this._startIdx) { // 向左滚动，看到后面的
            let i = 0;
            while (i < this._itemTsList.length) {
                if (this._itemTsList[i].getIdx() < startIdx) {  // 把前面滚动出视线的ts拿出来，收起来
                    let ts = this._itemTsList.shift();
                    ts.setActive(false);
                    // ge.log('_itemTsMap push2', ts._typeIdx)
                    this._itemTsMap[ts._typeIdx].push(ts);
                    continue;
                }
                i++;
                break;
            }
            for (let idx = startIdx + this._itemTsList.length; idx <= endIdx; idx++) {
                // ge.log('_itemTsMap pop2', this._itemInfoList[idx].typeIdx)
                let ts = this.popItemTs(this._itemInfoList[idx].typeIdx);
                if (!ts) { // 需要看看是什么问题
                    ge.shushuDataReporter.track("client_error", { tag: 'GUnfixScrollView', sub_tag: 'updateContentHorizontal2', msg: 'idx:' + idx + ',this._itemInfoList[idx].typeIdx:' + this._itemInfoList[idx].typeIdx });
                    ge.error('GUnfixScrollView 立马找客户端看看2')
                    return;
                }

                this._itemTsList.push(ts);

                ts.setIdx(idx);
                ts.setActive(true);
                this._setItemData(idx, ts);
            }
        } else if (endIdx > this._endIdx) { // 需要补上 startIdx != 0 &&
            for (let idx = this._endIdx + 1; idx <= endIdx; idx++) {
                // ge.log('_itemTsMap pop3', this._itemInfoList[idx].typeIdx)
                let ts = this.popItemTs(this._itemInfoList[idx].typeIdx);
                if (!ts) { // 需要看看是什么问题
                    ge.shushuDataReporter.track("client_error", { tag: 'GUnfixScrollView', sub_tag: 'updateContentHorizontal3', msg: 'idx:' + idx + ',this._itemInfoList[idx].typeIdx:' + this._itemInfoList[idx].typeIdx });
                    ge.error('GUnfixScrollView 立马找客户端看看3')
                    return;
                }

                this._itemTsList.push(ts);

                ts.setIdx(idx);
                ts.setActive(true);
                this._setItemData(idx, ts);
            }
        } else if (endIdx < this._endIdx) { // 把外面的收起来
            let i = this._itemTsList.length - 1;
            while (i >= 0) {
                if (this._itemTsList[i].getIdx() > endIdx) {  // 把前面滚动出视线的ts拿出来，收起来
                    let ts = this._itemTsList[i];
                    this._itemTsList.splice(i, 1);
                    ts.setActive(false);
                    // ge.log('_itemTsMap push3', ts._typeIdx)
                    this._itemTsMap[ts._typeIdx].push(ts);
                    i--;
                    continue;
                }
                i--;
                break;
            }

        }

        let itemHeight = (this._scrollContent.parent.height - this.gapBegin2 - this.gapEnd2);
        let startY = this._scrollContent.parent.height * -0.5 + this.gapBegin2 + itemHeight * 0.5;
        // setData 里可能回写过尺寸，摆放起点要取最新的info，否则整列会偏出可视区
        let startX = this._itemInfoList[startIdx] ? this._itemInfoList[startIdx].x : 0;
        this._itemTsList.forEach((ts) => {
            if (ts.node.active) {
                // ge.log('startX:', startX, ts.node.width * ts.node.anchorX);
                startX += ts.node.width * ts.node.anchorX;
                ts.setAttr({ y: startY, x: startX });
                ts.updateSubInfo();
                // console.log('itemTsList startX', startX);
                startX += ts.node.width * (1 - ts.node.anchorX);
            }
        });


        this._endIdx = endIdx;
        if (this._startIdx != startIdx) { // 记录上一个的startIdx
            this._updateVisibleIndex(startIdx, endIdx)
            this._startIdx = startIdx;
        }

        return this.isVisibleIdxRangeChanged(startIdx, endIdx);
    }


    calcInfoIdxByY(y: number) { // 二分法找，相对最快
        let min = 0, max = this._itemInfoList.length - 1;
        if (this._itemInfoList[0].y <= y) return 0;
        if (this._itemInfoList[max].y - this._itemInfoList[max].height >= y) return max;


        while (min <= max) {
            let idx = Math.floor((max + min) * 0.5);
            if (this._itemInfoList[idx].y < y) { // 如果当前的位置小于y，表示y在中间的上边
                max = idx - 1;
                continue;
            }
            if (this._itemInfoList[idx].y - this._itemInfoList[idx].height > y) {
                min = idx + 1;
                continue;
            }
            return idx;
            // return { x: this._itemInfoList[idx].x, idx };
        }
    }
    updateContentVertial() { // 垂直移动 根据实际位置更新content内容

        let { startIdx, endIdx } = this.calcVisibleIdxRange();

        // ge.log(startIdx, this._startIdx);
        // 需要判断节点能否复用
        let itemLen = this._itemTsList.length;
        // ge.log(this._itemTsList, itemLen);
        if (startIdx < this._startIdx) { // 向右滚动，看到前面的
            for (let i = itemLen - 1; i >= 0; i--) { // 把后面的删了
                if (this._itemTsList[i].getIdx() > endIdx) {
                    let ts = this._itemTsList.pop();
                    ts.setActive(false);
                    this._itemTsMap[ts._typeIdx].push(ts);
                    continue;
                }
                break;
            }


            for (let idx = endIdx - this._itemTsList.length; idx >= startIdx; idx--) {
                let ts = this.popItemTs(this._itemInfoList[idx].typeIdx);
                if (!ts) { // 需要看看是什么问题
                    ge.shushuDataReporter.track("client_error", { tag: 'GUnfixScrollView', sub_tag: 'updateContentVertial1', msg: 'idx:' + idx + ',this._itemInfoList[idx].typeIdx:' + this._itemInfoList[idx].typeIdx });
                    ge.error('GUnfixScrollView 立马找客户端看看啊1')
                    return;
                }

                this._itemTsList.unshift(ts);

                ts.setIdx(idx);
                ts.setActive(true);
                this._setItemData(idx, ts);
            }
        } else if (startIdx > this._startIdx) { // 向左滚动，看到后面的
            let i = 0;
            while (i < this._itemTsList.length) {
                if (this._itemTsList[i].getIdx() < startIdx) {  // 把前面滚动出视线的ts拿出来，收起来
                    let ts = this._itemTsList.shift();
                    ts.setActive(false);
                    this._itemTsMap[ts._typeIdx].push(ts);
                    continue;
                }
                i++;
                break;
            }
            for (let idx = startIdx + this._itemTsList.length; idx <= endIdx; idx++) {
                let ts = this.popItemTs(this._itemInfoList[idx].typeIdx);

                if (!ts) { // 需要看看是什么问题
                    ge.shushuDataReporter.track("client_error", { tag: 'GUnfixScrollView', sub_tag: 'updateContentVertial2', msg: 'idx:' + idx + ',this._itemInfoList[idx].typeIdx:' + this._itemInfoList[idx].typeIdx });
                    ge.error('GUnfixScrollView 立马找客户端看看啊2')
                    return;
                }

                this._itemTsList.push(ts);

                ts.setIdx(idx);
                ts.setActive(true);
                this._setItemData(idx, ts);
            }
        } else if (endIdx > this._endIdx) { // 需要补上 startIdx != 0 && 
            // ge.log('startIdx:', startIdx, endIdx, this._endIdx)
            for (let idx = this._endIdx + 1; idx <= endIdx; idx++) {
                let ts = this.popItemTs(this._itemInfoList[idx].typeIdx);
                if (!ts) { // 需要看看是什么问题
                    ge.shushuDataReporter.track("client_error", { tag: 'GUnfixScrollView', sub_tag: 'updateContentVertial3', msg: 'idx:' + idx + ',this._itemInfoList[idx].typeIdx:' + this._itemInfoList[idx].typeIdx });
                    ge.error('GUnfixScrollView 立马找客户端看看啊3')
                    return;
                }
                this._itemTsList.push(ts);

                ts.setIdx(idx);
                ts.setActive(true);
                this._setItemData(idx, ts);
            }
        } else if (endIdx < this._endIdx) { // 把外面的收起来
            let i = this._itemTsList.length - 1;
            while (i >= 0) {
                if (this._itemTsList[i].getIdx() > endIdx) {  // 把前面滚动出视线的ts拿出来，收起来
                    let ts = this._itemTsList[i];
                    this._itemTsList.splice(i, 1);
                    ts.setActive(false);
                    this._itemTsMap[ts._typeIdx].push(ts);
                    i--;
                    continue;
                }
                i--;
                break;
            }

        }

        let itemWidth = (this._scrollContent.parent.width - this.gapBegin2 - this.gapEnd2);
        let startX = this._scrollContent.parent.width * -0.5 + this.gapBegin2 + itemWidth * 0.5;
        // setData 里可能回写过尺寸，摆放起点要取最新的info，否则顶部会空出一块
        let startY = this._itemInfoList[startIdx] ? this._itemInfoList[startIdx].y : 0;
        this._itemTsList.forEach((ts) => {
            if (ts.node.active) {
                // ge.log('startX:', startX, ts.node.width * ts.node.anchorX);
                startY -= ts.node.height * (1 - ts.node.anchorY);
                ts.setAttr({ x: startX, y: startY });
                ts.updateSubInfo();
                // console.log('itemTsList startX', startX);
                startY -= ts.node.height * (ts.node.anchorY);
            }
        });

        this._endIdx = endIdx;
        if (this._startIdx != startIdx) { // 记录上一个的startIdx
            this.post('LocalGScrollViewUpdateStartIdx', { startIdx })
            this._startIdx = startIdx;
            this._updateVisibleIndex(startIdx, endIdx)
        }

        return this.isVisibleIdxRangeChanged(startIdx, endIdx);
    }
    scrollTo(idx: number, timeInSecond?: number, attenuated?: boolean) {
        if (!this._itemInfoList[idx]) return false;

        let x = 0, y = 0;
        if (this._isHorizontal) { x = this._itemInfoList[idx].x + (idx == 0 ? -this.gapBegin : 0); }
        else { y = Math.abs(this._itemInfoList[idx].y) + (idx == 0 ? -this.gapBegin : 0); }

        const curOffset = this.getViewOffset();
        const dstOffset = Math.min(Math.max(this._isHorizontal ? x : y, 0), this.getViewMaxOffset());
        // 目标会被夹到可滚动尽头，已经在尽头就别再起一次零距离动画，但仍要停掉残留滚动并刷新
        if (Math.abs(dstOffset - curOffset) <= 1) {
            this._scrollView.stopAutoScroll();
            this.updateVisiblePos();
            this.updateContent();
            return false;
        }

        this._scrollView.scrollToOffset(cc.v2(x, y), timeInSecond, attenuated);

        if (timeInSecond < 0.001) {
            this.updateVisiblePos();
            this.updateContent();
        }

        return true;
    }

    /** 当前已滚动的偏移量，与 scrollToOffset 入参同一坐标系（竖版向下为正，横版向右为正） */
    getViewOffset() {
        const content = this._scrollContent;
        if (!content) return 0;
        return this._isHorizontal ? this._contentDefualtX - content.x : content.y - this._contentDefualtY;
    }

    /** 可滚动的最大偏移量 */
    getViewMaxOffset() {
        const content = this._scrollContent, parent = content?.parent;
        if (!content || !parent) return 0;
        return Math.max(0, this._isHorizontal ? content.width - parent.width : content.height - parent.height);
    }

    /** content 改小后当前位置可能越界，而 ScrollView 只在滚动中回弹，静止时要手动夹回来 */
    clampScrollPos() {
        const content = this._scrollContent;
        if (!content) return false;

        const offset = this.getViewOffset();
        const dstOffset = Math.min(Math.max(offset, 0), this.getViewMaxOffset());
        if (Math.abs(dstOffset - offset) < 1) return false;

        if (this._isHorizontal) content.x = this._contentDefualtX - dstOffset;
        else content.y = this._contentDefualtY + dstOffset;
        return true;
    }

    onEnable() {
        this.initEvent();
        console.log('onEnable');
        // var eventMap = {
        //     "scroll-to-top": EventType.SCROLL_TO_TOP,
        //     "scroll-to-bottom": EventType.SCROLL_TO_BOTTOM,
        //     "scroll-to-left": EventType.SCROLL_TO_LEFT,
        //     "scroll-to-right": EventType.SCROLL_TO_RIGHT,
        //     scrolling: EventType.SCROLLING,
        //     "bounce-bottom": EventType.BOUNCE_BOTTOM,
        //     "bounce-left": EventType.BOUNCE_LEFT,
        //     "bounce-right": EventType.BOUNCE_RIGHT,
        //     "bounce-top": EventType.BOUNCE_TOP,
        //     "scroll-ended": EventType.SCROLL_ENDED,
        //     "touch-up": EventType.TOUCH_UP,
        //     "scroll-ended-with-threshold": EventType.AUTOSCROLL_ENDED_WITH_THRESHOLD,
        //     "scroll-began": EventType.SCROLL_BEGAN
        //   };


    }
    onDisable() {
        console.log('onDisable');
        this.uninitEvent();
    }

    initEvent() {
        this.on('WinResizeCallback');
        this.node.on('scroll-to-top', this._scrollToTop, this);
        this.node.on('scrolling', this._scrolling, this);
        this.node.on('scroll-began', this._scrollBegan, this);
        this.node.on('scroll-ended', this._scrollEnded, this);
    }
    uninitEvent() {
        this.off('WinResizeCallback');
        this.node.off('scroll-to-top', this._scrollToTop, this);
        this.node.off('scrolling', this._scrolling, this);
        this.node.off('scroll-began', this._scrollBegan, this);
        this.node.off('scroll-ended', this._scrollEnded, this);
    }

    _scrollToTop(event) {
        // console.log(event);
    }

    _scrolling(event) {
        this.updateVisiblePos();
        this.updateContent();
        // this._scrollContent.parent.y = this._defalutViewY;
        // cc.log("show move scrollo----->", this._scrollContent.parent.y);
        // console.log('content x:' + this._scrollContent.x, 'this._viewX:' + this._viewX, 'this._viewX2:' + this._viewX2, 'this._contentDefualtX:' + this._contentDefualtX);
        // console.log('content y:' + this._scrollContent.y, 'this._viewY:' + this._viewY, 'this._viewY2:' + this._viewY2, 'this._contentDefualtY:' + this._contentDefualtY);
        // console.log('scrolling', event);
    }
    _scrollBegan(event) {
        // console.log('began', event);
    }
    _scrollEnded(event) {
        // console.log('ended', event);
        // this.updateVisiblePos();
        // this.updateContent();
    }

    updateVisiblePos() { // 获取content的可视有效范围
        if (!this._scrollContent) {
            return;
        }
        this._viewY = this._contentDefualtY - this._scrollContent.y; // 可视范围，是指content的方位，越往上滚动，this._scrollContent.y越大，_viewY越大
        this._viewX = this._contentDefualtX - this._scrollContent.x; // 可视范围，是指content的方位，越往左滚动，this._scrollContent.x越小，_viewX越大


        // if (this._viewY >= 0) this._viewY2 = this._viewHeight + this._viewY;
        // else this._viewY2 = this._viewY + this._viewHeight;

        this._viewY2 = this._viewY - this._scrollContent.parent.height;

        // if (this._viewX >= 0) this._viewX2 = this._viewX + this._viewWidth;
        // else this._viewX2 = this._viewWidth + this._viewX;

        this._viewX2 = this._scrollContent.parent.width + this._viewX;
        // ge.log('_viewX:' + this._viewX, '_viewX2:' + this._viewX2, '_viewY:' + this._viewY, '_viewY2:' + this._viewY2, '_scrollContent.x:' + this._scrollContent.x, '_scrollContent.y:' + this._scrollContent.y);
    }
    // update(dt) { }
}
