const express = require("express");
const app = express();
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const server = http.createServer(app);
const io = socketio(server);

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const LEADER_PASSWORD = process.env.LEADER_PASSWORD || "leader123";

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const requireAuth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect("/join");
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie("token");
    res.redirect("/join");
  }
};

const parseCookies = (cookieHeader = "") =>
  Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k.trim(), decodeURIComponent(v.join("="))];
      })
      .filter(([k]) => k)
  );

io.use((socket, next) => {
  const cookies = parseCookies(socket.request.headers.cookie);
  const token = cookies.token;
  if (!token) return next(new Error("Unauthorized"));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", function (socket) {
  console.log(`User connected: ${socket.id} (${socket.user.name}, ${socket.user.role})`);

  socket.on("send-location", function (data) {
    io.emit("receive-location", {
      id: socket.id,
      name: socket.user.name,
      role: socket.user.role,
      phone: socket.user.phone || "",
      ...data,
    });
  });

  socket.on("send-announcement", function ({ message }) {
    if (socket.user.role !== "leader") return;
    if (!message || !message.trim()) return;
    io.emit("receive-announcement", {
      message: message.trim(),
      from: socket.user.name,
    });
  });

  socket.on("start-ride", function () {
    if (socket.user.role !== "leader") return;
    io.emit("ride-started");
  });

  socket.on("stop-ride", function () {
    if (socket.user.role !== "leader") return;
    io.emit("ride-stopped");
  });

  socket.on("disconnect", function () {
    console.log(`User disconnected: ${socket.id}`);
    io.emit("user-disconnected", socket.id);
  });
});

app.get("/join", (req, res) => {
  if (req.cookies.token) {
    try {
      jwt.verify(req.cookies.token, JWT_SECRET);
      return res.redirect("/");
    } catch {
      res.clearCookie("token");
    }
  }
  res.render("join", { error: null });
});

app.post("/join", (req, res) => {
  const { name, role, leaderPassword, phone } = req.body;

  if (!name || !name.trim()) {
    return res.render("join", { error: "Please enter your name." });
  }
  if (role === "leader" && leaderPassword !== LEADER_PASSWORD) {
    return res.render("join", { error: "Incorrect ride leader password." });
  }

  const user = {
    name: name.trim(),
    role: role === "leader" ? "leader" : "member",
    phone: phone && phone.trim() ? phone.trim() : "",
  };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "8h" });
  res.cookie("token", token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/join");
});

app.get("/", requireAuth, (req, res) => {
  res.render("index", { user: req.user });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
