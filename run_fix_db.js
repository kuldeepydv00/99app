
const mongoose = require("mongoose");
const Bet = require("/var/www/matka-backend/src/models/Bet.js");
mongoose.connect("mongodb://127.0.0.1:27017/matka")
  .then(async () => {
    const result = await Bet.updateMany({ number: 100 }, { $set: { number: 0 } });
    console.log("Updated DB:", result);
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); });
