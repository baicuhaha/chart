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

if (container) {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang") || "";
  const type = params.get("type") || "";

  //加载更多
  let loadMore = () => {
    window?.ReactNativeWebView?.postMessage(JSON.stringify({ type: "update" }));
  };

  let kchart = null;

  try {
    console.log("type--------->", type);
    if (type === "depth") {
      kchart = new Echarts({ container, language: lang });
    } else if (type === "Line") {
      kchart = new KlineChartLine({
        type: type,
        container,
        language: lang,
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
        //  console.log("klineData--------->",data)
        kchart.update(data);
      } else if (type === "updateAddData") {
        kchart.prependData(data);
      }
    } else {
      console.log("不是-----");
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
