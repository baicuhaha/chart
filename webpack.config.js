// const appModule = require('./webpack-config/app');
const webModule = require ('./webpack-config/web');
let finalModule = {};
let ENV = process.env.NODE_ENV; //此处变量可由命令行传入
switch (ENV) {
  case 'app':
    // finalModule = appModule;
    break;
  default:
    finalModule = webModule;
    break;
}
module.exports = finalModule;
