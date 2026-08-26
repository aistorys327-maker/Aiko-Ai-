# 💖 Best Friend AI Chatbot (Gemini + Netlify)

A secure, minimalist dark-mode Chatbot web application designed for fast, empathetic conversations with a deeply emotional, friendly companion persona powered by Google Gemini (`gemini-1.5-flash`) through a secure Netlify serverless function.

---

## 🚀 Quick Deployment Guide (GitHub + Netlify)

### Step 1: Push Code to GitHub
1. Initialize a git repository and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Gemini Chatbot for Netlify"
   ```
2. Create a new repository on [GitHub](https://github.com/new).
3. Link and push your code:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
   git push -u origin main
   ```

---

### Step 2: Deploy to Netlify
1. Go to [Netlify Dashboard](https://app.netlify.com/) and click **"Add new site"** → **"Import an existing project"**.
2. Connect your GitHub account and select your chatbot repository.
3. Netlify will automatically detect the settings from `netlify.toml`:
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
4. Click **"Deploy site"**.

---

### Step 3: Configure `GEMINI_API_KEY` (100% Private)
1. In your Netlify Site dashboard, navigate to **Site configuration** → **Environment variables**.
2. Click **"Add a variable"** → **"Add a single variable"**.
3. Set:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `Your_Actual_Gemini_API_Key` (from [Google AI Studio](https://aistudio.google.com/app/apikey))
4. Click **"Save"**.
5. Trigger a new deploy (**Deploys** → **Trigger deploy** → **Clear cache and deploy site**) so the function picks up the environment variable.

---

## 🔒 Security Architecture
- **Zero Frontend Leaks**: `index.html` contains no API keys or secret credentials.
- **Serverless Proxy**: Frontend calls `/.netlify/functions/chat` which runs `netlify/functions/chat.js` server-side, keeping your Gemini API key protected inside `process.env.GEMINI_API_KEY`.
