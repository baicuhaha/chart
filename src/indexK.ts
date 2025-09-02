import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineData,
  LineSeriesPartialOptions,
  CrosshairMode,
  UTCTimestamp,
  DeepPartial,
  ChartOptions,
  ColorType,
} from 'lightweight-charts';

import { setStyle, formatTimestamp } from './utils/util';
import Il8n from './i18n/index';
import { PartialPriceLine } from './plugins/partial-price-line';
import { OverlayPriceScale } from './plugins/overlay-price-scale';

type ChartType = 'line' | 'depth';

interface LinePoint {
  time: UTCTimestamp;
  value: number;
}

interface DepthPoint {
  price: number;
  bids: number;
  asks: number;
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
  private series: ISeriesApi<'Line'>[] = [];
  private _language: string = 'zh-CN';
  private _toolTip: HTMLElement | null = null;
  private _latestPriceDiv: HTMLElement | null = null;
  private _type: ChartType;
  private _loadMore?: () => void;
  private _loadingMore: boolean = false;
  private _data: LineData[] | DepthPoint[] = [];
  //最后的价格
    private _lastPrice:string | number = ''

  constructor({ type, container, language, loadMore, options = {} }: ChartInitOptions) {
    this._type = type;
    this._language = language || 'zh-CN';
    this._loadMore = loadMore;

    this.chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(13, 12, 34, 0.7)',
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          return date.toLocaleString(this._language, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        },
      },
      crosshair: { mode: CrosshairMode.Normal },
      grid: {
        vertLines: { color: 'rgba(13, 12, 34, 0.05)' },
        horzLines: { color: 'rgba(13, 12, 34, 0.05)' },
      },
      rightPriceScale: { visible: false }, // 隐藏原始右侧坐标
      timeScale: { rightOffset: 20 }, // 默认向左偏移
      ...options.chartOptions,
    });

    this.chart.timeScale().fitContent();

    this.createToolTip(container);
    this.createLatestPriceDiv(container);

    if (this._type === 'line') {
      const lineSeries = this.chart.addSeries(LineSeries, {
        color: 'red',
        lineWidth: 2,
        lineType: 0,   
      topColor: 'rgba(255, 136, 0, 0.3)',   // 填充区域顶部渐变颜色
  bottomColor: 'rgba(255, 0, 0, 0)',  // 填充区域底部渐变颜色
      } as LineSeriesPartialOptions);
      lineSeries.attachPrimitive(new PartialPriceLine());
      lineSeries.attachPrimitive(new OverlayPriceScale({side:"right"}));
      this.series.push(lineSeries);
    }

    if (this._type === 'depth') {
      const bidsSeries = this.chart.addSeries(LineSeries, {
        color: '#28c76f',
        lineWidth: 2,
      });
      const asksSeries = this.chart.addSeries(LineSeries, {
        color: '#ef4444',
        lineWidth: 2,
      });
      // bidsSeries.attachPrimitive(new PartialPriceLine());
      asksSeries.attachPrimitive(new OverlayPriceScale({side:"right"}));
      this.series.push(bidsSeries, asksSeries);
    }

    this.chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
      if (logicalRange && logicalRange.from < 30 && !this._loadingMore) {
        this._loadMore && this._loadMore();
        this._loadingMore = true;
      }
    });

      this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
console.log("拖动------------》")
this.updatePriceDiv(this._lastPrice)
      // this.updatePriceLabelPosition(this._lastPrice);
      });
  }

  public setData(data: LinePoint[] | DepthPoint[]): void {
    this._data = data;
    if (this._type === 'line') {
      this.series[0].setData(data as LineData[]);
      const lastPrice = (data as LinePoint[])[data.length - 1].value;
      this._lastPrice = lastPrice
      this.updatePriceDiv(lastPrice);
    }

    if (this._type === 'depth') {
      const bids = (data as DepthPoint[]).map((d) => ({ time: d.price as any, value: d.bids }));
      const asks = (data as DepthPoint[]).map((d) => ({ time: d.price as any, value: d.asks }));
      this.series[0].setData(bids);
      this.series[1].setData(asks);
      const lastBid = bids[bids.length - 1]?.value ?? 0;
      const lastAsk = asks[asks.length - 1]?.value ?? 0;
      this.updatePriceDiv((lastBid + lastAsk) / 2);
    }
  }

  public update(point: LinePoint | DepthPoint): void {
    if (this._type === 'line') {
      this.series[0].update(point as LineData);

          this._lastPrice = (point as LinePoint).value
      this.updatePriceDiv((point as LinePoint).value);
    }
    if (this._type === 'depth') {
      const d = point as DepthPoint;
      this.series[0].update({ time: d.price as any, value: d.bids });
      this.series[1].update({ time: d.price as any, value: d.asks });
      this.updatePriceDiv((d.bids + d.asks) / 2);
    }
  }

  private createToolTip(container: HTMLElement) {
    const toolTip = document.createElement('div');
    setStyle(toolTip, {
      position: 'absolute',
      display: 'none',
      padding: '6px 8px',
      minWidth: '120px',
      fontSize: '11px',
      background: 'rgba(251,251,251,0.95)',
      borderRadius: '6px',
      zIndex: '1000',
      pointerEvents: 'none',
    });
    this._toolTip = toolTip;
    container.appendChild(toolTip);

    this.chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        toolTip.style.display = 'none';
        return;
      }
      toolTip.style.display = 'block';
      if (this._type === 'line') {
        const p = param.seriesData.get(this.series[0]) as LineData;
        toolTip.innerHTML = `
          <div>${Il8n[this._language].time}: ${formatTimestamp(param.time)}</div>
          <div>${Il8n[this._language].value}: ${p?.value ?? '-'}</div>
        `;
      }
      if (this._type === 'depth') {
        const bids = param.seriesData.get(this.series[0]) as LineData;
        const asks = param.seriesData.get(this.series[1]) as LineData;
        toolTip.innerHTML = `
          <div>${Il8n[this._language].price}: ${param.time}</div>
          <div style="color:#28c76f">Bids: ${bids?.value ?? '-'}</div>
          <div style="color:#ef4444">Asks: ${asks?.value ?? '-'}</div>
        `;
      }
      toolTip.style.left = param.point.x + 10 + 'px';
      toolTip.style.top = param.point.y + 10 + 'px';
    });
  }

  private createLatestPriceDiv(container: HTMLElement) {
    const priceDiv = document.createElement('div');
    setStyle(priceDiv, {
      position: 'absolute',
      right: '7px',
      background: '#fff',
      padding: '2px 6px',
      fontSize: '12px',
      borderRadius: '4px',
      border: '1px solid rgba(13,12,34,1)',
      pointerEvents: 'none',
      zIndex: '10000',
      opacity: '0',
      transform: 'translateY(-50%)',
    });
    this._latestPriceDiv = priceDiv;
    container.appendChild(priceDiv);
  }

  private updatePriceDiv(price: number) {
    if (!this._latestPriceDiv || !this.series[0]) return;
    this._latestPriceDiv.style.opacity = '1';

    let y = this.series[0].priceToCoordinate(price);
    let maxY = 310
      let minY = 18
     if (y !== null) {
           y = Math.min(Math.max(y, minY), maxY);
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
