# ConnectNow

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen)](https://connect-now-phi.vercel.app/)
[![Vercel](https://img.shields.io/badge/deploy-vercel-black?logo=vercel)](https://vercel.com/unni-t-as-projects/connectnow)
![Status](https://img.shields.io/badge/status-active-blue)

> **ConnectNow** — a modern, responsive platform for connecting users (or teams) quickly. Built with Next.js + TypeScript and Tailwind CSS, deployed on Vercel.

---

## 🚀 Live Demo
**Production:** https://connect-now-phi.vercel.app/

---

## 🖼️ Screenshots

**Home / Dashboard**  
![ConnectNow home](/public/screenshots/connect-now.png)

**Profile / Chat / Actions**  
![ConnectNow details](/public/screenshots/connect-now1.png)

> Tip: screenshots should live at `public/screenshots/` so GitHub renders them correctly.

---

## ✨ Key Features

- Responsive landing and dashboard views
- Profile / user details pages
- Real-time-ish UI flows (chat or connection actions UI placeholders)
- Clean modular UI components using Tailwind CSS
- Accessible components and keyboard-focus friendly controls
- Vercel-deployed with preview environments for pull requests

---

## 🧰 Tech Stack

- Framework: **Next.js (App Router)**  
- Language: **TypeScript**  
- Styling: **Tailwind CSS**  
- Deployment: **Vercel**  
- Optional: API integration via REST/GraphQL, Firebase, Supabase, or custom backend.

---

## ⚙️ Quick Start (Local Development)

> Requirements: Node.js v18+ and npm or yarn

1. Clone
```bash
git clone https://github.com/unnita1235/ConnectNow.git
cd ConnectNow
Install

bash
Copy code
npm install
# or
yarn
Create environment file (if app requires one)

bash
Copy code
cp .env.example .env.local
Start dev server

bash
Copy code
npm run dev
# or
yarn dev
Open http://localhost:3000

🌍 Example .env.example
If your app needs API keys, authentication, or third-party configs, use this template and fill with real values in .env.local:

env
Copy code
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000
Do not commit your .env.local.

🧱 Build & Production
Build and run production locally:

bash
Copy code
npm run build
npm run start
☁️ Deploy to Vercel (exact steps to copy/paste)
Go to https://vercel.com/ → New Project → Import unnita1235/ConnectNow.

Configure environment variables (if any) under Project → Settings → Environment Variables.

Set Build Command: npm run build (default for Next.js) and Output Directory: (leave default).

Click Deploy. Vercel will create preview deployments for branches/PRs and auto-deploy main.

🗂 Project Structure (example)
perl
Copy code
ConnectNow/
├── public/
│   └── screenshots/
│       ├── connect-now.png
│       └── connect-now1.png
├── src/
│   ├── app/            # Next.js App Router pages
│   ├── components/     # Reusable UI components
│   ├── hooks/          # Custom hooks
│   ├── lib/            # API clients, utils
│   └── styles/         # Tailwind/CSS
├── package.json
├── next.config.js
├── tailwind.config.js
└── README.md
📦 NPM Scripts (copy these into your README or verify they exist in package.json)
json
Copy code
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write ."
  }
}
Run:

bash
Copy code
npm run dev
npm run build
npm run start
✅ How to add the screenshots to GitHub (if you haven’t yet)
In GitHub repo UI click Add file → Create new file.

Type public/screenshots/placeholder.txt and commit (this creates the folder).

Open public/screenshots/ then Add file → Upload files and upload:

connect-now.png

connect-now1.png

Commit changes.

Now the images will render in README using the paths above.

📣 Open Graph / Social Preview (optional copy/paste)
Add public/og-image.png (1200×630) and include meta tags in app/head.tsx (or the project's head component):

tsx
Copy code
// app/head.tsx
export default function Head() {
  return (
    <>
      <meta property="og:title" content="ConnectNow — Connect instantly" />
      <meta property="og:description" content="ConnectNow — modern platform to connect users and teams quickly." />
      <meta property="og:image" content="/og-image.png" />
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}
Upload og-image.png and set Social Preview image in GitHub repo Settings → Social preview for a nice link preview.

🤝 Contributing
Fork repository.

Create branch: git checkout -b feat/your-feature.

Commit and push.

Open a Pull Request.

Please follow the existing code style and include clear descriptions in PRs.

🪪 License
This project is licensed under the MIT License — see the LICENSE file.

👤 Author
Unni T A

GitHub: https://github.com/unnita1235

Live demo: https://connect-now-phi.vercel.app/
