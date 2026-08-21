import { GMBundleEntryBase, registerBundleEntry } from '../../../gmajor';

/** 基础包：通用 UI 件（Alert 等）；开机常驻，不 unbind */
class WidgetEntry extends GMBundleEntryBase {
    constructor() {
        super('Widget');
    }

    onBind(): void {
        console.info('[Widget] 就绪');
    }
}

registerBundleEntry('Widget', new WidgetEntry());
