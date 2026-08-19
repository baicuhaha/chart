# KChart

一个面向 Web 和 React Native WebView 场景的行情图表组件，基于 `lightweight-charts` 和 Apache ECharts 实现，适用于股票、数字资产及其他金融行情展示场景。

## 项目说明

KChart 将常见的行情图表封装为可直接初始化的 TypeScript 类，并提供统一的数据更新能力。项目既支持浏览器直接使用，也提供了通过 URL 参数和 `postMessage` 与 React Native 通信的 WebView 入口。

项目当前包含以下图表实现：

| 图表类型 | 实现 | 主要用途 |
| --- | --- | --- |
| K 线图 | `src/index.ts` | 展示开盘价、最高价、最低价、收盘价和成交量 |
| 分时图 | `src/indexLightLineNew.ts` | 展示价格面积线、成交量和涨跌变化 |
| 分时图（兼容实现） | `src/indexLine.ts` | 提供交互、极值标记和历史数据加载能力 |
| 深度图 | `src/indexEcharts.ts` | 展示买卖盘深度及卖出区域 |

## 功能介绍

- 支持 K 线和成交量柱状图组合展示。
- 支持分时价格线、成交量、最新价格标签及最大值/最小值标记。
- 支持深度图买卖盘展示。
- 支持十字光标、Tooltip、数据摘要和最新价格线。
- 支持缩放、拖拽、触摸滑动和移动端双指缩放。
- 支持初始化数据、实时更新、追加历史数据和整体替换数据。
- 支持通过回调触发历史数据加载。
- 支持中文、英文等语言环境，时间轴和 Tooltip 会根据语言格式化。
- 支持价格小数位配置，以及成交量均线等指标展示。
- 支持自定义图表高度、宽度和底层图表配置。
- 提供部分价格线和价格轴覆盖层插件，方便扩展图表样式。

## 环境要求

- Node.js
- Yarn 或 npm
- TypeScript 4.9+

## 安装依赖

```bash
yarn install
```

## 开发与构建

```bash
# 启动 Web 开发服务
yarn dev

# 构建 Web 版本
yarn build

# 启动 React Native WebView 版本
yarn dev:app

# 构建 React Native WebView 版本
yarn build:app
```

## 浏览器中使用

### K 线图

```ts
import KLineChart from "./src/index";

const container = document.getElementById("chart")!;
const chart = new KLineChart(container, () => {
  // 请求更多历史数据后调用 chart.prependData(...)
}, "zh-CN", { height: 380 });

chart.setData(data, 2);
chart.update(latestBar);
```

### 分时图

```ts
import LineChart from "./src/indexLightLineNew";

const chart = new LineChart({
  container: document.getElementById("chart")!,
  language: "zh-CN",
  options: { height: 380, width: "100%" },
});

chart.setData(lineData, 2);
chart.update(latestPoint);
```

## 数据格式

### K 线数据

```ts
interface KLineBar {
  time: number;       // Unix 时间戳，单位为秒
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
}
```

### 分时数据

```ts
interface LinePoint {
  time: number;       // Unix 时间戳，单位为秒
  value: number;
  volume?: number;
  average?: number;
}
```

常用数据方法：

| 方法 | 说明 |
| --- | --- |
| `setData(data, priceDecimal?)` | 初始化或重置图表数据 |
| `update(data)` | 更新最新数据；相同时间点通常会覆盖最后一条数据 |
| `prependData(data)` | 在历史数据前追加数据，并过滤重复时间点 |
| `replaceLineData(data)` | 替换分时图全部数据 |
| `getChart()` | 获取底层图表实例，用于进一步配置 |

## React Native WebView 通信

`src/rn/index.ts` 会根据 URL 参数自动选择图表类型：

- `type=Line`：分时图
- `type=depth`：深度图
- 其他值或未传入：K 线图

示例：

```text
index.html?type=Line&lang=zh-CN&height=380&width=375&platform=ios
```

Native 端可以向 WebView 发送 JSON 消息：

```json
{
  "type": "init",
  "data": [],
  "priceDecimal": 2
}
```

支持的消息类型：`init`（初始化）、`update`（更新实时数据）、`updateAddData`（追加历史数据）、`replaceLineData`（替换分时图数据）。图表初始化完成或需要加载更多数据时，会通过 `window.ReactNativeWebView.postMessage` 回传状态消息。

## 目录结构

```text
src/
├── index.ts                         # K 线图
├── indexLightLineNew.ts             # lightweight-charts 分时图
├── indexLine.ts                     # ECharts 分时图兼容实现
├── indexEcharts.ts                  # 深度图
├── rn/index.ts                      # React Native WebView 入口
├── plugins/                         # 价格线、价格轴等扩展插件
├── helpers/                         # 图表尺寸、时间和数据辅助方法
├── utils/                           # 格式化、均线和样式工具
└── i18n/                            # 国际化配置
```

## 注意事项

1. 时间戳统一使用秒级 Unix 时间戳，不要直接传入毫秒级时间戳。
2. 初始化数据后再调用 `update`，否则实时更新可能被忽略。
3. 容器在初始化时应具有有效高度，尤其是在 Android WebView 中。
4. 使用 `prependData` 时应传入更早的历史数据，并保证数据时间有序。
5. 当前项目以源码和 Webpack 构建为主，尚未配置独立的 npm 发布流程。
