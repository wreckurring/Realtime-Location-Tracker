const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    date: String,
    startTime: String,
    endTime: String,
    duration: String,
    leaderName: String,
    destination: { name: String, lat: Number, lng: Number },
    riderCount: Number,
    riderNames: [String],
    waypoints: [{ name: String, lat: Number, lng: Number }],
    notes: {
      during: [{ text: String, time: String }],
      after: String,
    },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
