// 折线图实现：价格折线及其下方成交量图。
// 由 src/rn/index.ts 在 type === "Line" 时创建。
import * as echarts from "echarts";
import { UTCTimestamp } from "lightweight-charts";
import Il8n from "./i18n/index";
import { normalizeLanguage } from "./i18n/index";
import { setStyle, formatTimestamp } from "./utils/util";
type ChartType = "Line";

export interface LinePoint {
  time: UTCTimestamp;
  value: number;
  volume?: number;
  average?: number;
}

type LineHistoryPoint = Partial<LinePoint> & {
  time: UTCTimestamp;
  close?: number;
};

interface ConstructorParams {
  container: HTMLElement;
  language?: string;
  options?: {
    height?: number;
    width?: number | string;
    isFullScreen?: boolean;
    from?: string;
  };
}

/** ================== 尺寸常量 ================== */
const TOTAL_HEIGHT = 380;
const PRICE_HEIGHT = 300;
const GRID_TOP = 47;
const GRID_BOTTOM = 22;
const CHART_HEIGHT = TOTAL_HEIGHT - GRID_TOP - GRID_BOTTOM;
//最大值和最小值 左右间距
const EDGE_PADDING = 16;

/** ================== 时间格式 ================== */
const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
  all: { year: "numeric", month: "2-digit", day: "2-digit" },
  "1y": { year: "numeric", month: "2-digit", day: "2-digit" },
  "6m": {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  "1m": {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  "1w": {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  "1d": { hour: "2-digit", minute: "2-digit", hour12: false },
  "1h": { hour: "2-digit", minute: "2-digit", hour12: false },
};

export default class SimpleChart {
  private chart: echarts.ECharts;
  private volumeChart: echarts.ECharts;
  private volumeContainer: HTMLDivElement;
  private container: HTMLElement;

  private _data: LinePoint[] = [];
  private _tick = 2;
  private _language = "zh-CN";
  private _timeRange = "1m";
  private _from = "";
  private _isFullScreen = false;
  private _crossTip!: HTMLDivElement;
  private _summary!: HTMLDivElement;

  private _lastDataIndex: number;
  private longPressTimer: any = null;
  private isLongPress = false;

  constructor({ container, language, options = {} }: ConstructorParams) {
    this.container = container;
    this._language = normalizeLanguage(language);
    this._from = options.from || "";
    this._isFullScreen = !!options.isFullScreen;

    container.style.width =
      options.width == null
        ? "100%"
        : typeof options.width === "number"
          ? `${options.width}px`
          : options.width;
    container.style.height = TOTAL_HEIGHT + "px";

    this.chart = echarts.init(container);
    this.chart.setOption(this.getBaseOption());
    this.chart.resize({height: PRICE_HEIGHT});

    container.style.position = "relative";
    container.style.overflow = "visible";
    this.volumeContainer = document.createElement("div");
    this.volumeContainer.style.position = "absolute";
    this.volumeContainer.style.left = "0";
    this.volumeContainer.style.top = `${PRICE_HEIGHT}px`;
    this.volumeContainer.style.width =
      options.width == null
        ? `${container.clientWidth}px`
        : typeof options.width === "number"
          ? `${options.width}px`
          : options.width;
    this.volumeContainer.style.height = `${TOTAL_HEIGHT - PRICE_HEIGHT}px`;
    container.appendChild(this.volumeContainer);
    this.volumeChart = echarts.init(this.volumeContainer);
    this.volumeChart.setOption(this.getVolumeOption());
    this._summary = document.getElementById("summary-layer") as HTMLDivElement;

    this.chart.on("updateAxisPointer", (event) => {
      const xAxisInfo = event.axesInfo?.[0];
      if (!xAxisInfo) return;

      const dataIndex = xAxisInfo.value; // 🔴 就是 index

      if (
        typeof dataIndex !== "number" ||
        dataIndex < 0 ||
        dataIndex >= this._data.length
      ) {
        return;
      }
      this._lastDataIndex = dataIndex;
      this.updateSummary(dataIndex);
      // 暂时隐藏折线图旧版十字线统计浮层，保留原调用便于后续恢复。
      // this.updateCrossTooltip(dataIndex);
    });

    // 点击分时线上的任意位置后，固定显示该点的完整数据。
    // ECharts 会把点击位置吸附到最近的数据点，因此移动端点按也能使用。
    this.chart.on("click", (params: any) => {
      const dataIndex = Number(params?.dataIndex);
      if (Number.isInteger(dataIndex) && dataIndex >= 0 && dataIndex < this._data.length) {
        this.showCrossAt(dataIndex);
      }
    });

    this.createCrossTooltip(container);

    // this.chart.on("hideTip", () => {
    //   // alert(1);
    //   if (this._lastDataIndex != null) {
    //     this.showCrossAt(this._lastDataIndex);
    //   }
    // });

    this.setTrigger();

    // 核心：处理鼠标移出容器
    // 在 constructor 内部添加
    // this.chart.getZr().on("globalout", () => {
    //   if (this._data.length === 0) return;

    //   // 获取最后一个点的索引
    //   const lastIndex = this._data.length - 1;

    //   // 🔴 关键：强行让 ECharts 重新渲染该位置的 axisPointer
    //   this.chart.dispatchAction({
    //     type: "showTip", // 虽然名字叫 showTip，但它会同时触发 axisPointer 的显示
    //     seriesIndex: 0,
    //     dataIndex: lastIndex,
    //   });

    //   // 同步更新你的自定义 Tooltip
    //   this.updateCrossTooltip(lastIndex);
    // });

    // this.chart.on("hideTip", () => {
    //   this._crossTip.style.display = "none";
    // });

    // this.chart.on("mousemove", (params) => {
    //   if (!params || params.dataIndex == null) return;

    //   this.chart.dispatchAction({
    //     type: "showTip",
    //     xAxisIndex: 0,
    //     dataIndex: params.dataIndex,
    //   });
    // });
    // this.chart.getZr().on("mouseleave", () => {
    //   // this.chart.dispatchAction({
    //   //   type: "hideTip",
    //   // });
    // });
  }

  /* ================== public ================== */

  public setData(
    data: LinePoint[],
    priceDecimal?: number,
    timeType?: string,
    from?: string,
  ) {
    this._data = data || [];
    this._timeRange = timeType || "1m";
    this._from = from || "MAIN";

    if (priceDecimal != null) {
      this._tick =
        String(priceDecimal).indexOf(".") === -1
          ? 0
          : String(priceDecimal).split(".")[1].length;
    }

    const { xData, yData } = this.buildSeriesData(this._data);
    let maxVal = Math.max(...yData);
    let minVal = Math.min(...yData);
    const onlyOne = yData.length === 1;

    if (onlyOne) {
      // ⭐ 垂直居中核心逻辑：
      // 给 Y 轴设置一个以当前值为中心，上下浮动 10% 的范围
      const val = yData[0];
      const offset = Math.abs(val) * 0.1 || 1; // 如果值为0，默认偏移1
      minVal = val - offset;
      maxVal = val + offset;
    } else {
      minVal = Math.min(...yData);
      maxVal = Math.max(...yData);
    }

    const lastIndex = yData.length - 1;
    const lastVal = yData[lastIndex];
    this.updateSummary(lastIndex);

    const values = data.map((i) => i.value);
    const trend = this.getTrendStyle(values);

    this.chart.setOption({
      yAxis: {
        min: minVal,
        max: maxVal,
      },
      xAxis: { data: xData },
      series: [
        {
          data: yData,
          showSymbol: onlyOne,
          emphasis: {
            scale: false,
            focus: "none",

            itemStyle: {
              color: trend.pointColor, // 圆点填充色
              borderColor: "#fff",

              borderWidth: 1,

              // opacity: 1,
            },
          },
          itemStyle: onlyOne
            ? {
                color: trend.pointColor,
                borderColor: "#fff",
                borderWidth: 1,
              }
            : {
                color: trend.pointColor,
                borderColor: trend.pointColor,
                borderWidth: 0,
              },

          lineStyle: {
            color: trend.lineColor,
          },
          areaStyle: {
            color: trend.areaColor,
          },
        },
        {
          data: lastVal != null ? [[lastIndex, lastVal]] : [],
          itemStyle: {
            color: trend.pointColor,
          },
        },
      ],
    });
    this.setVolumeData(xData, this._data);
    setTimeout(() => this.renderCustomExtrema(yData), 0);
  }

  public update(point: LinePoint, dataType?: string) {
    const lastIndex = this._data.length - 1;
    const lastPoint = this._data[lastIndex];

    if (
      dataType === "replace" ||
      (lastPoint && String(lastPoint.time) === String(point.time))
    ) {
      this._data[lastIndex] = point;
    } else {
      this._data.push(point);
    }

    this.replaceLineData(this._data);
  }

  public prependData(data: LineHistoryPoint[]) {
    const existingTimes = new Set(
      this._data.map(item => String(item.time)),
    );
    const history = (data || [])
      .map(item => ({
        time: item.time,
        value: Number(item.value ?? item.close),
        volume: Number(item.volume) || 0,
      }))
      .filter(
        item =>
          Number.isFinite(item.value) &&
          !existingTimes.has(String(item.time)),
      );

    this.replaceLineData([...history, ...this._data]);
  }

  public replaceLineData(data: LinePoint[]) {
    this._data = [...data];
    const { xData, yData } = this.buildSeriesData(this._data);
    let maxVal = Math.max(...yData);
    let minVal = Math.min(...yData);
    const onlyOne = yData.length === 1;

    if (onlyOne) {
      // ⭐ 垂直居中核心逻辑：
      // 给 Y 轴设置一个以当前值为中心，上下浮动 10% 的范围
      const val = yData[0];
      const offset = Math.abs(val) * 0.1 || 1; // 如果值为0，默认偏移1
      minVal = val - offset;
      maxVal = val + offset;
    } else {
      minVal = Math.min(...yData);
      maxVal = Math.max(...yData);
    }
    const lastIndex = yData.length - 1;
    const lastVal = yData[lastIndex];
    this.updateSummary(lastIndex);

    const values = data.map((i) => i.value);
    const trend = this.getTrendStyle(values);
    this.chart.setOption({
      yAxis: {
        min: minVal,
        max: maxVal,
      },
      xAxis: { data: xData },
      series: [
        {
          data: yData,
          emphasis: {
            scale: false,
            focus: "none",

            itemStyle: {
              color: trend.pointColor, // 圆点填充色
              borderColor: "#fff",

              borderWidth: 1,

              // opacity: 1,
            },
          },
          showSymbol: onlyOne,
          itemStyle: onlyOne
            ? {
                color: trend.pointColor,
                borderColor: "#fff",
                borderWidth: 1,
              }
            : {
                color: trend.pointColor,
                borderColor: trend.pointColor,
                borderWidth: 0,
              },
          lineStyle: {
            color: trend.lineColor,
          },
          areaStyle: {
            color: trend.areaColor,
          },
        },
        {
          data: lastVal != null ? [[lastIndex, lastVal]] : [],
          itemStyle: {
            color: trend.pointColor,
          },
        },
      ],
    });
    this.setVolumeData(xData, this._data);
    setTimeout(() => this.renderCustomExtrema(yData), 0);
  }

  private setVolumeData(xData: string[], data: LinePoint[]) {
    this.volumeChart.setOption({
      xAxis: {data: xData},
      series: [{data: this.buildVolumeData(data)}],
    });
  }

  private buildVolumeData(data: LinePoint[]) {
    return data.map((item, index) => ({
      value: Number(item.volume) || 0,
      itemStyle: {
        color:
          index === 0 || item.value >= data[index - 1].value
            ? "#16C784"
            : "#F6465D",
      },
    }));
  }

  private getVolumeOption(): echarts.EChartsOption {
    return {
      animation: false,
      grid: {left: 0, right: 0, top: 2, bottom: 20, containLabel: false},
      xAxis: {
        type: "category",
        boundaryGap: true,
        axisLine: {show: true, lineStyle: {color: "#E5E9EE"}},
        axisTick: {show: false},
        axisLabel: {show: true, color: "#868590", fontSize: 10, margin: 6},
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLine: {show: false},
        axisTick: {show: false},
        axisLabel: {show: false},
        splitLine: {show: false},
      },
      tooltip: {show: false},
      series: [{type: "bar", barMaxWidth: 5, data: []}],
    };
  }

  public getChart() {
    return this.chart;
  }

  /* ================== private ================== */

  private getBaseOption(): echarts.EChartsOption {
    return {
      animation: false,
      grid: {
        left: 0,
        right: 0,
        top: GRID_TOP,
        bottom: GRID_BOTTOM,
        containLabel: false,
      },

      xAxis: {
        type: "category",
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        axisPointer: {
          show: true,
          type: "line",
          snap: true,
          lineStyle: {
            color: "rgba(36, 36, 36, 1)",
            width: 0.5,
            type: "dashed",
          },
        },
      },

      yAxis: {
        type: "value",
        position: "right",
        scale: false,
        min: "",
        max: "",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },

      tooltip: {
        show: false, // ✅ 完全关闭 tooltip
        trigger: "axis", // ✅ 不触发任何 tooltip
        showContent: false, // ✅ 关键
        backgroundColor: "rgba(37, 37, 37, 1)",
        padding: [4, 10],
        borderRadius: 6,
        shadowBlur: 0,
        z: 100,
        shadowColor: "transparent",
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        extraCssText: "box-shadow:none;",
        axisPointer: {
          type: "line",
          lineStyle: {
            color: "rgba(36, 36, 36, 1)", // 十字线颜色
            width: 0.5,
            type: "dashed", // dashed / solid
          },
          handle: {
            show: false,
          },
        },
        borderWidth: 0,

        formatter: this.formatTooltip.bind(this),
      },

      series: [
        {
          type: "line",
          z: 200,
          smooth: false,
          showSymbol: false,
          clip: false,
          sampling: "lttb",
          // itemStyle: {
          //   color: "#24AA56", // ✅ normal 状态
          //   borderColor: "#fff",
          //   borderWidth: 1,
          // },
          lineStyle: { width: 1.5, color: "#24AA56" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(40,178,92,0.25)" },
                { offset: 0.6, color: "rgba(40,178,92,0.05)" },
                { offset: 1, color: "rgba(40,178,92,0)" },
              ],
            },
          },

          symbol: "circle",
          symbolSize: 8,
          // ===== 选中状态 =====
          emphasis: {
            scale: false,
            focus: "none",

            itemStyle: {
              color: "#24AA56", // 圆点填充色
              borderColor: "#fff",

              borderWidth: 1,

              // opacity: 1,
            },
          },
          data: [],
        },
        {
          type: "effectScatter",
          z: 300,
          symbol: "circle",
          symbolSize: 4,
          data: [],
          rippleEffect: {
            scale: 4,
            period: 3,
            number: 3,
            brushType: "stroke",
          },
          itemStyle: {
            color: "#24AA56",
          },
        },
      ],
    };
  }

  private buildSeriesData(data: LinePoint[]) {
    const xData: string[] = [];
    const yData: number[] = [];

    data.forEach((d) => {
      xData.push(this.formatTime(d.time));
      yData.push(d.value);
    });

    return { xData, yData };
  }

  // private formatTime(time: UTCTimestamp) {
  //   const date = new Date(time * 1000);
  //   const options = formatMap[this._timeRange] ?? formatMap["1m"];

  //   return date.toLocaleString(this._language, options).replace(",", "");
  // }
  private formatTime(time: UTCTimestamp) {
    const date = new Date(time * 1000);
    const options = formatMap[this._timeRange] ?? formatMap["1m"];

    const parts = new Intl.DateTimeFormat(this._language, {
      ...options,
      timeZone: "Etc/GMT-8", // ✅ UTC+8
    }).formatToParts(date);

    const map: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== "literal") {
        map[p.type] = p.value;
      }
    });

    const isZh = this._language.startsWith("zh");

    // 年月日
    if (map.year && map.month && map.day) {
      return isZh
        ? `${map.year}年${map.month}月${map.day}日`
        : `${map.year}/${map.month}/${map.day}`;
    }

    // 月日 + 时间
    if (map.month && map.day && map.hour && map.minute) {
      return isZh
        ? `${map.month}月${map.day}日 ${map.hour}:${map.minute}`
        : `${map.month}/${map.day} ${map.hour}:${map.minute}`;
    }

    // 仅时间
    if (map.hour && map.minute) {
      return `${map.hour}:${map.minute}`;
    }

    return "";
  }

  private formatTooltip(params: any[]) {
    if (!params || !params.length) return "";

    const p = params[0];

    // `
    //   <div style="font-size:11px;line-height:1.4">
    //     <div>${p.axisValue}</div>
    //     <div>价格：${Number(p.data).toFixed(this._tick)}</div>
    //   </div>
    // `;

    return `
        <div style="min-width:90px;padding:0px; ">
            <div style="display: flex;justify-content: space-between; align-items:center">
              <span style="color:rgba(255, 255, 255, 0.5);font-size:10px ">${
                Il8n[this._language].time
              }:</span>
              <span style="font-size:10px;color:rgba(255, 255, 255, 1)">${
                p.axisValue
              }</span>
            </div>
            <div style="display: flex;justify-content: space-between;margin-bottom: 0px; align-items:center">
              <span style="color:rgba(255, 255, 255, 0.5);font-size:10px ">${
                Il8n[this._language].price
              }</span>
              <span style="font-size:10px;color:rgba(255, 255, 255, 1)">${Number(
                p.data,
              ).toFixed(this._tick)}</span>
            </div>
     
      </div>
        `;
  }

  /** ================== 最值渲染（固定上下） ================== */
  /** ================== 最值渲染 (Category 模式优化版) ================== */
  private renderCustomExtrema(values: number[]) {
    if (!values || !values.length || values.length == 1) return;
    if (`${this._tick}` == "0") {
      return;
    }

    // 所有值相等，不显示
    const first = values[0];
    if (values.every((v) => v === first)) return;

    // 1. 找到绝对最大/最小值
    const originMax = Math.max(...values);
    const originMin = Math.min(...values);

    // 2. 核心修改：模拟 UI 显示精度进行查找
    const format = (v: number) => v.toFixed(this._tick);
    const targetMaxStr = format(originMax);
    const targetMinStr = format(originMin);

    const maxIdx = values.findIndex((v) => format(v) === targetMaxStr);
    const minIdx = values.findIndex((v) => format(v) === targetMinStr);

    const finalMaxIdx = maxIdx !== -1 ? maxIdx : values.indexOf(originMax);
    const finalMinIdx = minIdx !== -1 ? minIdx : values.indexOf(originMin);

    // 3. 转换坐标
    const maxPos = this.chart.convertToPixel({ seriesIndex: 0 }, [
      finalMaxIdx,
      originMax,
    ]);
    const minPos = this.chart.convertToPixel({ seriesIndex: 0 }, [
      finalMinIdx,
      originMin,
    ]);

    const chartWidth = this.container.clientWidth;
    const chartHeight = this.container.clientHeight;

    const FONT_SIZE = 12;
    const LABEL_HEIGHT = 14;
    const GAP = 4;

    const maxText = "$" + targetMaxStr;
    const minText = "$" + targetMinStr;

    const maxTextWidth = this.measureTextWidth(maxText, FONT_SIZE);
    const minTextWidth = this.measureTextWidth(minText, FONT_SIZE);

    /** Y 方向 clamp */
    const clampY = (y: number) =>
      Math.max(0, Math.min(y, chartHeight - LABEL_HEIGHT));

    /** X 方向 clamp（左右各留 16px） */
    const clampX = (x: number, w: number) =>
      Math.max(EDGE_PADDING, Math.min(x, chartWidth - w - EDGE_PADDING));

    const maxTop = clampY(maxPos[1] - LABEL_HEIGHT - GAP);
    const minTop = clampY(minPos[1] + GAP);

    const maxLeft = clampX(maxPos[0] - maxTextWidth / 2, maxTextWidth);
    const minLeft = clampX(minPos[0] - minTextWidth / 2, minTextWidth);

    this.chart.setOption({
      graphic: [
        {
          id: "max-label",
          type: "text",
          left: maxLeft,
          top: maxTop,
          silent: true,
          z: 100,
          style: {
            text: maxText,
            fontSize: FONT_SIZE,
            fill: "rgba(36, 36, 36, 0.6)",
          },
        },
        {
          id: "min-label",
          type: "text",
          left: minLeft,
          top: minTop,
          silent: true,
          z: 100,
          style: {
            text: minText,
            fontSize: FONT_SIZE,
            fill: "rgba(36, 36, 36, 0.6)",
          },
        },
      ],
    });
  }

  private measureTextWidth(text: string, fontSize = 12) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${fontSize}px sans-serif`;
    return ctx.measureText(text).width;
  }
  private createCrossTooltip(container: HTMLElement) {
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.top = "0px"; // 🔴 永远在折线图顶部
    div.style.left = "0";
    div.style.transform = "translateX(-50%)";
    div.style.pointerEvents = "none";
    div.style.zIndex = "10";
    div.style.background = "rgba(255, 255, 255, 1)";
    div.style.display = "none";
    div.style.whiteSpace = "nowrap"; // ⭐ 禁止换行
    div.style.wordBreak = "keep-all"; // ⭐ 禁止中英文断词

    div.style.minWidth = "48px";

    container.style.position = "relative";
    container.appendChild(div);

    this._crossTip = div;

    this._crossTip.addEventListener(
      "touchstart",
      (e) => {
        e.stopPropagation();
      },
      { passive: false },
    );

    this._crossTip.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
  }
  private updateCrossTooltip(dataIndex: number) {
    if (!this._crossTip) return;

    const point = this._data[dataIndex];
    const previous = dataIndex > 0 ? this._data[dataIndex - 1] : undefined;
    const change = previous ? point.value - previous.value : 0;
    const changePercent = previous?.value ? (change / previous.value) * 100 : 0;
    const changeColor = change < 0 ? "#EB4B6D" : "#16C784";
    const volume = Number(point.volume);
    const average = point.average ?? point.value;

    // 1️⃣ 更新内容
    this._crossTip.innerHTML = `
    <div style="font-family: 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
                text-align:center;
                border:0.5px solid rgba(0, 0, 0, 0.1);
                padding:4px 8px;
                border-radius:6px">
      <div style="font-weight:500;color:rgba(36, 36, 36, 1);font-size:12px">
        ${"$" + point.value.toFixed(this._tick)}
      </div>
      <div style="font-size:12px;color:rgba(36, 36, 36, 0.6);">
        ${this.formatTime(point.time)}
      </div>
      <div style="font-size:12px;color:${changeColor};">
        ${change >= 0 ? "+" : ""}${change.toFixed(this._tick)}
        (${change >= 0 ? "+" : ""}${changePercent.toFixed(2)}%)
      </div>
      <div style="font-size:12px;color:rgba(36, 36, 36, 0.6);">
        ${Il8n[this._language].avgPrice} ${average.toFixed(this._tick)}${Number.isFinite(volume) ? ` · ${Il8n[this._language].volume} ${volume}` : ""}
      </div>
    </div>
  `;

    // 2️⃣ index → 像素 X
    const x = this.chart.convertToPixel({ xAxisIndex: 0 }, dataIndex);

    // 3️⃣ 左右 16px 留边
    const containerWidth = this.chart.getDom().clientWidth;
    const tipWidth = this._crossTip.offsetWidth;

    let left = x;

    const minLeft = EDGE_PADDING + tipWidth / 2;
    const maxLeft = containerWidth - EDGE_PADDING - tipWidth / 2;

    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    // 4️⃣ 设置位置
    this._crossTip.style.left = `${left}px`;
    this._crossTip.style.display = "block";
  }

  private updateSummary(dataIndex: number) {
    const point = this._data[dataIndex];
    if (!this._summary || !point) return;
    const previous = dataIndex > 0 ? this._data[dataIndex - 1] : undefined;
    const change = previous ? point.value - previous.value : 0;
    const ratio = previous?.value ? (change / previous.value) * 100 : 0;
    const color = change < 0 ? "summary-fall" : "summary-value";
    const volume = Number(point.volume);
    const average = point.average ?? point.value;
    this._summary.innerHTML = `
      <div class="summary-row">
        <span class="summary-time">${this.formatTime(point.time)}</span>
        <span class="summary-item ${color}">${point.value.toFixed(this._tick)}</span>
        <span class="summary-item ${color}">${change >= 0 ? "+" : ""}${change.toFixed(this._tick)}</span>
        <span class="summary-item ${color}">${change >= 0 ? "+" : ""}${ratio.toFixed(2)}%</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">${Il8n[this._language].avgPrice}</span><span class="summary-yellow">${average.toFixed(this._tick)}</span>
        <span class="summary-label" style="margin-left:10px">${Il8n[this._language].volume}</span><span class="summary-fall">${Number.isFinite(volume) ? volume : "--"}</span>
      </div>`;
  }

  /** 显示十字线和自定义 Tooltip */
  public showCrossAt(index: number) {
    if (!this._data || !this._data.length) return;

    const point = this._data[index];
    if (!point) return;
    this.updateSummary(index);

    // 更新自定义 tooltip
    // 暂时不把统计信息放到十字线浮层上，统一显示在顶部 summary-layer。
    // this.updateCrossTooltip(index);

    // 显示 ECharts axisPointer（可选）
    // this.chart.dispatchAction({
    //   type: "updateAxisPointer",
    //   xAxisIndex: 0,
    //   seriesIndex: 0,
    //   dataIndex: index,
    // });

    // 显示 ECharts 十字线
    this.chart.setOption({
      tooltip: {
        // 保留十字线交互，不显示 ECharts 浮动统计层。
        show: false,
      },
    });
    this.chart.dispatchAction({
      type: "updateAxisPointer",
      xAxisIndex: 0,
      value: index,
    });
    this.chart.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: index,
    });
  }

  /** 隐藏十字线和自定义 Tooltip */
  public hideCross() {
    if (this._crossTip) this._crossTip.style.display = "none";

    this.chart.setOption({
      tooltip: {
        show: false,
      },
    });
  }

  private setTrigger() {
    const touchStartHandler = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      this.isLongPress = false;

      // 500ms 触发长按
      this.longPressTimer = setTimeout(() => {
        this.isLongPress = true;
        const touch = e.touches[0];
        const rect = this.chart.getDom().getBoundingClientRect();
        const x = touch.clientX - rect.left;

        const containerWidth = rect.width;
        const dataLen = this._data.length;
        if (!dataLen) return;

        let dataIndex: number;

        // 在折线图范围内，按比例计算
        dataIndex = Math.floor((x / containerWidth) * dataLen);
        this.showCrossAt(dataIndex);
      }, 500);
    };

    const touchMoveHandler = (e: TouchEvent) => {
      // if (e.touches.length !== 1) return;

      // // 如果是长按触发或者滑动触发才显示
      // if (!this.isLongPress) {
      //   clearTimeout(this.longPressTimer);
      //   return;
      // }

      // const touch = e.touches[0];
      // const pointInPixel = this.chart.convertFromPixel({ xAxisIndex: 0 }, [
      //   touch.clientX,
      //   0,
      // ]);
      // const dataIndex = Math.round(pointInPixel as number);

      // if (dataIndex >= 0 && dataIndex < this._data.length) {
      //   this.showCrossAt(dataIndex);
      // }

      const touch = e.changedTouches?.[0];
      if (!touch) return;

      const rect = this.chart.getDom().getBoundingClientRect();
      const x = touch.clientX - rect.left;

      const width = rect.width;
      const len = this._data.length;
      if (!len) return;

      console.log("touch move x:--------->", x);
      // 🚫 到达左右边缘 16px 内：停止更新十字线
      if (x <= EDGE_PADDING) {
        this.showCrossAt(0);
        return;
      }

      if (x >= width - EDGE_PADDING) {
        this.showCrossAt(len - 1);
        return;
      }
      console.log("还在继续-----");
      let index: number;

      if (x < 0) {
        // 👈 左吸附
        index = 0;
        this.showCrossAt(index);
      } else if (x > width) {
        // 👉 右吸附
        index = len - 1;
        this.showCrossAt(index);
      } else {
        this.showCrossAt(index);
      }
    };

    const touchEndHandler = (e: TouchEvent) => {
      clearTimeout(this.longPressTimer);
      this.hideCross();
    };

    const touchEndHandlerRef = (e: TouchEvent) => {
      const touch = e.changedTouches?.[0];
      if (!touch) return;

      const rect = this.chart.getDom().getBoundingClientRect();
      const x = touch.clientX - rect.left;

      const width = rect.width;
      const len = this._data.length;
      if (!len) return;

      let index: number;

      if (x < 0) {
        // 👈 左吸附
        index = 0;
        this.showCrossAt(index);
      } else if (x > width) {
        // 👉 右吸附
        index = len - 1;
        this.showCrossAt(index);
      } else {
        // this.hideCross();
      }
    };

    // 绑定事件
    this.container.addEventListener("touchstart", touchStartHandler, {
      passive: true,
    });
    this.container.addEventListener("touchmove", touchMoveHandler, {
      passive: true,
    });
    this.container.addEventListener("touchend", touchEndHandler);
    this.container.addEventListener("touchcancel", touchEndHandler);
  }

  private calcIndexByX(x: number, width: number, len: number) {
    if (len <= 1) return 0;
    return Math.floor((x / width) * len);
  }
  //处理涨跌颜色
  private getTrendStyle(values: number[]) {
    if (!values || values.length < 2) {
      return {
        lineColor: "#16C784",
        areaColor: "rgba(40,178,92,0.25)",
        pointColor: "#16C784",
      };
    }

    const first = values[0];
    const last = values[values.length - 1];

    const isUp = last >= first;

    return isUp
      ? {
          lineStyle: { width: 1.5, color: "#24AA56" },
          pointColor: "#24AA56", // 涨：绿
          areaColor: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(40,178,92,0.25)" },
              { offset: 0.6, color: "rgba(40,178,92,0.05)" },
              { offset: 1, color: "rgba(40,178,92,0)" },
            ],
          },
        }
      : {
          lineColor: "rgba(220, 51, 87, 1)", // 跌：红
          pointColor: "rgba(220, 51, 87, 1)", // 涨：绿
          areaColor: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(220, 51, 87, 0.25)" },
              { offset: 0.6, color: "rgba(220, 51, 87, 0.05)" },
              { offset: 1, color: "rgba(220, 51, 87, 0.00)" },
            ],
          },
        };
  }
}
