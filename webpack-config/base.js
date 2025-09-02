const path = require ('path');
const os = require ('os');

function getIPAddress () {
  const interfaces = os.networkInterfaces ();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (
        alias.family === 'IPv4' &&
        alias.address !== '127.0.0.1' &&
        !alias.internal &&
        !devName.includes ('vEthernet')
      ) {
        return alias.address;
      }
    }
  }
}

module.exports = {
  resolve: {
    extensions: ['.ts', '.js'],
    conditionNames: ['import', 'require', 'node'],
  },
  module: {
    rules: [
      // {
      //   test: /\.ts$/,
      //   loader: 'ts-loader',
      //   exclude: /node_modules/,
      // },

      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-typescript',
              [
                '@babel/preset-env',
                {
                  targets: {
                    android: '6',
                  },
                  useBuiltIns: 'entry',
                  corejs: 3,
                },
              ],
            ],
          },
        },
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|svg)$/,
        type: 'asset', // Webpack 5 内建 asset module 替代 url-loader
        parser: {
          dataUrlCondition: {
            maxSize: 10 * 1024,
          },
        },
      },
      {
        test: /\.m?js$/,
        include: /node_modules\/(lightweight-charts)/, // 👈 关键是加上这一句
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', {targets: {chrome: '60'}}]],
          },
        },
      },
    ],
  },
  performance: {
    hints: false,
  },
  devServer: {
    static: {
      directory: path.join (__dirname, 'src'),
    },
    host: getIPAddress (),
    port: 3019,
    hot: true,
  },
};
