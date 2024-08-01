const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  phoneNumber: { type: String, unique: true, required: true },
  email: { type: String, unique: true },
  firstName: { type: String },
  lastName: { type: String },
  // securityCode: { type: String },
  securityCode: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
