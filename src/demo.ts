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
} from './rn/lightweight-charts';
import Il8n from './i18n/index';
import { multipliedBy, dividedBy,formatTimestamp, setStyle} from './utils/util';

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
  private candleSeries:any; // 使用 ISeriesApi 类型
  private _loadMore?: () => void; // 用于加载更多数据的回调函数
  private _loadingMore: boolean = false; // 是否正在加载数据
  private _tick:number = 2; // 精度问题
  private _isInit: boolean = false; // 是否初始化完成
  private _language: string = 'zh-CN'; // 语言设置
  private _showToolTip: boolean = true; // 是否显示tooltip
  private _toolTip:HTMLElement = null
  private _toolTopSpecial:boolean = false  //用来处理 是否拖动了
  private volumeSeries: ISeriesApi<'Histogram'>; // 使用 ISeriesApi 类型

  private _upColor: string = 'rgba(32, 178, 108, 1)'; // 涨色
  private _downColor: string = 'rgba(239, 69, 74, 1)'; // 跌色

  constructor(
    container: HTMLElement,
    loadMore?: () => void,
    language?: string,
    options: {
      height?: number;
      chartOptions?: DeepPartial<ChartOptions>;
    } = {}
  ) {

    this._language = language || 'zh-CN'; // 设置语言
    this._loadMore =  loadMore;

    this.chart = createChart(container, {
      layout: {
        background: { color: '#fff' },
        textColor: 'rgba(13, 12, 34, 0.5)',
      },
      localization: {
        // 设置x周时间格式
        timeFormatter: (time: UTCTimestamp) => {
          const date = new Date(time); // Convert to milliseconds
          const options: Intl.DateTimeFormatOptions = { 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false // Use 24-hour format
          };
          return date.toLocaleString('zh-CN', options).replace(',', '');
        },

      },  
      crosshair: {
        // mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          style:1,
          color: 'rgba(13, 12, 34, 1)',
          labelBackgroundColor: 'rgba(13, 12, 34, 1)',
        
        },
        horzLine: {
          width: 1,
          style:1,
          color: 'rgba(13, 12, 34, 1)',
          labelBackgroundColor: 'rgba(13, 12, 34, 1)',
        },
      },
      grid: {
        vertLines: { color: 'rgba(13, 12, 34, 0.03)' },
        horzLines: { color: 'rgba(13, 12, 34, 0.03)' },
      },
      handleScroll: {
        vertTouchDrag: true,
        horzTouchDrag: true
      },
      handleScale: {
        pinch: true
      },
      timeScale: {
        borderColor: '#fff',
        timeVisible: true,
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time); // Convert to milliseconds
          const options: Intl.DateTimeFormatOptions = { 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false // Use 24-hour format
          };
          return date.toLocaleString('zh-CN', options).replace(',', '');
        },
        secondsVisible: false,
          rightOffset: 5,
          barSpacing: 6,
    
     
      },
   
      rightPriceScale: {
        borderColor: '#fff', // Y轴边框线颜色
      },
      ...options.chartOptions,
    });




 


    // 使用 addSeries 方法来添加蜡烛图和体积图
    this.candleSeries = this.chart.addSeries(CandlestickSeries,{
         
          upColor: this._upColor,
          // borderDownColor: this._downColor,
          wickUpColor: this._upColor,
          wickDownColor: this._downColor,
          downColor:this._downColor,

         

          
        });
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
          priceFormat: {
              type: 'volume',
          },
          priceScaleId: '', // set as an overlay by setting a blank priceScaleId
      });


      this.candleSeries.priceScale().applyOptions({
        // set the positioning of the volume series
        scaleMargins: {
          top: 0.1,     // 距离顶部
          bottom: 0.1   // 给 volume 留出空间
        },
    });

      this.volumeSeries.priceScale().applyOptions({
        // set the positioning of the volume series
        scaleMargins: {
            top: 0.9, // highest point of the series will be 70% away from the top
            bottom: 0,
        },
    });
 
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
      // 最左侧的数据距离用户拖拽后的起点位置如果小于30个数据单位, 则发起请求加载更早的数据
      // this.setMaxAndMinPrice(); // 设置最大最小价格标记
      if (logicalRange.from < 30  && !this._loadingMore && this._isInit) {
        // console.log('logicalRange', logicalRange);
        this._loadMore && this._loadMore();
        this._loadingMore = true; // 设置加载状态为true
      }
    
      if(this._toolTopSpecial) {
        //拖动的时候 去掉十字线 和 tooltip
        // this._toolTip.remove(); 
        this.chart.clearCrosshairPosition()
        this._showToolTip = true
        this._toolTip.style.display = 'none'
      }

      // this._toolTip.remove(); 
    })
    this.chart.timeScale().fitContent();
  
    this.createToolTip(container)
  

     
  }

  /**
   * 设置历史数据
   */
  public setData(data:any[],priceDecimal?:number): void {
   
      this._isInit = true; // 设置初始化完成标志
    const candleData: CandlestickData[] = data.map((item,index )=> ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      turnover:item.turnover,
      volume: item.volume,
    }));

    const volumeData: HistogramData[] = data.map(item => ({
      time: item.time,
      value: item.volume,
      color: item.close > item.open ? this._upColor : this._downColor,
    }));
    this._data = candleData; // 保存数据

    let tick = String(priceDecimal).indexOf('.') == -1 ? 0 : String(priceDecimal).length - 2  
    this._tick = tick|| 2; // 设置小数点位数

    console.log('setData-----priceDecimal---->', candleData[0]);
    this.candleSeries.applyOptions({
      // 示例：保留两位小数
      priceFormat: {
        type: 'custom',
        formatter: (price:any) => {
          return price.toFixed(this._tick )
        },
      }
    });

   

    this.candleSeries.setData(candleData);
    this.volumeSeries.setData(volumeData);

    // 生成标记（最高价 + 最低价）
    const markers = candleData.flatMap((bar) => [
      {
        time: bar.time,
        position: 'aboveBar',
        color: 'red',
        shape: 'circle',
        text: `H: ${bar.high}`,
      },
      {
        time: bar.time,
        position: 'belowBar',
        color: 'green',
        shape: 'circle',
        text: `L: ${bar.low}`,
      },
    ]);

    try {
      this.candleSeries.setMarkers(markers);
    } catch(err){
      console.log("err--------->",err)
    }
    
   


  }

  /**
   * 追加新数据
   */
  public update(bar: KLineBar): void {
    if(! this._isInit) return; // 如果没有初始化完成，则不执行更新操作
    const candleItem = {
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      turnover:bar.turnover,
      volume: bar.volume,
    };

    const volumeItem: HistogramData = {
      time: bar.time,
      value: bar.volume,
      color: bar.close > bar.open ? this._upColor : this._downColor,
    };

    this.candleSeries.update(candleItem);
    this.volumeSeries.update(volumeItem);
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
    const newData: CandlestickData[] = newBars.map(item => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      turnover:item.turnover,
      volume: item.volume,
    }));
  
    // ⚠️ 时间早的排前面，确保顺序正确
  

   newData.pop()
  
    this._data = [...newData, ...this._data]

    
    const volumeData: HistogramData[] = this._data.map((item:any )=> ({
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

    const toolTipWidth = 200 // tooltip宽度
    const toolTipHeight = 200 // tooltip高度
    const toolTipMargin = 0

    // Create and style the tooltip html element
    const toolTip = document.createElement('div')
    if(toolTip){
      setStyle(toolTip, {
        position: 'absolute',
        display: 'none',
        padding: '6px 8px',
        minWidth:"160px",
        boxSizing: 'border-box',
        fontSize: '12px',
        textAlign: 'left',
        zIndex: '1000',
        top: '12px',
        left: '12px',
        pointerEvents: 'none',
        borderRadius: '6px',
        fontFamily: `-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`,
        webkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        background: 'rgba(251, 251, 251, 1)',
      
   
      });
    }
    this._toolTip = toolTip
    container.appendChild(toolTip)


    this.chart.subscribeCrosshairMove(param => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > container.clientHeight
      ) {
       console.log("隐藏-------------------》")
       this._toolTopSpecial = false
      } else {
        console.log("展示-------------------》")
        this._toolTopSpecial = true
      }
      if (!param || !param.time) {
        this.chart.clearCrosshairPosition()
        toolTip.style.display = 'none'
        // this._toolTip.remove()
      }
    });
 

  // update tooltip
  this.chart.subscribeClick((param) => {
    const y = param.point.y
    const dataItem = this._data.find((item) => item.time === param.time)
    if(!dataItem) return; // 如果没有数据，则不执行更新操作
    if (
      param.point === undefined ||
      !param.time ||
      param.point.x < 0 ||
      param.point.x > container.clientWidth ||
      param.point.y < 0 ||
      param.point.y > container.clientHeight
    ) {
      toolTip.style.display = 'none'
    } else {
      if(this._showToolTip){
          toolTip.style.display = 'block'
          const price = this.candleSeries.coordinateToPrice(y);
          this.chart.setCrosshairPosition(
            price,
            dataItem.time,
            this.candleSeries
          );
      }else {
          toolTip.style.display = 'none'
          this.chart.clearCrosshairPosition()
      }

      let range = (Number(dataItem.close) - Number(dataItem.open)).toFixed(this._tick);

      let middleValue = dividedBy(range, dataItem.open) || 0;
      middleValue = multipliedBy(middleValue, 100);

      let rangeRatio = Number(middleValue).toFixed(2) + '%';
      
      this._showToolTip = !this._showToolTip // 切换tooltip显示状态
      toolTip.innerHTML = `<div>
      <div style="display: flex;justify-content: space-between;margin-bottom: 5px;">
        <span style="color:rgba(13, 12, 34, 0.5)">${Il8n[this._language].time}:</span>
        <span>${formatTimestamp(dataItem.time)}</span>
      </div>
       <div style="display: flex;justify-content: space-between;margin-bottom: 5px;">
         <span style="color:rgba(13, 12, 34, 0.5)">${Il8n[this._language].open}:</span>
        <span>${dataItem.open.toFixed(this._tick)}</span>
      </div>
          <div style="display: flex;justify-content: space-between;margin-bottom: 5px;">
         <span style="color:rgba(13, 12, 34, 0.5)">${Il8n[this._language].close}:</span>
        <span>${dataItem.close.toFixed(this._tick)}</span>
      </div>
           <div style="display: flex;justify-content: space-between;margin-bottom: 5px;">
        <span style="color:rgba(13, 12, 34, 0.5)">${Il8n[this._language].low}:</span>
        <span>${dataItem.low.toFixed(this._tick)}</span>
      </div>
        <div style="display: flex;justify-content: space-between;margin-bottom: 5px;">
        <span style="color:rgba(13, 12, 34, 0.5)">${Il8n[this._language].high}:</span>
        <span>${dataItem.high.toFixed(this._tick)}</span>
      </div>

       <div style="display: flex;justify-content: space-between;margin-bottom: 5px;">
        <span style="color:rgba(13, 12, 34, 0.5)">${Il8n[this._language].change}:</span>
        <span>${rangeRatio}</span>
      </div>
      </div>`

 
      let left = param.point.x + toolTipMargin
      if (left > container.clientWidth - toolTipWidth) {
        left = param.point.x - toolTipMargin - toolTipWidth
      }

      let top = y + toolTipMargin
      if (top > container.clientHeight - toolTipHeight) {
        top = y - toolTipHeight - toolTipMargin
      }
      toolTip.style.left = left + 'px'
      toolTip.style.top = top + 'px'


    
    }
  })



  }



 

 


  private setMaxAndMinPrice() {
    // 监听图表可视范围变化，更新标记

  // 通过 getVisibleRange() 获取当前可见时间范围
  const visibleRange = this.chart.timeScale().getVisibleRange();
  if (!visibleRange) return; // 视图还未完全初始化时
  
  // 注意：visibleRange 的 from/to 可能是数字或日期字符串，
  // 这里假设我们用的是秒级数字，所以需要和 candlestickData 中的 time 做对比
  
  // 筛选出在当前可视区间内的数据
  const visibleData = this._data.filter(d => {
    return d.time >= visibleRange.from && d.time <= visibleRange.to;
  });
  
  if (visibleData.length === 0) {
    // 没有数据则清空标记
    this.candleSeries.setMarkers([]);
    return;
  }
  
  // 找出 visibleData 中的最大 high 和最小 low 对应的记录
  let maxItem = visibleData[0];
  let minItem = visibleData[0];
    console.log("visibleData----visibleData---->",visibleData)
  visibleData.forEach(item => {
    if (item.high > maxItem.high) {
      maxItem = item;
    }
    if (item.low < minItem.low) {
      minItem = item;
    }
  });
  
  // 设置标记：最高点标记显示在K线图上方的箭头，最低点标记显示在下方
  this.candleSeries.setMarkers([
    {
      time: maxItem.time,
      position: 'aboveBar',
      color: 'red',
      shape: 'arrowDown',
      text: `最高: ${maxItem.high}`,
    },
    {
      time: minItem.time,
      position: 'belowBar',
      color: 'green',
      shape: 'arrowUp',
      text: `最低: ${minItem.low}`,
    }
  ]);

  }

  private myCrosshairMoveHandler() {
    console.log("移动了-------------》")
  }
 
  
}
