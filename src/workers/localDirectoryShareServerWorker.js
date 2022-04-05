// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const PATH = require('path')
const express = require('express')
const expressServer = express()
const fileUpload = require('express-fileupload')
const serveIndex = require('serve-index')

let selfDistructionTimeout = null

process.on('message', (event) => {
  scheduleSelfTermination()
  if (event.action === 'start-server') {
    serveDirectory(event)   
  }
})

/** Self-distruct the process if it stops receiving reset signals
* from the main process, e.g. if the main process is terminated
* unexpectedly. Otherwise the process will keep hanging in the memory
*/
function scheduleSelfTermination () {
  clearTimeout(selfDistructionTimeout)
  selfDistructionTimeout = setTimeout(() => {
    process.kill()
  }, 15000)
}

function serveDirectory (params) {
  initFTPserver(params)
  initFTPclientFileUpload(params)
}

async function initFTPserver (params) {
  // TODO:
  // Use https://www.npmjs.com/package/express-state
  // To pass dirItems data and generate dirItem nodes freely,
  // instead of using built-in {files} literal provided by serve-index
  // Or use Vue SSR https://ssr.vuejs.org/guide/#using-a-page-template
  // And send rendered on the server side HTML to the client side.
  // const processedHTML = fs.readFileSync(PATH.join(__static, 'server', '/ftp.html'))
  //  .replace('EXPRESS_REPLACE_SERVER_DATA', JSON.stringify(dirItemsData))
  expressServer.use(
    express.static(PATH.join(params.__static, 'server', 'public'))
  )

  expressServer.use(
    '/ftp',
    express.static(params.path, {
      setHeaders: (res, path, stat) => {
        res.set('Content-Disposition', 'inline')
      }
    }),
    serveIndex(params.path, {
      icons: true,
      template: PATH.join(params.__static, 'server', '/ftp.html')
      // template: processedHTML
    })
  )

  expressServer.listen(params.directorySharePort)
}

function initFTPclientFileUpload (params) {
  let {path, utils} = params

  expressServer.use(fileUpload({
    useTempFiles: true,
    tempFileDir: path
  }))

  expressServer.post('/uploaded', (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded')
    }
    // If only 1 file is uploaded, put it into an array
    const uploadedItems = Array.isArray(req.files.items)
      ? req.files.items
      : [req.files.items]

    // Write each uploaded file to storage
    uploadedItems.forEach(item => {
      // Get available names for each item
      item.path = utils.getUniquePath(PATH.join(path, item.name))
      // Write files to storage
      item.mv(item.path, (error) => {
        if (error) {
          return res.status(500).send(error)
        }
        else {
          res.send(
            `
              <style>
                body {
                  margin: 0
                }
                
                button {
                  cursor: pointer;
                  padding: 8px 18px;
                  margin-top: 12px;
                  font-size: 12px;
                  font-weight: 600;
                  letter-spacing: 1px;
                  border-radius: 4px;
                  text-transform: uppercase;
                  color: #bdbdbd;
                  border: 2px solid #bdbdbd;
                  background: transparent;
                }

                .container {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100%;
                  width: 100%;
                  background-color: #37474f;
                  color: #bdbdbd;
                  font-size: 36px;
                }
              </style>
              <div class="container">
                <div>Files were uploaded</div>
                <button onclick="window.location.pathname = '/ftp'">Go back</button>
              </div>
            `
          )
        }
      })
    })
  })
}
