const express = require('express');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');
require('dotenv').config();
const mongoURL = process.env['MONGO_URL'];
const PORT = process.env['PORT'];

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(mongoURL)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`connected to dB and running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.log(err);
  });

const exerciseSchema = new mongoose.Schema({
  user_id: { type: String },
  description: { type: String },
  duration: { type: Number },
  date: { type: String },
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
});
const User = mongoose.model('User', userSchema);

// serve static site
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// exercise tracker app

app.post('/api/users', async (req, res) => {
  const username = req.body.username;
  const user = new User({
    username,
  });
  await user
    .save()
    .then(doc => {
      const obj = {
        username: doc.username,
        _id: doc._id,
      };
      res.json(obj);
    })
    .catch(err => {
      console.log(err);
    });
});

// create new exercise for a specific user
app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params;
  const { description, duration } = req.body;
  let { date } = req.body;
  if (!date) {
    date = new Date().toDateString();
  } else {
    date = new Date(date).toDateString();
  }
  const exercise = new Exercise({
    user_id: _id,
    date,
    description,
    duration,
  });
  await exercise.save();
  await User.findById(_id).then(doc => {
    const obj = {
      _id,
      description,
      duration: +duration,
      date,
      username: doc.username,
    };
    res.json(obj);
  });
});

// see user info
app.get('/api/users/:_id/logs?', async (req, res) => {
  const reqQuery = req._parsedOriginalUrl.query;
  const logs = req.params.log || '';
  const _id = req.params._id;

  const user = await User.findById(_id);
  const exercises = await Exercise.find({ user_id: _id });
  const objExercises = exercises.map(e => ({
    description: e.description,
    duration: e.duration,
    date: e.date,
  }));

  if (reqQuery) {
    if (reqQuery.includes('&')) {
      const sRQ = reqQuery.split('&');
      const from = new Date(sRQ[0].slice(5));
      const to = new Date(sRQ[1].slice(3));
      const timeRange = objExercises.filter(
        e => new Date(e.date) >= from && new Date(e.date) <= to
      );
      const obj = {
        _id,
        username: user.username,
        from: from.toDateString(),
        to: to.toDateString(),
        count: timeRange.length,
        log: timeRange,
      };
      res.json(obj);
      return;
    } else {
      const limit = +reqQuery.slice(6);
      const limitedLog = objExercises.filter((e, i) => i <= limit - 1);
      const obj = {
        _id,
        username: user.username,
        count: limitedLog.length,
        log: limitedLog,
      };

      res.json(obj);
      return;
    }
  }
  // if no query is requested
  const obj = {
    _id,
    username: user.username,
    count: exercises.length,
    log: objExercises,
  };

  res.json(obj);
});

// see all users
app.get('/api/users', async (req, res) => {
  const users = await User.find().then(users => {
    console.log(users);
    res.send(users.map(user => ({ username: user.username, _id: user._id })));
  });
});
