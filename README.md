![Surfing4Fun](https://cdn.discordapp.com/banners/749142414475919420/c644a0faf33aa355463524c3b64512f2.webp?size=1024)

# FastDL Updater Server

This project provides a **FastDL server** with an integrated **live update interface**.  
It automatically **copies** and **compresses** game assets (`materials/`, `sound/`) from your surf and bhop servers, making them ready for Fast Download (FastDL).

---

## Features

- **Web Interface** to monitor progress (`/update`)
- **Real-time compression** of assets (`bzip2`)
- **Skips map files** (`.bsp`) to avoid issues
- **Socket.io live updates** (progress and errors)
- **Enforces throttling** (only one update per minute)

---

## Installation

```bash
# Clone the project
git clone https://github.com/surfing4fun/fastdl.git

# Enter the project folder
cd fastdl

# Install dependencies
npm install
```

---

## Usage

```bash
# Start the server
node index.js
```

The server will start at:  
> `http://localhost:3003`

Then, open the browser at:

> `http://localhost:3003/update`

to access the **FastDL Update Interface**!

---

## How It Works

1. **Assets are copied** from:
   - `../surf/cstrike/materials`
   - `../surf/cstrike/sound`
   - `../bhop/cstrike/materials`
   - `../bhop/cstrike/sound`

2. **Assets are compressed** using `bzip2` (`.bz2` files).

3. **Assets are served statically** at:
   - `http://yourserver.com/surf/...`
   - `http://yourserver.com/bhop/...`

---

## Example Progress Log

```text
Connecting…
--- Starting surf ---
Processing surf/materials
Copied: surf/materials/somefile.vtf
Compressed: surf/materials/somefile.vtf.bz2
Skipping map file: de_dust2.bsp
Finished surf
--- Starting bhop ---
Processing bhop/sound
Copied: bhop/sound/music.ogg
Compressed: bhop/sound/music.ogg.bz2
Finished bhop
All FastDL updates complete
```

If trying to update too soon:

```text
Please wait 42s before running again.
```

---

## Requirements

- Node.js v18+
- `bzip2` installed on the server
- Ports opened for Express server

---

## Notes

- The page at `/update` connects via **Socket.io** to stream real-time logs.
- Only `materials/` and `sound/` folders are compressed — `.bsp` (maps) are ignored.
- **Throttle** ensures stability by allowing only one update per minute.
