const express = require("express");
const app = express();
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const Trip = require("./models/Trip");

const server = http.createServer(app);
const io = socketio(server);

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const LEADER_PASSWORD = process.env.LEADER_PASSWORD || "leader123";

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── MongoDB ──────────────────────────────────────────────────────────────────
const DEMO_TRIPS = [
  {
    date: "15/01/2025",
    startTime: "06:30:00 AM",
    endTime: "10:15:00 AM",
    duration: "3h 45m",
    leaderName: "Arjun Mehta",
    destination: { name: "Sinhagad Fort", lat: 18.3665, lng: 73.7552 },
    riderCount: 12,
    riderNames: [
      "Arjun Mehta", "Priya Kulkarni", "Vikram Singh", "Neha Joshi",
      "Rohit Sharma", "Sneha Patil", "Aditya Desai", "Kavya Nair",
      "Rahul Sharma", "Pooja Rao", "Siddharth Jain", "Meera Iyer",
    ],
    waypoints: [
      { name: "Katraj Ghat Checkpoint", lat: 18.4525, lng: 73.8611 },
      { name: "Water Stop – Donje Village", lat: 18.3965, lng: 73.7820 },
      { name: "Base of Fort", lat: 18.3721, lng: 73.7578 },
    ],
    notes: {
      during: [
        { text: "Strong headwind after Katraj tunnel, group pace dropped", time: "07:15:00 AM" },
        { text: "Puncture stop at Donje — 10 min delay", time: "08:05:00 AM" },
        { text: "All 12 riders at base, starting the climb", time: "09:10:00 AM" },
      ],
      after:
        "Start before 6 AM to avoid traffic on Sinhagad Road. The ghat section after Donje has loose gravel — warn riders. Carry extra tubes, two riders had flats. Descent is fast, call out turns.",
    },
    isDemo: true,
  },
  {
    date: "08/02/2025",
    startTime: "07:00:00 AM",
    endTime: "09:20:00 AM",
    duration: "2h 20m",
    leaderName: "Priya Kulkarni",
    destination: { name: "Mulshi Lake", lat: 18.5246, lng: 73.5187 },
    riderCount: 8,
    riderNames: [
      "Priya Kulkarni", "Arjun Mehta", "Sneha Patil", "Aditya Desai",
      "Kavya Nair", "Pooja Rao", "Siddharth Jain", "Meera Iyer",
    ],
    waypoints: [
      { name: "Paud Phata Junction", lat: 18.5450, lng: 73.7270 },
      { name: "Pirangut Chai Stop", lat: 18.5380, lng: 73.6400 },
      { name: "Mulshi Dam View", lat: 18.5210, lng: 73.5260 },
    ],
    notes: {
      during: [
        { text: "Smooth roads till Paud, excellent pace", time: "07:35:00 AM" },
        { text: "Fog near Pirangut — reduced speed, lights on", time: "08:10:00 AM" },
      ],
      after:
        "Best route for beginners — flat roads with minimal traffic till Pirangut. Fog is common in winter mornings, bring blinkers. The dam viewpoint is worth the extra 800m detour. Return via same road.",
    },
    isDemo: true,
  },
  {
    date: "22/02/2025",
    startTime: "05:45:00 AM",
    endTime: "09:55:00 AM",
    duration: "4h 10m",
    leaderName: "Vikram Singh",
    destination: { name: "Pawna Lake", lat: 18.7228, lng: 73.5058 },
    riderCount: 15,
    riderNames: [
      "Vikram Singh", "Arjun Mehta", "Priya Kulkarni", "Neha Joshi",
      "Rohit Sharma", "Sneha Patil", "Aditya Desai", "Kavya Nair",
      "Rahul Sharma", "Pooja Rao", "Siddharth Jain", "Meera Iyer",
      "Karan Malhotra", "Divya Sharma", "Ankit Verma",
    ],
    waypoints: [
      { name: "Wakad Bridge Meetup", lat: 18.5990, lng: 73.7700 },
      { name: "Talegaon Dabhade Checkpoint", lat: 18.7310, lng: 73.6730 },
      { name: "Kamshet Water Stop", lat: 18.7670, lng: 73.5760 },
      { name: "Pawna Dam Road Entry", lat: 18.7310, lng: 73.5170 },
    ],
    notes: {
      during: [
        { text: "Largest group yet — maintaining 22 km/h average", time: "06:40:00 AM" },
        { text: "One rider cramping at Kamshet, 5 min rest", time: "08:20:00 AM" },
        { text: "Beautiful sunrise over Pawna, morale high!", time: "09:00:00 AM" },
      ],
      after:
        "For 15+ riders use a sweep rider at the back — essential. NH48 has heavy trucks early morning, wait till after Talegaon to spread out. Electrolytes are a must for the 70km return. Start no later than 5:45 AM.",
    },
    isDemo: true,
  },
  {
    date: "08/03/2025",
    startTime: "06:00:00 AM",
    endTime: "09:00:00 AM",
    duration: "3h 00m",
    leaderName: "Neha Joshi",
    destination: { name: "Lavasa", lat: 18.4073, lng: 73.5120 },
    riderCount: 6,
    riderNames: [
      "Neha Joshi", "Priya Kulkarni", "Sneha Patil",
      "Kavya Nair", "Pooja Rao", "Meera Iyer",
    ],
    waypoints: [
      { name: "Chandni Chowk Start", lat: 18.5120, lng: 73.8050 },
      { name: "Khambatki Ghat Top", lat: 18.4780, lng: 73.6820 },
      { name: "Lavasa Entry Gate", lat: 18.4140, lng: 73.5260 },
    ],
    notes: {
      during: [
        { text: "Khambatki descent super technical — everyone took it slow", time: "07:25:00 AM" },
        { text: "Lavasa entry required ID — heads up for future rides", time: "08:40:00 AM" },
      ],
      after:
        "Entry to Lavasa requires a valid ID at the gate — brief riders beforehand. Khambatki descent: apply brakes early, gravel on corners. This is a technical climb route, not recommended for first-timers. Morning light on the ghat is spectacular.",
    },
    isDemo: true,
  },
  {
    date: "29/03/2025",
    startTime: "05:30:00 AM",
    endTime: "11:00:00 AM",
    duration: "5h 30m",
    leaderName: "Rahul Sharma",
    destination: { name: "Lonavala", lat: 18.7481, lng: 73.4072 },
    riderCount: 10,
    riderNames: [
      "Rahul Sharma", "Arjun Mehta", "Vikram Singh", "Rohit Sharma",
      "Aditya Desai", "Siddharth Jain", "Karan Malhotra", "Ankit Verma",
      "Divya Sharma", "Meera Iyer",
    ],
    waypoints: [
      { name: "Hinjewadi Meetup Point", lat: 18.5902, lng: 73.7380 },
      { name: "Talegaon Dabhade Fuel Stop", lat: 18.7310, lng: 73.6730 },
      { name: "Khandala Ghat Viewpoint", lat: 18.7640, lng: 73.4510 },
      { name: "Lonavala Chikki Shop", lat: 18.7490, lng: 73.4120 },
    ],
    notes: {
      during: [
        { text: "Expressway shoulder narrow near Urse — single file", time: "07:10:00 AM" },
        { text: "Rain started at Khandala, slippery roads, pace reduced", time: "09:30:00 AM" },
        { text: "All 10 riders made it to Lonavala despite rain", time: "11:00:00 AM" },
      ],
      after:
        "Longest ride from AIT — split into two legs (Talegaon rest, then push). Monsoon prep essential even in March. Khandala ghat is extremely slippery in rain — have a bail-out plan. Start time 5:30 AM is optimal to beat Pune traffic on expressway access road.",
    },
    isDemo: true,
  },
];

async function seedDemoData() {
  try {
    const count = await Trip.countDocuments({ isDemo: true });
    if (count > 0) return;
    await Trip.insertMany(DEMO_TRIPS);
    console.log("Demo trips seeded.");
  } catch (err) {
    console.error("Demo seed error:", err.message);
  }
}

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost/cyclotrack")
  .then(() => {
    console.log("MongoDB connected.");
    seedDemoData();
  })
  .catch((err) => console.error("MongoDB connection error:", err.message));

// ── Auth helpers ─────────────────────────────────────────────────────────────
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

// ── Server-side ride state ────────────────────────────────────────────────────
let currentDestination = null;
let currentTrip = null;

function calcDuration(startMs) {
  const totalMin = Math.round((Date.now() - startMs) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on("connection", function (socket) {
  console.log(`Connected: ${socket.id} (${socket.user.name}, ${socket.user.role})`);

  if (currentDestination) socket.emit("destination-set", currentDestination);

  socket.on("send-location", function (data) {
    if (currentTrip) currentTrip.riderNames.add(socket.user.name);
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
    io.emit("receive-announcement", { message: message.trim(), from: socket.user.name });
  });

  socket.on("start-ride", function () {
    if (socket.user.role !== "leader") return;
    currentTrip = {
      _startMs: Date.now(),
      startTime: new Date().toLocaleTimeString("en-IN"),
      date: new Date().toLocaleDateString("en-IN"),
      leaderName: socket.user.name,
      destination: currentDestination || null,
      waypoints: [],
      notes: { during: [], after: "" },
      riderNames: new Set([socket.user.name]),
    };
    io.emit("ride-started");
  });

  socket.on("stop-ride", async function () {
    if (socket.user.role !== "leader") return;
    let savedTripId = null;
    if (currentTrip) {
      try {
        const saved = await Trip.create({
          date: currentTrip.date,
          startTime: currentTrip.startTime,
          endTime: new Date().toLocaleTimeString("en-IN"),
          duration: calcDuration(currentTrip._startMs),
          leaderName: currentTrip.leaderName,
          destination: currentTrip.destination,
          riderCount: currentTrip.riderNames.size,
          riderNames: [...currentTrip.riderNames],
          waypoints: currentTrip.waypoints,
          notes: currentTrip.notes,
        });
        savedTripId = saved._id.toString();
      } catch (err) {
        console.error("Trip save error:", err.message);
      }
      currentTrip = null;
    }
    io.emit("ride-stopped");
    if (savedTripId) socket.emit("trip-saved", { tripId: savedTripId });
  });

  socket.on("place-waypoint", function ({ name, lat, lng }) {
    if (socket.user.role !== "leader") return;
    if (currentTrip) currentTrip.waypoints.push({ name, lat, lng });
  });

  socket.on("add-note", async function ({ text, type, tripId }) {
    if (socket.user.role !== "leader") return;
    if (!text || !text.trim()) return;

    if (type === "during") {
      if (!currentTrip) return;
      const entry = { text: text.trim(), time: new Date().toLocaleTimeString("en-IN") };
      currentTrip.notes.during.push(entry);
      socket.emit("note-saved", entry);
    } else if (type === "after" && tripId) {
      try {
        await Trip.findByIdAndUpdate(tripId, { "notes.after": text.trim() });
      } catch (err) {
        console.error("After-note save error:", err.message);
      }
    }
  });

  socket.on("set-destination", function ({ lat, lng, name }) {
    if (socket.user.role !== "leader") return;
    currentDestination = { lat, lng, name };
    if (currentTrip) currentTrip.destination = currentDestination;
    io.emit("destination-set", currentDestination);
  });

  socket.on("clear-destination", function () {
    if (socket.user.role !== "leader") return;
    currentDestination = null;
    io.emit("destination-cleared");
  });

  socket.on("disconnect", function () {
    console.log(`Disconnected: ${socket.id}`);
    io.emit("user-disconnected", socket.id);
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
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
  if (!name || !name.trim()) return res.render("join", { error: "Please enter your name." });
  if (role === "leader" && leaderPassword !== LEADER_PASSWORD)
    return res.render("join", { error: "Incorrect ride leader password." });

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

app.get("/history", requireAuth, async (req, res) => {
  try {
    const trips = await Trip.find().sort({ createdAt: -1 }).limit(50);
    res.render("history", { user: req.user, trips });
  } catch (err) {
    console.error("History route error:", err.message);
    res.status(500).send("Could not load trip history.");
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
