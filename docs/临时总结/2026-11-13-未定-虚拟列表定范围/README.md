# 虚拟列表定范围

## 需求与情况

框架要加一个通用列表控件。大任务，先 grilling 定范围，共识写在 `docs/specs/虚拟列表/共识.md`，用户说「开干」才写代码。不按动物园背包、商店、任务的格数来收，调用方自己给数据和项预制体。

已有 12 个框架控件。`PfGMSelect` 里已有一套普通滚动：引擎 `ScrollView`，运行时 `createTs` 把行铺进 `content`。CashGo 的 `GFixScrollView` / `GUnfixScrollView` 是 Creator 2.4 的回收列表，用户要求留在工程里，以后要做虚拟列表再参考。

这个窗口做到：范围和类名已定，项怎么给已提问、还没答。共识和代码都没写。参考文件还没拷进工程。

## 尝试

- 读了 CashGo 四份：`GFixScrollItem.ts`、`GFixScrollView.ts`、`GUnfixScrollItem.ts`、`GUnfixScrollView.ts`。固定项高的 `GFix` 只建可视区加缓冲，滚动时换数据；`GUnfix` 是不等高、多种预制体。都挂在 `ge.Component` 上，不是本框架这一代。
- 先用背包最多 16、商店约 24、任务卡 3 建议先做普通滚动列表。用户否掉这条依据：这是框架，做通用的，不要考虑背包功能。
- 改按通用控件重提：这次只做一次铺完的滚动列表，回收复用以后再加。用户同意，并要求把上面四份留在工程里。
- 看了 `tsconfig` 的 `db://assets`、`db://gmajor`。`docs/` 不在编译路径。参考文件准备放 `docs/specs/虚拟列表/参考/`，不放进 `gmajor/` 或 `assets/`。还没拷。
- 类名候选 `PfGMList`、`PfGMScroll`。用户定 `PfGMList`。不沿用已删的 `GMVirtualList`。
- 项的给法问了两条：prefab 加填数据回调，或项脚本必须实现接口。建议前者，根上有 `GMComponent`、用 `gu.createTs`。这条还没答。

## 结论

未定。这次做通用滚动列表 `PfGMList`，虚拟列表以后再加；项怎么给、横竖、滚动条、滚到底、demo 放哪都还没定，共识和代码都没写。

## 接着做

- 等用户定项怎么给。建议是 prefab 加填数据回调，不另做项接口。
- 接着问完：竖向还是横向、要不要滚动条、要不要滚到底加载更多、demo 放哪、要不要改 `LyControls` 的页结构。页签 3 颗是硬上限，加第 4 页得先改 `PfGMTabs` 排版。
- 问完写 `docs/specs/虚拟列表/共识.md`，并把四份参考文件拷进 `docs/specs/虚拟列表/参考/`。用户说「开干」再写代码。

## 产物

这次没有用到 del 目录。

记录夹里没有另拷文件。
