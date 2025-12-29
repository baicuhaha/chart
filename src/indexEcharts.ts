import * as echarts from "echarts";
import { setStyle, formatTimestamp } from "./utils/util";
import Il8n from "./i18n/index";

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
  private _data: any[] = [];
  private _tick: number = 2;

  constructor({ container, language, options = {} }: ChartInitOptions) {
    this._language = language || "zh-CN";
    const currentLang = this._language;

    const option = {
      animation: false,
      dataZoom: [
        { type: "inside", disabled: true },
        { type: "slider", show: false },
      ],
      // --- 核心修改部分：开启 Tooltip 并设置自动翻转位置 ---
      tooltip: {
        show: true,
        trigger: "axis",
        showContent: true, // 开启显示内容
        confine: true, // 限制在容器内
        backgroundColor: "rgba(248, 248, 248, 0.9)", // 匹配你之前的背景色
        borderRadius: 4,
        padding: 8,
        borderWidth: 0,
        extraCssText: "box-shadow: 0 0 8px rgba(0,0,0,0.1);", // 增加微阴影

        // 1. 处理位置自动翻转
        position: function (
          point: any,
          params: any,
          dom: any,
          rect: any,
          size: any
        ) {
          const [x, y] = point;
          const { viewSize, contentSize } = size;
          const [vW, vH] = viewSize;
          const [tW, tH] = contentSize;

          const offsetX = 10;
          const offsetY = 10;

          let left = x + offsetX;
          let top = y - tH / 2; // 默认垂直居中于鼠标

          // 左右判断：如果右侧溢出，则显示在左侧
          if (left + tW > vW) {
            left = x - tW - offsetX;
          }
          // 上下边界修正
          if (top < 0) top = 5;
          if (top + tH > vH) top = vH - tH - 5;

          return [left, top];
        },

        // 2. 还原你之前的 Rich Label 样式
        formatter: (params: any) => {
          const data = params[0].data;
          return `
            <div style="font-size: 10px; color: #0D0C22; line-height: 1.6;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="color: rgba(13, 12, 34, 0.5);">${
                  Il8n[currentLang].price
                }：</span>
                <span style="font-weight: 500; margin-left: 8px;">${
                  data[0]
                }</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: rgba(13, 12, 34, 0.5);">${
                  Il8n[currentLang].amount
                }：</span>
                <span style="font-weight: 500; margin-left: 8px;">${Math.round(
                  data[1]
                )}</span>
              </div>
            </div>
          `;
        },

        axisPointer: {
          type: "line",
          axis: "x",
          lineStyle: {
            color: "rgba(13, 12, 34, 1)",
            width: 0.5,
            type: "dashed",
          },
        },
      },
      xAxis: {
        type: "value",
        scale: true,
        boundaryGap: false,
        axisTick: { show: false },
        splitLine: { show: false },
        showMinLabel: false,
        showMaxLabel: false,
        axisLine: { lineStyle: { color: "#F3F3F4" } },
        axisPointer: {
          label: {
            show: true,
            backgroundColor: "#000",
            color: "#fff",
            fontSize: 10,
            borderRadius: 2,
          },
        },
        min: "dataMin",
        axisLabel: {
          fontSize: 10,
          showMinLabel: true,
          showMaxLabel: true,
          hideOverlap: true,
          inside: false,
          formatter: (value: any) => value,
        },
      },
      yAxis: {
        type: "value",
        position: "right",
        showMinLabel: false,
        splitLine: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(13, 12, 34, 0.05);" } },
        axisPointer: {
          label: {
            show: true,
            backgroundColor: "#000",
            color: "#fff",
            fontSize: 10,
            borderRadius: 2,
          },
        },
        axisLabel: {
          color: "#868590",
          fontSize: 10,
          inside: true,
          formatter: function (val: any) {
            return val === 0 ? "" : val;
          },
        },
      },
      series: [
        {
          data: [],
          type: "line",
          symbol: "circle",
          showSymbol: false,
          symbolSize: 6,
          itemStyle: { color: "#EB4B6D" },
          smooth: true,
          // --- 修改：关闭 series 内的 label，改由 tooltip 实现交互显示 ---
          label: {
            show: false,
          },
          lineStyle: {
            color: "rgba(235, 75, 109, 1)",
            width: 1,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(235, 75, 109, 0.3)" },
              { offset: 1, color: "rgba(235, 75, 109, 0)" },
            ]),
            opacity: 1,
          },
        },
      ],
      grid: {
        left: 0,
        right: 0,
        top: 10,
        bottom: 3.5,
        containLabel: true,
      },
    };

    this._data = [];
    this._option = option;
    this.chart = echarts.init(container);
    this.chart.setOption(option);
    this.createSellerDiv(container);
  }

  public setData(data: any[], priceDecimal?: number): void {
    this._data = [...this._data, ...data];
    this._option.series[0].data = this._data;
    if (priceDecimal) {
      let tick =
        String(priceDecimal).indexOf(".") == -1
          ? 0
          : String(priceDecimal).length - 2;
      this._tick = tick || 2;
    }
    this.chart.setOption(this._option);
  }

  public update(data: any[]): void {
    this._data = [...data];
    this._option.series[0].data = this._data;
    this.chart.setOption(
      {
        series: [{ data: this._data }],
        xAxis: this.chart.getOption().xAxis,
      },
      false
    );
  }

  private createSellerDiv(container: any) {
    let sell = document.getElementById("sell-layer");
    if (sell) {
      sell.style.display = "flex";
      let sellTitle = document.getElementById("sell-layer-title");
      if (sellTitle) {
        sellTitle.innerHTML = Il8n[this._language].seller;
      }
    }
  }
}
