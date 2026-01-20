import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { authService } from "../services/auth";

let io: Server;

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowUpgrades: true,
    cookie: false
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication failed"));
      }

      const decoded = await authService.verifyAccessToken(token);
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log("Client connected:", socket.id, socket.data.user.role);

    // Join role-specific room
    const roomPrefix = socket.data.user.role === "DRIVER" ? "driver" : "user";
    socket.join(`${roomPrefix}_${socket.data.user.id}`);

    // Handle order room subscription
    socket.on("join:order", (orderId: string) => {
      socket.join(`order_${orderId}`);
      console.log(`Client joined order room: order_${orderId}`);
    });

    socket.on("leave:order", (orderId: string) => {
      socket.leave(`order_${orderId}`);
      console.log(`Client left order room: order_${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
