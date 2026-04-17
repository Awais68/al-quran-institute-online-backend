import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import Notification from "../models/Notification.js";

const notificationRouter = express.Router();

// Get all notifications for current user
notificationRouter.get("/", authorization, async (req, res) => {
  try {
    const { limit = 20, unreadOnly = false } = req.query;
    
    const filter = { userId: req.user._id };
    if (unreadOnly === "true") {
      filter.read = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    sendResponse(
      res,
      200,
      { notifications, unreadCount },
      false,
      "Notifications fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    sendResponse(res, 500, null, true, "Error fetching notifications: " + error.message);
  }
});

// Get unread notification count
notificationRouter.get("/unread-count", authorization, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    sendResponse(res, 200, { count }, false, "Unread count fetched successfully");
  } catch (error) {
    console.error("Error fetching unread count:", error);
    sendResponse(res, 500, null, true, "Error fetching unread count: " + error.message);
  }
});

// Mark notification as read
notificationRouter.patch("/:id/read", authorization, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return sendResponse(res, 404, null, true, "Notification not found");
    }

    sendResponse(res, 200, { notification }, false, "Notification marked as read");
  } catch (error) {
    console.error("Error marking notification as read:", error);
    sendResponse(res, 500, null, true, "Error updating notification: " + error.message);
  }
});

// Mark all notifications as read
notificationRouter.patch("/mark-all-read", authorization, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    sendResponse(res, 200, null, false, "All notifications marked as read");
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    sendResponse(res, 500, null, true, "Error updating notifications: " + error.message);
  }
});

// Delete notification
notificationRouter.delete("/:id", authorization, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!notification) {
      return sendResponse(res, 404, null, true, "Notification not found");
    }

    sendResponse(res, 200, null, false, "Notification deleted successfully");
  } catch (error) {
    console.error("Error deleting notification:", error);
    sendResponse(res, 500, null, true, "Error deleting notification: " + error.message);
  }
});

// Create notification (Admin/Teacher only)
notificationRouter.post("/create", authorization, async (req, res) => {
  try {
    const { userId, type, title, message, relatedId, relatedModel, actionUrl } = req.body;

    // Only teachers and admins can create notifications
    if (req.user.role !== "Teacher" && req.user.role !== "Admin") {
      return sendResponse(res, 403, null, true, "Only teachers and admins can create notifications");
    }

    if (!userId || !type || !title || !message) {
      return sendResponse(res, 400, null, true, "Missing required fields");
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      relatedId,
      relatedModel,
      actionUrl,
    });

    // Emit socket event for real-time notification
    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("new-notification", notification);
    }

    sendResponse(res, 201, { notification }, false, "Notification created successfully");
  } catch (error) {
    console.error("Error creating notification:", error);
    sendResponse(res, 500, null, true, "Error creating notification: " + error.message);
  }
});

// Broadcast notification to multiple users
notificationRouter.post("/broadcast", authorization, async (req, res) => {
  try {
    const { userIds, type, title, message, actionUrl } = req.body;

    // Only admins can broadcast
    if (req.user.role !== "Admin") {
      return sendResponse(res, 403, null, true, "Only admins can broadcast notifications");
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return sendResponse(res, 400, null, true, "User IDs array is required");
    }

    if (!type || !title || !message) {
      return sendResponse(res, 400, null, true, "Missing required fields");
    }

    // Create notifications for all users
    const notifications = await Notification.insertMany(
      userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        actionUrl,
      }))
    );

    // Emit socket events
    const io = req.app.get("io");
    if (io) {
      notifications.forEach((notification) => {
        io.to(notification.userId.toString()).emit("new-notification", notification);
      });
    }

    sendResponse(
      res,
      201,
      { count: notifications.length },
      false,
      `Broadcasted to ${notifications.length} users`
    );
  } catch (error) {
    console.error("Error broadcasting notification:", error);
    sendResponse(res, 500, null, true, "Error broadcasting notification: " + error.message);
  }
});

export default notificationRouter;
