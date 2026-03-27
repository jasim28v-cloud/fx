// هيكل Firebase Realtime Database المقترح
{
  "users": {
    "$uid": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "avatar": "string",
      "bio": "string",
      "lastSeen": "timestamp",
      "status": "online/offline/typing",
      "isVerified": boolean,
      "createdAt": "timestamp",
      "contacts": ["uid1", "uid2"],
      "blockedUsers": ["uid3"]
    }
  },
  
  "chats": {
    "$chatId": {
      "type": "private/group/channel",
      "name": "string",
      "avatar": "string",
      "participants": ["uid1", "uid2"],
      "admins": ["uid1"],
      "createdBy": "uid",
      "createdAt": "timestamp",
      "lastMessage": {
        "text": "string",
        "senderId": "uid",
        "timestamp": "timestamp"
      }
    }
  },
  
  "messages": {
    "$chatId": {
      "$messageId": {
        "senderId": "uid",
        "text": "string",
        "type": "text/image/video/file/audio",
        "mediaUrl": "string",
        "replyTo": "messageId",
        "edited": boolean,
        "editedAt": "timestamp",
        "deleted": boolean,
        "seen": ["uid1", "uid2"],
        "timestamp": "timestamp"
      }
    }
  },
  
  "stories": {
    "$storyId": {
      "userId": "uid",
      "type": "image/video/text",
      "content": "string",
      "mediaUrl": "string",
      "duration": 24,
      "createdAt": "timestamp",
      "expiresAt": "timestamp",
      "viewers": ["uid1", "uid2"]
    }
  },
  
  "typing": {
    "$chatId": {
      "$uid": {
        "isTyping": boolean,
        "timestamp": "timestamp"
      }
    }
  },
  
  "calls": {
    "$callId": {
      "type": "voice/video",
      "callerId": "uid",
      "receiverId": "uid",
      "status": "initiating/ongoing/ended/missed",
      "duration": number,
      "startedAt": "timestamp",
      "endedAt": "timestamp"
    }
  }
}
