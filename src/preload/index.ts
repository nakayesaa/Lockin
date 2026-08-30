import { contextBridge, ipcRenderer } from 'electron';
import { createLockInApi } from './api';

contextBridge.exposeInMainWorld('lockIn', createLockInApi(ipcRenderer));
