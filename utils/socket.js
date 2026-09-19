import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import logger from './logger.js';
import { isAllowedOrigin } from '../config/allowedOrigins.js';

let io;

export const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      // Same predicate the HTTP server uses, so a preview deployment that can
      // call the REST API can also open a socket.
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true
    }
  });

  // Store active rooms and participants
  const rooms = new Map();
  const userSockets = new Map();
  const sessionStartTimes = new Map();
  const userJoinTimes = new Map();
  const registeredUsers = new Map(); // Map userId to socketId

  // Identity comes from the JWT in the handshake, never from the client payload.
  // Anonymous sockets are still allowed through (public pages open one before
  // login) but they get no personal room and cannot impersonate anyone.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();

    try {
      const decoded = jwt.verify(token, process.env.AUTH_SECRET);
      socket.data.userId = decoded.id;
    } catch (error) {
      logger.warn('Socket handshake token rejected', { socketId: socket.id, reason: error.message });
    }
    return next();
  });

  io.on('connection', (socket) => {
    logger.debug('User connected', { socketId: socket.id, userId: socket.data.userId });

    // Every authenticated socket joins a room named after its user id. REST
    // handlers emit to that room (io.to(userId)) for messages, notifications
    // and scheduled sessions, so those events need no socket id lookup.
    if (socket.data.userId) {
      socket.join(socket.data.userId);
    }

    // Register user for receiving calls
    socket.on('register-user', ({ userId, userName, userType }) => {
      // Trust the token over the payload when both are present.
      const trustedId = socket.data.userId || userId;
      if (!trustedId) {
        logger.warn('register-user without a resolvable user id', { socketId: socket.id });
        return;
      }
      socket.data.userId = trustedId;
      socket.join(trustedId);
      registeredUsers.set(trustedId, { socketId: socket.id, userName, userType });
      logger.info('User registered', { userId: trustedId, userName, userType, socketId: socket.id });
    });

    // Ring a user on every socket they have open. Targeting the per-user room
    // instead of a single stored socket id means the callee is reachable from
    // any page (and any tab), not only the one that emitted `register-user`.
    const ringUser = async (targetUserId, payload, label) => {
      if (!targetUserId) {
        logger.warn('Call requested without a target user id', { label });
        return;
      }

      const sockets = await io.in(targetUserId).fetchSockets();
      if (sockets.length === 0) {
        // Fall back to the legacy registry for clients that connect without a token.
        const registered = registeredUsers.get(targetUserId);
        if (!registered) {
          logger.warn('Call target is offline', { label, targetUserId });
          return;
        }
        io.to(registered.socketId).emit('incoming-call', { from: socket.id, ...payload });
      } else {
        io.to(targetUserId).emit('incoming-call', { from: socket.id, ...payload });
      }

      logger.info('Call notification sent', { label, targetUserId, ...payload });
    };

    // Notify student about incoming call
    socket.on('call-student', ({ studentId, teacherName, roomId }) => {
      ringUser(studentId, { roomId, teacherName }, 'call-student');
    });

    // Notify teacher about incoming call from student
    socket.on('call-teacher', ({ teacherId, studentName, roomId }) => {
      ringUser(teacherId, { roomId, studentName }, 'call-teacher');
    });

    // User joins a video session room
    socket.on('join-session', ({ sessionId, userId, userName, userType }) => {
      // The handshake token is authoritative; the payload is only a hint.
      const joiningUserId = socket.data.userId || userId;
      if (!sessionId || !joiningUserId) {
        logger.warn('join-session without a session or user id', { socketId: socket.id, sessionId });
        return;
      }
      userId = joiningUserId;
      socket.data.sessionId = sessionId;

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
        .map(id => {
          const known = userSockets.get(id);
          return known ? { userId: id, ...known } : null;
        })
        // A participant with no live socket is a leftover from a crashed tab.
        // Sending it makes the client open a peer connection keyed by
        // `undefined` that nothing can ever answer.
        .filter(Boolean);

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
    socket.on('leave-session', ({ sessionId, userId, userName } = {}) => {
      const room = sessionId || socket.data.sessionId;
      const leavingId = socket.data.userId || userId;
      handleUserLeave(socket, room, leavingId, userName || userSockets.get(leavingId)?.userName);
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
          // Only if this socket still owns the mapping: when the same user has
          // a second tab open it has already overwritten the entry.
          if (userSockets.get(userId)?.socketId === socket.id) {
            userSockets.delete(userId);
          }
          break;
        }
      }
      logger.debug('User disconnected', { socketId: socket.id });
    });
  });

  function handleUserLeave(socket, sessionId, userId, userName) {
    if (!sessionId || !userId) {
      logger.warn('Leave requested without a session or user id', { socketId: socket.id, sessionId, userId });
      return;
    }

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
    // socketId matters as much as userId: peers key their RTCPeerConnections by
    // socket id, so without it the remote side keeps a dead connection and a
    // frozen video tile.
    socket.to(sessionId).emit('user-left', { userId, userName, socketId: socket.id });
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
