import { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  BarPrice,
  Coordinate,
  IChartApi,
  IPriceFormatter,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";

/*
  Simple price scale overlay primitive
*/

interface RendererData {
  priceFormatter: IPriceFormatter;
  coordinateToPrice: (coordinate: number) => BarPrice | null;
  priceToCoordinate: (price: number) => Coordinate | null;
  options: OverlayPriceScaleOptions;
}

interface Label {
  label: string;
  y: number;
}

const tickSpacing = 40;
const horizontalPadding = 3;
const verticalPadding = 2;
const sideMargin = 10;
const fontSize = 10;
const radius = 4;

class OverlayPriceScaleRenderer implements IPrimitivePaneRenderer {
  _data: RendererData | null = null;

  update(data: RendererData) {
    this._data = data;
  }

  // 兼容性圆角矩形绘制方法
  private _drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useMediaCoordinateSpace((scope) => {
      if (!this._data) return;

      const totalHeight = scope.mediaSize.height;
      const mainChartHeight = totalHeight;
      const labels = this._calculatePriceScale(mainChartHeight, this._data, 0);

      const maxLabelLength = labels.reduce((answer: number, label: Label) => {
        return Math.max(answer, label.label.length);
      }, 0);

      const testLabelForWidth = "".padEnd(maxLabelLength, "0");
      const ctx = scope.context;
      const isLeft = this._data.options.side === "left";

      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const testDimensions = ctx.measureText(testLabelForWidth);
      const width = testDimensions.width;

      const x = isLeft
        ? sideMargin
        : scope.mediaSize.width - sideMargin - (width + horizontalPadding * 2);

      const textX = x + horizontalPadding + Math.round(width / 2);

      labels.forEach((label) => {
        const topY = label.y - fontSize / 2;
        const rectWidth = width + horizontalPadding * 2;
        const rectHeight = fontSize + 2 * verticalPadding;

        // 核心修复：检查并使用兼容绘制逻辑
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, topY, rectWidth, rectHeight, radius);
        } else {
          this._drawRoundedRect(ctx, x, topY, rectWidth, rectHeight, radius);
        }

        ctx.fillStyle = this._data!.options.backgroundColor;
        ctx.fill();

        ctx.fillStyle = this._data!.options.textColor;
        ctx.fillText(label.label, textX, topY + verticalPadding);
      });
    });
  }

  _calculatePriceScale(height: number, data: RendererData, yOffset: number) {
    const yPositions: number[] = [];
    const halfTick = Math.round(tickSpacing / 4);
    let pos = halfTick;
    while (pos <= height - halfTick) {
      yPositions.push(pos + yOffset);
      pos += tickSpacing;
    }

    // 转换 epsilon 为数字，确保 toFixed 不报错
    const epsilon =
      typeof data.options.flatEpsilonRatio === "string"
        ? parseInt(data.options.flatEpsilonRatio, 10)
        : data.options.flatEpsilonRatio;

    const labels = yPositions
      .map((y) => {
        const price = data.coordinateToPrice(y);
        if (price === null) return null;

        // 使用指定的精度格式化价格
        const priceLabel = price.toFixed(epsilon || 2);
        return {
          label: priceLabel,
          y: y,
        };
      })
      .filter((item: Label | null): item is Label => Boolean(item));
    return labels;
  }
}

class OverlayPriceScaleView implements IPrimitivePaneView {
  _renderer: OverlayPriceScaleRenderer;
  constructor() {
    this._renderer = new OverlayPriceScaleRenderer();
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }

  update(data: RendererData) {
    this._renderer.update(data);
  }
}

export interface OverlayPriceScaleOptions {
  textColor: string;
  backgroundColor: string;
  side: "left" | "right";
  flatEpsilonRatio: number | string;
}

const defaultOptions: OverlayPriceScaleOptions = {
  textColor: "#868590",
  backgroundColor: "rgba(255, 255, 255, 0.6)",
  side: "left",
  flatEpsilonRatio: 2,
} as const;

export class OverlayPriceScale implements ISeriesPrimitive<Time> {
  _paneViews: OverlayPriceScaleView[];
  _chart: IChartApi | null = null;
  _series: ISeriesApi<SeriesType> | null = null;
  _requestUpdate?: () => void;
  _options: OverlayPriceScaleOptions;

  constructor(options: Partial<OverlayPriceScaleOptions>) {
    this._options = {
      ...defaultOptions,
      ...options,
    };
    this._paneViews = [new OverlayPriceScaleView()];
  }

  applyOptions(options: Partial<OverlayPriceScaleOptions>) {
    this._options = {
      ...this._options,
      ...options,
    };
    if (this._requestUpdate) this._requestUpdate();
  }

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
  }

  updateAllViews() {
    if (!this._series || !this._chart) return;
    const coordinateToPrice = (coordinate: number): BarPrice | null =>
      this._series!.coordinateToPrice(coordinate);
    const priceToCoordinate = (price: number): Coordinate | null =>
      this._series!.priceToCoordinate(price);
    const priceFormatter = this._series.priceFormatter();
    const options = this._options;
    const data: RendererData = {
      coordinateToPrice,
      priceToCoordinate,
      priceFormatter,
      options,
    };
    this._paneViews.forEach((pw) => pw.update(data));
  }

  paneViews() {
    return this._paneViews;
  }
}
