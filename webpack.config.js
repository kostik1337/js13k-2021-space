const path = require('path');
const webpack = require('webpack');

module.exports = (argc, argv) => {
  return {
    entry: './src/js/index.ts',
    module: {
      rules: [
        {
          test: /\.glsl$/,
          use: 'raw-loader',
        },
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        DEBUG_DATA: JSON.stringify(argv.mode != 'production'),
      })
    ],
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
  
    devServer: {
      contentBase: path.join(__dirname, 'dist'),
      compress: false,
      liveReload: false,
      port: 8080,
    },
  
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
  };
}