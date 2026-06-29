import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Auth from './Auth';
import { 
  BarChart2, 
  Plus, 
  Trash2, 
  Vote, 
  Shield, 
  Users, 
  Activity, 
  Database, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  Check, 
  Info,
  X,
  LogOut,
  Trophy,
  Award
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

function App() {
  // Navigation & User Auth State
  const [view, setView] = useState('user'); // 'user' or 'admin'
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('livepoll_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sidebar Sub-tab for User View
  const [sidebarTab, setSidebarTab] = useState('history'); // 'history' or 'winners'

  // Polls States
  const [activePoll, setActivePoll] = useState(null);
  const [history, setHistory] = useState([]);
  const [votedPolls, setVotedPolls] = useState(() => {
    try {
      const saved = localStorage.getItem('livepoll_voted_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Admin Create Poll Form States
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);

  const socketRef = useRef(null);

  // Sync User Session to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('livepoll_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('livepoll_user');
      // Reset view to user when logging out
      setView('user');
    }
  }, [user]);

  // Socket Connection & Real-time Synchronization
  useEffect(() => {
    if (!user) return; // Wait for authentication

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Receive initial active poll and history list
    socket.on('initData', ({ activePoll, history }) => {
      setActivePoll(activePoll);
      setHistory(history || []);
    });

    // Receive live vote updates
    socket.on('pollUpdated', (updatedPoll) => {
      setActivePoll(updatedPoll);
    });

    // Receive active poll start event
    socket.on('newPollStarted', (newPoll) => {
      setActivePoll(newPoll);
      setError(null);
    });

    // Receive poll end event
    socket.on('pollEnded', (endedPoll) => {
      setActivePoll(null);
    });

    // Receive entire history list updates
    socket.on('historyUpdated', (updatedHistory) => {
      setHistory(updatedHistory || []);
    });

    // Handle generic server errors (e.g. double vote attempts)
    socket.on('errorMsg', (msg) => {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Sync Voted Poll IDs
  useEffect(() => {
    localStorage.setItem('livepoll_voted_ids', JSON.stringify(votedPolls));
  }, [votedPolls]);

  // Log Out Handler
  const handleLogout = () => {
    setUser(null);
  };

  // Submit Vote socket trigger
  const submitVote = (optionIndex) => {
    if (!activePoll || !socketRef.current || !user) return;
    
    // Emit vote payload with voter's username for database verification
    socketRef.current.emit('vote', {
      pollId: activePoll._id,
      optionIndex: optionIndex,
      username: user.username
    });

    // Keep client backup tracking
    setVotedPolls(prev => [...prev, activePoll._id]);
  };

  // Determine if MongoDB Fallback database is running
  const isFallbackActive = activePoll?._id?.startsWith('mock_') || 
                           history.some(p => p._id?.startsWith('mock_'));

  // Checks if the user has voted (either local storage record or in-database record)
  const hasVotedActivePoll = activePoll && (
    votedPolls.includes(activePoll._id) || 
    (activePoll.voters && activePoll.voters.includes(user?.username?.toLowerCase()))
  );

  // Admin options handlers
  const handleOptionChange = (index, value) => {
    const updated = [...newOptions];
    updated[index] = value;
    setNewOptions(updated);
  };

  const addOptionField = () => {
    if (newOptions.length >= 8) return;
    setNewOptions([...newOptions, '']);
  };

  const removeOptionField = (index) => {
    if (newOptions.length <= 2) return;
    const updated = newOptions.filter((_, idx) => idx !== index);
    setNewOptions(updated);
  };

  // Admin Authorized REST requests helper
  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (user && user.token) {
      headers['Authorization'] = `Bearer ${user.token}`;
    }
    return headers;
  };

  const launchNewPoll = async (e) => {
    e.preventDefault();
    
    const filteredOptions = newOptions.map(opt => opt.trim()).filter(Boolean);
    if (!newQuestion.trim() || filteredOptions.length < 2) {
      alert('Please fill out the question and at least 2 options.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/polls`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          question: newQuestion.trim(),
          options: filteredOptions
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create new poll');
      }

      setNewQuestion('');
      setNewOptions(['', '']);
      setError(null);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error launching poll.');
    }
  };

  const endActivePoll = async () => {
    if (!activePoll) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/polls/${activePoll._id}/end`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to end poll');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error ending poll.');
    }
  };

  const deletePoll = async (pollId) => {
    if (!window.confirm('Are you sure you want to delete this poll?')) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/polls/${pollId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete poll');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error deleting poll.');
    }
  };

  // Calculations Helpers
  const getPollStats = (poll) => {
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    const maxVotes = Math.max(...poll.options.map(opt => opt.votes));
    
    // Indices of winning option(s)
    const winningIndices = totalVotes > 0 
      ? poll.options.map((opt, idx) => opt.votes === maxVotes ? idx : -1).filter(idx => idx !== -1)
      : [];

    return { totalVotes, winningIndices };
  };

  const formatTimeAgo = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
             ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // User Views: Polling Options Buttons
  const renderVotingOptions = () => {
    if (!activePoll) return null;
    
    return (
      <div className="poll-options-list">
        {activePoll.options.map((option, idx) => (
          <button 
            key={option._id || idx}
            className="poll-option-btn animate-fade-in"
            onClick={() => submitVote(idx)}
            style={{ animationDelay: `${idx * 0.08}s` }}
          >
            <span className="flex-align-center">
              <span style={{ 
                background: 'rgba(99, 102, 241, 0.12)', 
                color: 'var(--primary)', 
                fontWeight: 700, 
                width: '28px', 
                height: '28px', 
                display: 'inline-flex',
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: '6px',
                marginRight: '0.75rem',
                fontSize: '0.85rem'
              }}>
                {String.fromCharCode(65 + idx)}
              </span>
              {option.text}
            </span>
            <ChevronRight size={18} className="poll-option-arrow" />
          </button>
        ))}
      </div>
    );
  };

  // User Views: Active Poll results
  const renderPollResults = (poll) => {
    const { totalVotes, winningIndices } = getPollStats(poll);
    const hasUserVotedThisOption = poll.voters && poll.voters.includes(user?.username?.toLowerCase());

    return (
      <div className="poll-results-list">
        {poll.options.map((option, idx) => {
          const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isWinner = winningIndices.includes(idx);
          
          return (
            <div 
              key={option._id || idx} 
              className={`poll-result-item ${isWinner ? 'winner' : ''}`}
            >
              <div className="poll-result-header">
                <span className="poll-result-option-text">{option.text}</span>
                <div className="poll-result-stats">
                  <span className="poll-result-votes">{option.votes} {option.votes === 1 ? 'vote' : 'votes'}</span>
                  <span className="poll-result-percentage">{percentage}%</span>
                </div>
              </div>
              <div className="poll-result-bar-bg">
                <div 
                  className="poll-result-bar-fill" 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
        <div className="poll-vote-meta">
          <span>Total Votes: <strong>{totalVotes}</strong></span>
          <span className="badge badge-live">Live Sync</span>
        </div>
      </div>
    );
  };

  // Filter history to exclude currently running active poll
  const pastPolls = history.filter(p => p._id !== activePoll?._id);

  // Compute Winners List for Leaderboard
  const winnersList = pastPolls.map(poll => {
    const { totalVotes, winningIndices } = getPollStats(poll);
    // Get all options that tied as winners
    const winners = winningIndices.map(idx => poll.options[idx]).filter(Boolean);
    return {
      pollId: poll._id,
      question: poll.question,
      winners,
      totalVotes,
      createdAt: poll.createdAt
    };
  });

  // Render Login page if not authenticated
  if (!user) {
    return (
      <div className="app-container">
        {/* Simple Navbar Header */}
        <nav className="navbar" style={{ marginBottom: '1rem' }}>
          <div className="logo-container">
            <Activity size={24} className="logo-icon" />
            <span className="logo-text">LivePoll</span>
          </div>
          <div className="connection-status">
            <span className="status-indicator disconnected"></span>
            <span>Auth Required</span>
          </div>
        </nav>
        
        {/* Auth Forms */}
        <Auth onLoginSuccess={(data) => {
          setUser({
            username: data.user.username,
            isAdmin: data.user.isAdmin,
            token: data.token
          });
        }} />
        
        {/* Footer */}
        <footer className="footer">
          <p>© 2026 LivePoll Dashboard. Real-time feedback engine powered by WebSockets.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Navbar Header */}
      <nav className="navbar">
        <div className="logo-container">
          <Activity size={24} className="logo-icon" />
          <span className="logo-text">LivePoll</span>
        </div>

        <div className="nav-controls">
          {/* User Status details */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--card-border)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Welcome,</span>
            <strong style={{ color: 'var(--primary)' }}>{user.username}</strong>
            <span className={`badge ${user.isAdmin ? 'badge-fallback' : 'badge-ended'}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', border: 'none' }}>
              {user.isAdmin ? 'Admin' : 'Voter'}
            </span>
          </div>

          {/* Connection status */}
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>

          {/* Fallback warning */}
          {isFallbackActive && (
            <div className="badge badge-fallback" title="MongoDB offline. Storing data in memory.">
              <Database size={12} />
              <span>Memory</span>
            </div>
          )}

          {/* View Toggles (Admin panel restricted to admin users) */}
          <div className="nav-tabs">
            <button 
              className={`nav-btn ${view === 'user' ? 'active' : ''}`} 
              onClick={() => setView('user')}
            >
              <Users size={14} />
              User View
            </button>
            {user.isAdmin && (
              <button 
                className={`nav-btn ${view === 'admin' ? 'active' : ''}`} 
                onClick={() => setView('admin')}
              >
                <Shield size={14} />
                Admin Panel
              </button>
            )}
          </div>

          {/* Logout Button */}
          <button onClick={handleLogout} className="btn-delete-history" title="Sign Out" style={{ width: '2rem', height: '2rem' }}>
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Backend Alert Messages */}
      {error && (
        <div className="info-banner" style={{ borderLeft: '4px solid var(--danger)', marginBottom: '1.5rem', animation: 'slideDown var(--transition-fast)' }}>
          <AlertCircle size={18} className="info-banner-icon" style={{ color: 'var(--danger)' }} />
          <div>
            <strong style={{ color: 'var(--text-main)' }}>Alert: </strong>
            {error}
          </div>
        </div>
      )}

      {/* Main Grid Dashboards */}
      {view === 'user' ? (
        <div className="main-content split-layout">
          {/* USER VIEW: ACTIVE POLL CARD */}
          <div className="card highlighted">
            <div className="card-title-container">
              <div className="card-title-wrapper">
                <span className="badge badge-live" style={{ alignSelf: 'flex-start', marginBottom: '0.25rem' }}>Active Poll</span>
                <h2 className="card-title">
                  {activePoll ? activePoll.question : 'No Active Poll'}
                </h2>
              </div>
              <Vote size={28} style={{ color: 'var(--primary)' }} />
            </div>

            {activePoll ? (
              hasVotedActivePoll ? (
                renderPollResults(activePoll)
              ) : (
                renderVotingOptions()
              )
            ) : (
              <div className="empty-state">
                <Clock size={40} className="empty-state-icon" />
                <h3 className="empty-state-title">Waiting for Polls</h3>
                <p className="empty-state-description">
                  The admin hasn't started a live poll yet. Hold tight, updates appear automatically!
                </p>
              </div>
            )}
          </div>

          {/* USER VIEW: SIDEBAR CARD (Past Logs & Winners Showcase) */}
          <div className="card">
            <div className="card-title-container" style={{ flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="card-title">Poll Archives</h2>
                <Trophy size={20} style={{ color: 'var(--warning)' }} />
              </div>
              
              {/* Internal Sidebar Tab toggler */}
              <div className="nav-tabs" style={{ width: '100%', padding: '0.2rem' }}>
                <button 
                  className={`nav-btn ${sidebarTab === 'history' ? 'active' : ''}`} 
                  onClick={() => setSidebarTab('history')}
                  style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.8rem', justifyContent: 'center' }}
                >
                  <BarChart2 size={13} />
                  Past Results
                </button>
                <button 
                  className={`nav-btn ${sidebarTab === 'winners' ? 'active' : ''}`} 
                  onClick={() => setSidebarTab('winners')}
                  style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.8rem', justifyContent: 'center' }}
                >
                  <Award size={13} />
                  Winners Wall
                </button>
              </div>
            </div>

            {/* Sidebar View Rendering */}
            {sidebarTab === 'history' ? (
              /* TAB 1: HISTORY BAR CHARTS */
              pastPolls.length > 0 ? (
                <div className="history-list">
                  {pastPolls.map((poll) => {
                    const { totalVotes, winningIndices } = getPollStats(poll);
                    return (
                      <div key={poll._id} className="history-item">
                        <div className="history-header">
                          <span className="history-question">{poll.question}</span>
                          <span className="badge badge-ended">Ended</span>
                        </div>

                        <div className="history-results-compact">
                          {poll.options.map((opt, oIdx) => {
                            const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                            const isWinner = winningIndices.includes(oIdx);
                            return (
                              <div 
                                key={opt._id || oIdx} 
                                className={`history-option-bar-row ${isWinner ? 'is-winner' : ''}`}
                              >
                                <div className="history-option-info">
                                  <span className="history-option-text">{opt.text}</span>
                                  <span className="history-option-votes">{percentage}% ({opt.votes})</span>
                                </div>
                                <div className="history-bar-bg">
                                  <div 
                                    className="history-bar-fill"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="history-footer">
                          <span>Total votes: {totalVotes}</span>
                          <span>{formatTimeAgo(poll.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <BarChart2 size={28} className="empty-state-icon" />
                  <h4 className="empty-state-title">No Poll History</h4>
                  <p className="empty-state-description" style={{ fontSize: '0.8rem' }}>
                    Finished polls will appear here with vote breakdowns.
                  </p>
                </div>
              )
            ) : (
              /* TAB 2: WINNERS SHOWCASE LEADERBOARD */
              winnersList.length > 0 ? (
                <div className="history-list">
                  {winnersList.map((item) => {
                    const hasWinner = item.winners.length > 0;
                    return (
                      <div key={item.pollId} className="history-item" style={{ 
                        border: '1px solid rgba(245, 158, 11, 0.15)',
                        background: 'rgba(245, 158, 11, 0.01)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {formatTimeAgo(item.createdAt)}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                            {item.question}
                          </span>
                          
                          <div style={{ 
                            background: 'rgba(245, 158, 11, 0.05)', 
                            border: '1px solid rgba(245, 158, 11, 0.15)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.75rem 1rem',
                            marginTop: '0.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem'
                          }}>
                            <div className="flex-align-center" style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              <Trophy size={14} style={{ color: 'var(--warning)' }} />
                              <span>WINNER{item.winners.length > 1 ? 'S (TIE)' : ''}</span>
                            </div>
                            
                            {hasWinner ? (
                              item.winners.map((win, wIdx) => {
                                const percentage = item.totalVotes > 0 ? Math.round((win.votes / item.totalVotes) * 100) : 0;
                                return (
                                  <div key={wIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{win.text}</strong>
                                    <strong style={{ color: 'var(--warning)', fontSize: '0.95rem' }}>
                                      {percentage}% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>({win.votes} votes)</span>
                                    </strong>
                                  </div>
                                );
                              })
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No votes recorded</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                            Total Poll Turnout: {item.totalVotes}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <Award size={28} className="empty-state-icon" style={{ color: 'var(--warning)' }} />
                  <h4 className="empty-state-title">Winners Board Empty</h4>
                  <p className="empty-state-description" style={{ fontSize: '0.8rem' }}>
                    Completed poll champions will be showcased here.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* ADMIN VIEW */
        <div className="main-content split-layout">
          {/* ADMIN: CREATE POLL FORM */}
          <div className="card">
            <div className="card-title-container">
              <div className="card-title-wrapper">
                <h2 className="card-title">Create Live Poll</h2>
                <span className="card-subtitle">Launch a poll to all connected users</span>
              </div>
              <Plus size={24} style={{ color: 'var(--primary)' }} />
            </div>

            <form onSubmit={launchNewPoll} className="form">
              <div className="form-group">
                <label className="form-label">Poll Question</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Which backend framework do you use?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label className="form-label">Options</label>
                  <span className="form-label-hint">{newOptions.length}/8 options</span>
                </div>
                
                <div className="dynamic-options-list">
                  {newOptions.map((option, idx) => (
                    <div key={idx} className="dynamic-option-row">
                      <input 
                        type="text" 
                        className="form-input"
                        placeholder={`Option ${idx + 1}`}
                        value={option}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        required
                      />
                      {newOptions.length > 2 && (
                        <button 
                          type="button" 
                          className="btn-remove-option"
                          onClick={() => removeOptionField(idx)}
                          title="Remove option"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={addOptionField}
                  disabled={newOptions.length >= 8}
                  style={{ flex: 1 }}
                >
                  <Plus size={16} /> Add Option
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                >
                  <Activity size={16} /> Launch Live Poll
                </button>
              </div>
            </form>

            <div className="info-banner">
              <Info size={16} className="info-banner-icon" />
              <span>Launching a new poll will automatically end and archive the currently active poll.</span>
            </div>
          </div>

          {/* ADMIN: LIVE MONITOR & HISTORY MANAGER */}
          <div className="card">
            {/* Live Monitor */}
            <div className="card-title-container">
              <div className="card-title-wrapper">
                <h2 className="card-title">Live Monitor</h2>
                <span className="card-subtitle">Active poll real-time monitoring</span>
              </div>
              <Activity size={24} style={{ color: 'var(--success)' }} />
            </div>

            {activePoll ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--card-border)',
                  padding: '1.25rem', 
                  borderRadius: 'var(--radius-md)' 
                }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', lineHeight: '1.4' }}>
                    {activePoll.question}
                  </h4>
                  {renderPollResults(activePoll)}
                </div>
                <button 
                  className="btn btn-danger" 
                  onClick={endActivePoll}
                  style={{ width: '100%' }}
                >
                  <Check size={16} /> End and Archive Poll
                </button>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <Clock size={32} className="empty-state-icon" />
                <h4 className="empty-state-title">No Active Poll</h4>
                <p className="empty-state-description" style={{ fontSize: '0.8rem' }}>
                  No poll is currently active. Use the creation form on the left to start a live vote.
                </p>
              </div>
            )}

            <hr style={{ border: 'none', height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.5rem 0' }} />

            {/* History Control */}
            <div className="card-title-container" style={{ marginTop: '0.25rem' }}>
              <div className="card-title-wrapper">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>History Manager</h3>
                <span className="card-subtitle">Manage or delete completed polls</span>
              </div>
            </div>

            {pastPolls.length > 0 ? (
              <div className="history-list" style={{ maxHeight: '250px' }}>
                {pastPolls.map((poll) => {
                  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
                  return (
                    <div 
                      key={poll._id} 
                      className="history-item" 
                      style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
                    >
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {poll.question}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} • {formatTimeAgo(poll.createdAt)}
                        </div>
                      </div>
                      <button 
                        className="btn-delete-history"
                        onClick={() => deletePoll(poll._id)}
                        title="Delete Poll"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                <p style={{ fontSize: '0.8rem' }}>No archived history yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 LivePoll Dashboard. Real-time feedback engine powered by WebSockets.</p>
      </footer>
    </div>
  );
}

export default App;
