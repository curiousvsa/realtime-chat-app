import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  /**
   * Connect to Socket.IO server with JWT token
   */
  connect(token) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✓ Socket connected:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('✗ Socket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      console.log('Socket manually disconnected');
    }
  }

  /**
   * Send direct message
   */
  sendDirectMessage(receiverId, messageText) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('send_direct_message', { receiverId, messageText });
  }

  /**
   * Send group message
   */
  sendGroupMessage(groupId, messageText) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('send_group_message', { groupId, messageText });
  }

  /**
   * Send typing indicator for direct messages
   */
  sendTypingDirect(receiverId, isTyping) {
    if (!this.socket) return;
    this.socket.emit('typing_direct', { receiverId, isTyping });
  }

  /**
   * Send typing indicator for group messages
   */
  sendTypingGroup(groupId, isTyping) {
    if (!this.socket) return;
    this.socket.emit('typing_group', { groupId, isTyping });
  }

  /**
   * Listen for direct messages
   */
  onDirectMessage(callback) {
    if (!this.socket) return;
    this.socket.on('receive_direct_message', callback);
  }

  /**
   * Listen for group messages
   */
  onGroupMessage(callback) {
    if (!this.socket) return;
    this.socket.on('receive_group_message', callback);
  }

  /**
   * Listen for message sent confirmation
   */
  onMessageSent(callback) {
    if (!this.socket) return;
    this.socket.on('message_sent', callback);
  }

  /**
   * Listen for user status changes
   */
  onUserStatusChange(callback) {
    if (!this.socket) return;
    this.socket.on('user_status_change', callback);
  }

  /**
   * Listen for direct typing indicators
   */
  onTypingDirect(callback) {
    if (!this.socket) return;
    this.socket.on('user_typing_direct', callback);
  }

  /**
   * Listen for group typing indicators
   */
  onTypingGroup(callback) {
    if (!this.socket) return;
    this.socket.on('user_typing_group', callback);
  }

  /**
   * Listen for errors
   */
  onError(callback) {
    if (!this.socket) return;
    this.socket.on('error', callback);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;