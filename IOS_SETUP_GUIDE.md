# 📱 CloudStream for iOS: Setup & Streaming Guide

This guide explains how to run CloudStream and set it up on your mum's iPhone with **zero sideloading, zero certificate expirations, and 100% native iOS feel**.

---

## 🚀 Quick Start (Local Network)

### Step 1: Start the Server
Double-click `start.bat` (on Windows) or run:
```bash
npm start
```
The terminal will display your local IP and print a **QR code**.

### Step 2: Open on iPhone
1. Connect your mum's iPhone to the **same Wi-Fi network**.
2. Open the **iPhone Camera** app and point it at the QR code on your computer screen.
3. Tap the yellow banner to open CloudStream in **Safari**.

### Step 3: Add to iPhone Home Screen (1-Tap Permanent App)
1. At the bottom of Safari, tap the **Share** button <img src="https://upload.wikimedia.org/wikipedia/commons/d/d8/Share_icon_%28iOS%29.svg" width="16" />.
2. Scroll down and select **"Add to Home Screen"** ➕.
3. Tap **"Add"** in the top right.

🎉 **Done!** CloudStream now appears as a native app on her Home Screen with:
- Full screen viewing (no browser URL bars)
- AirPlay to Apple TV & Smart TVs
- Picture-in-Picture mode
- Lock screen media controls with episode artwork

---

## 🌐 24/7 Free Cloud Hosting (No PC Required)

If you don't want to keep your PC on, you can host CloudStream 24/7 for free:

### Option A: Render.com (1-Click Free Hosting)
1. Fork or push the `cloudstream-ios` folder to a GitHub repository.
2. Go to [Render.com](https://render.com) and create a new **Web Service**.
3. Select your repository:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Render will provide a free public URL (e.g. `https://cloudstream-mum.onrender.com`).
5. Open this link on your mum's iPhone and **Add to Home Screen**!

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
