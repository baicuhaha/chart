// SimpleEChart.ts
import * as echarts from "echarts";
import { UTCTimestamp } from "lightweight-charts";
import Il8n from "./i18n/index";

type ChartType = "Line";

export interface LinePoint {
  time: UTCTimestamp;
  value: number;
}

interface ConstructorParams {
  container: HTMLElement;
  language?: string;
  options?: {
    height?: number;
    isFullScreen?: boolean;
    from?: string;
  };
}

/** ================== 尺寸常量 ================== */
const TOTAL_HEIGHT = 304;
const GRID_TOP = 22;
const GRID_BOTTOM = 22;
const CHART_HEIGHT = TOTAL_HEIGHT - GRID_TOP - GRID_BOTTOM;

/** ================== 时间格式 ================== */
const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
  all: { year: "numeric", month: "2-digit", day: "2-digit" },
  "1y": { year: "numeric", month: "2-digit", day: "2-digit" },
  "6m": { month: "2-digit", day: "2-digit" },
  "1m": { month: "2-digit", day: "2-digit" },
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
  private container: HTMLElement;

  private _data: LinePoint[] = [];
  private _tick = 2;
  private _language = "zh-CN";
  private _timeRange = "1m";
  private _from = "";
  private _isFullScreen = false;

  constructor({ container, language, options = {} }: ConstructorParams) {
    this.container = container;
    this._language = language || "zh-CN";
    this._from = options.from || "";
    this._isFullScreen = !!options.isFullScreen;

    container.style.width = options.width ? options.width + "px" : "100%";
    container.style.height = TOTAL_HEIGHT + "px";

    this.chart = echarts.init(container);
    this.chart.setOption(this.getBaseOption());
  }

  /* ================== public ================== */

  public setData(
    data: LinePoint[],
    priceDecimal?: number,
    timeType?: string,
    from?: string
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
    const maxVal = Math.max(...yData);
    const minVal = Math.min(...yData);

    this.chart.setOption({
      yAxis: {
        min: minVal,
        max: maxVal,
      },
      xAxis: { data: xData },
      series: [{ data: yData }],
    });

    setTimeout(() => this.renderCustomExtrema(yData), 0);
  }

  public update(point: LinePoint) {
    this._data.push(point);

    this.chart.appendData({
      seriesIndex: 0,
      data: [point.value],
    });
  }

  public replaceLineData(data: LinePoint[]) {
    this._data = [...data];
    const { xData, yData } = this.buildSeriesData(this._data);
    const maxVal = Math.max(...yData);
    const minVal = Math.min(...yData);

    this.chart.setOption({
      yAxis: {
        min: minVal,
        max: maxVal,
      },
      xAxis: { data: xData },
      series: [{ data: yData }],
    });

    setTimeout(() => this.renderCustomExtrema(yData), 0);
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
      },

      yAxis: {
        type: "value",
        position: "right",
        scale: false,
        min: "", // 运行时 set
        max: "",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false }, // 👈 关键
        splitLine: { show: false }, // 👈 顺手关掉
      },

      tooltip: {
        trigger: "axis",
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
          sampling: "lttb",
          lineStyle: { width: 1.5, color: "#30BD65" },
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
          symbolSize: 6,
          // ===== 选中状态 =====
          emphasis: {
            scale: false,
            focus: "none",

            itemStyle: {
              color: "#30BD65", // 圆点填充色
              borderColor: "#fff",

              borderWidth: 1,

              // opacity: 1,
            },
          },
          data: [],
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

  private formatTime(time: UTCTimestamp) {
    const date = new Date(time * 1000);
    const options = formatMap[this._timeRange] ?? formatMap["1m"];
    return date.toLocaleString(this._language, options).replace(",", "");
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
        <div style="font-family: Arial, Helvetica, sans-serif;min-width:90px;padding:0px; ">
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
                this._from === "MAIN"
                  ? Il8n[this._language].price
                  : Il8n[this._language].avgPrice
              }</span>
              <span style="font-size:10px;color:rgba(255, 255, 255, 1)">${Number(
                p.data
              ).toFixed(this._tick)}</span>
            </div>
     
      </div>
        `;
  }

  /** ================== 最值渲染（固定上下） ================== */
  // private renderCustomExtrema(values: number[]) {
  //   if (!values.length) return;

  //   const maxVal = Math.max(...values);
  //   const minVal = Math.min(...values);
  //   const maxIdx = values.indexOf(maxVal);
  //   const minIdx = values.lastIndexOf(minVal);

  //   const maxPos = this.chart.convertToPixel({ seriesIndex: 0 }, [
  //     maxIdx,
  //     maxVal,
  //   ]);
  //   const minPos = this.chart.convertToPixel({ seriesIndex: 0 }, [
  //     minIdx,
  //     minVal,
  //   ]);

  //   const chartWidth = this.chart.getWidth();
  //   const chartHeight = this.chart.getHeight();

  //   const FONT_SIZE = 12;
  //   const LABEL_HEIGHT = 14;
  //   const GAP = 4;

  //   const maxText = "$" + maxVal.toFixed(this._tick);
  //   const minText = "$" + minVal.toFixed(this._tick);

  //   const maxTextWidth = this.measureTextWidth(maxText, FONT_SIZE);
  //   const minTextWidth = this.measureTextWidth(minText, FONT_SIZE);

  //   /** Y 方向 clamp */
  //   const clampY = (y: number) =>
  //     Math.max(0, Math.min(y, chartHeight - LABEL_HEIGHT));

  //   /** X 方向 clamp */
  //   const clampX = (x: number, w: number) =>
  //     Math.max(0, Math.min(x, chartWidth - w));

  //   // 理想位置：点的上方 / 下方
  //   const maxTop = clampY(maxPos[1] - LABEL_HEIGHT - GAP);
  //   //这是原来的 跟这个Y位置有关
  //   // const minTop = clampY(minPos[1] + GAP);

  //   const minTop = clampY(chartHeight - LABEL_HEIGHT + GAP);

  //   // 理想居中
  //   const maxLeft = clampX(maxPos[0] - maxTextWidth / 2, maxTextWidth);
  //   const minLeft = clampX(minPos[0] - minTextWidth / 2, minTextWidth);

  //   this.chart.setOption({
  //     graphic: [
  //       {
  //         id: "max-label",
  //         type: "text",
  //         left: maxLeft,
  //         top: maxTop,
  //         silent: true,
  //         z: 100,
  //         style: {
  //           text: maxText,
  //           fontSize: FONT_SIZE,
  //           fill: "rgba(36, 36, 36, 0.6)",
  //         },
  //       },
  //       {
  //         id: "min-label",
  //         type: "text",
  //         left: minLeft,
  //         top: minTop,
  //         silent: true,
  //         z: 100,
  //         style: {
  //           text: minText,
  //           fontSize: FONT_SIZE,
  //           fill: "rgba(36, 36, 36, 0.6)",
  //         },
  //       },
  //     ],
  //   });
  // }

  private renderCustomExtrema(values: number[]) {
    if (!values.length) return;

    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);

    // ✅ 第一个极值（最早出现）
    const maxIdx = values.findIndex((v) => v === maxVal);
    const minIdx = values.findIndex((v) => v === minVal);

    const chartWidth = this.chart.getWidth();
    const chartHeight = this.chart.getHeight();

    const FONT_SIZE = 12;
    const LABEL_HEIGHT = 14;
    const GAP = 4;

    const maxText = "$" + maxVal.toFixed(this._tick);
    const minText = "$" + minVal.toFixed(this._tick);

    const maxTextWidth = this.measureTextWidth(maxText, FONT_SIZE);
    const minTextWidth = this.measureTextWidth(minText, FONT_SIZE);

    // ⚠️ 只用 xAxisIndex + index 算 X（关键）
    const maxX = this.chart.convertToPixel({ xAxisIndex: 0 }, maxIdx) as number;

    const minX = this.chart.convertToPixel({ xAxisIndex: 0 }, minIdx) as number;

    const clampX = (x: number, w: number) =>
      Math.max(0, Math.min(x, chartWidth - w));

    const maxLeft = clampX(maxX - maxTextWidth / 2, maxTextWidth);
    const minLeft = clampX(minX - minTextWidth / 2, minTextWidth);

    // ✅ Y 固定：最高贴顶，最低贴底
    const maxTop = GAP;
    const minTop = chartHeight - LABEL_HEIGHT - GAP;

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
            fill: "rgba(36,36,36,0.6)",
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
            fill: "rgba(36,36,36,0.6)",
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
}
