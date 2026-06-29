require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Poll, User } = require('./models');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/live-polling';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_for_live_polling';

// MongoDB Connection
console.log('[DB] Connecting to MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('[DB] Connected to MongoDB successfully.');
  })
  .catch((err) => {
    console.error('[DB] MongoDB connection failed:', err.message);
    Poll.enableFallback();
  });

// JWT Authentication Middlewares
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
    req.user = decodedUser;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}

// Socket.io Realtime Logic
io.on('connection', async (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send initial state data to client
  try {
    const activePoll = await Poll.findOne({ isActive: true });
    const polls = await Poll.find();
    socket.emit('initData', { activePoll, history: polls });
  } catch (err) {
    console.error('[Socket] Error sending initial data:', err.message);
  }

  // Handle Voting
  socket.on('vote', async ({ pollId, optionIndex, username }) => {
    if (!username) {
      socket.emit('errorMsg', 'You must be signed in to vote.');
      return;
    }
    const voterName = username.toLowerCase().trim();
    console.log(`[Socket] Vote received from "${voterName}" for Poll ${pollId}, Option ${optionIndex}`);
    
    try {
      // Find poll
      const poll = await Poll.findOne({ _id: pollId });
      if (!poll) {
        socket.emit('errorMsg', 'Poll not found.');
        return;
      }
      if (!poll.isActive) {
        socket.emit('errorMsg', 'This poll has ended.');
        return;
      }

      // Check if user has already voted
      if (poll.voters && poll.voters.includes(voterName)) {
        socket.emit('errorMsg', 'You have already voted in this poll.');
        return;
      }

      // Register vote and add voter username to voters list
      const updatePath = `options.${optionIndex}.votes`;
      const updatedPoll = await Poll.findByIdAndUpdate(
        pollId,
        { 
          $inc: { [updatePath]: 1 },
          $addToSet: { voters: voterName }
        },
        { new: true }
      );

      if (updatedPoll) {
        // Broadcast the updated poll state to all connected clients
        io.emit('pollUpdated', updatedPoll);
        
        // Broadcast updated history log
        const polls = await Poll.find();
        io.emit('historyUpdated', polls);
      }
    } catch (err) {
      console.error('[Socket] Vote processing error:', err.message);
      socket.emit('errorMsg', 'Failed to submit vote.');
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Authentication Endpoints

// Sign Up / User Registration
app.post('/api/auth/signup', async (req, res) => {
  const { username, password, isAdmin, adminCode } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  let userIsAdmin = false;
  if (isAdmin) {
    const SYSTEM_ADMIN_CODE = process.env.ADMIN_SECRET_CODE || 'admin123';
    if (adminCode !== SYSTEM_ADMIN_CODE) {
      return res.status(400).json({ error: 'Invalid admin passcode code.' });
    }
    userIsAdmin = true;
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user
    const newUser = await User.create({
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      isAdmin: userIsAdmin
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username, isAdmin: newUser.isAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        username: newUser.username,
        isAdmin: newUser.isAdmin
      }
    });
  } catch (err) {
    console.error('[Auth API] Signup error:', err.message);
    res.status(500).json({ error: 'An error occurred during registration.' });
  }
});

// Sign In / Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        username: user.username,
        isAdmin: user.isAdmin
      }
    });
  } catch (err) {
    console.error('[Auth API] Login error:', err.message);
    res.status(500).json({ error: 'An error occurred during sign-in.' });
  }
});

// REST API Endpoints (Secured where necessary)

// Get all polls (history)
app.get('/api/polls', async (req, res) => {
  try {
    const polls = await Poll.find();
    res.json(polls);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve polls.' });
  }
});

// Get current active poll
app.get('/api/polls/active', async (req, res) => {
  try {
    const activePoll = await Poll.findOne({ isActive: true });
    res.json(activePoll);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve active poll.' });
  }
});

// Create a new poll (Admin only)
app.post('/api/polls', authenticateToken, requireAdmin, async (req, res) => {
  const { question, options } = req.body;
  
  if (!question || !options || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'A question and at least 2 options are required.' });
  }

  try {
    // 1. Deactivate any existing active polls
    const activePoll = await Poll.findOne({ isActive: true });
    if (activePoll) {
      await Poll.findByIdAndUpdate(activePoll._id, { $set: { isActive: false } });
    }

    // 2. Create the new poll
    const formattedOptions = options.map(opt => ({ text: opt, votes: 0 }));
    const newPoll = await Poll.create({
      question,
      options: formattedOptions,
      isActive: true,
      voters: []
    });

    // 3. Broadcast to all socket clients that a new poll started and history updated
    io.emit('newPollStarted', newPoll);
    
    const polls = await Poll.find();
    io.emit('historyUpdated', polls);

    res.status(201).json(newPoll);
  } catch (err) {
    console.error('[REST] Error creating poll:', err.message);
    res.status(500).json({ error: 'Failed to create poll.' });
  }
});

// End the active poll (Admin only)
app.put('/api/polls/:id/end', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const updatedPoll = await Poll.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!updatedPoll) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    // Broadcast that the poll has ended
    io.emit('pollEnded', updatedPoll);

    const polls = await Poll.find();
    io.emit('historyUpdated', polls);

    res.json(updatedPoll);
  } catch (err) {
    console.error('[REST] Error ending poll:', err.message);
    res.status(500).json({ error: 'Failed to end poll.' });
  }
});

// Delete a poll (Admin only)
app.delete('/api/polls/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Poll.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    // Broadcast updated history
    const polls = await Poll.find();
    io.emit('historyUpdated', polls);

    // If the active poll was deleted, let clients know
    const activePoll = await Poll.findOne({ isActive: true });
    if (!activePoll) {
      io.emit('newPollStarted', null); // Clears active poll on client
    }

    res.json({ message: 'Poll deleted successfully.' });
  } catch (err) {
    console.error('[REST] Error deleting poll:', err.message);
    res.status(500).json({ error: 'Failed to delete poll.' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`[Server] Live Polling backend running on port ${PORT}`);
  console.log(`[Server] API Base: http://localhost:${PORT}/api`);
});
