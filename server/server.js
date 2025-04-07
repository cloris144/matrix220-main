"use strict";

// Import NFC module
const { NFC } = require('nfc-pcsc');

// Import other dependencies
const fs = require('fs');
const ffi = require('ffi-napi');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

// Create NFC instance
const nfc = new NFC();

// Create Express app
const app = express();
const port = 3001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Start WebSocket server on port 8000
const wss = new WebSocket.Server({ port: 8000 });

// --- NFC Setup ---
console.log('Waiting for ACR122U reader connection...');

// Listen for reader events
nfc.on('reader', reader => {
    console.log(`${reader.reader.name} reader connected, waiting for card...`);

    // Card placement event
    reader.on('card', async card => {
        if (card.standard === 'TAG_ISO_14443_3') {
            console.log('Test card detected:');
            console.log(`  - UID: ${card.uid}`);
            console.log(`  - Type: ${card.standard}`);
            
            // Send the card UID to all WebSocket clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(`NFC Card UID: ${card.uid}`);
                }
            });
        } else {
            console.log(`Ignoring non-test card: ${card.standard}`);
        }
    });

    // Card removal event
    reader.on('card.off', card => {
        console.log('Card removed');
    });

    // Reader error event
    reader.on('error', err => {
        if (err.message !== 'Cannot process ISO 14443-4 tag because AID was not set.') {
            console.log(`Reader error: ${err.message}`);
        }
    });

    // Reader removal event
    reader.on('end', () => {
        console.log(`Reader removed`);
    });
});

// NFC controller error event
nfc.on('error', err => {
    console.log('NFC error:', err.message);
});

// --- Keyboard Event Capture Setup ---
const devicePath = '/dev/input/event15'; // Adjust to your keyboard device file
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
    2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
    16: 'q', 17: 'w', 18: 'e', 19: 'r', 20: 't', 21: 'y', 22: 'u', 23: 'i', 24: 'o', 25: 'p',
    30: 'a', 31: 's', 32: 'd', 33: 'f', 34: 'g', 35: 'h', 36: 'j', 37: 'k', 38: 'l',
    44: 'z', 45: 'x', 46: 'c', 47: 'v', 48: 'b', 49: 'n', 50: 'm',
    28: 'enter'
  };

  const BUFFER_SIZE = 24; // Size of struct input_event (commonly 24 bytes on 64-bit systems)
  const buffer = Buffer.alloc(BUFFER_SIZE);

  // Decode the input_event from the buffer.
  function decodeEvent(buf) {
    const type = buf.readUInt16LE(16);
    const code = buf.readUInt16LE(18);
    const value = buf.readInt32LE(20);
    return { type, code, value };
  }

  // Get the character for a key press event.
  function getKeyFromEvent(buf) {
    const { type, code, value } = decodeEvent(buf);
    if (type === 1 && value === 1) {
      return keyMap[code] || '';
    }
    return '';
  }

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
          // Send scanned barcode to WebSocket clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(`Scanned barcode: ${barcode}`);
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
  res.send("NFC & Keyboard Scanner Server is running...");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Handle program termination
process.on('SIGINT', () => {
  console.log('Program terminated');
  process.exit();
});
