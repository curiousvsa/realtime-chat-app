import React, { useState } from 'react';
import './Chat.css';

const UserList = ({ users, onSelectUser, selectedUserId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="user-list">
      <div className="search-box">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="list-items">
        {filteredUsers.length === 0 ? (
          <div className="empty-list">
            <p>No users found</p>
          </div>
        ) : (
          filteredUsers.map(user => (
            <div
              key={user.user_id}
              className={`list-item ${selectedUserId === user.user_id ? 'active' : ''}`}
              onClick={() => onSelectUser(user)}
            >
              <div className="user-avatar">
                <span>{user.username.charAt(0).toUpperCase()}</span>
                <span className={`status-indicator ${user.is_online ? 'online' : 'offline'}`}></span>
              </div>
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-status">
                  {user.is_online ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserList;