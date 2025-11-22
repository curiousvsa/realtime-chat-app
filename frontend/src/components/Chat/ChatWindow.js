import React, { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../../services/api';
import socketService from '../../services/socket';
import MessageInput from './MessageInput';
import './Chat.css';

const ChatWindow = ({ chat, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);

  // Load messages when chat changes
  useEffect(() => {
    loadMessages();
  }, [chat.id, chat.type]);

  // Set up socket listeners
  useEffect(() => {
    // Listen for new messages
    if (chat.type === 'direct') {
      socketService.onDirectMessage(handleNewDirectMessage);
      socketService.onTypingDirect(handleTypingDirect);
    } else {
      socketService.onGroupMessage(handleNewGroupMessage);
      socketService.onTypingGroup(handleTypingGroup);
    }

    socketService.onMessageSent(handleMessageSent);

    // Cleanup
    return () => {
      socketService.removeAllListeners();
    };
  }, [chat.id, chat.type]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      let response;
      if (chat.type === 'direct') {
        response = await chatAPI.getDirectMessages(chat.id);
      } else {
        response = await chatAPI.getGroupMessages(chat.id);
      }
      setMessages(response.data.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewDirectMessage = (message) => {
    // Only add if message is from current chat
    if (message.senderId === chat.id || message.receiverId === chat.id) {
      setMessages(prev => [...prev, message]);
    }
  };

  const handleNewGroupMessage = (message) => {
    // Only add if message is from current group
    if (message.groupId === chat.id) {
      setMessages(prev => [...prev, message]);
    }
  };

  const handleMessageSent = (message) => {
    // Add sent message to local state
    setMessages(prev => [...prev, message]);
  };

  const handleTypingDirect = ({ userId, username, isTyping }) => {
    if (userId === chat.id) {
      if (isTyping) {
        setTypingUsers([username]);
      } else {
        setTypingUsers([]);
      }
    }
  };

  const handleTypingGroup = ({ groupId, userId, username, isTyping }) => {
    if (groupId === chat.id && userId !== currentUser.userId) {
      setTypingUsers(prev => {
        if (isTyping) {
          return prev.includes(username) ? prev : [...prev, username];
        } else {
          return prev.filter(u => u !== username);
        }
      });
    }
  };

  const handleSendMessage = (messageText) => {
    if (chat.type === 'direct') {
      socketService.sendDirectMessage(chat.id, messageText);
    } else {
      socketService.sendGroupMessage(chat.id, messageText);
    }
  };

  const handleTyping = (isTyping) => {
    if (chat.type === 'direct') {
      socketService.sendTypingDirect(chat.id, isTyping);
    } else {
      socketService.sendTypingGroup(chat.id, isTyping);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = {};
    messages.forEach(msg => {
      const date = formatDate(msg.sent_at || msg.sentAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            {chat.type === 'direct' ? (
              <span>{chat.name.charAt(0).toUpperCase()}</span>
            ) : (
              <span>#</span>
            )}
          </div>
          <div>
            <h3>{chat.name}</h3>
            <p className="chat-status">
              {chat.type === 'direct' ? (
                chat.isOnline ? 'Online' : 'Offline'
              ) : (
                `${chat.memberCount} members`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        {loading ? (
          <div className="loading-messages">
            <div className="loading-spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : (
          <>
            {Object.keys(messageGroups).length === 0 ? (
              <div className="no-messages">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              Object.entries(messageGroups).map(([date, msgs]) => (
                <div key={date}>
                  <div className="date-divider">
                    <span>{date}</span>
                  </div>
                  {msgs.map((msg) => {
                    const isOwnMessage = msg.sender_id === currentUser.userId || msg.senderId === currentUser.userId;
                    return (
                      <div
                        key={msg.message_id || msg.messageId}
                        className={`message ${isOwnMessage ? 'own' : 'other'}`}
                      >
                        {!isOwnMessage && chat.type === 'group' && (
                          <div className="message-sender">
                            {msg.sender_username || msg.senderUsername}
                          </div>
                        )}
                        <div className="message-bubble">
                          <p>{msg.message_text || msg.messageText}</p>
                          <span className="message-time">
                            {formatTime(msg.sent_at || msg.sentAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} />
    </div>
  );
};

export default ChatWindow;