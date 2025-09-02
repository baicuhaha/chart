import  KlineChart from '../index';


declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

let container = document.getElementById("container");


if(container){

  

  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang') || "";   

 
    let kchart = new KlineChart(container,()=>{
      window?.ReactNativeWebView?.postMessage(
        JSON.stringify({ type: "update" })
      );
    },lang)

    //  let kchart = new KlineChart({type:"depth",container,language:lang})

    const logoElement = document.querySelector('a#tv-attr-logo');
    if (logoElement) {
      logoElement.remove();
    }
  
    
       requestAnimationFrame(() => {
                window?.ReactNativeWebView?.postMessage(
                  JSON.stringify({ type: "init" })
                ) // 模拟“渲染完成” 
    });
  
  
      //RN 处理
      // window.addEventListener("message", function (event) {
      //   const data = event.data;
      //   handleNativeData(data);
      // });

      //RN 处理
      let handleMessage = function(event:any) {
        const data = event.data;
        handleNativeData(data);
      }
      window.addEventListener("message", handleMessage); // iOS
      document.addEventListener("message", handleMessage); // Android
   
  
      const handleNativeData = function(res:any) {
          // 更新图表数据的逻辑
          if (isJSON(res)) {
            let { data, type, priceDecimal, dataType } = JSON.parse(res);
  
            if (type === "init") {
  
              kchart.setData(
                data,
                priceDecimal
              )
  
              requestAnimationFrame(() => {
                window?.ReactNativeWebView?.postMessage(
                  JSON.stringify({ type: "onReady" })
                ) // 模拟“渲染完成” 
              });
              
            } else if (type === "update") {
          //  console.log("klineData--------->",data)
              kchart.update(data);
            } else if (type === "updateAddData") {
  
  
            kchart.prependData(data);
          
  
              // kchart.setLas
  
              // 监听数据变化事件
            }
          }else {
            console.log("不是-----")
          }
      }
  
      const isJSON = function (str:any) {
        if (typeof str !== "string") return false;
        try {
          const result = JSON.parse(str);
          return typeof result === "object" && result !== null;
        } catch (e) {
          return false;
        }
      };
 

}