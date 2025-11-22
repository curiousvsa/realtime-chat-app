const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Store active socket connections: userId -> socketId
const userSockets = new Map();

/**
 * Initialize Socket.IO handlers
 */
const initializeSocketHandlers = (io) => {
  // Socket.IO authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Handle new socket connections
  io.on('connection', async (socket) => {
    console.log(`✓ User connected: ${socket.username} (ID: ${socket.userId})`);

    // Store socket connection
    userSockets.set(socket.userId, socket.id);

    // Update user online status in database
    try {
      await db.query(
        'UPDATE Users SET is_online = TRUE, last_seen = CURRENT_TIMESTAMP WHERE user_id = ?',
        [socket.userId]
      );
    } catch (error) {
      console.error('Error updating online status:', error);
    }

    // Notify all users about online status
    io.emit('user_status_change', {
      userId: socket.userId,
      username: socket.username,
      isOnline: true
    });

    /**
     * Handle direct messages
     * Event: 'send_direct_message'
     * Data: { receiverId, messageText }
     */
    socket.on('send_direct_message', async (data) => {
      try {
        const { receiverId, messageText } = data;
        const senderId = socket.userId;

        // Validate input
        if (!receiverId || !messageText) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        // Save message to database
        const [result] = await db.query(
          `INSERT INTO DirectMessages (sender_id, receiver_id, message_text) 
           VALUES (?, ?, ?)`,
          [senderId, receiverId, messageText]
        );

        const messageId = result.insertId;

        // Prepare message object
        const messageData = {
          messageId,
          senderId,
          senderUsername: socket.username,
          receiverId,
          messageText,
          sentAt: new Date().toISOString(),
          isRead: false
        };

        // Send to receiver if online
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_direct_message', messageData);
        }

        // Send confirmation to sender
        socket.emit('message_sent', messageData);

        console.log(`Direct message: ${socket.username} -> User ${receiverId}`);
      } catch (error) {
        console.error('Error sending direct message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Handle group messages
     * Event: 'send_group_message'
     * Data: { groupId, messageText }
     */
    socket.on('send_group_message', async (data) => {
      try {
        const { groupId, messageText } = data;
        const senderId = socket.userId;

        // Validate input
        if (!groupId || !messageText) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        // Verify user is a member of the group
        const [membership] = await db.query(
          'SELECT membership_id FROM GroupMembers WHERE group_id = ? AND user_id = ?',
          [groupId, senderId]
        );

        if (membership.length === 0) {
          socket.emit('error', { message: 'You are not a member of this group' });
          return;
        }

        // Save message to database
        const [result] = await db.query(
          `INSERT INTO GroupMessages (group_id, sender_id, message_text) 
           VALUES (?, ?, ?)`,
          [groupId, senderId, messageText]
        );

        const messageId = result.insertId;

        // Prepare message object
        const messageData = {
          messageId,
          groupId,
          senderId,
          senderUsername: socket.username,
          messageText,
          sentAt: new Date().toISOString()
        };

        // Get all group members
        const [members] = await db.query(
          'SELECT user_id FROM GroupMembers WHERE group_id = ?',
          [groupId]
        );

        // Send message to all online group members
        members.forEach((member) => {
          const memberSocketId = userSockets.get(member.user_id);
          if (memberSocketId) {
            io.to(memberSocketId).emit('receive_group_message', messageData);
          }
        });

        console.log(`Group message: ${socket.username} -> Group ${groupId}`);
      } catch (error) {
        console.error('Error sending group message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Handle typing indicators for direct messages
     * Event: 'typing_direct'
     * Data: { receiverId, isTyping }
     */
    socket.on('typing_direct', (data) => {
      const { receiverId, isTyping } = data;
      const receiverSocketId = userSockets.get(receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_typing_direct', {
          userId: socket.userId,
          username: socket.username,
          isTyping
        });
      }
    });

    /**
     * Handle typing indicators for groups
     * Event: 'typing_group'
     * Data: { groupId, isTyping }
     */
    socket.on('typing_group', async (data) => {
      try {
        const { groupId, isTyping } = data;

        // Get all group members except sender
        const [members] = await db.query(
          'SELECT user_id FROM GroupMembers WHERE group_id = ? AND user_id != ?',
          [groupId, socket.userId]
        );

        // Notify all online members
        members.forEach((member) => {
          const memberSocketId = userSockets.get(member.user_id);
          if (memberSocketId) {
            io.to(memberSocketId).emit('user_typing_group', {
              groupId,
              userId: socket.userId,
              username: socket.username,
              isTyping
            });
          }
        });
      } catch (error) {
        console.error('Error handling typing indicator:', error);
      }
    });

    /**
     * Handle user disconnect
     */
    socket.on('disconnect', async () => {
      console.log(`✗ User disconnected: ${socket.username} (ID: ${socket.userId})`);

      // Remove socket from map
      userSockets.delete(socket.userId);

      // Update user offline status
      try {
        await db.query(
          'UPDATE Users SET is_online = FALSE, last_seen = CURRENT_TIMESTAMP WHERE user_id = ?',
          [socket.userId]
        );
      } catch (error) {
        console.error('Error updating offline status:', error);
      }

      // Notify all users about offline status
      io.emit('user_status_change', {
        userId: socket.userId,
        username: socket.username,
        isOnline: false
      });
    });
  });

  console.log('✓ Socket.IO handlers initialized');
};

module.exports = initializeSocketHandlers;