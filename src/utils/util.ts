import BigNumber from 'bignumber.js';



type StyleMap = Partial<CSSStyleDeclaration> & {
  [key: string]: string | number | undefined;
};


 // 加法
 export function  add(a: number | string, b: number | string): string {
  if (!b) {
    return a.toString();
  }
  const bigA = new BigNumber(a);
  const result = bigA.plus(b).toString();
  return result;
}

// 减法
export function  minus(a: number | string, b: number | string): string {

  if (!b) {
    return `${a}`.toString();
  }
  const bigA = new BigNumber(a);
  const result = bigA.minus(b).toString();
  return result;
}

// 乘法
export function multipliedBy(a: number | string | null | undefined, b: string | number | null|undefined): string {
  if(!a){
    return '';
  }
  if(!b){
    return '';
  }
  const bigA = new BigNumber(a);
  const result = bigA.multipliedBy(b).toString();
  return result;
}

// 除法
export function  dividedBy(a: number | string | null |undefined, b: number | string|null|undefined): string | null {
  if (!b) {
    return '';
  }
  if(!a) {
    return '';
  }
  const bigA = new BigNumber(a);
  const result = bigA.dividedBy(b).toString();
  return result;
}



export  function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要加1
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}


export  function setStyle(el: HTMLElement, styles: StyleMap) {
  for (const key in styles) {
    if (styles.hasOwnProperty(key) && styles[key] !== undefined) {
      try {
        // 使用类型断言处理非标准属性（如 webkitFontSmoothing）
        (el.style as any)[key] = styles[key];
      } catch (e) {
        console.warn(`无法设置样式 ${key}:`, e);
      }
    }
  }
}


/**
 * 计算简单移动平均线（MA）
 * @param {number[]} volumeArr 成交量数组
 * @param {number} period 计算周期，比如5、10、20
 * @returns {Array<number|null>} 返回对应的移动平均数组，前面不够period个数据的部分返回null
 */
export function calculateMA(volumeArr:any[], period:any) {
  const ma = [];
  for (let i = 0; i < volumeArr.length; i++) {
    if (i < period - 1) {
      // 数据不够，无法计算，返回null占位
      ma.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += volumeArr[j];
    }
    ma.push(sum / period);
  }
  return ma;
}



// 取最后一项的值
export function updateLatestIndicators(kLineData:any[],ma5Data:any[],ma10Data:any[]) {
  const lastIndex = kLineData.length - 1;

  const lastK = kLineData[lastIndex];
  const vol = lastK.volume;
  const ma5 = ma5Data[lastIndex] ?? '-';
  const ma10 = ma10Data[lastIndex] ?? '-';
  return {
    vol:formatAmount(vol),
    ma5:formatAmount(ma5),
    ma10:formatAmount(ma10)
  }
}

export function formatAmount(amount) {
    let formattedAmount;
  if(!amount) {
    return amount
  }
    if (amount < 1000) {
      // Amount < 1000: 直接取整并保留 2 位小数，且不转换单位
      formattedAmount = amount.toFixed(2);
      return `${formattedAmount}`;
    } else if (amount >= 1000 && amount < 1000000) {
      // 1000 <= Amount < 1000000: 转换为 K
      formattedAmount = (amount / 1000).toFixed(2);
      return `${formattedAmount}K`;
    } else if (amount >= 1000000 && amount < 1000000000) {
      // 1000000 <= Amount < 1000000000: 转换为 M
      formattedAmount = (amount / 1000000).toFixed(2);
      return `${formattedAmount}M`;
    } else if (amount >= 1000000000 && amount < 1000000000000) {
      // 1000000000 <= Amount < 1000000000000: 转换为 B
      formattedAmount = (amount / 1000000000).toFixed(2);
      return `${formattedAmount}B`;
    }
  }
