const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. User Schema for MongoDB
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const MongoUser = mongoose.model('User', UserSchema);

// 2. Poll Schema updated with a "voters" tracking array
const PollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [
    {
      text: { type: String, required: true },
      votes: { type: Number, default: 0 }
    }
  ],
  voters: [{ type: String }], // Track usernames of users who voted in this poll
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const MongoPoll = mongoose.model('Poll', PollSchema);

// In-Memory Database Fallback Mode State
let isUsingFallback = false;

// Mock database arrays
const mockUsers = [
  {
    _id: 'mock_user_1',
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10), // Seed default admin passcode
    isAdmin: true,
    createdAt: new Date()
  },
  {
    _id: 'mock_user_2',
    username: 'user',
    password: bcrypt.hashSync('user123', 10), // Seed default user passcode
    isAdmin: false,
    createdAt: new Date()
  }
];

const mockPolls = [
  {
    _id: 'mock_1',
    question: 'Which frontend framework do you prefer?',
    options: [
      { _id: 'mock_opt_1', text: 'React', votes: 12 },
      { _id: 'mock_opt_2', text: 'Vue', votes: 5 },
      { _id: 'mock_opt_3', text: 'Svelte', votes: 8 },
      { _id: 'mock_opt_4', text: 'Angular', votes: 3 }
    ],
    voters: ['user'], // Seed voter
    isActive: false,
    createdAt: new Date(Date.now() - 3600000 * 2)
  },
  {
    _id: 'mock_2',
    question: 'What is your preferred state manager for React?',
    options: [
      { _id: 'mock_opt_5', text: 'Zustand', votes: 18 },
      { _id: 'mock_opt_6', text: 'Redux Toolkit', votes: 7 },
      { _id: 'mock_opt_7', text: 'Context API', votes: 10 },
      { _id: 'mock_opt_8', text: 'Recoil / Signals', votes: 4 }
    ],
    voters: [],
    isActive: true,
    createdAt: new Date()
  }
];

function setUsingFallback(value) {
  isUsingFallback = value;
  if (value) {
    console.warn('\x1b[33m%s\x1b[0m', '[DATABASE WARNING] Running in MEMORY FALLBACK mode. Data will not persist across server restarts.');
  }
}

// User Wrapper Model for database abstraction
const User = {
  async findOne(query) {
    if (!isUsingFallback) {
      try {
        // Query might be username (which we store lowercase)
        let mongoQuery = { ...query };
        if (mongoQuery.username) {
          mongoQuery.username = mongoQuery.username.toLowerCase();
        }
        return await MongoUser.findOne(mongoQuery);
      } catch (err) {
        console.error('[DB] MongoDB error on User.findOne(), switching to in-memory fallback:', err.message);
        setUsingFallback(true);
      }
    }
    
    return mockUsers.find(u => {
      for (let key in query) {
        let val1 = u[key];
        let val2 = query[key];
        if (typeof val1 === 'string' && typeof val2 === 'string') {
          if (val1.toLowerCase() !== val2.toLowerCase()) return false;
        } else if (val1 !== val2) {
          return false;
        }
      }
      return true;
    }) || null;
  },

  async create(data) {
    if (!isUsingFallback) {
      try {
        const newUser = new MongoUser({
          ...data,
          username: data.username.toLowerCase()
        });
        return await newUser.save();
      } catch (err) {
        console.error('[DB] MongoDB error on User.create(), switching to in-memory fallback:', err.message);
        setUsingFallback(true);
      }
    }

    const newUser = {
      _id: 'mock_user_' + Math.random().toString(36).substr(2, 9),
      username: data.username.toLowerCase(),
      password: data.password,
      isAdmin: data.isAdmin || false,
      createdAt: new Date()
    };
    mockUsers.push(newUser);
    return newUser;
  }
};

// Poll Wrapper Model updated to support voter lists
const Poll = {
  async find() {
    if (!isUsingFallback) {
      try {
        return await MongoPoll.find().sort({ createdAt: -1 });
      } catch (err) {
        console.error('[DB] MongoDB error on Poll.find(), switching to in-memory fallback:', err.message);
        setUsingFallback(true);
      }
    }
    return [...mockPolls].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async findOne(query) {
    if (!isUsingFallback) {
      try {
        return await MongoPoll.findOne(query);
      } catch (err) {
        console.error('[DB] MongoDB error on Poll.findOne(), switching to in-memory fallback:', err.message);
        setUsingFallback(true);
      }
    }
    return mockPolls.find(p => {
      for (let key in query) {
        if (p[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  async create(data) {
    if (!isUsingFallback) {
      try {
        const newPoll = new MongoPoll({
          ...data,
          voters: []
        });
        return await newPoll.save();
      } catch (err) {
        console.error('[DB] MongoDB error on Poll.create(), switching to in-memory fallback:', err.message);
        setUsingFallback(true);
      }
    }
    
    const newPoll = {
      _id: 'mock_' + Math.random().toString(36).substr(2, 9),
      question: data.question,
      options: data.options.map(opt => ({
        _id: 'mock_opt_' + Math.random().toString(36).substr(2, 9),
        text: opt.text,
        votes: opt.votes || 0
      })),
      voters: [],
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date()
    };
    mockPolls.push(newPoll);
    return newPoll;
  },

  async findByIdAndUpdate(id, update, options = {}) {
    const idStr = id.toString();
    if (!isUsingFallback && !idStr.startsWith('mock_')) {
      try {
        return await MongoPoll.findByIdAndUpdate(id, update, options);
      } catch (err) {
        console.error('[DB] MongoDB error on Poll.findByIdAndUpdate(), switching to in-memory fallback:', err.message);
        setUsingFallback(true);
      }
    }
    
    const poll = mockPolls.find(p => p._id === idStr);
    if (!poll) return null;

    if (update.$set) {
      Object.assign(poll, update.$set);
    } else {
      for (let key in update) {
        if (key !== '$inc' && key !== '$addToSet' && key !== '$push') {
          poll[key] = update[key];
        }
      }
    }

    // Handle vote increments
    if (update.$inc) {
      for (let path in update.$inc) {
        const match = path.match(/options\.(\d+)\.votes/);
        if (match) {
          const index = parseInt(match[1]);
          if (poll.options[index]) {
            poll.options[index].votes += update.$inc[path];
          }
        }
      }
    }

    // Handle adding username to voters array in memory
    if (update.$addToSet && update.$addToSet.voters) {
      const username = update.$addToSet.voters;
      if (!poll.voters.includes(username)) {
        poll.voters.push(username);
      }
    } else if (update.$push && update.$push.voters) {
      const username = update.$push.voters;
      poll.voters.push(username);
    }

    return poll;
  },

  async deleteOne(query) {
    if (!isUsingFallback) {
      try {
        if (query._id && query._id.toString().startsWith('mock_')) {
          // Skip Mongo for mock IDs
        } else {
          return await MongoPoll.deleteOne(query);
        }
      } catch (err) {
        console.error('[DB] MongoDB error on Poll.deleteOne(), switching to in-memory fallback:', err.message);
        setUsingFallback(true);
      }
    }

    const idStr = query._id ? query._id.toString() : '';
    const index = mockPolls.findIndex(p => p._id === idStr);
    if (index !== -1) {
      mockPolls.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  },

  enableFallback() {
    setUsingFallback(true);
  },

  isFallbackActive() {
    return isUsingFallback;
  }
};

module.exports = {
  User,
  Poll,
  MongoUser,
  MongoPoll
};
