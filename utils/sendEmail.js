const nodemailer = require('nodemailer');
require("dotenv").config()
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { 
    user: process.env.GMAIL, // Replace with your Gmail address
    pass: process.env.PASSWORD, // Replace with your app password
  },
});

exports.sendEmail = async (to, subject, text) => { 
  try {
    await transporter.sendMail({
      from: process.env.GMAIL,  
      to,
      subject,
      text,
    }); 
    console.log('Email sent successfully'); 
  } catch (error) {
    console.error('Error sending email:', error); 
    throw error; // Ensure errors are propagated         
  }
};  
  