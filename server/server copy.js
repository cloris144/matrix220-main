const fs = require('fs');
const ffi = require('ffi-napi');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const port = 3001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Start WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8000 });

// --- Keyboard Event Capture Setup ---
const devicePath = '/dev/input/event7'; // Adjust to your keyboard device file
let fd = null;

try {
  fd = fs.openSync(devicePath, 'r+');
  console.log("Keyboard device opened:", devicePath);
} catch (err) {
  console.error(`Error opening device ${devicePath}. Are you running as root?`, err);
  // Continue to start HTTP/WebSocket servers even if keyboard device is not available.
}
if (fd !== null) {
  // Load libc to access ioctlfrfr
  const libc = ffi.Library('libc', {
    ioctl: ['int', ['int', 'ulong', 'int']],
  });
  const EVIOCGRAB = 0x40044590;
  
  if (libc.ioctl(fd, EVIOCGRAB, 1) !== 0) {
    console.error("Failed to grab the device. It may be in use or you might not have sufficient privileges.");
  } else {
    console.log("Device grabbed successfully. Keyboard events will not affect the OS.");
  }

  // Mapping of Linux key codes to characters (and "enter")
  const keyMap = {
    // Number rowscs9H1
    2: '1',
    3: '2',
    4: '3',
    5: '4',
    6: '5',
    7: '6',
    8: '7',
    9: '8',
    10: '9',
    11: '0',
    // Top alphabet row
    16: 'q',
    17: 'w',
    18: 'e',
    19: 'r',
    20: 't',
    21: 'y',
    22: 'u',
    23: 'i',
    24: 'o',
    25: 'p',
    // Home row
    30: 'a',
    31: 's',
    32: 'd',
    33: 'f',
    34: 'g',
    35: 'h',
    36: 'j',
    37: 'k',
    38: 'l',
    // Bottom row
    44: 'z',
    45: 'x',
    46: 'c',
    47: 'v',
    48: 'b',
    49: 'n',
    50: 'm',
    // Enter key (to signal end of barcode)
    28: 'enter'
  };

  const BUFFER_SIZE = 24; // Size of struct input_event (commonly 24 bytes on 64-bit systems)
  const buffer = Buffer.alloc(BUFFER_SIZE);

  // Decode the input_event from the buffer.
  function decodeEvent(buf) {
    // The structure: 16 bytes timestamp, 2 bytes type, 2 bytes code, 4 bytes value.
    const type = buf.readUInt16LE(16);
    const code = buf.readUInt16LE(18);
    const value = buf.readInt32LE(20);
    return { type, code, value };
  }

  // Get the character for a key press event.
  function getKeyFromEvent(buf) {
    const { type, code, value } = decodeEvent(buf);
    // EV_KEY events (type === 1) with value 1 are key presses.
    if (type === 1 && value === 1) {
      return keyMap[code] || '';
    }
    return '';
  }

  // Barcode accumulator
  let barcode = '';

  // Continuously read and process keyboard events.
  function readEvent() {
    fs.read(fd, buffer, 0, BUFFER_SIZE, null, (err, bytesRead) => {
      if (err || bytesRead <= 0) {
        setImmediate(readEvent);
        return;
      }
      const key = getKeyFromEvent(buffer);
      if (key) {
        if (key === 'enter') {
          // When Enter is pressed, send the accumulated barcode to all WebSocket clients.
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(barcode);
            }
          });
          console.log('Scanned barcode:', barcode);
          barcode = ''; // Reset for the next scan.
        } else {
          barcode += key;
        }
      }
      setImmediate(readEvent);
    });
  }

  readEvent();
}

// --- Express HTTP Server Setup ---
app.get("/", (req, res) => {
  res.send("Keyboard Scanner Server is running...");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

