const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/chat/users
 * Get all users except current user
 */
router.get('/users', async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const [users] = await db.query(
      `SELECT user_id, username, email, is_online, last_seen 
       FROM Users 
       WHERE user_id != ? 
       ORDER BY username`,
      [currentUserId]
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

/**
 * GET /api/chat/direct-messages/:userId
 * Get direct message history with a specific user
 */
router.get('/direct-messages/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 50;

    // Fetch messages between current user and specified user
    const [messages] = await db.query(
      `SELECT 
        dm.message_id,
        dm.sender_id,
        dm.receiver_id,
        dm.message_text,
        dm.sent_at,
        dm.is_read,
        u.username as sender_username
       FROM DirectMessages dm
       JOIN Users u ON dm.sender_id = u.user_id
       WHERE (dm.sender_id = ? AND dm.receiver_id = ?)
          OR (dm.sender_id = ? AND dm.receiver_id = ?)
       ORDER BY dm.sent_at DESC
       LIMIT ?`,
      [currentUserId, otherUserId, otherUserId, currentUserId, limit]
    );

    // Mark messages as read
    await db.query(
      `UPDATE DirectMessages 
       SET is_read = TRUE 
       WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE`,
      [currentUserId, otherUserId]
    );

    res.json({
      success: true,
      data: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages'
    });
  }
});

/**
 * GET /api/chat/groups
 * Get all groups the current user is a member of
 */
router.get('/groups', async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const [groups] = await db.query(
      `SELECT 
        g.group_id,
        g.group_name,
        g.description,
        g.created_at,
        gm.role,
        COUNT(DISTINCT gm2.user_id) as member_count
       FROM Groups g
       JOIN GroupMembers gm ON g.group_id = gm.group_id
       LEFT JOIN GroupMembers gm2 ON g.group_id = gm2.group_id
       WHERE gm.user_id = ?
       GROUP BY g.group_id, g.group_name, g.description, g.created_at, gm.role
       ORDER BY g.created_at DESC`,
      [currentUserId]
    );

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching groups'
    });
  }
});

/**
 * POST /api/chat/groups
 * Create a new group
 */
router.post('/groups', async (req, res) => {
  try {
    const { groupName, description, memberIds } = req.body;
    const currentUserId = req.user.userId;

    if (!groupName) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Create group
      const [groupResult] = await connection.query(
        'INSERT INTO Groups (group_name, description, created_by) VALUES (?, ?, ?)',
        [groupName, description || '', currentUserId]
      );

      const groupId = groupResult.insertId;

      // Add creator as admin
      await connection.query(
        'INSERT INTO GroupMembers (group_id, user_id, role) VALUES (?, ?, ?)',
        [groupId, currentUserId, 'admin']
      );

      // Add other members if provided
      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
        const memberValues = memberIds.map(userId => [groupId, userId, 'member']);
        await connection.query(
          'INSERT INTO GroupMembers (group_id, user_id, role) VALUES ?',
          [memberValues]
        );
      }

      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        data: { groupId, groupName }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating group'
    });
  }
});

/**
 * GET /api/chat/group-messages/:groupId
 * Get message history for a specific group
 */
router.get('/group-messages/:groupId', async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const currentUserId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;

    // Verify user is a member of the group
    const [membership] = await db.query(
      'SELECT membership_id FROM GroupMembers WHERE group_id = ? AND user_id = ?',
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Fetch group messages
    const [messages] = await db.query(
      `SELECT 
        gm.message_id,
        gm.sender_id,
        gm.message_text,
        gm.sent_at,
        u.username as sender_username
       FROM GroupMessages gm
       JOIN Users u ON gm.sender_id = u.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.sent_at DESC
       LIMIT ?`,
      [groupId, limit]
    );

    res.json({
      success: true,
      data: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages'
    });
  }
});

/**
 * GET /api/chat/group-members/:groupId
 * Get all members of a specific group
 */
router.get('/group-members/:groupId', async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const currentUserId = req.user.userId;

    // Verify user is a member
    const [membership] = await db.query(
      'SELECT membership_id FROM GroupMembers WHERE group_id = ? AND user_id = ?',
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Fetch group members
    const [members] = await db.query(
      `SELECT 
        u.user_id,
        u.username,
        u.email,
        u.is_online,
        gm.role,
        gm.joined_at
       FROM GroupMembers gm
       JOIN Users u ON gm.user_id = u.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.role DESC, u.username`,
      [groupId]
    );

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching members'
    });
  }
});

module.exports = router;