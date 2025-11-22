import React, { useState, useEffect } from 'react';
import { chatAPI } from '../services/api';
import socketService from '../services/socket';
import UserList from './Chat/UserList';
import GroupList from './Chat/GroupList';
import ChatWindow from './Chat/ChatWindow';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Connect to Socket.IO
    socketService.connect(user.token);

    // Load initial data
    loadUsers();
    loadGroups();

    // Listen for user status changes
    socketService.onUserStatusChange((data) => {
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.user_id === data.userId 
            ? { ...u, is_online: data.isOnline }
            : u
        )
      );
    });

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, [user.token]);

  const loadUsers = async () => {
    try {
      const response = await chatAPI.getUsers();
      setUsers(response.data.data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await chatAPI.getGroups();
      setGroups(response.data.data);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleSelectUser = (selectedUser) => {
    setSelectedChat({
      type: 'direct',
      id: selectedUser.user_id,
      name: selectedUser.username,
      isOnline: selectedUser.is_online
    });
  };

  const handleSelectGroup = (selectedGroup) => {
    setSelectedChat({
      type: 'group',
      id: selectedGroup.group_id,
      name: selectedGroup.group_name,
      memberCount: selectedGroup.member_count
    });
  };

  const handleCreateGroup = async (groupName, description, memberIds) => {
    try {
      await chatAPI.createGroup({ groupName, description, memberIds });
      await loadGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    socketService.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Chat App</h2>
          <div className="user-info">
            <span className="username">{user.username}</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users ({users.length})
          </button>
          <button
            className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups ({groups.length})
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'users' ? (
            <UserList
              users={users}
              onSelectUser={handleSelectUser}
              selectedUserId={selectedChat?.type === 'direct' ? selectedChat.id : null}
            />
          ) : (
            <GroupList
              groups={groups}
              users={users}
              onSelectGroup={handleSelectGroup}
              onCreateGroup={handleCreateGroup}
              selectedGroupId={selectedChat?.type === 'group' ? selectedChat.id : null}
            />
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            currentUser={user}
          />
        ) : (
          <div className="no-chat-selected">
            <div className="empty-state">
              <h3>Welcome to Chat App!</h3>
              <p>Select a user or group to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;