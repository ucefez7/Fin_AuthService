const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Your User model
const { accountSID, authToken, serviceSID } = require('../config/otp_auth');
const twilio = require('twilio');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const retry = require('retry');

const client = twilio(accountSID, authToken);

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

const sendOtpWithRetry = (phoneNumber, callback) => {
  const operation = retry.operation({
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 5000,
  });

  operation.attempt((currentAttempt) => {
    client.verify
      .services(serviceSID)
      .verifications.create({ to: phoneNumber, channel: 'sms' })
      .then((resp) => {
        console.log('OTP sent successfully:', resp);
        callback(null, resp);
      })
      .catch((error) => {
        console.error('Error sending OTP:', error);
        if (error.status === 429) {
          if (operation.retry(error)) {
            return;
          }
        }
        callback(error);
      });
  });
};

router.post('/mobile', otpRequestLimiter, (req, res) => {
  const phoneNumber = req.body.number;
  const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  sendOtpWithRetry(formattedPhoneNumber, (error, response) => {
    if (error) {
      console.error('Failed to send OTP:', error);
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
    console.log('OTP response:', response);
    res.status(200).json(response);
  });
});


router.post('/otp', async (req, res) => {
  const { otp, userNumber } = req.body;
  const formattedPhoneNumber = userNumber.startsWith('+') ? userNumber : `+${userNumber}`;
  try {
    const verificationCheck = await client.verify
      .services(serviceSID)
      .verificationChecks.create({ to: formattedPhoneNumber, code: otp });

    console.log('Verification check result:', verificationCheck);

    if (!verificationCheck.valid) {
      return res.status(400).json({ valid: false, message: 'Expired or invalid OTP' });
    }

    let user = await User.findOne({ phoneNumber: formattedPhoneNumber });
    if (!user) {
      user = new User({ phoneNumber: formattedPhoneNumber });
      await user.save();
      console.log('New user created:', user);
      return res.json({ valid: true, newUser: true, userId: user._id, redirect: '/email', message: 'User created, proceed to email' });
    } else {
      const token = jwt.sign({ id: user._id }, 'your_jwt_secret_key', { expiresIn: '1h' });
      console.log('Existing user found, token generated:', token);
      return res.json({ valid: true, token, newUser: false, redirect: '/', message: 'Welcome back' });
    }
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    return res.status(500).json({ valid: false, error: 'Failed to verify OTP' });
  }
});




router.post('/email', async (req, res) => {
  const { userId, email } = req.body;
  try {
    let user = await User.findById(userId);
    if (user) {
      user.email = email;
      await user.save();
      console.log('Email updated successfully for user:', user);
      res.status(200).json({ message: 'Email updated successfully', redirect: '/name' });
    } else {
      console.log('User not found for ID:', userId);
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Failed to update email:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});




router.post('/name', async (req, res) => {
  const { phoneNumber, firstName, lastName } = req.body;
  try {
    const result = await User.updateOne({ phoneNumber }, { firstName, lastName });
    console.log('Name updated result:', result);
    res.json({ message: 'Name updated' });
  } catch (error) {
    console.error('Failed to update name:', error);
    res.status(500).json({ error: 'Failed to update name' });
  }
});

module.exports = router;
