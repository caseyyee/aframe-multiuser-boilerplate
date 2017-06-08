const http = require('http');
const path = require('path');

const cors = require('cors');
const easyrtc = require('easyrtc');
const express = require('express');
const ip = require('ip');
const socketIo = require('socket.io');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 8080;
const BUILD_DIR = path.join(__dirname, '..', '_build');
const CLIENT_DIR = path.join(__dirname, '..', 'client');

// Set process name.
process.title = 'webvr-smasher';

// Set up and configure Express http server.
// Expect the 'client' directory to be the web root.
const app = express()
  .options('*', cors())
  .use(cors())
  .use('/js/', express.static(BUILD_DIR))
  .use('/', express.static(CLIENT_DIR));

const ENV = app.settings.env || process.env.NODE_ENV || 'development';

// Attach and start the Express http server.
const webServer = http.createServer(app);
webServer.listen(PORT, HOST, () => {
  const serverHost = ENV === 'development' ? 'localhost' : ip.address();
  const serverPort = webServer.address().port;
  console.log('[%s] Listening on %s:%s', ENV, serverHost, serverPort);
});

// Start Socket.io so it attaches itself to the Express server.
const socketServer = socketIo.listen(webServer, {'log level': 1});

const myIceServers = [
  {'url': 'stun:stun.l.google.com:19302'},
  {'url': 'stun:stun1.l.google.com:19302'},
  {'url': 'stun:stun2.l.google.com:19302'},
  {'url': 'stun:stun3.l.google.com:19302'}
  // {
  //   'url': 'turn:[ADDRESS]:[PORT]',
  //   'username': '[USERNAME]',
  //   'credential': '[CREDENTIAL]'
  // },
  // {
  //   'url': 'turn:[ADDRESS]:[PORT][?transport=tcp]',
  //   'username': '[USERNAME]',
  //   'credential': '[CREDENTIAL]'
  // }
];
easyrtc.setOption('appIceServers', myIceServers);
easyrtc.setOption('logLevel', 'debug');
easyrtc.setOption('demosEnable', false);

// Overriding the default easyrtcAuth listener, only so we can directly access its callback
easyrtc.events.on('easyrtcAuth', (socket, easyrtcid, msg, socketCallback, callback) => {
  easyrtc.events.defaultListeners.easyrtcAuth(socket, easyrtcid, msg, socketCallback, (err, connectionObj) => {
    if (err || !msg.msgData || !msg.msgData.credential || !connectionObj) {
      callback(err, connectionObj);
      return;
    }

    connectionObj.setField('credential', msg.msgData.credential, {isShared: false});

    console.log(`[${easyrtcid}] Credential saved: %s`,
      connectionObj.getFieldValueSync('credential'));

    callback(err, connectionObj);
  });
});

// To test, let's print the credential to the console for every room join!
easyrtc.events.on('roomJoin', (connectionObj, roomName, roomParameter, callback) => {
  console.log(`[${connectionObj.getEasyrtcid()}] Credential retrieved: %s`,
    connectionObj.getFieldValueSync('credential'));
  easyrtc.events.defaultListeners.roomJoin(connectionObj, roomName, roomParameter, callback);
});

// Start the EasyRTC server.
easyrtc.listen(app, socketServer, null, (err, rtcRef) => {
  if (err) {
    console.error(err);
    throw err;
  }

  console.log('Successfully initiated EasyRTC server');

  rtcRef.events.on('roomCreate', (appObj, creatorConnectionObj, roomName, roomOptions, callback) => {
    console.log('[roomCreate] Creating room "%s"', roomName);

    appObj.events.defaultListeners.roomCreate(appObj, creatorConnectionObj, roomName, roomOptions, callback);
  });
});
