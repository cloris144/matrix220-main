const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const net = require('net');

// 初始化 Express 應用
const app = express();
const httpPort = 3001;

// 啟用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json());

// 啟動 WebSocket 伺服器（端口 8000）
const wss = new WebSocket.Server({ port: 8000 });
console.log('WebSocket server running on ws://localhost:8000');

// 啟動 TCP 伺服器（端口 3002）接收 Matrix 120 的數據
const tcpPort = 3002;
const tcpServer = net.createServer((socket) => {
  console.log('Matrix 120 connected from:', socket.remoteAddress);
  
  let barcode = ''; // 儲存條碼數據

  // 監聽 Matrix 120 發來的數據
  socket.on('data', (data) => {
    barcode += data.toString();

    // 假設 Matrix 120 以換行符 '\n' 結束每次掃描數據
    if (barcode.includes('\n')) {
      const trimmedBarcode = barcode.trim();
      console.log('Received barcode from Matrix 120:', trimmedBarcode);

      // 將條碼數據發送給所有 WebSocket 客戶端
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(trimmedBarcode);
        }
      });

      barcode = ''; // 重置條碼緩衝區
    }
  });

  // 當 Matrix 120 斷開連接時
  socket.on('end', () => {
    console.log('Matrix 120 disconnected');
  });

  // 處理錯誤
  socket.on('error', (err) => {
    console.error('TCP socket error:', err.message);
  });
});

// 啟動 TCP 伺服器
tcpServer.listen(tcpPort, () => {
  console.log(`TCP server running on port ${tcpPort}`);
});

// Express HTTP 路由
app.get('/', (req, res) => {
  res.send('Matrix 120 TCP Server is running...');
});

// 啟動 Express 伺服器
app.listen(httpPort, () => {
  console.log(`HTTP server running at http://localhost:${httpPort}`);
});