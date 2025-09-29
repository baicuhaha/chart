import * as echarts from "echarts";
import { setStyle, formatTimestamp } from "./utils/util";
import Il8n from "./i18n/index";
import { PartialPriceLine } from "./plugins/partial-price-line";
import { OverlayPriceScale } from "./plugins/overlay-price-scale";

interface ChartInitOptions {
  container: HTMLElement;
  language?: string;
  options?: {
    height?: number;
  };
}

export default class SimpleChart {
  private _language: string = "zh-CN";
  private chart: any;
  private _option: any;
  private _data: any[];

  constructor({ container, language, options = {} }: ChartInitOptions) {
    this._language = language || "zh-CN";
    // 配置项
    const option = {
      animation: false,
      dataZoom: [
        {
          type: "inside", // 内部缩放（鼠标滚轮/拖动）
          disabled: true, // ⚠️ 禁用放大拖拽
        },
        {
          type: "slider", // 页面滑块
          show: false, // 隐藏
        },
      ],
      tooltip: {
        show: true,
        trigger: "axis",
        confine: true,
        showContent: false,

        axisPointer: {
          type: "line", // 只画单线
          axis: "x", // ⚠️ 关键属性：只作用于 y 轴
          // crossStyle: {
          //   color: "rgba(13, 12, 34, 1)",
          //   width: 1,
          //   type: "dashed",
          // },

          lineStyle: {
            color: "rgba(13, 12, 34, 1)",
            width: 0.5,
            type: "dashed",
          },
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        axisTick: { show: false },
        splitLine: { show: false },
        showMinLabel: false,
        showMaxLabel: false,
        axisLine: {
          lineStyle: {
            color: "#F3F3F4", // ✅ y轴颜色
          },
        },
        axisPointer: {
          label: {
            show: true,
            backgroundColor: "#000", // ✅ 改成黑色背景
            color: "#fff", // 文字颜色（默认白色比较清晰）
            fontSize: 10,
            borderRadius: 2,
          },
        },

        axisLabel: {
          showMinLabel: false,
          showMaxLabel: false,
          fontSize: 10,
          inside: false, // ✅ 数值显示在绘图区里面
          // margin: 30, // ✅ 调整内边距，防止和边框挤一起
          formatter: (value, index) => {
            // console.log("---")
            // alert(this._data.length);

            return value;
            // return index === this._data.length ? "" : value;
          },
        },
      },

      yAxis: {
        type: "value",
        position: "right",
        showMinLabel: false,
        splitLine: { show: false },
        axisTick: { show: false },
        axisLine: {
          lineStyle: {
            color: "rgba(13, 12, 34, 0.05);", // ✅ y轴颜色
          },
        },
        axisPointer: {
          label: {
            show: true,
            backgroundColor: "#000", // ✅ 改成黑色背景
            color: "#fff", // 文字颜色（默认白色比较清晰）
            fontSize: 10,
            borderRadius: 2,
          },
        },
        axisLabel: {
          color: "#868590",
          fontSize: 10,
          inside: true, // ✅ 数值显示在绘图区里面
          formatter: function (val) {
            return val === 0 ? "" : val; // 0 不显示
          },
        },
      },

      series: [
        {
          data: [],
          type: "line",
          symbol: "circle",
          showSymbol: false,
          symbolSize: 6, // 默认大小
          itemStyle: {
            color: "#EB4B6D", // 默认颜色
          },
          smooth: true,
          label: {
            show: true,
            position: "left",
            // distance: 10,
            padding: 8,
            fontSize: 12,
            borderRadius: 4,
            color: "#0D0C22",
            backgroundColor: "rgba(248, 248, 248, 0.9)", // 整体背景色
            formatter: function (params) {
              return [
                `{key|${Il8n[language].price}：}{value|${params.data[0]}}` +
                  "\n",
                `{key|${Il8n[language].amount}：}{value|${Math.round(
                  params.data[1]
                )}}`,
              ].join("\n");
            },
            rich: {
              key: {
                align: "left", // 左对齐
                color: "rgba(13, 12, 34, 0.50)",
                fontSize: 10,
                padding: [0, 8, 0, 0], // key 和 value 之间的间距
              },
              value: {
                align: "right", // 右对齐
                color: "#0D0C22",
                fontSize: 10,
              },
            },
          },
          lineStyle: {
            color: "rgba(235, 75, 109, 1)",
            width: 1,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(
              0,
              0,
              0,
              1, // 上到下渐变
              [
                { offset: 0, color: "rgba(235, 75, 109, 0.3)" }, // 顶部颜色
                { offset: 1, color: "rgba(235, 75, 109, 0)" }, // 底部透明
              ]
            ),
            opacity: 1, // 透明度已经在渐变里设置，可以改为 1
          },
        },
      ],
      grid: {
        left: 0,
        right: 0,
        top: 10,
        bottom: 3.5,
        containLabel: true, // false 表示不为了 label 留空
      },
    };

    this._data = [];

    this._option = option;
    this.chart = echarts.init(container);
    this.chart.setOption(option);

    this.createSellerDiv(container);
  }

  public setData(data: any[]): void {
    this._data = [...this._data, ...data];
    console.log("  this._option----->", this._option);
    this._option.series[0].data = this._data;
    this.chart.setOption(this._option);
  }

  public update(data: any[]): void {
    // alert("更新");
    this._data = [...data];
    // this._data = [...data];
    this._option.series[0].data = this._data;
    this.chart.setOption(
      {
        series: [
          {
            data: this._data,
          },
        ],
        xAxis: this.chart.getOption().xAxis, // 保留原来的 xAxis 配置
      },
      false
    ); // ✅ 第二个参数 false 表示不 merge 坐标系配置
  }

  private createSellerDiv(container: any) {
    let sell = document.getElementById("sell-layer");
    if (sell) {
      sell.style.display = "flex";

      let sellTitle = document.getElementById("sell-layer-title");
      if (sellTitle) {
        sellTitle.innerHTML = Il8n[this._language].seller;
      }

      // sell.innerHTML = `<div style="width:10px;height:10px;background:rgba(235, 75, 109, 1)"/> `;
    }

    // setStyle(sell, {
    //   position: "absolute",
    //   display: "none",
    //   padding: "6px 8px",
    //   minWidth: "120px",
    //   fontSize: "11px",
    //   background: "red",
    //   borderRadius: "6px",
    //   zIndex: "1000",
    //   left: "10px",
    //   top: "10px",
    //   width: "40px",
    //   height: "30px",
    //   pointerEvents: "none",
    // });
    // container.appendChild(sell);
  }
}
