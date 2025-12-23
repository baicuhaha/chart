import KlineChartLine from "../indexLine";
import KlineChart from "../index";
import Echarts from "../indexEcharts";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

let container = document.getElementById("container");

const params = new URLSearchParams(window.location.search);
const lang = params.get("lang") || "";
const type = params.get("type") || "";
let height = params.get("height");
let platform = params.get("platform");

let timeout =
  platform === "ios" ? 0 : type === "Line" || type === "depth" ? 1000 : 0;

function init() {
  if (container) {
    //加载更多
    let loadMore = () => {
      window?.ReactNativeWebView?.postMessage(
        JSON.stringify({ type: "update" })
      );
    };

    let kchart = null;

    try {
      console.log("type--------->", type, height);
      if (type === "depth") {
        kchart = new Echarts({ container, language: lang });
      } else if (type === "Line") {
        kchart = new KlineChartLine({
          type: type,
          container,
          language: lang,
          options: {
            height: height,
          },
          loadMore: () => loadMore(),
        });
      } else {
        kchart = new KlineChart(
          container,
          () => {
            window?.ReactNativeWebView?.postMessage(
              JSON.stringify({ type: "update" })
            );
          },
          lang
        );
      }
    } catch (err) {
      console.log("type-----kchart-err--->", err);
    }

    const logoElement = document.querySelector("a#tv-attr-logo");
    if (logoElement) {
      logoElement.remove();
    }

    requestAnimationFrame(() => {
      window?.ReactNativeWebView?.postMessage(JSON.stringify({ type: "init" })); // 模拟“渲染完成”
    });

    //RN 处理
    // window.addEventListener("message", function (event) {
    //   const data = event.data;
    //   handleNativeData(data);
    // });

    //RN 处理
    let handleMessage = function (event: any) {
      const data = event.data;
      handleNativeData(data);
    };
    window.addEventListener("message", handleMessage); // iOS
    document.addEventListener("message", handleMessage); // Android

    const handleNativeData = function (res: any) {
      // 更新图表数据的逻辑
      if (isJSON(res)) {
        let { data, type, priceDecimal, dataType } = JSON.parse(res);
        console.log("data------init---xxxx---->", data, type, priceDecimal);
        if (type === "init") {
          kchart && kchart.setData(data, priceDecimal);
          requestAnimationFrame(() => {
            window?.ReactNativeWebView?.postMessage(
              JSON.stringify({ type: "onReady" })
            ); // 模拟“渲染完成”
          });
        } else if (type === "update") {
          kchart.update(data);
        } else if (type === "updateAddData") {
          kchart.prependData(data);
        }
      } else {
        console.log("不是----1111-");
      }
    };

    const isJSON = function (str: any) {
      if (typeof str !== "string") return false;
      try {
        const result = JSON.parse(str);
        return typeof result === "object" && result !== null;
      } catch (e) {
        return false;
      }
    };
  }
}

// if (platform === "ios") {
//   init();
// } else {
//   setTimeout(() => {
//     init();
//   }, timeout);
// }

/**
 * 启动守卫：隔离安卓与iOS
 */
function bootstrap() {
  const isAndroid = platform !== "ios";
  const isSensitiveType = type === "Line" || type === "depth";

  if (isAndroid && isSensitiveType) {
    // 安卓折线图逻辑：轮询检测容器高度
    // 替代 setTimeout，直到拿到真实高度才初始化
    let retryCount = 0;
    const checkSize = () => {
      const rect = container?.getBoundingClientRect();
      const hasHeight =
        (rect && rect.height > 0) || (container && container.offsetHeight > 0);

      if (hasHeight) {
        console.log("Android container ready, height:", rect?.height);
        init();
      } else if (retryCount < 50) {
        // 最多等待5秒(50 * 100ms)
        retryCount++;
        setTimeout(checkSize, 100);
      } else {
        // 最终保底方案
        init();
      }
    };
    checkSize();
  } else {
    // iOS 或普通K线图：直接执行
    // 建议放在 DOMContentLoaded 后执行更稳妥
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      init();
    } else {
      window.addEventListener("DOMContentLoaded", init);
    }
  }
}

// 执行启动
bootstrap();
