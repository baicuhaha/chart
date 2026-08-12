/*
====================================================
泡泡玛特小程序自动化抢购脚本 (Auto.js 6 适配版)
版本: 1.0.1
适配: Auto.js 6.x / Auto.js Pro
====================================================
*/

// ==================== 【只需修改这里】 ====================
const CONFIG = {
  // 抢购时间 (精确到毫秒，格式必须正确)
  BUY_TIME: '2026-03-10 10:00:00.000',

  // 按钮坐标 (用指针位置获取你手机的实际坐标)
  BUY_BUTTON: {x: 900, y: 1800}, // 「立即抢购」按钮坐标
  SUBMIT_BUTTON: {x: 850, y: 2200}, // 「提交订单」按钮坐标
  CONFIRM_BUTTON: {x: 750, y: 1900}, // 「确认订单/我知道了」按钮坐标

  // 高级配置 (不懂就保持默认)
  OPEN_ADVANCE: 30000, // 提前多少毫秒打开小程序 (默认30秒)
  RETRY_COUNT: 15, // 抢购重试次数 (默认15次)
  CLICK_MIN_DELAY: 50, // 点击最小间隔(毫秒)
  CLICK_MAX_DELAY: 150, // 点击最大间隔(毫秒)
  ANTI_DETECTION: true, // 开启防检测模式 (必须开)
  VIBRATE_ON_SUCCESS: true, // 成功后震动提醒
  SCREENSHOT_ON_SUCCESS: true, // 成功后自动截图
};
// ==========================================================

// 全局变量
let isRunning = true;
let isSuccess = false;

// 启动入口
function main () {
  console.log ('\n🎉 泡泡玛特抢购脚本启动成功');
  console.log (`⏰ 设定抢购时间: ${CONFIG.BUY_TIME}`);

  // 权限检查
  if (!checkPermissions ()) return;

  // 时间计算
  const targetTime = new Date (CONFIG.BUY_TIME).getTime ();
  const nowTime = Date.now ();
  const timeDiff = targetTime - nowTime;

  if (timeDiff < 0) {
    console.error ('❌ 错误：抢购时间已过去，请重新设置');
    exit ();
  }

  console.log (`⌛ 距离抢购还有 ${Math.floor (timeDiff / 1000)} 秒\n`);

  // 提前打开小程序
  if (timeDiff > CONFIG.OPEN_ADVANCE) {
    setTimeout (() => {
      openMiniProgram ();
    }, timeDiff - CONFIG.OPEN_ADVANCE);
  } else {
    openMiniProgram ();
  }

  // 等待到抢购时间
  setTimeout (() => {
    startBuying ();
  }, timeDiff);

  // 监听音量上键停止脚本
  events.onKeyDown ('volume_up', () => {
    toast ('🛑 脚本已手动停止');
    isRunning = false;
    exit ();
  });
}

// 权限检查
function checkPermissions () {
  // 无障碍权限
  if (!auto.service) {
    alert ('❌ 请先开启无障碍服务！');
    return false;
  }

  // 悬浮窗权限 (Auto.js 6 API)
  try {
    if (!floaty.hasPermission ()) {
      toast ('⚠️ 未开启悬浮窗权限，无法显示成功弹窗');
    }
  } catch (e) {
    console.log ('⚠️ 悬浮窗权限检查失败，跳过');
  }

  console.log ('✅ 权限检查通过');
  return true;
}

// 打开泡泡玛特小程序
function openMiniProgram () {
  console.log ('📱 正在打开泡泡玛特小程序...');

  try {
    // 回到桌面
    home ();
    sleep (1000);

    // 打开微信
    launchApp ('微信');
    sleep (2500);

    // 下拉打开小程序列表
    swipe (500, 100, 500, 1000, 300);
    sleep (1000);

    // 点击泡泡玛特小程序 (根据你小程序位置调整坐标)
    click (300, 400);
    sleep (3500);

    console.log ('✅ 小程序已打开，请确保停留在商品详情页');
  } catch (e) {
    console.warn ('⚠️ 自动打开小程序失败，请手动打开');
  }
}

// 开始抢购
function startBuying () {
  if (!isRunning) return;

  console.log ('\n🔥 抢购开始！');
  toast ('开始抢购！');

  for (let i = 0; i < CONFIG.RETRY_COUNT && isRunning && !isSuccess; i++) {
    console.log (`🔄 第 ${i + 1} 次尝试`);

    try {
      // 1. 点击抢购按钮
      clickButton (CONFIG.BUY_BUTTON);

      // 2. 等待页面跳转
      sleep (random (300, 500));

      // 3. 提交订单
      clickButton (CONFIG.SUBMIT_BUTTON);

      // 4. 确认订单
      clickButton (CONFIG.CONFIRM_BUTTON);

      // 5. 检查是否成功
      if (checkSuccess ()) {
        onSuccess ();
        break;
      }

      // 防检测间隔
      if (CONFIG.ANTI_DETECTION) {
        sleep (random (80, 200));
      }
    } catch (e) {
      console.error (`❌ 尝试失败: ${e.message}`);
    }
  }

  if (!isSuccess && isRunning) {
    console.log ('\n❌ 抢购结束，未抢到');
    toast ('抢购结束，未抢到');
    if (CONFIG.VIBRATE_ON_SUCCESS) {
      device.vibrate (500);
    }
  }
}

// 点击按钮（带防检测偏移）
function clickButton (button) {
  if (CONFIG.ANTI_DETECTION) {
    // 随机偏移 ±5 像素，模拟人类点击
    const offsetX = random (-5, 5);
    const offsetY = random (-5, 5);
    click (button.x + offsetX, button.y + offsetY);
  } else {
    click (button.x, button.y);
  }

  sleep (random (CONFIG.CLICK_MIN_DELAY, CONFIG.CLICK_MAX_DELAY));
}

// 检查是否抢购成功
function checkSuccess () {
  // 查找成功关键词
  const payBtn = textContains ('支付').findOne (1000);
  const successText = textContains ('订单提交成功').findOne (500);
  const orderText = textContains ('订单详情').findOne (500);

  if (payBtn || successText || orderText) {
    return true;
  }

  // 查找失败关键词
  const soldOut = textContains ('售罄').findOne (500);
  const noStock = textContains ('库存不足').findOne (500);
  const fail = textContains ('抢购失败').findOne (500);

  if (soldOut || noStock || fail) {
    console.log ('⚠️ 商品已售罄/库存不足');
    return false;
  }

  return false;
}

// 抢购成功回调
function onSuccess () {
  isSuccess = true;
  console.log ('\n🎉 恭喜！抢购成功！请尽快支付');
  toast ('🎉 抢购成功！');

  // 震动提醒 (短-长-短-长-长)
  if (CONFIG.VIBRATE_ON_SUCCESS) {
    device.vibrate ([100, 200, 100, 200, 800]);
  }

  // 悬浮窗提示
  try {
    if (floaty.hasPermission ()) {
      const win = floaty.window (
        <frame
          gravity="center"
          bg="#FF4081"
          alpha="0.9"
          padding="20 16"
          cornerRadius="12"
        >
          <text text="🎉 抢购成功！" textColor="#fff" textSize="22sp" />
        </frame>
      );

      setTimeout (() => {
        win.close ();
      }, 6000);
    }
  } catch (e) {
    console.log ('⚠️ 悬浮窗显示失败');
  }

  // 自动截图保存
  if (CONFIG.SCREENSHOT_ON_SUCCESS) {
    threads.start (() => {
      try {
        const img = captureScreen ();
        const savePath =
          '/sdcard/Pictures/PPMT抢购成功_' + new Date ().getTime () + '.png';
        images.save (img, savePath);
        console.log (`📸 成功截图已保存: ${savePath}`);
      } catch (e) {
        console.log ('⚠️ 截图失败，检查存储权限');
      }
    });
  }

  // 播放提示音
  try {
    media.playMusic ('/system/media/audio/notifications/Argon.ogg', 1, 0);
  } catch (e) {}
}

// 随机数生成
function random (min, max) {
  return Math.floor (Math.random () * (max - min + 1) + min);
}

// 启动脚本
main ();

let str = {
  线上权益签约: '100元',
  双方押金代办: '150元',
  月嫂征信核验: '30元',
  雇主代办保险: '120元',
  平台服务费: '88元',
};

let list = [];
Object.keys (str).forEach (key => {
  list.push ({
    label: key,
    value: str[key],
  });
});
console.log (list);

[
  {
    label: '省心 · 一站式代办权益包',
    value: '488',
    isRecommend: false,
    img: 'home/yuezicombo-488.png',
    select: 'home/yuezicombo-select-488.png',
    desc: [
      {label: '线上权益签约', value: '100元'},
      {label: '双方押金代办', value: '150元'},
      {label: '月嫂征信核验', value: '30元'},
      {label: '雇主代办保险', value: '120元'},
      {label: '平台服务费', value: '88元'},
    ],
  },
  {
    label: '暖心 · 帮面代办全能包',
    value: '888',
    isRecommend: false,
    img: 'home/yuezicombo-888.png',
    select: 'home/yuezicombo-select-888.png',
    desc: [
      {label: '暖心·帮面代办全能包', value: '平台帮面 3次'},
      {label: '简历联系方式', value: '10份'},
      {label: '一站式代办权益包', value: '1分'},
    ],
  },
  {
    label: '安心・众选焕新尊享包',
    value: '999',
    isRecommend: true,
    select: 'home/yuezicombo-select-999.png',
    img: 'home/yuezicombo-999.png',
    desc: [
      {label: '平台帮面', value: '3次'},
      {label: '简历联系方式', value: '10份'},
      {label: '一站式代办权益包', value: '1份'},
      {label: '免费换新', value: '3次'},
    ],
  },
  {
    label: '倾心・无限兜底臻享包',
    value: '1999',
    isRecommend: false,
    img: 'home/yuezicombo-1999.png',
    select: 'home/yuezicombo-select-1999.png',
    desc: [
      {label: '倾心·无限兜底臻享包', value: '平台帮面 3次'},
      {label: '简历联系方式', value: '10份'},
      {label: '一站式代办权益包', value: '1份'},
      {label: '免费换新', value: '不限次数'},
    ],
  },
];

[
  {
    label: '暖心 · 帮面代办全能包',
    value: '888',
    isRecommend: false,
    img: 'home/yuezicombo-888.png',
    select: 'home/yuezicombo-select-888.png',
    desc: [
      {label: '暖心·帮面代办全能包', value: '平台帮面 3次'},
      {label: '简历联系方式', value: '10份'},
      {label: '一站式代办权益包', value: '1分'},
    ],
  },
  {
    label: '安心・众选焕新尊享包',
    value: '999',
    isRecommend: true,
    select: 'home/yuezicombo-select-999.png',
    img: 'home/yuezicombo-999.png',
    desc: [
      {label: '平台帮面', value: '3次'},
      {label: '简历联系方式', value: '10份'},
      {label: '一站式代办权益包', value: '1分'},
      {label: '免费换新', value: '3次'},
    ],
  },
  {
    label: '倾心・无限兜底臻享包',
    value: '1999',
    isRecommend: false,
    img: 'home/yuezicombo-1999.png',
    select: 'home/yuezicombo-select-1999.png',
    desc: [
      {label: '倾心·无限兜底臻享包', value: '平台帮面 3次'},
      {label: '简历联系方式', value: '10份'},
      {label: '一站式代办权益包', value: '1分'},
      {label: '免费换新', value: '不限次数'},
    ],
  },
  {
    label: '省心 · 一站式代办权益包',
    value: '488',
    isRecommend: false,
    img: 'home/yuezicombo-488.png',
    select: 'home/yuezicombo-select-488.png',
    desc: [
      {label: '线上权益签约', value: '100元'},
      {label: '双方押金代办', value: '150元'},
      {label: '月嫂征信核验', value: '30元'},
      {label: '雇主代办保险', value: '120元'},
      {label: '平台服务费', value: '88元'},
    ],
  },
];
