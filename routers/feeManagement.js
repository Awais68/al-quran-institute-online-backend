import express from 'express';
import User from '../models/user.js';
import authorization from '../middlewares/authtication.js';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      error: true,
      message: 'Access denied. Admin only.',
      data: null
    });
  }
  next();
};

// Get analytics dashboard data
router.get('/analytics', authorization, isAdmin, async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      paidStudents,
      unpaidStudents,
      partialStudents,
      totalRevenue,
      thisMonthRevenue
    ] = await Promise.all([
      User.countDocuments({ role: 'Student' }),
      User.countDocuments({ role: 'Student', status: 'active' }),
      User.countDocuments({ role: 'Student', feeStatus: 'paid' }),
      User.countDocuments({ role: 'Student', feeStatus: 'unpaid' }),
      User.countDocuments({ role: 'Student', feeStatus: 'partial' }),
      User.aggregate([
        { $match: { role: 'Student' } },
        { $group: { _id: null, total: { $sum: '$totalFeePaid' } } }
      ]),
      User.aggregate([
        { $match: { role: 'Student' } },
        { $unwind: '$feeHistory' },
        {
          $match: {
            'feeHistory.paymentDate': {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$feeHistory.amount' } } }
      ])
    ]);

    // Get course-wise breakdown
    const courseBreakdown = await User.aggregate([
      { $match: { role: 'Student' } },
      {
        $group: {
          _id: '$course',
          count: { $sum: 1 },
          paid: {
            $sum: { $cond: [{ $eq: ['$feeStatus', 'paid'] }, 1, 0] }
          },
          unpaid: {
            $sum: { $cond: [{ $eq: ['$feeStatus', 'unpaid'] }, 1, 0] }
          },
          revenue: { $sum: '$totalFeePaid' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Recent payments
    const recentPayments = await User.aggregate([
      { $match: { role: 'Student' } },
      { $unwind: '$feeHistory' },
      { $sort: { 'feeHistory.paymentDate': -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $project: {
          studentName: '$studentInfo.name',
          studentEmail: '$studentInfo.email',
          amount: '$feeHistory.amount',
          paymentDate: '$feeHistory.paymentDate',
          paymentMethod: '$feeHistory.paymentMethod',
          receiptNumber: '$feeHistory.receiptNumber'
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          activeStudents,
          inactiveStudents: totalStudents - activeStudents,
          paidStudents,
          unpaidStudents,
          partialStudents,
          totalRevenue: totalRevenue[0]?.total || 0,
          thisMonthRevenue: thisMonthRevenue[0]?.total || 0
        },
        courseBreakdown,
        recentPayments
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch analytics',
      data: null
    });
  }
});

// Toggle fee status (admin only)
router.put('/toggle-status/:studentId', authorization, isAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { feeStatus } = req.body;

    if (!['paid', 'unpaid', 'partial'].includes(feeStatus)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid fee status. Must be paid, unpaid, or partial',
        data: null
      });
    }

    const student = await User.findById(studentId);
    
    if (!student) {
      return res.status(404).json({
        error: true,
        message: 'Student not found',
        data: null
      });
    }

    const oldStatus = student.feeStatus;

    // Update status
    student.feeStatus = feeStatus;
    student.feesPaid = feeStatus === 'paid';
    await student.save();

    // Log the fee status change
    logger.audit.feeStatusChange({
      studentId: student._id,
      oldStatus,
      newStatus: feeStatus,
      changedBy: req.user.id,
      reason: 'Admin manual status change'
    });

    res.json({
      success: true,
      message: 'Fee status updated successfully',
      data: student
    });
  } catch (error) {
    logger.error('Toggle status error', { error: error.message, studentId: req.params.studentId });
    res.status(500).json({
      error: true,
      message: 'Failed to update fee status',
      data: null
    });
  }
});

// Add payment record
router.post('/add-payment/:studentId', authorization, isAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { amount, paymentMethod, notes, paymentDate } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: true,
        message: 'Valid payment amount is required',
        data: null
      });
    }

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        error: true,
        message: 'Student not found',
        data: null
      });
    }

    // Add payment to history
    student.feeHistory.push({
      amount: parseFloat(amount),
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || 'cash',
      receiptNumber,
      notes: notes || '',
      addedBy: req.user._id,
      status: 'confirmed'
    });

    // Update total fee paid
    student.totalFeePaid = (student.totalFeePaid || 0) + parseFloat(amount);

    // Update fee status
    if (student.totalFeePaid >= student.fees) {
      student.feeStatus = 'paid';
      student.feesPaid = true;
    } else if (student.totalFeePaid > 0) {
      student.feeStatus = 'partial';
    }

    await student.save();

    // Log payment in audit logs
    logger.audit.payment('add_payment', {
      userId: student._id,
      studentId: student._id,
      amount: parseFloat(amount),
      receiptNumber,
      paymentMethod: paymentMethod || 'cash',
      adminId: req.user.id
    });

    res.json({
      success: true,
      message: 'Payment added successfully',
      data: {
        student,
        receiptNumber
      }
    });
  } catch (error) {
    logger.error('Add payment error', { error: error.message, studentId: req.params.studentId });
    res.status(500).json({
      error: true,
      message: 'Failed to add payment',
      data: null
    });
  }
});

// Generate PDF receipt
router.get('/receipt/:receiptNumber', authorization, async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    // Find student with this receipt
    const student = await User.findOne({
      'feeHistory.receiptNumber': receiptNumber
    });

    if (!student) {
      return res.status(404).json({
        error: true,
        message: 'Receipt not found',
        data: null
      });
    }

    const payment = student.feeHistory.find(
      h => h.receiptNumber === receiptNumber
    );

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${receiptNumber}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(25).text('Al-Quran Institute Academy', { align: 'center' });
    doc.fontSize(12).text('Fee Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('_______________________________________________', { align: 'center' });
    doc.moveDown();

    // Receipt details
    doc.fontSize(12).text(`Receipt Number: ${receiptNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Student details
    doc.fontSize(14).text('Student Details:', { underline: true });
    doc.fontSize(11)
      .text(`Name: ${student.name}`)
      .text(`Email: ${student.email}`)
      .text(`Course: ${student.course}`)
      .text(`Roll No: ${student.roll_no || 'N/A'}`);
    doc.moveDown();

    // Payment details
    doc.fontSize(14).text('Payment Details:', { underline: true });
    doc.fontSize(11)
      .text(`Amount Paid: $${payment.amount.toFixed(2)}`)
      .text(`Payment Method: ${payment.paymentMethod.replace('_', ' ').toUpperCase()}`)
      .text(`Status: ${payment.status.toUpperCase()}`);
    
    if (payment.notes) {
      doc.text(`Notes: ${payment.notes}`);
    }
    doc.moveDown();

    // Fee summary
    doc.fontSize(14).text('Fee Summary:', { underline: true });
    doc.fontSize(11)
      .text(`Total Fee: $${student.fees.toFixed(2)}`)
      .text(`Total Paid: $${student.totalFeePaid.toFixed(2)}`)
      .text(`Balance: $${(student.fees - student.totalFeePaid).toFixed(2)}`)
      .text(`Status: ${student.feeStatus.toUpperCase()}`);
    doc.moveDown(2);

    // Footer
    doc.fontSize(10)
      .text('Thank you for your payment!', { align: 'center' })
      .text('For queries, contact: info@alquran-institute.com', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to generate receipt',
      data: null
    });
  }
});

// Send receipt via email
router.post('/send-receipt/:receiptNumber', authorization, isAdmin, async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const { recipientEmail } = req.body;

    // Find student with this receipt
    const student = await User.findOne({
      'feeHistory.receiptNumber': receiptNumber
    });

    if (!student) {
      return res.status(404).json({
        error: true,
        message: 'Receipt not found',
        data: null
      });
    }

    const payment = student.feeHistory.find(
      h => h.receiptNumber === receiptNumber
    );

    const emailTo = recipientEmail || student.email;

    // Create PDF in memory
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(chunks);

      // Setup email transporter (configure with your SMTP settings)
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Send email
      await transporter.sendMail({
        from: `"Al-Quran Institute" <${process.env.SMTP_USER}>`,
        to: emailTo,
        subject: `Fee Payment Receipt - ${receiptNumber}`,
        html: `
          <h2>Fee Payment Receipt</h2>
          <p>Dear ${student.name},</p>
          <p>Thank you for your payment. Please find your fee receipt attached.</p>
          <p><strong>Payment Details:</strong></p>
          <ul>
            <li>Amount: $${payment.amount.toFixed(2)}</li>
            <li>Date: ${new Date(payment.paymentDate).toLocaleDateString()}</li>
            <li>Receipt Number: ${receiptNumber}</li>
          </ul>
          <p>If you have any questions, please contact us.</p>
          <p>Best regards,<br>Al-Quran Institute Academy</p>
        `,
        attachments: [{
          filename: `receipt-${receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });

      res.json({
        success: true,
        message: `Receipt sent to ${emailTo}`,
        data: null
      });
    });

    // Generate PDF content (same as above)
    doc.fontSize(25).text('Al-Quran Institute Academy', { align: 'center' });
    doc.fontSize(12).text('Fee Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('_______________________________________________', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Receipt Number: ${receiptNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();
    doc.fontSize(14).text('Student Details:', { underline: true });
    doc.fontSize(11)
      .text(`Name: ${student.name}`)
      .text(`Email: ${student.email}`)
      .text(`Course: ${student.course}`)
      .text(`Roll No: ${student.roll_no || 'N/A'}`);
    doc.moveDown();
    doc.fontSize(14).text('Payment Details:', { underline: true });
    doc.fontSize(11)
      .text(`Amount Paid: $${payment.amount.toFixed(2)}`)
      .text(`Payment Method: ${payment.paymentMethod.replace('_', ' ').toUpperCase()}`)
      .text(`Status: ${payment.status.toUpperCase()}`);
    if (payment.notes) {
      doc.text(`Notes: ${payment.notes}`);
    }
    doc.moveDown();
    doc.fontSize(14).text('Fee Summary:', { underline: true });
    doc.fontSize(11)
      .text(`Total Fee: $${student.fees.toFixed(2)}`)
      .text(`Total Paid: $${student.totalFeePaid.toFixed(2)}`)
      .text(`Balance: $${(student.fees - student.totalFeePaid).toFixed(2)}`)
      .text(`Status: ${student.feeStatus.toUpperCase()}`);
    doc.moveDown(2);
    doc.fontSize(10)
      .text('Thank you for your payment!', { align: 'center' })
      .text('For queries, contact: info@alquran-institute.com', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Send receipt error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to send receipt',
      data: null
    });
  }
});

// Get student payment history
router.get('/payment-history/:studentId', authorization, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if user is admin or the student themselves
    if (req.user.role !== 'Admin' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        error: true,
        message: 'Access denied',
        data: null
      });
    }

    const student = await User.findById(studentId)
      .select('name email course fees feeStatus totalFeePaid feeHistory')
      .lean();

    if (!student) {
      return res.status(404).json({
        error: true,
        message: 'Student not found',
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        student: {
          name: student.name,
          email: student.email,
          course: student.course,
          totalFee: student.fees,
          totalPaid: student.totalFeePaid,
          balance: student.fees - student.totalFeePaid,
          status: student.feeStatus
        },
        payments: student.feeHistory.sort((a, b) => 
          new Date(b.paymentDate) - new Date(a.paymentDate)
        )
      }
    });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch payment history',
      data: null
    });
  }
});

export default router;
