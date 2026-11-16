
import GFixScrollItem from "./GFixScrollItem";


// https://docs.cocos.com/creator/api/zh/class/ScrollView

const { ccclass, property, requireComponent } = cc._decorator;


interface FGetItemData {
    (idx: number, cb: Function): void
}

export interface GFixScrollViewInitParm {
    setItemData: FGetItemData;
    itemDataList?: Array<any>; // item对应的数值
    isDelayCreate?: boolean; // 是否延迟创建
    cb?: Function; // 加载结束后回调，cb(error, data);
    startNumAddMore?: number// 开始时多显示几个节点
}

enum TempType {
    Node = 1,
    Prefab = 2,
}




@ccclass
@requireComponent(cc.ScrollView)
export default class GFixScrollView extends ge.Component { // 只针对固定大小的item
    @property({ type: cc.Enum(TempType), tooltip: CC_DEV && '模板类型', })
    tempType: TempType = TempType.Node;

    @property({ type: cc.Node, tooltip: CC_DEV && '模板节点', visible() { return this.tempType == TempType.Node; } })
    ndTemp: cc.Node = null;

    @property({ type: cc.Prefab, tooltip: CC_DEV && '模板预制体', visible() { return this.tempType == TempType.Prefab; } })
    pfTemp: cc.Prefab = null;

    @property({ type: cc.Integer, tooltip: CC_DEV && '每一线有多少个item，大于1为Grid模式', range: [0, 100, 1], })
    lineCount: number = 1;

    needItemNum: number = 0; // 实际要创建多少个
    needUpdateContent: boolean = false; // 是否需要更新内容

    @property({ type: cc.Float, tooltip: CC_DEV && '同向开始间隔' })
    gapBegin: number = 0.0;

    @property({ type: cc.Float, tooltip: CC_DEV && '同向结束间隔' })
    gapEnd: number = 0.0;

    @property({ type: cc.Float, tooltip: CC_DEV && '同向间隔' })
    gapDirect: number = 0.0;


    @property({ type: cc.Float, tooltip: CC_DEV && '同向开始间隔', visible() { return this.lineCount > 1; } })
    gapBegin2: number = 0.0;

    @property({ type: cc.Float, tooltip: CC_DEV && '同向结束间隔', visible() { return this.lineCount > 1; } })
    gapEnd2: number = 0.0;

    @property({ type: cc.Float, tooltip: CC_DEV && '垂直方向间隔，用于Grid模式', visible() { return this.lineCount > 1; } })
    gapDirect2: number = 0.0;


    @property({ type: cc.String, tooltip: CC_DEV && '将item的内容分层，减少drawcall' })
    strSubLayers: Array<string> = [];

    _ndSubLayers: Array<cc.Node> = [];



    _scrollView: cc.ScrollView = null;
    _isHorizontal: boolean;
    _scrollContent: cc.Node = null;
    _viewWidth: number = 0;
    _viewHeight: number = 0;
    _itemWidth: number = 0;
    _itemHeight: number = 0;
    _contentDefualtX: number = 0; // 默认content x的位置
    _contentDefualtY: number = 0; // 默认content y的位置
    _viewX: number = 0; // 实际content里面的可视起始x
    _viewY: number = 0; // 实际content里面的可视起始y
    _viewX2: number = 0; // 实际content里面的可视结束x
    _viewY2: number = 0; // 实际content里面的可视结束y

    _startNumAddMore: number = 0;// 开始时多显示几个节点

    _setItemData: FGetItemData = () => { };
    _itemNum: number = 0;
    _itemTsList: Array<any> = [];
    _startIdx: number = -999999999;

    isDelayCreate: boolean = false;

    /**
     * Cocos Creator 2.4 的 ScrollView 会缓存越界距离。
     * Content/View 尺寸变化后的内部边界校正直接修改节点位置，
     * 某些情况下不会同步使该缓存失效，导致松手时拿到旧值而不回弹。
     */
    markScrollBoundaryDirty() {
        let scrollView = this._scrollView as any;
        if (scrollView) scrollView._outOfBoundaryAmountDirty = true;
    }

    scheduleBounceBackCheck() {
        this.unschedule(this.forceBounceBackIfNeeded);
        this.scheduleOnce(this.forceBounceBackIfNeeded, 0);
    }

    forceBounceBackIfNeeded() {
        let scrollView = this._scrollView as any;
        if (!scrollView || !scrollView.elastic || !scrollView._startBounceBackIfNeeded) return;
        if (scrollView.isAutoScrolling && scrollView.isAutoScrolling()) return;

        this.markScrollBoundaryDirty();
        scrollView._startBounceBackIfNeeded();
    }

    init(parm: GFixScrollViewInitParm) { // 通过这个接口，可以预先加载若干内容
        let tts = Date.now();
        this._setItemData = parm.setItemData;
        this._startIdx = -999999999;
        this.isDelayCreate = parm.isDelayCreate;
        this._startNumAddMore = parm.startNumAddMore || 0;

        // 统一用this.ndTemp
        if (this.tempType == TempType.Prefab) {
            this.tempType = TempType.Node;
            this.ndTemp = cc.instantiate(this.pfTemp);
        }

        this._itemWidth = this.ndTemp.width;
        this._itemHeight = this.ndTemp.height;

        // 初始化相关坐标
        this._scrollView = this.node.getComponent(cc.ScrollView);
        this._isHorizontal = this._scrollView.horizontal;
        this._scrollContent = this._scrollView.content;
        this.updateItemNum(0);
        this._scrollContent.removeAllChildren();
        this._viewWidth = this._scrollContent.parent.width;
        this._viewHeight = this._scrollContent.parent.height;

        this.initSubLayers();
        this.initItemTsList(); // 初始化所有节点，保留ts, 有subLayers的记录一下节点情况

        this._contentDefualtX = this._scrollContent.x;
        this._contentDefualtY = this._scrollContent.y;
        // this._contentDefualtX = 0; // this._scrollContent.parent.width * this._scrollContent.parent.anchorX;
        // this._contentDefualtY = this._scrollContent.parent.height * (1 - this._scrollContent.parent.anchorY);
        this.updateVisiblePos();

        if (parm.itemDataList) {
            this.updateItemNum(parm.itemDataList.length);
            this.resetPos();
            this.updateContent();
        }
        // this.updateContent();

        parm.cb && parm.cb();
    }
    initSubLayers() {
        for (let i = 0; i < this.strSubLayers.length + 1; i++) {
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
        })
    }
    instantiateItem() { // 单独常见一个预制体
        let item = cc.instantiate(this.ndTemp);
        item.active = false;
        item.parent = this._ndSubLayers[0];
        let ts = item.getComponent(GFixScrollItem);
        ts.init && ts.init({});


        // 移植子节点的父节点
        for (let ii = 0; ii < this.strSubLayers.length; ii++) {
            let list = this.strSubLayers[ii].split(';');
            for (let j = 0; j < list.length; j++) {
                let child = this.findChild(ts.node, list[j]);
                if (!child) {
                    console.warn('找不到节点：', list[j]);
                    continue;
                }
                ts.recordChild(child);
                child.parent = this._ndSubLayers[ii + 1];
            }
        }
        return ts;
    }
    async initItemTsList() { // 初始化所有节点，只生成可视范围内和最多额外多一个节点
        let itemNum = this.lineCount; // 支持grid

        // this.lineCount > 1是grid模式，这个模式下，需要多显示一个节点就好，多了drawcall太多了。其他情况下还是按照原来的2个节点不改动
        if (this._isHorizontal) {
            itemNum *= Math.ceil(this._viewWidth / (this.gapDirect + this._itemWidth)) + (this.lineCount > 1 ? 1 : 2);
        } else {
            itemNum *= Math.ceil(this._viewHeight / (this.gapDirect + this._itemHeight)) + (this.lineCount > 1 ? 1 : 2);
        }

        if (this.isDelayCreate) {
            this.needItemNum = itemNum;
        } else {
            this.needItemNum = 0;
            for (let i = 0; i < itemNum; i++) {
                let ts = this.instantiateItem();
                this._itemTsList.push(ts);
            }
        }


    }
    findChild(node: cc.Node, path) {
        let p = path.split('.');
        for (let i = 0; i < p.length; i++) {
            node = node.getChildByName(p[i]);
            if (!node) break;
        }
        return node;
    }
    updateItemNum(num: number) {
        this._itemNum = Math.max(0, num);
        let maxLine = Math.ceil(this._itemNum / this.lineCount);
        if (this._isHorizontal) {
            // 比 View 多 1 像素，避免安卓设备上的尺寸取整令 Content 被判定为小于 View，
            // Cocos ScrollView._clampDelta 会在这种情况下直接清零拖动和回弹距离。
            this._scrollContent.width = Math.max(this._scrollContent.parent.width + 1, this.gapBegin + this.gapEnd + maxLine * (this._itemWidth + this.gapDirect) - this.gapDirect); // 先做上下这种模式
        } else {
            this._scrollContent.height = Math.max(this._scrollContent.parent.height + 1, this.gapBegin + this.gapEnd + maxLine * (this._itemHeight + this.gapDirect) - this.gapDirect); // 先做上下这种模式
        }
        // SIZE_CHANGED 会触发 ScrollView 内部边界校正；校正完成后再次标脏，
        // 保证下一次拖动/松手重新计算真实越界距离。
        this.markScrollBoundaryDirty();
    }
    resetPos() {
        this._scrollView.stopAutoScroll();
        if (this._isHorizontal) this._scrollView.scrollToLeft();
        else this._scrollView.scrollToTop();
    }
    resetContentPos() {
        this._scrollContent.y = this._contentDefualtY;
        this._scrollContent.x = this._contentDefualtX;
    }
    updateAll() {
        this._startIdx = -999999999; // 强制重新刷新
        this.updateVisiblePos();
        this.updateContent();
    }
    getItemTsByIdx(idx) {
        for (let i = 0; i < this._itemTsList.length; i++) {
            if (this._itemTsList[i].isSamveIdx(idx)) {
                return this._itemTsList[i];
            }
        }
    }
    getItemsTs() {
        return this._itemTsList;
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
    updateActiveItemData() { // 更新当前显示出来的item的数据
        this._itemTsList.forEach((ts, idx) => {
            if (ts.node.active) this._setItemData(idx, ts);
        })
    }
    updateContent() {
        if (this.needItemNum > 0) {
            this.needUpdateContent = true;
            return;
        }
        if (this._isHorizontal) this.updateContentHorizontal();
        else this.updateContentVertial();
    }
    updateContentVertial() { // 垂直移动  根据实际位置更新content内容
        // if (this.lineCount > 1) return this.updateContentGrid(); // 为了提高效率，所以单个处理


        let viewY = -this._viewY;
        let startIdx = Math.max(0, Math.floor((viewY - this.gapBegin) / (this._itemHeight + this.gapDirect)) - this._startNumAddMore) * this.lineCount;
        let startY = this.gapBegin + startIdx / this.lineCount * (this._itemHeight + this.gapDirect) + this.ndTemp.anchorY * this._itemHeight;

        // ge.log(startIdx, this._startIdx);
        // 需要判断节点能否复用
        let needChangeList = [];
        let itemLen = this._itemTsList.length;
        if (startIdx < this._startIdx) { // 向下滚动，看到前面的
            for (let i = 0; i < itemLen; i++) {
                if (startIdx + i != this._startIdx) { // 把滚动出视线的ts拿出来，放在后面
                    let ts = this._itemTsList.pop();
                    if (!ts) {
                        ts = this.instantiateItem();
                        // this.needItemNum--;
                    }
                    needChangeList.push(ts);
                    continue;
                }
                break;
            }
            let realStartIdx = startIdx + needChangeList.length - 1; // 从哪个idx开始，向前补充数据
            needChangeList.forEach((ts, idx) => {
                this._itemTsList.unshift(ts);

                let theIdx = realStartIdx - idx;
                if (theIdx < 0 || theIdx >= this._itemNum) ts.setActive(false);
                else {
                    ts.setIdx(theIdx);
                    ts.setActive(true);
                    this._setItemData(theIdx, ts);
                }
            })
        } else if (startIdx > this._startIdx) { // 向上滚动，看到后面的
            for (let i = 0; i < itemLen; i++) {
                if (startIdx != this._startIdx + i) { // 把滚动出视线的ts拿出来，放在后面
                    let ts = this._itemTsList.shift();
                    if (!ts) {
                        ts = this.instantiateItem();
                        // this.needItemNum--;
                    }
                    needChangeList.push(ts);
                    continue;
                }
                break;
            }
            let realStartIdx = startIdx + this._itemTsList.length; // 从哪个index开始，向后补充数据
            needChangeList.forEach((ts, idx) => {
                this._itemTsList.push(ts);

                let theIdx = realStartIdx + idx;
                if (theIdx < 0 || theIdx >= this._itemNum) ts.setActive(false);
                else {
                    ts.setIdx(theIdx);
                    ts.setActive(true);
                    this._setItemData(theIdx, ts);
                }
            })
        }


        let itemWidth = (this._viewWidth - this.gapBegin2 - this.gapEnd2 - this.gapDirect2 * (this.lineCount - 1)) / this.lineCount;
        let startX = this._viewWidth * -0.5 + this.gapBegin2 + itemWidth * 0.5;
        this._itemTsList.forEach((ts, idx) => {
            if (ts.node.active) {
                let xIdx = idx % this.lineCount;
                ts.setAttr({ x: startX + xIdx * (itemWidth + this.gapDirect2), y: -startY });
                ts.updateSubInfo();

                if (xIdx + 1 >= this.lineCount) startY += this._itemHeight + this.gapDirect;
            }
        });



        this._startIdx = startIdx; // 记录上一个的startIdx
    }
    updateContentHorizontal() { // 水平移动 根据实际位置更新content内容
        let viewX = -this._viewX;
        let startIdx = Math.max(0, Math.floor((viewX - this.gapBegin) / (this._itemWidth + this.gapDirect)) - this._startNumAddMore) * this.lineCount;
        let startX = this.gapBegin + startIdx / this.lineCount * (this._itemWidth + this.gapDirect) + this.ndTemp.anchorX * this._itemWidth;

        // ge.log(startIdx, this._startIdx);
        // 需要判断节点能否复用
        let needChangeList = [];
        let itemLen = this._itemTsList.length;
        if (startIdx < this._startIdx) { // 向下滚动，看到前面的
            for (let i = 0; i < itemLen; i++) {
                if (startIdx + i != this._startIdx) { // 把滚动出视线的ts拿出来，放在后面
                    let ts = this._itemTsList.pop();
                    if (!ts) {
                        ts = this.instantiateItem();
                        // this.needItemNum--;
                    }
                    needChangeList.push(ts);
                    continue;
                }
                break;
            }
            let realStartIdx = startIdx + needChangeList.length - 1; // 从哪个idx开始，向前补充数据
            needChangeList.forEach((ts, idx) => {
                this._itemTsList.unshift(ts);

                let theIdx = realStartIdx - idx;
                if (theIdx < 0 || theIdx >= this._itemNum) ts.setActive(false);
                else {
                    ts.setIdx(theIdx);
                    ts.setActive(true);
                    this._setItemData(theIdx, ts);
                }
            })
        } else if (startIdx > this._startIdx) { // 向上滚动，看到后面的
            for (let i = 0; i < itemLen; i++) {
                if (startIdx != this._startIdx + i) { // 把滚动出视线的ts拿出来，放在后面
                    let ts = this._itemTsList.shift();
                    if (!ts) {
                        ts = this.instantiateItem();
                        // this.needItemNum--;
                    }
                    needChangeList.push(ts);
                    continue;
                }
                break;
            }
            let realStartIdx = startIdx + this._itemTsList.length; // 从哪个index开始，向后补充数据
            needChangeList.forEach((ts, idx) => {
                this._itemTsList.push(ts);

                let theIdx = realStartIdx + idx;
                if (theIdx < 0 || theIdx >= this._itemNum) ts.setActive(false);
                else {
                    ts.setIdx(theIdx);
                    ts.setActive(true);
                    this._setItemData(theIdx, ts);
                }
            })
        }


        let itemHeight = (this._viewHeight - this.gapBegin2 - this.gapEnd2 - this.gapDirect2 * (this.lineCount - 1)) / this.lineCount;
        let startY = this._viewHeight * 0.5 - this.gapBegin2 - itemHeight * 0.5;
        this._itemTsList.forEach((ts, idx) => {
            if (ts.node.active) {
                let xIdx = idx % this.lineCount;
                ts.setAttr({ y: startY - xIdx * (itemHeight + this.gapDirect2), x: startX });
                ts.updateSubInfo();

                if (xIdx + 1 >= this.lineCount) startX += this._itemWidth + this.gapDirect;
            }
        });



        if (this._startIdx != startIdx) { // 记录上一个的startIdx
            this.post('LocalGScrollViewUpdateStartIdx', { startIdx })
            this._startIdx = startIdx;
        }
    }

    scrollTo(idx: number, timeInSecond?: number, attenuated?: boolean) {
        let x = 0, y = 0;

        if (this._isHorizontal) { x = Math.floor(idx / this.lineCount) * this._itemWidth; }
        else { y = Math.floor(idx / this.lineCount) * this._itemHeight; }
        this._scrollView.scrollToOffset(cc.v2(x, y), timeInSecond, attenuated);
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
        this.node.on('scroll-to-top', this._scrollToTop, this);
        this.node.on('scrolling', this._scrolling, this);
        this.node.on('scroll-began', this._scrollBegan, this);
        this.node.on('scroll-ended', this._scrollEnded, this);
        this.node.on('touch-up', this._touchUp, this);
        this.node.on(cc.Node.EventType.TOUCH_CANCEL, this._touchCancelled, this);
    }
    uninitEvent() {
        this.node.off('scroll-to-top', this._scrollToTop, this);
        this.node.off('scrolling', this._scrolling, this);
        this.node.off('scroll-began', this._scrollBegan, this);
        this.node.off('scroll-ended', this._scrollEnded, this);
        this.node.off('touch-up', this._touchUp, this);
        this.node.off(cc.Node.EventType.TOUCH_CANCEL, this._touchCancelled, this);
    }

    _scrollToTop(event) {
        // console.log(event);
    }

    _scrolling(event) {
        this.updateVisiblePos();
        this.updateContent();
        // console.log('content y:', this._scrollContent.y, this._viewX, this._viewY, this._viewX2, this._viewY2);
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
    _touchUp() {
        // ScrollView 会先派发 touch-up，再执行自身松手逻辑；延后一帧检查，
        // 只在引擎未成功启动回弹时补一次。
        this.scheduleBounceBackCheck();
    }
    _touchCancelled(event: cc.Event.EventTouch) {
        // ScrollView 为取消子按钮点击而构造的模拟 cancel 发生在拖动途中，不能触发回弹。
        if (!(event as any).simulate) this.scheduleBounceBackCheck();
    }

    updateVisiblePos() { // 获取content的可视有效范围
        this._viewY = this._contentDefualtY - this._scrollContent.y; // 越往上滚动，y越小
        this._viewX = this._scrollContent.x - this._contentDefualtX; // 越往左滚动，x越大


        if (this._viewY <= 0) this._viewY2 = this._viewHeight;
        else this._viewY2 = this._viewY + this._viewHeight;

        if (this._viewX >= 0) this._viewX2 = this._viewWidth;
        else this._viewX2 = this._viewX + this._viewWidth;
    }
    resize(width: number, height: number) {
        if (width) {
            this.node.width = width;
            this.node.getChildByName('view').width = width;
            this._viewWidth = width;
        }
        if (height) {
            this.node.height = height;
            this.node.getChildByName('view').height = height;
            this._viewHeight = height;
        }
        if (this._scrollContent) {
            this.updateItemNum(this._itemNum);
            this.updateAll();
        }
    }

    update(dt) {
        if (this.needItemNum != 0) {
            ge.time('update initItemTsList' + dt);
            while (this.needItemNum > 0) {
                let ts = this.instantiateItem();
                this._itemTsList.push(ts);
                this.needItemNum--;
                // this.updateContent();
            }
            ge.timeEnd('update initItemTsList' + dt);
            if (this.needUpdateContent) {
                this.needUpdateContent = false;
                this.updateContent();
            }
        }
    }
}
