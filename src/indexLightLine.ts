import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  AreaSeries,
  DeepPartial,
  LineData,
  LineSeriesPartialOptions,
  CrosshairMode,
  UTCTimestamp,
  AreaStyleOptions,
  ChartOptions,
  ColorType,
} from "lightweight-charts";

import { setStyle, formatTimestamp } from "./utils/util";
import Il8n from "./i18n/index";
import { PartialPriceLine } from "./plugins/partial-price-line";
import { OverlayPriceScale } from "./plugins/overlay-price-scale";

type ChartType = "Line" | "depth";

interface LinePoint {
  time: UTCTimestamp;
  value: number;
}

interface DepthPoint {
  price: number;
  bids: number;
  asks: number;
}

// 先定义扩展类型
interface ExtendedLineData extends LineData {
  volume?: number;
  turnover?: number;
  averagePrice?: number;
  isPatched?: boolean;
}

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
  "1d": {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  "1h": {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
};

interface ChartInitOptions {
  type: ChartType;
  container: HTMLElement;
  language?: string;
  loadMore?: () => void;
  options?: {
    height?: number;
    chartOptions?: DeepPartial<ChartOptions>;
    timeRange?: string;
    isFullScreen?: boolean; // ✅ 外部传入 是否全屏
  };
}

export default class SimpleChart {
  private chart: IChartApi;
  private series: ISeriesApi<"Line">[] = [];
  private _language: string = "zh-CN";
  private _toolTip: HTMLElement | null = null;
  private _latestPriceDiv: HTMLElement | null = null;
  private _type: ChartType;
  private _isInit: boolean = false; // 是否初始化完成
  private _loadMore?: () => void;
  private _loadingMore: boolean = false;

  private _areaSeries: any;
  private _data: LineData[] | DepthPoint[] = [];
  private _tick: number = 2; // 精度问题
  //最后的价格
  private _lastPrice: string | number = "";

  private _initSubscribe = false;
  private _timeRange: string = "";
  private _isFullScreen: boolean = false;

  private _from: string = ""; //是否与主板还是创业版本

  private _maxLabel?: HTMLElement;
  private _minLabel?: HTMLElement;

  constructor({
    type,
    container,
    language,
    loadMore,
    options = {},
  }: ChartInitOptions) {
    this._type = type;
    this._language = language || "zh-CN";
    this._loadMore = loadMore;
    console.log("options?.heigh-------->", options.height);
    container.style.height = (options.height || 326) + "px";

    container.style.width = `${
      options?.width ? options?.width + "px" : "100%"
    }`;
    this._isFullScreen = options.isFullScreen || false;
    let counter = 0;
    const step = 2; // 每隔 step 根 K 线显示一次
    this._timeRange = options.timeRange || "";

    this.chart = createChart(container, {
      // height: 326,

      layout: {
        background: { type: ColorType.Solid, color: "yellow" },
        textColor: "rgba(13, 12, 34, 0.7)",
        fontSize: 10, // x轴文字大小
      },

      localization: {
        timeFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          return date.toLocaleString(this._language, {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: {
          visible: false, // 👈 关键
        },
      },
      grid: {
        vertLines: {
          visible: !this._isFullScreen,
          color: "rgba(13, 12, 34, 0.03)",
        },
        horzLines: {
          visible: !this._isFullScreen,
          color: "rgba(13, 12, 34, 0.03)",
        },
      },
      rightPriceScale: { visible: false }, // 隐藏原始右侧坐标
      // timeScale: { rightOffset: 20, borderColor: "#F3F3F4" }, // 默认向左偏移
      timeScale: {
        visible: false,
        borderColor: "rgba(13, 12, 34, 0.07)",
        timeVisible: false,
        tickMarkFormatter: (time: UTCTimestamp) => {
          counter++;
          if (counter % step !== 0) return ""; // 不显示
          const date = new Date(time * 1000);
          // const options: Intl.DateTimeFormatOptions = {
          //   month: "2-digit",
          //   day: "2-digit",
          //   hour: "2-digit",
          //   minute: "2-digit",
          //   hour12: false,
          // };
          // return date.toLocaleString(this._language, options).replace(",", "");
          const options = formatMap[this._timeRange] ?? formatMap["1m"]; // fallback
          return date.toLocaleString(this._language, options).replace(",", "");
        },
        secondsVisible: false,
        rightOffset: this._isFullScreen ? 0 : 20,
      },
      ...options.chartOptions,
    });

    console.log(
      "container rect-----》:",
      container.getBoundingClientRect().height
    );

    // this.chart.applyOptions({
    //   layout: {
    //     fontSize: 10, // x轴文字大小
    //   },
    // });

    this.createToolTip(container);
    // this.createLatestPriceDiv(container);

    const areaSeries = this.chart.addSeries(AreaSeries, {
      // lineColor: "#4A7D2F",
      lineColor: "#30BD65",
      lineWidth: 2,
      lineType: 0,
      priceLineVisible: false, // 最新价格横线
      topColor: "rgba(48, 189, 101, 0.1)", // 填充区域顶部渐变颜色
      bottomColor: "rgba(48, 189, 101, 0)", // 填充区域底部渐变颜色
    } as DeepPartial<AreaStyleOptions>);

    // areaSeries.attachPrimitive(new PartialPriceLine());

    this._areaSeries = areaSeries;
    this.series.push(areaSeries);
    //横盘处理
    this._areaSeries.applyOptions({
      autoscaleInfoProvider: () => {
        const timeScale = this.chart.timeScale();
        const logicalRange = timeScale.getVisibleLogicalRange();
        if (!logicalRange) return null;

        const bars = this._data.slice(
          Math.max(0, Math.floor(logicalRange.from)),
          Math.min(this._data.length, Math.ceil(logicalRange.to))
        ) as LinePoint[];

        if (!bars.length) return null;

        const values = bars.map((b) => b.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const last = values[values.length - 1];

        const epsilon = 10 ** -this._tick;
        const range = max - min;

        // ✅ 横盘：价格贴近 X 轴（底部）
        if (range < epsilon) {
          return {
            priceRange: {
              minValue: last - epsilon, // 👈 价格压在底部
              maxValue: last + epsilon * 30, // 👈 上方留白
            },
          };
        }

        // 非横盘：正常
        return {
          priceRange: {
            minValue: min,
            maxValue: max,
          },
        };
      },
    });

    this.chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((logicalRange) => {
        //如果是全屏的话，不触发加载更多
        if (this._isFullScreen) {
          return;
        }
        // if (!this._initSubscribe) {
        //   this._initSubscribe = true;
        //   return;
        // }
        // if (
        //   logicalRange &&
        //   logicalRange.from < 30 &&
        //   !this._loadingMore &&
        //   this._isInit
        // ) {
        //   this._loadMore && this._loadMore();
        //   this._loadingMore = true;
        // }

        // 如果还没初始化完成，或者正在加载中，直接返回
        if (!this._isInit || this._loadingMore || !logicalRange) {
          return;
        }

        // 只有当数据量超过一定阈值（比如 50 条），才允许触发加载更多
        // 防止初始化时因为数据太少，导致 from 必然小于 30
        if (this._data.length < 50) return;

        if (logicalRange.from < 10) {
          // 调低阈值到 10 左右更灵敏且安全
          console.log("触发加载更多...");
          this._loadingMore = true;
          this._loadMore?.();
        }
      });

    this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      // this.updatePriceDiv(this._lastPrice);
      // this.updatePriceLabelPosition(this._lastPrice);
    });

    this.chart.timeScale().fitContent();

    this.applyInteractionByMode();

    this.createExtremaLabels(container);
  }

  public setData(
    data: LinePoint[] | DepthPoint[],
    priceDecimal?: number,
    timeType?: string,
    from?: string
  ): void {
    this._data = data || [];
    this._timeRange = timeType;
    this._from = from || "";

    // if (this._type === 'Line') {
    this.series[0].setData(data as LineData[]);

    if (data.length > 0) {
      const lastPrice = (data as LinePoint[])[data.length - 1].value;
      this._lastPrice = lastPrice;

      // this.updatePriceDiv(lastPrice);
    }

    if (priceDecimal) {
      let tick =
        String(priceDecimal).indexOf(".") == -1
          ? 0
          : String(priceDecimal).length - 2;
      this._tick = tick || 2; // 设置小数点位数
    }

    if (!this._isFullScreen) {
      this.chart.timeScale().scrollToPosition(20, false);
    }
    console.log("setData----isFullScreen--->", this._isFullScreen);
    console.log("setData----data--->", data);
    console.log("setData----data---1111--->", data.length);
    requestAnimationFrame(() => {
      this._isInit = true; // 绘制完成后再放开开关
      this._isFullScreen && this.forceFullScreen();
      this.updateVisibleExtrema();
      // 强制刷新一次布局，解决高度/起始点渲染滞后问题
      this.chart.timeScale().scrollToRealTime();
    });
  }

  public update(point: LinePoint | DepthPoint): void {
    if (!this._isInit) return; // 如果没有初始化完成，则不执行更新操作

    console.log("追加数据------------>", point);
    this.series[0].update(point as LineData);

    this._data.push(point);
    this._lastPrice = (point as LinePoint).value;
    // this.updatePriceDiv((point as LinePoint).value);
  }

  /**
   * 追加历史数据（往前补）
   */
  public prependData(newBars: LinePoint[]): void {
    if (!newBars || newBars.length === 0) return;

    // 确保 newBars 是升序排列
    const sortedNewBars = [...newBars].sort((a, b) => a.time - b.time);

    // 如果接口返回的最后一条数据和现有第一条重复，就去掉
    if (this._data.length > 0 && sortedNewBars.length > 0) {
      const firstExistingTime = (this._data[0] as LinePoint).time;
      if (sortedNewBars[sortedNewBars.length - 1].time >= firstExistingTime) {
        sortedNewBars.pop();
      }
    }

    // 拼接：新数据在前，旧数据在后
    this._data = [...sortedNewBars, ...this._data];

    // 更新图表
    this.series[0].setData(this._data as LineData[]);

    this._loadingMore = false; // 重置加载状态
  }

  private createToolTip(container: HTMLElement) {
    const toolTip = document.createElement("div");
    setStyle(toolTip, {
      position: "absolute",
      display: "none",
      padding: "6px 8px",
      minWidth: "100px",
      fontSize: "11px",
      background: "rgba(251,251,251,0.95)",
      borderRadius: "6px",
      zIndex: "1000",
      pointerEvents: "none",
    });
    this._toolTip = toolTip;
    container.appendChild(toolTip);

    this.chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        toolTip.style.display = "none";
        return;
      }
      toolTip.style.display = "block";

      const p = param.seriesData.get(this.series[0]) as ExtendedLineData;
      const dataItem = this._data.find((item) => item.time === p.time);

      let avgPrice = dataItem.isPatched
        ? "--"
        : dataItem?.averagePrice.toFixed(this._tick);

      const date = new Date(dataItem?.time * 1000);
      const options = formatMap[this._timeRange] ?? formatMap["1m"]; // fallback
      let timeStr = date
        .toLocaleString(this._language, options)
        .replace(",", "");

      // toolTip.innerHTML = `
      //   <div style="font-family: Arial, Helvetica, sans-serif;">
      // <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
      //   <span style="color:rgba(13, 12, 34, 0.5); ">${
      //     Il8n[this._language].time
      //   }:</span>
      //   <span>${formatTimestamp(dataItem?.time * 1000)}</span>
      // </div>
      //  <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
      //    <span style="color:rgba(13, 12, 34, 0.5)">${
      //      Il8n[this._language].avgPrice
      //    }</span>
      //   <span>${avgPrice}</span>
      // </div>
      //   <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
      //    <span style="color:rgba(13, 12, 34, 0.5)">${
      //      Il8n[this._language].volume
      //    }</span>
      //   <span>${dataItem?.volume.toFixed(this._tick)}</span>
      // </div>
      //   <div style="display: flex; justify-content: space-between;margin-bottom: 5px; align-items:center">
      //    <span style="color:rgba(13, 12, 34, 0.5)">${
      //      Il8n[this._language].turnover
      //    }</span>
      //   <span>${dataItem?.turnover.toFixed(this._tick)}</span>
      // </div>
      // </div>
      //   `;

      toolTip.innerHTML = `
        <div style="font-family: Arial, Helvetica, sans-serif;">
      <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
        <span style="color:rgba(13, 12, 34, 0.5); ">${
          Il8n[this._language].time
        }:</span>
        <span>${timeStr}</span>
      </div>
       <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
         <span style="color:rgba(13, 12, 34, 0.5)">${
           this._from === "MAIN"
             ? Il8n[this._language].price
             : Il8n[this._language].avgPrice
         }</span>
        <span>${avgPrice}</span>
      </div>
     
      </div>
        `;

      const coordinateX = param.point.x;
      const coordinateY = param.point.y;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const offsetX = 10;
      const offsetY = 10;

      // 根据你的内容行数预估高度约为 100px
      const toolTipWidth = 140;
      const toolTipHeight = 100;

      // --- 左右调整 ---
      if (coordinateX > containerWidth / 2) {
        toolTip.style.left = coordinateX - toolTipWidth - offsetX + "px";
      } else {
        toolTip.style.left = coordinateX + offsetX + "px";
      }

      // --- 上下调整 ---
      // 如果坐标在容器下半部分，则将 ToolTip 显示在鼠标上方
      if (coordinateY > containerHeight / 2) {
        toolTip.style.top = coordinateY - toolTipHeight - offsetY + "px";
      } else {
        toolTip.style.top = coordinateY + offsetY + "px";
      }
    });
  }

  private createLatestPriceDiv(container: HTMLElement) {
    const priceDiv = document.createElement("div");
    setStyle(priceDiv, {
      position: "absolute",
      right: "0px",
      background: "#fff",
      padding: "2px 6px",
      fontSize: "10px",
      borderRadius: "4px",
      border: "1px solid rgba(13,12,34,1)",
      pointerEvents: "none",
      zIndex: "10000",
      opacity: "0",

      fontFamily: "Arial, Helvetica, sans-serif", // ✅ 强制用普通字体
      transform: "translateY(-50%)",
    });
    this._latestPriceDiv = priceDiv;
    container.appendChild(priceDiv);
  }

  private updatePriceDiv(price: number) {
    if (!this._latestPriceDiv || !this.series[0]) return;
    this._latestPriceDiv.style.opacity = "1";

    let y = this.series[0].priceToCoordinate(price);
    let maxY = 310;
    let minY = y;
    if (y !== null) {
      // y = Math.min(Math.max(y, minY), maxY);
      this._latestPriceDiv.style.top = `${y}px`;
    } else {
      this._latestPriceDiv.style.top = `-9999px`; // 隐藏
    }

    this._latestPriceDiv.innerHTML = `${price}`;
  }

  public getChart(): IChartApi {
    return this.chart;
  }

  private applyInteractionByMode() {
    const isFull = this._isFullScreen;

    this.chart.applyOptions({
      handleScroll: isFull
        ? {
            mouseWheel: false,
            pressedMouseMove: false,
            horzTouchDrag: false,
            vertTouchDrag: false,
          }
        : true,
      handleScale: isFull
        ? {
            mouseWheel: false,
            pinch: false,
            axisPressedMouseMove: false,
          }
        : true,
    });
  }

  private forceFullScreen() {
    const count = this._data.length;
    if (!count) return;

    const timeScale = this.chart.timeScale();

    // 1️⃣ 强行把 X 轴限制在真实数据范围
    timeScale.setVisibleLogicalRange({
      from: 0,
      to: count - 1,
    });

    // 2️⃣ 禁止一切横向操作
    this.chart.applyOptions({
      handleScroll: false,
      handleScale: false,
      timeScale: {
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    });
  }
  //全局替换数据
  public replaceLineData(data: LinePoint[]) {
    this._isInit = false;

    this._data = [...data];
    this.series[0].setData(this._data as LineData[]);

    const timeScale = this.chart.timeScale();

    if (this._isFullScreen && this._data.length > 0) {
      timeScale.setVisibleLogicalRange({
        from: 0,
        to: this._data.length - 1,
      });
    } else {
      timeScale.fitContent();
    }

    requestAnimationFrame(() => {
      this._isInit = true;
      this.updateVisibleExtrema();
    });
  }

  //最大值和最小值
  private createExtremaLabels(container: HTMLElement) {
    const baseStyle = {
      position: "absolute",
      fontSize: "12px",
      color: "#0D0C22",
      pointerEvents: "none",
      zIndex: "10",
      fontFamily: "Arial, Helvetica, sans-serif",
    };

    const maxEl = document.createElement("div");
    Object.assign(maxEl.style, baseStyle);
    maxEl.style.transform = "translate(-50%, -100%)";

    const minEl = document.createElement("div");
    Object.assign(minEl.style, baseStyle);
    minEl.style.transform = "translate(-50%, 0)";

    container.appendChild(maxEl);
    container.appendChild(minEl);

    this._maxLabel = maxEl;
    this._minLabel = minEl;
  }

  // private updateVisibleExtrema() {
  //   if (!this._data.length || !this._maxLabel || !this._minLabel) return;

  //   const timeScale = this.chart.timeScale();
  //   const logicalRange = timeScale.getVisibleLogicalRange();
  //   if (!logicalRange) return;

  //   const from = Math.max(0, Math.floor(logicalRange.from));
  //   const to = Math.min(this._data.length - 1, Math.ceil(logicalRange.to));

  //   const visibleData = (this._data as LinePoint[]).slice(from, to + 1);
  //   if (!visibleData.length) return;

  //   let max = visibleData[0];
  //   let min = visibleData[0];

  //   for (const item of visibleData) {
  //     if (item.value > max.value) max = item;
  //     if (item.value < min.value) min = item;
  //   }

  //   // 转换为坐标
  //   const maxX = timeScale.timeToCoordinate(max.time as UTCTimestamp);
  //   const minX = timeScale.timeToCoordinate(min.time as UTCTimestamp);

  //   const maxY = this.series[0].priceToCoordinate(max.value);
  //   const minY = this.series[0].priceToCoordinate(min.value);

  //   if (maxX == null || maxY == null || minX == null || minY == null) return;

  //   // 更新 DOM
  //   this._maxLabel.style.left = `${maxX}px`;
  //   this._maxLabel.style.top = `${maxY}px`;
  //   this._maxLabel.innerText = `$${max.value.toFixed(this._tick)}`;

  //   this._minLabel.style.left = `${minX}px`;
  //   this._minLabel.style.top = `${minY}px`;
  //   this._minLabel.innerText = `$${min.value.toFixed(this._tick)}`;
  // }

  private updateVisibleExtrema() {
    if (!this._data.length || !this._maxLabel || !this._minLabel) return;

    const timeScale = this.chart.timeScale();
    const logicalRange = timeScale.getVisibleLogicalRange();
    if (!logicalRange) return;

    const from = Math.max(0, Math.floor(logicalRange.from));
    const to = Math.min(this._data.length - 1, Math.ceil(logicalRange.to));

    const visibleData = (this._data as LinePoint[]).slice(from, to + 1);
    if (!visibleData.length) return;

    let max = visibleData[0];
    let min = visibleData[0];

    for (const item of visibleData) {
      if (item.value > max.value) max = item;
      if (item.value < min.value) min = item;
    }

    const maxX = timeScale.timeToCoordinate(max.time as UTCTimestamp);
    const minX = timeScale.timeToCoordinate(min.time as UTCTimestamp);
    const maxY = this.series[0].priceToCoordinate(max.value);
    const minY = this.series[0].priceToCoordinate(min.value);

    if (maxX == null || maxY == null || minX == null || minY == null) {
      this._maxLabel.style.display = "none";
      this._minLabel.style.display = "none";
      return;
    }

    const containerWidth = this.chart.chartElement().clientWidth;
    const containerHeight = this.chart.chartElement().clientHeight;
    const padding = 10; // 左右安全距离

    const renderLabel = (
      el: HTMLElement,
      x: number,
      y: number,
      value: number,
      isMax: boolean
    ) => {
      el.style.display = "block";
      el.innerText = `$${value.toFixed(this._tick)}`;

      // 强制取消所有 transform，避免它干扰 left 的定位
      el.style.transform = "none";
      el.style.whiteSpace = "nowrap"; // 确保不换行

      // 立即获取宽度
      const labelWidth = el.offsetWidth;
      const labelHeight = el.offsetHeight;

      // 1. 计算 Left：让标签中心对齐数据点 X 坐标
      let finalLeft = x - labelWidth / 2;

      // 2. 左右边界修正：如果太靠左或太靠右，强行推回容器内
      if (finalLeft < padding) {
        finalLeft = padding;
      } else if (finalLeft + labelWidth > containerWidth - padding) {
        finalLeft = containerWidth - labelWidth - padding;
      }

      // 3. 上下位置确定
      let finalTop = y;
      if (isMax) {
        // 最大值：放在点上方。如果顶到头了(y轴坐标太小)，就放点下方。
        finalTop = y - labelHeight - 4;
        if (finalTop < 2) finalTop = y + 4;
      } else {
        // 最小值：放在点下方。如果到底部了，就放点上方。
        finalTop = y + 4;
        if (finalTop + labelHeight > containerHeight - 20)
          finalTop = y - labelHeight - 4;
      }

      el.style.left = `${finalLeft}px`;
      el.style.top = `${finalTop}px`;
    };

    renderLabel(this._maxLabel, maxX, maxY, max.value, true);
    renderLabel(this._minLabel, minX, minY, min.value, false);
  }
}
