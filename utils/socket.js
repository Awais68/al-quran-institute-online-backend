import { Server } from 'socket.io';
import logger from './logger.js';

let io;

export const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }
  });

  // Store active rooms and participants
  const rooms = new Map();
  const userSockets = new Map();
  const sessionStartTimes = new Map();
  const userJoinTimes = new Map();
  const registeredUsers = new Map(); // Map userId to socketId

  io.on('connection', (socket) => {
    logger.debug('User connected', { socketId: socket.id });

    // Register user for receiving calls
    socket.on('register-user', ({ userId, userName, userType }) => {
      registeredUsers.set(userId, { socketId: socket.id, userName, userType });
      logger.info('User registered', { userId, userName, userType, socketId: socket.id });
    });

    // Notify student about incoming call
    socket.on('call-student', ({ studentId, teacherName, roomId }) => {
      const studentSocket = registeredUsers.get(studentId);
      if (studentSocket) {
        io.to(studentSocket.socketId).emit('incoming-call', {
          from: socket.id,
          roomId,
          teacherName,
        });
        logger.info('Call notification sent', { studentId, teacherName, roomId });
      } else {
        logger.warn('Student not registered', { studentId });
      }
    });

    // User joins a video session room
    socket.on('join-session', ({ sessionId, userId, userName, userType }) => {
      socket.join(sessionId);
      
      if (!rooms.has(sessionId)) {
        rooms.set(sessionId, new Set());
        sessionStartTimes.set(sessionId, Date.now());
        
        // Log session start
        logger.session.start({
          sessionId,
          participants: [{ userId, userName, userType }],
          initiator: { userId, userName, userType }
        });
      }
      
      rooms.get(sessionId).add(userId);
      userSockets.set(userId, { socketId: socket.id, userName, userType });
      userJoinTimes.set(`${sessionId}-${userId}`, Date.now());

      // Log user join
      logger.session.join({
        sessionId,
        userId,
        userName,
        userType
      });

      // Notify others in the room
      socket.to(sessionId).emit('user-joined', {
        userId,
        userName,
        userType,
        socketId: socket.id
      });

      // Send list of existing participants
      const participants = Array.from(rooms.get(sessionId))
        .filter(id => id !== userId)
        .map(id => ({
          userId: id,
          ...userSockets.get(id)
        }));

      socket.emit('existing-participants', participants);

      logger.info(`User joined session`, { userName, userType, sessionId, participantCount: rooms.get(sessionId).size });
    });

    // WebRTC signaling
    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', { from: socket.id, offer });
      logger.debug('Forwarding offer', { from: socket.id, to });
    });

    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
      logger.debug('Forwarding answer', { from: socket.id, to });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
      logger.debug('Forwarding ICE candidate', { from: socket.id, to });
    });

    // Chat messages
    socket.on('chat-message', ({ sessionId, message, userName, userId }) => {
      io.to(sessionId).emit('chat-message', {
        message,
        userName,
        userId,
        timestamp: new Date().toISOString()
      });
    });

    // Screen sharing
    socket.on('start-screen-share', ({ sessionId, userId, userName }) => {
      socket.to(sessionId).emit('user-sharing-screen', { userId, userName });
    });

    socket.on('stop-screen-share', ({ sessionId, userId }) => {
      socket.to(sessionId).emit('user-stopped-sharing', { userId });
    });

    // Mute/unmute notifications
    socket.on('toggle-audio', ({ sessionId, userId, muted }) => {
      socket.to(sessionId).emit('user-audio-toggle', { userId, muted });
    });

    socket.on('toggle-video', ({ sessionId, userId, hidden }) => {
      socket.to(sessionId).emit('user-video-toggle', { userId, hidden });
    });

    // Leave session
    socket.on('leave-session', ({ sessionId, userId, userName }) => {
      handleUserLeave(socket, sessionId, userId, userName);
    });

    socket.on('disconnect', () => {
      // Clean up registered users
      for (const [userId, data] of registeredUsers.entries()) {
        if (data.socketId === socket.id) {
          registeredUsers.delete(userId);
          logger.debug('User unregistered', { userId });
          break;
        }
      }

      // Find user and session
      for (const [userId, data] of userSockets.entries()) {
        if (data.socketId === socket.id) {
          for (const [sessionId, participants] of rooms.entries()) {
            if (participants.has(userId)) {
              handleUserLeave(socket, sessionId, userId, data.userName);
            }
          }
          userSockets.delete(userId);
          break;
        }
      }
      logger.debug('User disconnected', { socketId: socket.id });
    });
  });

  function handleUserLeave(socket, sessionId, userId, userName) {
    const joinTime = userJoinTimes.get(`${sessionId}-${userId}`);
    const duration = joinTime ? Date.now() - joinTime : 0;
    
    // Log user leave
    logger.session.leave({
      sessionId,
      userId,
      duration: Math.round(duration / 1000) // Convert to seconds
    });
    
    socket.leave(sessionId);
    
    if (rooms.has(sessionId)) {
      rooms.get(sessionId).delete(userId);
      
      if (rooms.get(sessionId).size === 0) {
        // Last participant left - log session end
        const sessionStartTime = sessionStartTimes.get(sessionId);
        const sessionDuration = sessionStartTime ? Date.now() - sessionStartTime : 0;
        
        logger.session.end({
          sessionId,
          duration: Math.round(sessionDuration / 1000), // Convert to seconds
          participants: 0,
          peakParticipants: 0 // Could track this separately if needed
        });
        
        rooms.delete(sessionId);
        sessionStartTimes.delete(sessionId);
      }
    }
    
    userJoinTimes.delete(`${sessionId}-${userId}`);
    socket.to(sessionId).emit('user-left', { userId, userName });
    logger.info(`User left session`, { userName, sessionId, remainingParticipants: rooms.get(sessionId)?.size || 0 });
  }

  logger.info('Socket.IO initialized for video sessions');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export default { initializeSocketIO, getIO };
