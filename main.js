const electron = require('electron');
const path = require("path");
const url = require('url');

process.env.NODE_ENV = 'development';

const { app, BrowserWindow, Menu, ipcMain, ipcRenderer } = electron;

let mainWin;

app.on('ready', function () {
  mainWin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true
    }
  });

  mainWin.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  mainWin.on('closed', function () {
    app.quit();
  });
});

ipcMain.on('#nouveau', function (e, item) {
});
ipcMain.on('#ouvrir', function (e, item) {
});
ipcMain.on('#enregistrer', function (e, item) {
});
ipcMain.on('#enregistrer_sous', function (e, item) {
});
ipcMain.on('#quitter', function (e, item) {
  app.quit();
});

