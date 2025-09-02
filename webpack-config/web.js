const webpackMerge = require ('webpack-merge');
const path = require ('path');
const HtmlWebpackPlugin = require ('html-webpack-plugin');
const base = require ('./base');
module.exports = webpackMerge.merge (base, {
  entry: {
    index: './src/rn/index.ts', // 入口文件可以多个
  },
  output: {
    filename: 'index-v1.0.js', // 这里会自动生成index.js
    path: path.resolve ('.', './dist'), // 输出到哪个文件夹
  },
  plugins: [
    new HtmlWebpackPlugin ({
      template: path.join ('.', './src/index.html'), // 指定模板页面
      filename: 'index.html', // 指定要生成的文件名称
    }), // 创建一个在内存中生成html页面插件
  ],
});
