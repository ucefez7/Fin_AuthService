const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const testRouter = require("./Router/testRouter");
const authenticateToken = require("./middleware/auth");
const User = require("./models/User");

const app = express();

mongoose.connect("mongodb://localhost:27017/Fin_Auth", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // useCreateIndex: true,
})
  .then(async () => {
    console.log("MongoDB connected");

    // Perform cleanup on startup
    await User.updateMany({ email: null }, { $unset: { email: 1 } });
    console.log('Database cleaned up');
    
    // Start the server only after cleanup
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`Port running on ${PORT}`);
    });
  })
  .catch((err) => console.log(err));

app.use(cors());
app.use(bodyParser.json());
app.use("/", testRouter);

// Example protected route
app.get("/protected", authenticateToken, (req, res) => {
  res.send("This is a protected route");
});
