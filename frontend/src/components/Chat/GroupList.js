
import React, { useState } from 'react';
import './Chat.css';

const GroupList = ({ groups, users, onSelectGroup, onCreateGroup, selectedGroupId }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({
    groupName: '',
    description: '',
    selectedMembers: []
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError('');

    if (!newGroup.groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setCreating(true);
    try {
      await onCreateGroup(
        newGroup.groupName,
        newGroup.description,
        newGroup.selectedMembers
      );
      
      setShowCreateModal(false);
      setNewGroup({ groupName: '', description: '', selectedMembers: [] });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const toggleMemberSelection = (userId) => {
    setNewGroup(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.includes(userId)
        ? prev.selectedMembers.filter(id => id !== userId)
        : [...prev.selectedMembers, userId]
    }));
  };

  return (
    <div className="group-list">
      <button
        className="btn-create-group"
        onClick={() => setShowCreateModal(true)}
      >
        + Create Group
      </button>

      <div className="list-items">
        {groups.length === 0 ? (
          <div className="empty-list">
            <p>No groups yet</p>
          </div>
        ) : (
          groups.map(group => (
            <div
              key={group.group_id}
              className={`list-item ${selectedGroupId === group.group_id ? 'active' : ''}`}
              onClick={() => onSelectGroup(group)}
            >
              <div className="group-avatar">
                <span>#</span>
              </div>
              <div className="user-details">
                <div className="user-name">{group.group_name}</div>
                <div className="user-status">
                  {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Group</h3>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label>Group Name *</label>
                <input
                  type="text"
                  value={newGroup.groupName}
                  onChange={(e) => setNewGroup({ ...newGroup, groupName: e.target.value })}
                  placeholder="Enter group name"
                  disabled={creating}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Enter group description (optional)"
                  disabled={creating}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Add Members (optional)</label>
                <div className="member-selection">
                  {users.map(user => (
                    <label key={user.user_id} className="member-checkbox">
                      <input
                        type="checkbox"
                        checked={newGroup.selectedMembers.includes(user.user_id)}
                        onChange={() => toggleMemberSelection(user.user_id)}
                        disabled={creating}
                      />
                      <span>{user.username}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupList;