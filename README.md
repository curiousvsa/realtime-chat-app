# Real-Time Chat Application — High-Level Summary

## Frontend

### Authentication

#### `Login.js`
- User enters username/password  
- Credentials sent to backend  
- Backend returns JWT token  
- Token stored in `localStorage`

#### `Register.js`
- User registers  
- Backend returns JWT token  
- User is automatically logged in

---

### Main UI

#### `Dashboard.js`
- Fetches all users and groups from backend  
- Displays list in the sidebar

---

### Navigation

#### `UserList.js`
- Clicking a user opens `ChatWindow` for **direct messages**

#### `GroupList.js`
- User can create a new group or select an existing one  
- Opens `ChatWindow` for that group

---

### Chat Interface

#### `ChatWindow.js`
- Displays message history  
- Shows typing indicators  
- Supports real-time updates via **WebSockets**

#### `MessageInput.js`
- Typing triggers “typing” WebSocket events  
- Sending a message emits a WebSocket event to the server

---

## Backend

### REST API (axios)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login existing user |
| GET | `/api/chat/users` | Get all users |
| GET | `/api/chat/groups` | Get user’s groups |
| GET | `/api/chat/direct-messages/:userId` | Retrieve direct messages |
| GET | `/api/chat/group-messages/:groupId` | Retrieve group messages |
| POST | `/api/chat/groups` | Create new group |

---

### WebSocket Events (socket.io)

#### Client → Server
- `send_direct_message`
- `send_group_message`
- `typing_direct`
- `typing_group`

#### Server → Client
- `receive_direct_message`
- `receive_group_message`
- `user_status_change`
- `user_typing_direct`
- `user_typing_group`

---

## Database

### Database Initialization — `setup_db.py`
- Checks if Docker is running  
- Starts MySQL container:

```bash
docker run --name chatapp-mysql \
  -e MYSQL_ROOT_PASSWORD=*** \
  -p 3306:3306 \
  mysql:8.0

