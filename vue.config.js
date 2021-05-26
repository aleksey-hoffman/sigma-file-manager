module.exports = {
  configureWebpack: {
    resolve: {
      // Needed for 'ws' and similar modules
      mainFields: ['main', 'browser']
    },
    output: {
      filename: '[name].bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.worker\.(c|m)?js$/,
          loader: 'worker-loader'
        },
        {
          test: /.node$/,
          loader: 'node-loader'
        }
      ]
    }
  },
  pages: {
    index: {
      entry: 'src/electronRenderer.js'
    }
  },
  pluginOptions: {
    electronBuilder: {
      builderOptions: {
        appId: 'com.alekseyhoffman.sigma-file-manager',
        icon: 'build/icon.png',
        productName: 'Sigma file manager',
        copyright: 'Copyright © 2021 - present Aleksey Hoffman',
        win: {
          target: [
            { target: 'nsis' }
          ]
        },
        nsis: {
          installerIcon: 'build/icon.ico',
          uninstallerIcon: 'build/icon.ico',
          oneClick: true
        },
        linux: {
          target: [
            { target: 'AppImage' }
            // {target: 'snap'}
          ],
          icon: 'build/icon.png',
          category: 'System;FileTools',
          maintainer: 'Aleksey Hoffman'
        },
        mac: {
          // Do not build DMG. Without a certificate (notorization)
          // it will not work on the latest MacOS versions.
          target: 'pkg'
        },
        files: [
          '**/*',
          '!**/resources${/*}',
          '**/resources/${platform}/**',
          '**/resources/media/**'
        ]
      },
      nodeIntegration: true,
      mainProcessFile: 'src/electronMain.js',
      // Files that should trigger process re-build on change.
      mainProcessWatch: [
        './src/utils/downloadManager.js',
        './src/utils/search.js'
      ],
      // Exclude dependencies from the output bundles
      externals: ['chokidar', 'fsevents', 'xxhash-addon'],
      // Webpack config for electron renderer process only
      chainWebpackRendererProcess: (config) => {
        config.plugin('define').tap(args => {
          args[0]['process.env.FLUENTFFMPEG_COV'] = false
          return args
        })
      }
    }
  }
}
