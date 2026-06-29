# LivePoll 🚀

LivePoll is a premium, real-time polling application featuring a live voter interface, an administrative control panel, secure authentication, and database-backed voting protections. 

The application is styled with a custom dark-theme glassmorphism design system using pure Vanilla CSS.

---

## 🌟 Features

### 1. User Polling Interface
- **Active Poll Card**: Displays the current live poll question and available choices.
- **Real-Time Results**: Instantly animates progress bars and shows voting percentages as soon as the user votes.
- **Double-Voting Prevention**: Locks the user session server-side to prevent double-voting, surviving page refreshes or device switching.

### 2. Admin Dashboard Panel
- **Dynamic Poll Creator**: Add or remove options on-the-fly (supporting 2 to 8 options) before launching.
- **Active Live Monitor**: View incoming votes, percentages, and total turnouts live.
- **Archive Controls**: "End and Archive" the active poll, which locks the results and moves the poll to the historical log.
- **History Manager**: Delete old polls from the archive.

### 3. Secure Authentication
- **Role-Based Auth**: Distinct User (Voter) and Admin registration and sign-in.
- **JWT Protection**: Secure API endpoints (`POST`, `PUT`, `DELETE` operations on polls) requiring a verified admin JSON Web Token in headers.
- **Passcode Protection**: Admin registration is restricted behind an Admin Secret Code (default: `admin123`).

### 4. Archive & Winners Leaderboard
- **Past Results**: View historical logs of all completed polls.
- **Winners Wall**: A dedicated leaderboard sub-tab that highlights winning choices, turnout volumes, and victory percentages.

### 5. Resilient Database Layer
- **Graceful Fallback**: If a local MongoDB instance is offline, the backend automatically transitions to a custom in-memory database fallback. The application remains fully operational, making it zero-config to test.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, Vanilla CSS, Lucide Icons, Socket.io-client |
| **Backend** | Node.js, Express, Socket.io, Jsonwebtoken, Bcryptjs, Dotenv |
| **Database** | MongoDB / Mongoose *(with In-Memory Mock Fallback)* |

---

## 📂 Project Structure

```text
Live polling/
├── client/                     # React Frontend
│   ├── src/
│   │   ├── assets/             # Images and SVGs
│   │   ├── App.jsx             # Main Dashboard Orchestrator
│   │   ├── Auth.jsx            # Sign In / Sign Up Card View
│   │   ├── index.css           # Premium Custom Stylesheet
│   │   └── main.jsx            # Frontend Entry Point
│   ├── index.html              # Core HTML structure & Google Fonts
│   └── package.json            # Client dependency configuration
├── server/                     # Express & WebSockets Backend
│   ├── models.js               # Mongoose Schemas & Database wrappers
│   ├── server.js               # REST APIs & Socket.io Handlers
│   └── package.json            # Server dependency configuration
└── .gitignore                  # Git ignore rules (excludes node_modules and configuration keys)
```

---

## 🚀 Getting Started

Follow these steps to run the application locally on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) installed.
- (Optional) Local [MongoDB](https://www.mongodb.com/) running on port `27017`. If MongoDB is not active, the system automatically runs in memory mode.

### 1. Set Up the Backend Server
1. Navigate into the `server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your local environment configuration variables (such as ports, database connections, and JWT session secrets) as required by the application.

4. Start the server:
   ```bash
   npm start
   ```
   *You should see output indicating the server is running on port 5000.*

### 2. Set Up the Client Frontend
1. Open a new terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Open your browser and go to:
   ```text
   http://localhost:5173/
   ```

---

## 🧪 How to Test and Verify

1. **User Sign Up**: Click *Register Now* and sign up with username `alice` and password `password123`.
2. **Access Protection**: Notice that logged-in users cannot access the admin panel or see admin navigation buttons.
3. **Admin Sign Up**: Logout and click *Register Now*. Sign up with username `bob`, check the *Register as Administrator* checkbox, enter admin secret `admin123`, and submit.
4. **Create Poll**: Logged in as `bob`, go to the *Admin Panel*, enter a question and options, and launch the poll.
5. **Real-time Vote**: Log in as `alice` on another browser tab/window. Submit a vote and watch the graphs update instantly in both the user tab and admin monitor tab using WebSocket triggers.
6. **Result Archive**: End the poll as `bob` and verify it relocates immediately to the *Past Results* and *Winners Wall* log for `alice`.