import { useState, useRef, useEffect } from "react"

function BarcodeScanner() {
  const [barcode, setBarcode] = useState("")
  const [scanHistory, setScanHistory] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    // Focus the hidden input so keyboard events are captured.
    inputRef.current.focus()
    const handleWindowClick = () => {
      inputRef.current.focus()
    }
    window.addEventListener("click", handleWindowClick)

    // Establish a WebSocket connection to the backend.
    const ws = new WebSocket("ws://localhost:8000")
    ws.onopen = () => {
      console.log("Connected to WebSocket server")
    }
    ws.onmessage = (event) => {
      const scannedBarcode = event.data
      console.log("Received from server:", scannedBarcode)
      setScanHistory((prev) => [scannedBarcode, ...prev])
    }
    ws.onerror = (err) => {
      console.error("WebSocket error:", err)
    }
    ws.onclose = () => {
      console.log("WebSocket connection closed")
    }

    return () => {
      window.removeEventListener("click", handleWindowClick)
      ws.close()
    }
  }, [])

  // This handleChange and handleKeyDown are optional for manual entry.
  const handleChange = (e) => {
    setBarcode(e.target.value)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && barcode.trim() !== "") {
      console.log("Manually scanned:", barcode)
      setScanHistory((prev) => [barcode, ...prev])
      setBarcode("")
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Matrix 220 Barcode Scanner</h1>
      {/* Hidden input to capture keyboard focus */}
      <input
        ref={inputRef}
        type="text"
        value={barcode}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={styles.hiddenInput}
        placeholder="Barcode will appear here..."
      />

      <div style={styles.message}>Please scan a barcode...</div>

      <div style={styles.historyBox}>
        <h2 style={styles.historyTitle}>Scan History</h2>
        {scanHistory.length === 0 ? (
          <p style={styles.emptyMessage}>No scan data yet</p>
        ) : (
          <ul style={styles.list}>
            {scanHistory.map((code, index) => (
              <li key={index} style={styles.listItem}>
                <span style={styles.itemNumber}>{index + 1}</span>
                <span style={styles.itemCode}>{code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    textAlign: "center",
    padding: "50px",
    fontFamily: "Arial, sans-serif",
    maxWidth: "800px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
  },
  title: {
    fontSize: "32px",
    marginBottom: "20px",
    color: "#333333",
  },
  message: {
    fontSize: "20px",
    color: "#555555",
    margin: "20px 0",
    fontWeight: "500",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
    pointerEvents: "none",
  },
  historyBox: {
    marginTop: "40px",
    textAlign: "left",
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: "6px",
    padding: "20px",
    boxSizing: "border-box",
  },
  historyTitle: {
    fontSize: "24px",
    marginTop: 0,
    marginBottom: "16px",
    color: "#333333",
  },
  emptyMessage: {
    color: "#888888",
    fontStyle: "italic",
    textAlign: "center",
    padding: "20px 0",
  },
  list: {
    padding: 0,
    listStyle: "none",
    margin: 0,
  },
  listItem: {
    backgroundColor: "#ffffff",
    marginBottom: "8px",
    padding: "12px 16px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  itemNumber: {
    backgroundColor: "#4a90e2",
    color: "white",
    borderRadius: "50%",
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "12px",
    fontSize: "14px",
    fontWeight: "bold",
  },
  itemCode: {
    fontFamily: "monospace",
    fontSize: "16px",
  },
}

export default BarcodeScanner

