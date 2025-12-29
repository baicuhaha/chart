import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeriesOptions,
  CandlestickSeries,
  isUTCTimestamp,
  HistogramSeries,
  Time,
  CrosshairMode,
  UTCTimestamp,
  CandlestickData,
  HistogramData,
  DeepPartial,
  ChartOptions,
  createSeriesMarkers,
  ColorType,
  IPriceLine,
} from "lightweight-charts";
import Il8n from "./i18n/index";
import {
  formatAmount,
  updateLatestIndicators,
  multipliedBy,
  calculateMA,
  dividedBy,
  formatTimestamp,
  setStyle,
} from "./utils/util";
import { PartialPriceLine } from "./plugins/partial-price-line";

import { OverlayPriceScale } from "./plugins/overlay-price-scale";

interface KLineBar {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  turnover?: number;
}

export default class KLineChart {
  private chart: IChartApi;
  private _data: CandlestickData[] = []; // 存储历史数据
  private candleSeries: any; // 使用 ISeriesApi 类型
  private seriesMarkers: any;
  private _loadMore?: () => void; // 用于加载更多数据的回调函数
  private _loadingMore: boolean = false; // 是否正在加载数据
  private _tick: number = 2; // 精度问题
  private _isInit: boolean = false; // 是否初始化完成
  private _language: string = "zh-CN"; // 语言设置
  private _showToolTip: boolean = true; // 是否显示tooltip
  private _toolTip: HTMLElement = null;
  private _toolTopSpecial: boolean = false; //用来处理 是否拖动了
  private volumeSeries: ISeriesApi<"Histogram">; // 使用 ISeriesApi 类型

  private _upColor: string = "rgba(32, 178, 108, 1)"; // 涨色
  private _downColor: string = "rgba(235, 75, 109, 1)"; // 跌色
  private _latestPriceLine: IPriceLine | null = null; //最新价格线
  //最新价格div
  private _priceDiv: HTMLElement = null;

  private _container: HTMLElement = null;

  private _lastPrice: string | number = "";

  private _ma5Val: any[] = [];
  private _ma10Val: any[] = [];

  private _volumeList: any[] = [];
  constructor(
    container: HTMLElement,
    loadMore?: () => void,
    language?: string,
    options: {
      height?: number;
      chartOptions?: DeepPartial<ChartOptions>;
    } = {}
  ) {
    this._language = language || "zh-CN"; // 设置语言
    this._loadMore = loadMore;
    this._container = container;
    // console.log("十四师-------")
    this.chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(13, 12, 34, 0.5)",
        fontSize: 10,
        // background: { type: 'solid', color: 'transparent' },
      },
      localization: {
        // 设置x周时间格式
        timeFormatter: (time: UTCTimestamp) => {
          const date = new Date(time); // Convert to milliseconds
          const options: Intl.DateTimeFormatOptions = {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false, // Use 24-hour format
          };
          return date.toLocaleString(this._language, options).replace(",", "");
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          style: 1,
          color: "rgba(13, 12, 34, 1)",
          labelBackgroundColor: "rgba(13, 12, 34, 1)",
        },
        horzLine: {
          width: 1,
          style: 1,
          color: "rgba(13, 12, 34, 1)",
          labelBackgroundColor: "rgba(13, 12, 34, 1)",
        },
      },
      grid: {
        vertLines: { color: "rgba(13, 12, 34, 0.03)" },
        horzLines: { color: "rgba(13, 12, 34, 0.03)" },
      },
      handleScroll: {
        vertTouchDrag: true,
        horzTouchDrag: true,
      },
      handleScale: {
        pinch: true,
      },
      timeScale: {
        borderColor: "#fff",
        timeVisible: true,
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time); // Convert to milliseconds
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

      rightPriceScale: {
        visible: false,
        borderColor: "#fff", // Y轴边框线颜色
      },
      ...options.chartOptions,
    });

    // console.log("十四师-------",this.chart)

    // 使用 addSeries 方法来添加蜡烛图和体积图
    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      priceScaleId: "right",
      upColor: this._upColor,
      // borderDownColor: this._downColor,
      wickUpColor: this._upColor,
      wickDownColor: this._downColor,
      downColor: this._downColor,
      lastValueVisible: true,
      // priceLineColor:"rgba(13, 12, 34, 1)"
      //  lastValueVisible: false,
      //   priceLineVisible: false,
      //   priceLineSource: 0,
    });

    this.candleSeries.attachPrimitive(
      new OverlayPriceScale({ side: "right", backgroundColor: "rgba(0,0,0,0)" })
    );

    this.candleSeries.attachPrimitive(new PartialPriceLine());
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      lastValueVisible: false,
      priceLineVisible: false,

      priceScaleId: "volume-scale", // set as an overlay by setting a blank priceScaleId
    });

    this.candleSeries.priceScale().applyOptions({
      // set the positioning of the volume series
      scaleMargins: {
        top: 0.04, // 距离顶部
        bottom: 0.2, // 给 volume 留出空间
      },
    });

    this.volumeSeries.priceScale().applyOptions({
      // set the positioning of the volume series
      visible: true, // 👈 让 Y 轴显示出来
      scaleMargins: {
        top: 0.9, // highest point of the series will be 70% away from the top
        bottom: 0,
      },
    });
    this.seriesMarkers = createSeriesMarkers(this.candleSeries, []);
    this.chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((logicalRange) => {
        // 最左侧的数据距离用户拖拽后的起点位置如果小于30个数据单位, 则发起请求加载更早的数据
        // this.setMaxAndMinPrice(); // 设置最大最小价格标记
        if (
          logicalRange &&
          logicalRange.from < 30 &&
          !this._loadingMore &&
          this._isInit
        ) {
          // console.log('logicalRange', logicalRange);
          this._loadMore && this._loadMore();
          this._loadingMore = true; // 设置加载状态为true
        }

        if (this._toolTopSpecial) {
          //拖动的时候 去掉十字线 和 tooltip
          // this._toolTip.remove();
          this.chart.clearCrosshairPosition();
          this._showToolTip = true;
          this._toolTip.style.display = "none";
        }
        // console.log("logicalRange-------->",logicalRange?.from,logicalRange?.to)
        // this._toolTip.remove();
        // this.setMaxAndMinPrice()
      });

    this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      this.setMaxAndMinPrice();
      this.updatePriceLabelPosition(this._lastPrice);
    });

    this.chart.timeScale().fitContent();

    this.createToolTip(container);

    this.latestPriceDiv(container);
  }

  /**
   * 设置历史数据
   */
  public setData(data: any[], priceDecimal?: number): void {
    // console.log('setData-----setData--开始-->');
    this._isInit = true; // 设置初始化完成标志
    const candleData: CandlestickData[] = data.map((item, index) => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      turnover: item.turnover,
      volume: item.volume,
    }));
    this._volumeList = data.map((item, index) => {
      return item.volume;
    });

    const volumeData: HistogramData[] = data.map((item) => ({
      time: item.time,
      value: item.volume,
      color: item.close > item.open ? this._upColor : this._downColor,
    }));
    this._data = candleData; // 保存数据

    let tick =
      String(priceDecimal).indexOf(".") == -1
        ? 0
        : String(priceDecimal).length - 2;
    this._tick = tick || 2; // 设置小数点位数

    this.candleSeries.applyOptions({
      // 示例：保留两位小数
      priceFormat: {
        type: "custom",
        formatter: (price: any) => {
          return price.toFixed(this._tick);
        },
      },
    });

    this.candleSeries.setData(candleData);
    this.volumeSeries.setData(volumeData);

    this._ma5Val = calculateMA(this._volumeList, 5);
    this._ma10Val = calculateMA(this._volumeList, 10);
    let lastObj = updateLatestIndicators(
      candleData,
      this._ma5Val,
      this._ma10Val
    );
    this.setVOL(lastObj);
    // this.setPriceData()
    console.log("volumeList---->", data[data.length - 1].close);

    this._lastPrice = data[data.length - 1].close;

    requestAnimationFrame(() => {
      this.updatePriceLabelPosition(data[data.length - 1].close);
    });

    this.chart.timeScale().scrollToPosition(20, false);
  }

  /**
   * 追加新数据
   */
  public update(bar: KLineBar): void {
    if (!this._isInit) return; // 如果没有初始化完成，则不执行更新操作
    const candleItem = {
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      turnover: bar.turnover,
      volume: bar.volume,
    };

    const volumeItem: HistogramData = {
      time: bar.time,
      value: bar.volume,
      color: bar.close > bar.open ? this._upColor : this._downColor,
    };
    this._volumeList.push(bar.volume);
    let lastTime = this._data[this._data.length - 1];
    if (lastTime.time === bar.time) {
      this._data[this._data.length - 1] = bar;
    } else {
      this._data.push(bar);
    }
    this._ma5Val = calculateMA(this._volumeList, 5);
    this._ma10Val = calculateMA(this._volumeList, 10);
    let lastObj = updateLatestIndicators(
      this._data,
      this._ma5Val,
      this._ma10Val
    );

    this.candleSeries.update(candleItem);
    this.volumeSeries.update(volumeItem);
    if (this._showToolTip) {
      this.setVOL(lastObj);
    }

    this._lastPrice = bar.close;
    this.updatePriceLabelPosition(bar.close);
  }

  /**
   * 获取底层图表实例（可自定义扩展）
   */
  public getChart(): IChartApi {
    return this.chart;
  }

  /**
   * 追加数据
   */
  public prependData(newBars: KLineBar[]): void {
    const newData: CandlestickData[] = newBars.map((item) => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      turnover: item.turnover,
      volume: item.volume,
    }));

    // ⚠️ 时间早的排前面，确保顺序正确

    newData.pop();

    this._data = [...newData, ...this._data];

    const volumeData: HistogramData[] = this._data.map((item: any) => ({
      time: item.time,
      value: item.volume,
      color: item.close > item.open ? this._upColor : this._downColor,
    }));

    this.candleSeries.setData(this._data);
    this.volumeSeries.setData(volumeData);
    this._loadingMore = false; // 重置加载状态
  }

  /**
   * 创建toolTip
   */
  private createToolTip(container: HTMLElement) {
    const toolTipWidth = 200; // tooltip宽度
    const toolTipHeight = 200; // tooltip高度
    const toolTipMargin = 0;

    // Create and style the tooltip html element
    const toolTip = document.createElement("div");
    if (toolTip) {
      setStyle(toolTip, {
        position: "absolute",
        display: "none",
        padding: "6px 8px",
        minWidth: "160px",
        boxSizing: "border-box",
        fontSize: "11px",
        textAlign: "left",
        zIndex: "1000",
        top: "12px",
        left: "12px",
        pointerEvents: "none",
        borderRadius: "6px",
        // fontFamily: `-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`,
        webkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        background: "rgba(251, 251, 251, 1)",
      });
    }
    this._toolTip = toolTip;
    container.appendChild(toolTip);

    this.chart.subscribeCrosshairMove((param) => {
      this.updatePriceLabelPosition(this._lastPrice);

      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > container.clientHeight
      ) {
        //  console.log("隐藏-------------------》")
        this._toolTopSpecial = false;
      } else {
        // console.log("展示-------------------》")
        this._toolTopSpecial = true;
      }
      if (!param || !param.time) {
        this.chart.clearCrosshairPosition();
        toolTip.style.display = "none";
        // this._toolTip.remove()
      }
    });

    // update tooltip
    this.chart.subscribeClick((param) => {
      const y = param.point.y;
      const dataItem = this._data.find((item) => item.time === param.time);
      if (!dataItem) return; // 如果没有数据，则不执行更新操作
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > container.clientHeight
      ) {
        toolTip.style.display = "none";
      } else {
        if (this._showToolTip) {
          toolTip.style.display = "block";
          const price = this.candleSeries.coordinateToPrice(y);
          this.chart.setCrosshairPosition(
            price,
            dataItem.time,
            this.candleSeries
          );
        } else {
          toolTip.style.display = "none";
          this.chart.clearCrosshairPosition();
        }

        let range = (Number(dataItem.close) - Number(dataItem.open)).toFixed(
          this._tick
        );

        let middleValue = dividedBy(range, dataItem.open) || 0;
        middleValue = multipliedBy(middleValue, 100);

        let rangeRatio = Number(middleValue).toFixed(2) + "%";

        this._showToolTip = !this._showToolTip; // 切换tooltip显示状态

        let rangeRatioColor =
          Number(middleValue) < 0 ? this._downColor : this._upColor;
        let amplitude = dataItem.high
          ? (
              (Math.abs(Number(dataItem.high) - Number(dataItem.low)) /
                Number(dataItem.open)) *
              100
            ).toFixed(2) + "%"
          : "";

        let symbolChar =
          Number(middleValue) == 0 ? "" : Number(middleValue) < 0 ? "" : "+";
        let rangeValue = parseFloat(Number(range).toFixed(this._tick));

        toolTip.innerHTML = `<div style="font-family: Arial, Helvetica, sans-serif;">
      <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
        <span style="color:rgba(13, 12, 34, 0.5)">${
          Il8n[this._language].time
        }:</span>
        <span>${formatTimestamp(dataItem.time)}</span>
      </div>
       <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
         <span style="color:rgba(13, 12, 34, 0.5)">${
           Il8n[this._language].open
         }:</span>
        <span>${dataItem.open.toFixed(this._tick)}</span>
      </div>

           <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
        <span style="color:rgba(13, 12, 34, 0.5)">${
          Il8n[this._language].high
        }:</span>
        <span>${dataItem.high.toFixed(this._tick)}</span>
      </div>

        <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
        <span style="color:rgba(13, 12, 34, 0.5)">${
          Il8n[this._language].low
        }:</span>
        <span>${dataItem.low.toFixed(this._tick)}</span>
      </div>

          <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
         <span style="color:rgba(13, 12, 34, 0.5)">${
           Il8n[this._language].close
         }:</span>
        <span>${dataItem.close.toFixed(this._tick)}</span>
      </div>

      
         
   

       <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
        <span style="color:rgba(13, 12, 34, 0.5)">${
          Il8n[this._language].change
        }:</span>
        <span style="color:${rangeRatioColor}">${symbolChar}${rangeValue}(${symbolChar}${rangeRatio})</span>
      </div>

        <div style="display: flex;justify-content: space-between;margin-bottom: 5px; align-items:center">
         <span style="color:rgba(13, 12, 34, 0.5)">${
           Il8n[this._language].amplitude
         }:</span>
        <span>${amplitude}</span>
      </div>
      </div>`;

        let left = param.point.x + toolTipMargin;
        if (left > container.clientWidth - toolTipWidth) {
          left = param.point.x - toolTipMargin - toolTipWidth;
        }

        let top = y + toolTipMargin;
        if (top > container.clientHeight - toolTipHeight) {
          top = y - toolTipHeight - toolTipMargin;
        }

        toolTip.style.left = left + "px";
        toolTip.style.top = top + "px";

        const idx = this._data.findIndex((item) => item.time === param.time);
        if (idx !== -1 && this._showToolTip) {
          const vol = this._data[idx].volume;
          const ma5Val = this._ma5Val[idx];
          const ma10Val = this._ma10Val[idx];
          this.setVOL({
            vol: formatAmount(vol),
            ma5: formatAmount(ma5Val),
            ma10: formatAmount(ma10Val),
          });
        }
      }
    });
  }

  private setVOL(lastObj: any) {
    // if(lastObj.vol &&lastObj.ma5 && lastObj.ma10 && document.getElementById('ma-label')){
    //    let label =  `
    //     <span style="color:rgba(13, 12, 34, 0.5)">VOLUME:${lastObj.vol}</span>
    //     <span  style="color:rgba(255, 138, 36, 1)">MA5:${lastObj.ma5}</span>
    //     <span  style="color:rgba(134, 85, 177, 1)">MA10:${lastObj.ma10}</span>`
    //       document.getElementById('ma-label').innerHTML = label;
    // }
  }

  private createNewPriceLine(lastPrice: any) {
    if (this._latestPriceLine) {
      this.candleSeries.removePriceLine(this._latestPriceLine);
    }

    this._latestPriceLine = this.candleSeries.createPriceLine({
      type: "line",
      price: lastPrice,
      color: "#FF0000",
      axisLabelVisible: true,
      title: "",
    });
  }

  // private setLastPrice(latestPrice:any) {
  //   this.candleSeries.createPriceLine({
  //     price: latestPrice, // 你的最新价
  //     color: '#28c76f',   // 固定绿色
  //     lineStyle: 2,       // 虚线
  //     lineWidth: 1,
  //     axisLabelVisible: true,
  //     title: '',          // 不显示标题
  //   });
  // }

  private setMaxAndMinPrice() {
    // 监听图表可视范围变化，更新标记

    // 通过 getVisibleRange() 获取当前可见时间范围
    const visibleRange = this.chart.timeScale().getVisibleRange();
    if (!visibleRange) return; // 视图还未完全初始化时

    const visibleData = this._data.filter((d) => {
      return d.time >= visibleRange.from && d.time <= visibleRange.to;
    });
    this.seriesMarkers.setMarkers([]);

    if (visibleData.length === 0) {
      return;
    }

    // 找出 visibleData 中的最大 high 和最小 low 对应的记录
    let maxItem = visibleData[0];
    let minItem = visibleData[0];

    visibleData.forEach((item) => {
      if (item.high > maxItem.high) {
        maxItem = item;
      }
      if (item.low < minItem.low) {
        minItem = item;
      }
    });
    //  console.log("visibleData----visibleData---->",maxItem,minItem)
    // 设置标记：最高点标记显示在K线图上方的箭头，最低点标记显示在下方

    this.seriesMarkers.setMarkers([
      {
        time: maxItem.time,
        position: "aboveBar",
        color: "rgba(13, 12, 34, 1)",

        text: `${maxItem.high}`,
      },
      {
        time: minItem.time,
        position: "belowBar",
        color: "rgba(13, 12, 34, 1)",

        text: `${minItem.low}`,
      },
    ]);
  }

  private setPriceData() {
    this.chart.subscribeCrosshairMove(this.renderCustomPriceScale);
    this.chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange(this.renderCustomPriceScale);
    this.candleSeries
      .priceScale()
      .subscribePriceScaleChanged(this.renderCustomPriceScale);
    setTimeout(this.renderCustomPriceScale, 500); // 首次渲染
  }

  private renderCustomPriceScale() {
    const priceLayer = document.getElementById("price-layer");
    // if(priceLayer) {
    //   priceLayer.innerHTML = '';
    // const ps = this.chart.priceScale('right');
    // const priceRange = ps.priceRange();
    // if (!priceRange) return;

    // const min = priceRange.minValue;
    // const max = priceRange.maxValue;
    // const step = (max - min) / 10;

    // for (let p = min; p <= max; p += step) {
    //   const y = ps.priceToCoordinate(p);
    //   if (y !== null) {
    //     const label = document.createElement('div');
    //     label.className = 'custom-price-label';
    //     label.style.top = `${y - 7}px`;
    //     label.textContent = p.toFixed(2);
    //     priceLayer.appendChild(label);
    //   }
    // }
    // }
  }
  private myCrosshairMoveHandler() {
    console.log("移动了-------------》");
  }

  private latestPriceDiv(container: Element) {
    // 获取最新价格
    const latestPrice = "";

    // 创建自定义 div
    const priceDiv = document.createElement("div");
    priceDiv.innerText = `${latestPrice}`;
    priceDiv.style.position = "absolute";
    priceDiv.style.right = "0px";
    priceDiv.style.padding = "2px 6px";
    priceDiv.style.background = "#fff";
    priceDiv.style.color = "rgba(13, 12, 34, 1)";
    priceDiv.style.fontSize = "10px";
    priceDiv.style.borderRadius = "4px";
    priceDiv.style.pointerEvents = "none";
    priceDiv.style.transform = "translateY(-50%)";
    // priceDiv.style.borderWidth = "1px"
    priceDiv.style.border = "1px solid rgba(13, 12, 34, 1)";
    priceDiv.style.fontFamily = "Arial, Helvetica, sans-serif";
    // priceDiv.style.borderColor='rgba(13, 12, 34, 1)'

    priceDiv.style.zIndex = "10000";
    priceDiv.style.opacity = "0";
    this._priceDiv = priceDiv;
    container.appendChild(priceDiv);
  }
  // 函数：根据价格换算 y 像素位置
  private updatePriceLabelPosition(lastPrice: string | number) {
    this._priceDiv.style.opacity = "1";
    let y = this.candleSeries.priceToCoordinate(lastPrice);

    let maxY = 310;
    let minY = 18;
    if (y !== null) {
      y = Math.min(Math.max(y, minY), maxY);
      this._priceDiv.style.top = `${y}px`;
    } else {
      this._priceDiv.style.top = `-9999px`; // 隐藏
    }

    this._priceDiv.innerHTML = `${lastPrice}`;
  }
}
