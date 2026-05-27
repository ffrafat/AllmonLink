# AllmonTouch 📱

**AllmonTouch** is a premium, mobile-first Progressive Web App (PWA) dashboard for monitoring and managing **AllStarLink** nodes. Designed as a modern companion to Allmon3, AllmonTouch features a sleek, high-contrast, Apple-style interface with real-time status updates and smooth animations.

---

## Key Features

- **Apple Glassmorphic & AMOLED Design**: A beautiful, translucent glass design with responsive spring physics. Features a true-black AMOLED theme for night/low-light operations and an elegant ice-white theme for day use.
- **Pulsing Neon Telemetry**: Replaces heavy color banners with dynamic, breathing neon telemetry rings (Green for Active/Idle, Red pulsing for Transmitting, Blue/Cyan for Network/Receive activity).
- **Single-Click Connections**: Instantly connect or disconnect target nodes without navigation delays or repetitive confirmation clicks.
- **Floating Connect Panel**: A swift bottom-sheet popup where you can input node numbers, select from favorites, and request connections.
- **Built-in CLI Console**: Execute standard commands (`rpt cmd`) directly from the device with pre-defined shortcuts and a real-time output console.
- **Installable PWA**: Easily add AllmonTouch to your mobile home screen (iOS Safari or Android Chrome) for a native app-like experience.

---

## Prerequisites

- A Raspberry Pi or Linux system running **AllStarLink (ASL3)**.
- **Allmon3** installed and active.
- A running **Nginx** or **Apache2** web server on the node.

---

## Installation

You can install AllmonTouch automatically on your AllStarLink node. Log in to your node via SSH and run the following single-line installer command:

```bash
curl -sSL https://raw.githubusercontent.com/ffrafat/AllmonLink/main/install.sh | sudo bash
```

The script will automatically:
1. Detect whether you are running Nginx or Apache2.
2. Download and deploy the AllmonTouch web assets to `/usr/share/allmontouch`.
3. Configure the `/allmontouch/` web server alias and restart your web server.
4. Set up convenient CLI shortcuts for future updates and uninstallation.

Once installed, open your mobile browser and navigate to:
```
http://<your-node-ip>/allmontouch/
```
*On iOS/Safari, tap the **Share** button and select **Add to Home Screen**. On Android/Chrome, tap the three dots and select **Install App**.*

---

## Updates

If an update is available (which you'll also be notified of inside the app's update check modal), you can update the system easily by running this command on your terminal:

```bash
sudo allmontouch-update
```

*(This command pulls the latest release directly from GitHub and re-runs the installer configuration).*

---

## Uninstallation

If you ever need to completely remove AllmonTouch, its configurations, and terminal shortcuts from your system, simply run:

```bash
sudo allmontouch-uninstall
```

Confirm the prompt, and the script will cleanly delete the `/usr/share/allmontouch` files, clean up Apache/Nginx aliases, and remove the shortcut helper commands.

---

## Repository & Development

The source repository for this PWA is located at [github.com/ffrafat/AllmonLink](https://github.com/ffrafat/AllmonLink).
Contributions and issue reports are welcome!

---

*AllmonTouch is independent of, but built to work seamlessly alongside, the official AllStarLink Allmon3 suite.*
