
const mongoose = require("mongoose");
const Bet = require("./src/models/Bet");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const result = await Bet.updateMany({ number: 100 }, { \: { number: 0 } });
    console.log("Updated bets:", result);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
