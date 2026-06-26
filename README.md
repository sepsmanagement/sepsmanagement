# SEPS Management B.V. — Website

Official website for SEPS Management B.V., a premier shipping agency 
representing oil tankers, superyachts, mega yachts, and cargo vessels.

## Files

- `index.html` — Main website (Home, About, Services, Fleet, Contact)
- `dashboard.html` — Private email organizer dashboard (AI-powered)
- `css/style.css` — All styles
- `js/main.js` — Animations, slider, interactions

## Deploy to GitHub Pages (Step by Step)

1. Create a free account at https://github.com
2. Click the **+** icon → **New repository**
3. Name it exactly: `sepsmanagement` (or your domain name)
4. Set to **Public**, click **Create repository**
5. Click **uploading an existing file**
6. Drag ALL these files/folders into the upload area
7. Click **Commit changes**
8. Go to **Settings** → **Pages**
9. Under Source, select **main** branch → **/ (root)** → **Save**
10. Your site will be live at: `https://yourusername.github.io/sepsmanagement`

## Connect your GoDaddy Domain

1. In GitHub Pages settings, add your custom domain (e.g. sepsmanagement.com)
2. Log into GoDaddy → My Products → Domains → Manage DNS
3. Add these DNS records:
   - Type A | Host @ | Points to 185.199.108.153
   - Type A | Host @ | Points to 185.199.109.153
   - Type A | Host @ | Points to 185.199.110.153
   - Type A | Host @ | Points to 185.199.111.153
   - Type CNAME | Host www | Points to yourusername.github.io
4. Wait 10-30 minutes for DNS to propagate
5. Enable **Enforce HTTPS** in GitHub Pages settings ✅

## Updating Your Site

1. Go to your GitHub repository
2. Click the file you want to edit
3. Click the pencil ✏️ icon
4. Make changes → Commit
5. Live in ~60 seconds ✅

## Email Dashboard

Access your private email dashboard at:
`https://yourdomain.com/dashboard.html`

Keep this URL private — share only with your team.

---
Built for SEPS Management B.V. · St. Eustatius, Caribbean Netherlands
