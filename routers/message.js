import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import Message from "../models/Message.js";
import User from "../models/user.js";

const messageRouter = express.Router();

// Get conversation between two users
messageRouter.get("/conversation/:userId", authorization, async (req, res) => {
  try {
    const { userId } = req.params; // Other user ID
    const currentUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId },
      ],
    })
      .populate("senderId", "name image email role")
      .populate("receiverId", "name image email role")
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        senderId: userId,
        receiverId: currentUserId,
        read: false,
      },
      {
        read: true,
        readAt: new Date(),
      }
    );

    sendResponse(res, 200, { messages }, false, "Messages fetched successfully");
  } catch (error) {
    console.error("Error fetching messages:", error);
    sendResponse(res, 500, null, true, "Error fetching messages: " + error.message);
  }
});

// Send a message
messageRouter.post("/send", authorization, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return sendResponse(res, 400, null, true, "Receiver ID and content are required");
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return sendResponse(res, 404, null, true, "Receiver not found");
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      content,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "name image email role")
      .populate("receiverId", "name image email role");

    // Emit socket event for real-time messaging
    const io = req.app.get("io");
    if (io) {
      io.to(receiverId.toString()).emit("new-message", populatedMessage);
    }

    sendResponse(res, 201, { message: populatedMessage }, false, "Message sent successfully");
  } catch (error) {
    console.error("Error sending message:", error);
    sendResponse(res, 500, null, true, "Error sending message: " + error.message);
  }
});

// Get unread message count
messageRouter.get("/unread-count", authorization, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiverId: req.user._id,
      read: false,
    });

    sendResponse(res, 200, { count }, false, "Unread count fetched successfully");
  } catch (error) {
    console.error("Error fetching unread count:", error);
    sendResponse(res, 500, null, true, "Error fetching unread count: " + error.message);
  }
});

// Get list of conversations (users with whom current user has exchanged messages)
messageRouter.get("/conversations", authorization, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get all unique user IDs that current user has messaged with
    const sentMessages = await Message.find({ senderId: currentUserId }).distinct("receiverId");
    const receivedMessages = await Message.find({ receiverId: currentUserId }).distinct("senderId");

    // Combine and get unique user IDs
    const userIds = [...new Set([...sentMessages, ...receivedMessages])];

    // Get user details and last message for each conversation
    const conversations = await Promise.all(
      userIds.map(async (userId) => {
        const user = await User.findById(userId).select("name image email role");
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: currentUserId, receiverId: userId },
            { senderId: userId, receiverId: currentUserId },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(1);

        const unreadCount = await Message.countDocuments({
          senderId: userId,
          receiverId: currentUserId,
          read: false,
        });

        return {
          user,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Sort by last message time
    conversations.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt || 0;
      const timeB = b.lastMessage?.createdAt || 0;
      return timeB - timeA;
    });

    sendResponse(res, 200, { conversations }, false, "Conversations fetched successfully");
  } catch (error) {
    console.error("Error fetching conversations:", error);
    sendResponse(res, 500, null, true, "Error fetching conversations: " + error.message);
  }
});

export default messageRouter;
