import {
  AreaSeries,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import Il8n from "./i18n/index";
import { normalizeLanguage } from "./i18n/index";
import { PartialPriceLine } from "./plugins/partial-price-line";
import { OverlayPriceScale } from "./plugins/overlay-price-scale";

interface LinePoint {
  time: UTCTimestamp;
  value: number;
  volume?: number;
  average?: number;
}

interface Options {
  height?: number;
  width?: number | string;
  isFullScreen?: boolean;
}

interface Params {
  type?: "Line";
  container: HTMLElement;
  language?: string;
  options?: Options;
  loadMore?: () => void;
}

const UP = "#16B978";
const DOWN = "#EB4B6D";
const LINE_SUMMARY_HEIGHT = 64;
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const formatXAxisTime = (time: Time, language: string) => {
  if (typeof time !== "number") return "";
  console.log("time------xx------>", time, language);
  return new Date(time * 1000).toLocaleString(language, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: localTimeZone,
  });
};

/** lightweight-charts 分时图：价格面积线 + 成交量柱 + 十字线。 */
export default class LightweightLineChart {
  private chart: IChartApi;
  private priceSeries: ISeriesApi<"Area">;
  private volumeSeries: ISeriesApi<"Histogram">;
  private data: LinePoint[] = [];
  private summary: HTMLElement | null;
  private latestPriceLabel: HTMLElement | null = null;
  private extremaMarkers: ReturnType<typeof createSeriesMarkers> | null = null;
  private container: HTMLElement;
  private tick = 2;
  private language: string;

  constructor({ container, language, options = {} }: Params) {
    this.language = normalizeLanguage(language);
    this.container = container;
    container.style.position = "relative";
    container.style.height = `${options.height || 380}px`;
    if (options.width != null) {
      container.style.width =
        typeof options.width === "number"
          ? `${options.width}px`
          : options.width;
    }

    // 顶部摘要是外层 DOM，需要给 lightweight-charts 预留独立的绘图区。
    const chartHost = document.createElement("div");
    chartHost.style.position = "absolute";
    chartHost.style.left = "0";
    chartHost.style.right = "0";
    chartHost.style.top = `${LINE_SUMMARY_HEIGHT}px`;
    chartHost.style.bottom = "0";
    chartHost.style.width = "100%";
    chartHost.style.overflow = "hidden";
    container.appendChild(chartHost);

    this.chart = createChart(chartHost, {
      width: options.width ? Number(options.width) : undefined,
      height: Math.max(1, (options.height || 380) - LINE_SUMMARY_HEIGHT),
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(13, 12, 34, .55)",
        fontSize: 11,
      },
      localization: {
        // 与 K 线保持一致：timeFormatter 负责十字线/时间提示的时间格式。
        timeFormatter: (time: UTCTimestamp) =>
          formatXAxisTime(time, this.language).replace(",", ""),
      },
      grid: {
        vertLines: { color: "rgba(13, 12, 34, .06)" },
        horzLines: { color: "rgba(13, 12, 34, .06)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(36, 36, 36, .8)",
          width: 1,
          style: 1,
          labelBackgroundColor: "#242424",
        },
        horzLine: {
          color: "rgba(36, 36, 36, .8)",
          width: 1,
          style: 1,
          labelBackgroundColor: "#242424",
        },
      },
      rightPriceScale: {
        visible: false,
        borderColor: "#fff",
        scaleMargins: { top: 0.12, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "rgba(13, 12, 34, .08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
        tickMarkFormatter: (time: UTCTimestamp) =>
          formatXAxisTime(time, this.language),
      },
    });

    this.priceSeries = this.chart.addSeries(AreaSeries, {
      lineColor: DOWN,
      lineWidth: 2,
      topColor: "rgba(235, 75, 109, .18)",
      bottomColor: "rgba(235, 75, 109, 0)",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    this.priceSeries
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.12, bottom: 0.25 } });
    this.priceSeries.attachPrimitive(
      new OverlayPriceScale({
        side: "right",
        backgroundColor: "rgba(0,0,0,0)",
      }),
    );
    this.priceSeries.attachPrimitive(new PartialPriceLine());
    this.extremaMarkers = createSeriesMarkers(this.priceSeries);

    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    this.volumeSeries
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    this.summary = document.getElementById("summary-layer");
    this.createLatestPriceLabel();
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.updateLatestPriceLabel();
      this.updateVisibleExtrema();
    });

    this.chart.subscribeCrosshairMove((param) => {
      if (!param.time) return;
      const point = this.findPoint(param.time);
      if (point) this.updateSummary(this.data.indexOf(point));
    });
    this.chart.subscribeClick((param) => {
      if (!param.time || !param.point) return;
      const point = this.findPoint(param.time);
      if (!point) return;
      this.chart.setCrosshairPosition(
        point.value,
        point.time,
        this.priceSeries,
      );
      this.updateSummary(this.data.indexOf(point));
    });
  }

  public setData(data: LinePoint[], priceDecimal?: number): void {
    this.data = [...(data || [])].sort(
      (a, b) => Number(a.time) - Number(b.time),
    );
    if (priceDecimal != null) {
      this.tick = Number.isInteger(priceDecimal)
        ? Number(priceDecimal)
        : String(priceDecimal).split(".")[1]?.length || 2;
    }
    this.priceSeries.setData(
      this.data.map((item) => ({
        time: item.time,
        value: item.value,
      })) as LineData<Time>[],
    );
    this.volumeSeries.setData(
      this.data.map((item, index) => ({
        time: item.time,
        value: Number(item.volume) || 0,
        color:
          index === 0 || item.value >= this.data[index - 1].value ? UP : DOWN,
      })),
    );
    // 初始化摘要使用第一条数据，不直接展示最新价格；点击数据点后再切换。
    if (this.data.length) this.updateSummary(0);
    // 保持固定 barSpacing，并让最新数据回到右侧可视区域。
    // scrollToPosition(20) 在当天数据较少时会把整条折线滚出屏幕。
    if (this.data.length > 20) {
      this.chart.timeScale().scrollToPosition(20, false);
    } else {
      this.chart.timeScale().scrollToRealTime();
    }
    this.updateLatestPriceLabel();
    this.updateVisibleExtrema();
  }

  public update(point: LinePoint, dataType?: string): void {
    if (!point) return;
    const last = this.data[this.data.length - 1];
    if (
      dataType === "replace" ||
      (last && String(last.time) === String(point.time))
    ) {
      this.data[this.data.length - 1] = point;
    } else {
      this.data.push(point);
    }
    this.setData(this.data, this.tick);
  }

  public prependData(data: LinePoint[]): void {
    const existing = new Set(this.data.map((item) => String(item.time)));
    const history = (data || []).filter(
      (item) => !existing.has(String(item.time)),
    );
    this.setData([...history, ...this.data], this.tick);
  }

  public replaceLineData(data: LinePoint[]): void {
    this.setData(data, this.tick);
  }

  public getChart(): IChartApi {
    return this.chart;
  }

  private findPoint(time: Time): LinePoint | undefined {
    return this.data.find((item) => String(item.time) === String(time));
  }

  private updateSummary(index: number): void {
    const point = this.data[index];
    if (!this.summary || !point) return;
    const previous = this.data[index - 1];
    const change = previous ? point.value - previous.value : 0;
    const ratio = previous?.value ? (change / previous.value) * 100 : 0;
    const color = change < 0 ? "summary-fall" : "summary-value";
    const average = point.average ?? point.value;
    const time = new Date(Number(point.time) * 1000).toLocaleString(
      this.language,
      {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: localTimeZone,
      },
    );
    this.summary.innerHTML = `
      <div class="summary-row"><span class="summary-time">${time}</span>
        <span class="summary-item ${color}">${point.value.toFixed(this.tick)}</span>
        <span class="summary-item ${color}">${change >= 0 ? "+" : ""}${change.toFixed(this.tick)}</span>
        <span class="summary-item ${color}">${change >= 0 ? "+" : ""}${ratio.toFixed(2)}%</span>
      </div>
      <div class="summary-row"><span class="summary-label">${Il8n[this.language].avgPrice}</span><span class="summary-yellow">${average.toFixed(this.tick)}</span>
        <span class="summary-label" style="margin-left:10px">${Il8n[this.language].volume}</span><span class="summary-fall">${point.volume ?? "--"}</span>
      </div>`;
  }

  private createLatestPriceLabel(): void {
    const label = document.createElement("div");
    label.style.position = "absolute";
    label.style.right = "0px";
    label.style.padding = "2px 6px";
    label.style.background = "#fff";
    label.style.color = "rgba(13, 12, 34, 1)";
    label.style.fontSize = "10px";
    label.style.borderRadius = "4px";
    label.style.pointerEvents = "none";
    label.style.transform = "translateY(-50%)";
    label.style.border = "1px solid rgba(13, 12, 34, 1)";
    label.style.fontFamily = "Arial, Helvetica, sans-serif";
    label.style.zIndex = "10000";
    label.style.opacity = "0";
    label.style.whiteSpace = "nowrap";
    this.latestPriceLabel = label;
    this.container.appendChild(label);
  }

  private updateLatestPriceLabel(): void {
    const latest = this.data[this.data.length - 1];
    if (!this.latestPriceLabel || !latest) return;

    const y = this.priceSeries.priceToCoordinate(latest.value);
    const chartHeight = this.container.clientHeight - LINE_SUMMARY_HEIGHT;
    if (y === null || y < 0 || y > chartHeight) {
      this.latestPriceLabel.style.opacity = "0";
      this.latestPriceLabel.style.top = "-9999px";
      return;
    }

    this.latestPriceLabel.style.opacity = "1";
    this.latestPriceLabel.style.top = `${y + LINE_SUMMARY_HEIGHT}px`;
    this.latestPriceLabel.innerText = latest.value.toFixed(this.tick);
  }

  private updateVisibleExtrema(): void {
    if (!this.data.length || !this.extremaMarkers) return;
    const range = this.chart.timeScale().getVisibleLogicalRange();
    if (!range) return;

    const from = Math.max(0, Math.floor(range.from));
    const to = Math.min(this.data.length - 1, Math.ceil(range.to));
    const visibleData = this.data.slice(from, to + 1);
    if (!visibleData.length) return;

    const max = visibleData.reduce((result, item) =>
      item.value > result.value ? item : result,
    );
    const min = visibleData.reduce((result, item) =>
      item.value < result.value ? item : result,
    );
    this.extremaMarkers.setMarkers(
      max.time === min.time
        ? [
            {
              time: max.time,
              position: "atPriceTop",
              price: max.value,
              shape: "arrowDown",
              color: DOWN,
              size: 1,
              text: max.value.toFixed(this.tick),
            },
          ]
        : [
            {
              time: max.time,
              position: "atPriceTop",
              price: max.value,
              shape: "arrowDown",
              color: DOWN,
              size: 1,
              text: max.value.toFixed(this.tick),
            },
            {
              time: min.time,
              position: "atPriceBottom",
              price: min.value,
              shape: "arrowUp",
              color: UP,
              size: 1,
              text: min.value.toFixed(this.tick),
            },
          ],
    );
  }
}
