# 🎉 ESCParty – A Eurovision Experience for Everyone

![ESCParty Logo](https://github.com/mamf92/escparty/blob/main/src/assets/escparty-banner.png?raw=true)

**ESCParty** is an interactive web app built for **Eurovision Song Contest fans and party hosts**. It offers fun ways to engage with the contest through games, song discovery, and interactive score sheets.

---

## 📋 Description

ESCParty brings the Eurovision hype to your fingertips. Whether you’re hosting a party or just a fan wanting to engage more deeply with ESC, this app is your one-stop shop.

**Current Features:**
- 🎤 Interactive *Eurovision Quiz* to test your fan knowledge
  - Host a multiplayer quiz for your party at three difficulty levels
  - Participate in a multiplayer quiz
  - Test your own knowledge in a single player quiz

**Upcoming Milestones:**
- 🎶 *Song Discovery* – Explore national final entries and Eurovision finalists – Feature ready by **January 2025**
- 📝 *Score Sheets* for rating songs live during the show – Functionality ready before the **Eurovision final (May 2026)**

---

## ⚙️ Built With
**Frontend:**
- [React.js](https://reactjs.org/)  ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
- [TypeScript](https://www.typescriptlang.org/)  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
- [Vite](https://vitejs.dev/)  ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)

**Backend:** 
- [Firebase](https://firebase.google.com/)  ![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)

**Project Management:** 
- GitHub Projects
- ChatGPT Projects

---

## 🚀 Getting Started

### 🔧 Installing

1. Clone the repo:
```bash
git clone https://github.com/mamf92/escparty.git
```

2. Install dependencies:
```bash
npm install
```
### ▶️ Running the App

Start the local development server:
```bash
npm run dev
```
Open your browser and follow the link provided in your terminal.

### 🔑 Environment variables

Copy `.env.example` to `.env.local` and fill in your Firebase project values. Vite exposes env vars that start with `VITE_`, and this project expects the following keys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)

To use the local Firestore emulator during development, set `VITE_USE_FIREBASE_EMULATOR=true` in your `.env.local` and run the Firebase emulator suite. Do not commit `.env.local` to version control.

Note: the Firestore emulator requires a working Java runtime on your system. If you see the error "Unable to locate a Java Runtime" install a JDK (e.g., from https://adoptium.net/) and ensure `java -version` works. Also authenticate the Firebase CLI with `firebase login` before starting emulators.

Quick emulator start:
```
npm run emulators
```

---

### 🌐 Live Demo

Check out the deployed app here:  
👉 [https://mamf92.github.io/escparty/](https://mamf92.github.io/escparty/)

---

## 👤 Contact

- [LinkedIn – Martin Fischer](https://www.linkedin.com/in/mamf92/)
- [GitHub – @mamf92](https://github.com/mamf92)

---

## 📄 License

© 2025 Martin Fischer. All rights reserved.

This project and its source code are protected under copyright law.  
You may not reproduce, distribute, modify, or use any part of this project or its content without explicit written permission from the author.

---

## 🙏 Acknowledgments

- Inspired by the passion of Eurovision fans
- With inspiration from eurovisionworld.com and the EuroParty app
