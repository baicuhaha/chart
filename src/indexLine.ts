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

interface ChartInitOptions {
  type: ChartType;
  container: HTMLElement;
  language?: string;
  loadMore?: () => void;
  options?: {
    height?: number;
    chartOptions?: DeepPartial<ChartOptions>;
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
  private _data: LineData[] | DepthPoint[] = [];
  private _tick: number = 2; // 精度问题
  //最后的价格
  private _lastPrice: string | number = "";

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

    this.chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(13, 12, 34, 0.7)",
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
      crosshair: { mode: CrosshairMode.Normal },
      grid: {
        vertLines: { color: "rgba(13, 12, 34, 0.03)" },
        horzLines: { color: "rgba(13, 12, 34, 0.03)" },
      },
      rightPriceScale: { visible: false }, // 隐藏原始右侧坐标
      // timeScale: { rightOffset: 20, borderColor: "#F3F3F4" }, // 默认向左偏移
      timeScale: {
        borderColor: "rgba(13, 12, 34, 0.07)",
        timeVisible: true,
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000); // Convert to milliseconds
          const options: Intl.DateTimeFormatOptions = {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false, // Use 24-hour format
          };
          return date.toLocaleString(this._language, options).replace(",", "");
        },
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
      },
      ...options.chartOptions,
    });

    this.chart.applyOptions({
      layout: {
        fontSize: 10, // x轴文字大小
      },
    });

    this.chart.timeScale().fitContent();

    this.createToolTip(container);
    this.createLatestPriceDiv(container);

    if (this._type === "Line") {
      const areaSeries = this.chart.addSeries(AreaSeries, {
        lineColor: "#4A7D2F",
        lineWidth: 1,
        lineType: 0,
        topColor: "rgba(74, 125, 47, 0.3)", // 填充区域顶部渐变颜色
        bottomColor: "rgba(74, 125, 47, 0)", // 填充区域底部渐变颜色
      } as DeepPartial<AreaStyleOptions>);
      areaSeries.attachPrimitive(new PartialPriceLine());
      areaSeries.attachPrimitive(
        new OverlayPriceScale({
          side: "right",
          backgroundColor: "rgba(0,0,0,0)",
        })
      );
      this.series.push(areaSeries);
    }

    this.chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((logicalRange) => {
        if (
          logicalRange &&
          logicalRange.from < 30 &&
          !this._loadingMore &&
          this._isInit
        ) {
          this._loadMore && this._loadMore();
          this._loadingMore = true;
        }
      });

    this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      console.log("拖动------------》");
      this.updatePriceDiv(this._lastPrice);
      // this.updatePriceLabelPosition(this._lastPrice);
    });
  }

  public setData(
    data: LinePoint[] | DepthPoint[],
    priceDecimal?: number
  ): void {
    this._isInit = true;
    this._data = data || [];
    console.log("data=========>", data);
    // if (this._type === 'Line') {
    this.series[0].setData(data as LineData[]);

    if (data.length > 0) {
      const lastPrice = (data as LinePoint[])[data.length - 1].value;
      this._lastPrice = lastPrice;

      this.updatePriceDiv(lastPrice);
    }

    if (priceDecimal) {
      let tick =
        String(priceDecimal).indexOf(".") == -1
          ? 0
          : String(priceDecimal).length - 2;
      this._tick = tick || 2; // 设置小数点位数
    }
  }

  public update(point: LinePoint | DepthPoint): void {
    if (!this._isInit) return; // 如果没有初始化完成，则不执行更新操作
    this.series[0].update(point as LineData);

    this._data.push(point);
    this._lastPrice = (point as LinePoint).value;
    this.updatePriceDiv((point as LinePoint).value);
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
      minWidth: "124px",
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
      console.log("ExtendedLineData--------->", dataItem.isPatched);

      let avgPrice = dataItem.isPatched
        ? "--"
        : dataItem?.averagePrice.toFixed(this._tick);

      toolTip.innerHTML = `
        <div style="font-family: Arial, Helvetica, sans-serif;">
      <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
        <span style="color:rgba(13, 12, 34, 0.5); ">${
          Il8n[this._language].time
        }:</span>
        <span>${formatTimestamp(dataItem?.time * 1000)}</span>
      </div>
       <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
         <span style="color:rgba(13, 12, 34, 0.5)">${
           Il8n[this._language].avgPrice
         }</span>
        <span>${avgPrice}</span>
      </div>
        <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
         <span style="color:rgba(13, 12, 34, 0.5)">${
           Il8n[this._language].volume
         }</span>
        <span>${dataItem?.volume.toFixed(this._tick)}</span>
      </div>
        <div style="display: flex; justify-content: space-between;margin-bottom: 5px; align-items:center">
         <span style="color:rgba(13, 12, 34, 0.5)">${
           Il8n[this._language].turnover
         }</span>
        <span>${dataItem?.turnover.toFixed(this._tick)}</span>
      </div>
      </div>
        
        `;

      toolTip.style.left = param.point.x + 10 + "px";
      toolTip.style.top = param.point.y + 10 + "px";
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
}
