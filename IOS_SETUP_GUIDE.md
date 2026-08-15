# 📱 CloudStream for iOS — Complete Setup Guide

This guide explains how to run CloudStream and set it up on your iPhone with **zero sideloading, zero certificate expirations, and 100% native iOS feel**.

---

## 📱 Quick Setup (Same Wi-Fi Network)

### Step 1: Start the Server
Make sure the server is running on this computer:
```bash
npm start
# or double click start.bat on Windows
```

### Step 2: Open on your iPhone
1. Connect your iPhone to the **same Wi-Fi network**.
2. Open the **iPhone Camera** app and point it at the QR code on your computer screen.
3. Tap the yellow banner to open CloudStream in **Safari**.

### Step 3: Add to iPhone Home Screen (1-Tap Permanent App)
This guide explains how to run CloudStream and set it up on your iPhone with **zero sideloading, zero certificate expirations, and 100% native iOS feel**.

---

## 🚀 Method 1: Local Wi-Fi Quick Access (No Hosting Needed)

1. Connect your iPhone to the **same Wi-Fi network** as this PC.
2. Run `npm start` (or double click `start.bat`).
3. Scan the QR code printed in the terminal or open:
   ```text
   http://192.168.29.153:3000
   ```
4. In Safari, tap **Share** ➔ **"Add to Home Screen"** ➔ **"Add"**.

---

## 🌐 Method 2: Permanent 24/7 Cloud Deployment (Render.com)

1. Push this folder to your GitHub repository.
2. Sign in to [render.com](https://render.com) and create a **Web Service**.
3. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Plan**: Free
4. Render will provide a free public URL (e.g. `https://cloudstream-app.onrender.com`).
5. Open this link on your iPhone and **Add to Home Screen**!

### Option B: Railway / Fly.io / VPS
- Deploy with `npm start` on port `3000` or process environment `PORT`.

---

## ✨ Features Available on iOS
- 🔥 **Catalog**: Trending Movies, TV Series, Anime, Asian Dramas, All-Time Classics.
- 📺 **Multi-Server Streaming**: 6+ redundant streaming sources (VidSrc Pro, VidSrc CC, AutoEmbed, SmashyStream, MoviesAPI, 2Embed).
- 💬 **Subtitles**: Multi-language support (English, Spanish, French, German, Arabic, Hindi, Portuguese).
- 🕒 **Continue Watching**: Automatically saves watch progress down to the second.
- 🔖 **Watchlist / Bookmarks**: Save favorite shows and movies locally.
- 📲 **Native AirPlay & PiP**: Stream to TV or watch while texting.
