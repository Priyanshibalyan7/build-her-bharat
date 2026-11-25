import mongoose from "mongoose";
const { Schema, model } = mongoose;

export const User = model("User", new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: String,
  googleId: String,
  org: { type: String, default: "" },
  role: { type: String, default: "Analyst" },
  avatar: { type: String, default: null },
}, { timestamps: true }));

export const Video = model("Video", new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", index: true },
  name: String,
  mlId: String, // id inside the Python ML service
  state: { type: String, default: "queued" },
  progress: { type: Number, default: 0 },
  error: String,
}, { timestamps: true }));

export const Search = model("Search", new Schema({
  owner: { type: Schema.Types.ObjectId, index: true },
  video: Schema.Types.ObjectId,
  q: String, count: Number, ms: Number,
}, { timestamps: true }));
