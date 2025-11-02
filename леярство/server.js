// server.js - Express backend that sends contact form submissions via nodemailer
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Basic security: rate limiting (tweak as needed)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10 // max 10 requests per IP per minute
});
app.use(limiter);

// Allow CORS for development; in production set specific origin
app.use(cors());
app.use(express.json());

// Serve static frontend from ./public
app.use(express.static(path.join(__dirname, 'public')));

// Simple validation helper
function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post('/api/send-email', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body || {};

        if (!name || !email || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email' });
        }

        const toEmail = process.env.TO_EMAIL;
        if (!toEmail) {
            return res.status(500).json({ success: false, error: 'Recipient email not configured' });
        }

        // Create transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false otherwise
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const mailOptions = {
            from: `"Website Contact" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Website contact${subject ? `: ${subject}` : ''}`,
            text: `You have a new contact form submission:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject || '(none)'}\n\nMessage:\n${message}`,
            html: `<h2>New contact form submission</h2>
                   <p><strong>Name:</strong> ${name}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Subject:</strong> ${subject || '(none)'}</p>
                   <hr/>
                   <p>${(message || '').replace(/\n/g, '<br/>')}</p>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('Error sending email:', err);
        return res.status(500).json({ success: false, error: 'Failed to send email' });
    }
});

// Fallback for SPA routes (serve index.html for non-API GET requests)
app.get('*', (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});