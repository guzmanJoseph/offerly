# Offerly

> A modern job application management platform that helps job seekers organize every aspect of their job search in one place.

## Features

-  Track job applications with customizable statuses
-  Gmail integration to automatically import recruiting emails
-  Chrome Extension to save jobs directly from LinkedIn and supported job boards
-  Networking tracker for recruiters, referrals, and alumni
-  Calendar view for interviews and important deadlines
-  Notes and application management
-  Dashboard with job search analytics
-  Secure authentication with Supabase and Google OAuth

---

## Chrome Extension

Offerly includes a Chrome Extension that allows users to save jobs directly from supported job boards with one click.

Current capabilities include:

- Save job title
- Company
- Location
- Job URL
- Automatically sync with your Offerly account

Chrome Web Store:

https://chromewebstore.google.com/detail/fphkldkkmkhefaknadkfekeappojnoji

---

## Tech Stack

### Frontend

- React
- Vite
- React Router
- CSS3

### Backend

- Supabase
- PostgreSQL
- Supabase Authentication
- Google OAuth

### APIs

- Gmail API
- Google OAuth 2.0

### Browser Extension

- Chrome Extension (Manifest V3)

---

## Running Locally

### Clone the repository

```bash
git clone https://github.com/guzmanJoseph/offerly.git
```

Install dependencies

```bash
npm install
```

Create a `.env` file in the project root.

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Run the development server

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

---

## Authentication

Offerly supports:

- Email / Password
- Google Sign In

Google accounts can optionally connect Gmail to automatically import recruiting emails.

---

## Project Structure

```
src/
│
├── applications/
├── dashboard/
├── layout/
├── lib/
├── networking/
├── pages/
├── styles/
├── utils/
│
├── App.jsx
└── main.jsx
```

---

## Privacy

Offerly only accesses Gmail data after the user explicitly grants permission.

The Chrome Extension only reads the currently open job posting when the user chooses to save a job.

Offerly does **not** sell personal data.

---

## Developer

**Joseph Guzman**

University of Florida  
B.S. Computer Science

GitHub:
https://github.com/guzmanJoseph

LinkedIn:
https://www.linkedin.com/in/joseph-guzman-069972246/

Portfolio:
(Add Portfolio URL)
