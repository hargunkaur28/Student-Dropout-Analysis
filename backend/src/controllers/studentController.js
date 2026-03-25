import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import Grade from "../models/Grade.js";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import { uploadImage, deleteImage } from "../config/cloudinary.js";
import { calculateRiskScore } from "../services/riskCalculator.js";
import { sendRiskAlertToParents } from "../services/riskAlertService.js";
import logger from "../utils/logger.js";

// @desc    Get all students with filtering, sorting, and pagination
// @route   GET /api/v1/students
// @access  Private (Admin, Teacher, Counselor)
export const getAllStudents = asyncHandler(async (req, res, next) => {
  const {
    class: classId,
    section,
    riskLevel,
    status,
    search,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  // Build query
  const query = {};

  if (classId) query.class = classId;
  if (section) query.section = section.toUpperCase();
  if (riskLevel) query.riskLevel = riskLevel;
  if (status) query.status = status;

  // Text search on multiple fields
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { rollNumber: { $regex: search, $options: "i" } },
      { admissionNumber: { $regex: search, $options: "i" } },
    ];
  }

  // If teacher, only show their class students
  if (req.user.role === "teacher") {
    query.class = { $in: req.user.assignedClasses };
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: order === "desc" ? -1 : 1 };

  // Execute query
  const [students, total] = await Promise.all([
    Student.find(query)
      .populate("class", "name standard section")
      .populate("createdBy", "firstName lastName")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Student.countDocuments(query),
  ]);

  res.status(200).json({
    status: "success",
    results: students.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
    data: {
      students,
    },
  });
});

// @desc    Get single student by ID
// @route   GET /api/v1/students/:id
// @access  Private
export const getStudentById = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id)
    .populate("class", "name standard section classTeacher")
    .populate("createdBy", "firstName lastName")
    .populate("lastUpdatedBy", "firstName lastName");

  if (!student) {
    return next(new AppError("Student not found", 404));
  }

  // Get additional data
  const [attendanceSummary, grades, interventionCount] = await Promise.all([
    Attendance.getStudentSummary(
      student._id,
      new Date(new Date().getFullYear(), 0, 1), // Start of academic year
      new Date()
    ),
    Grade.getSubjectPerformance(student._id, "2024-2025"), // Current academic year
    // Count active interventions (if Intervention model exists)
    // Intervention.countDocuments({ student: student._id, status: 'In Progress' })
    0, // Placeholder
  ]);

  // Ensure risk data is consistent - use stored values from database
  const studentData = student.toObject();
  
  res.status(200).json({
    status: "success",
    data: {
      student: studentData,
      attendanceSummary,
      grades,
      interventionCount,
    },
  });
});

// @desc    Create new student
// @route   POST /api/v1/students
// @access  Private (Admin, Teacher)
export const createStudent = asyncHandler(async (req, res, next) => {
  const studentData = { ...req.body };

  // Check if roll number already exists
  if (studentData.rollNumber) {
    const existingStudent = await Student.findOne({ 
      rollNumber: studentData.rollNumber.toUpperCase().trim() 
    });
    
    if (existingStudent) {
      return next(new AppError(`Roll number ${studentData.rollNumber} is already assigned to ${existingStudent.firstName} ${existingStudent.lastName}`, 400));
    }
  }

  // Handle photo upload if present
  if (req.files && req.files.photo) {
    const photoResult = await uploadImage(
      req.files.photo.tempFilePath,
      "students"
    );
    studentData.photo = photoResult;
  }

  // Set created by
  studentData.createdBy = req.user._id;

  // Create student
  const student = await Student.create(studentData);

  // Calculate initial risk score
  const riskData = await calculateRiskScore(student._id);
  student.riskScore = riskData.totalRiskScore;
  student.riskFactors = riskData.factors;
  await student.save();

  // Populate relations
  await student.populate("class", "name standard section");

  logger.info(
    `New student created: ${student.fullName} (${student.rollNumber}) by ${req.user.email}`
  );

  res.status(201).json({
    status: "success",
    message: "Student created successfully",
    data: {
      student,
    },
  });
});

// @desc    Update student
// @route   PUT /api/v1/students/:id
// @access  Private (Admin, Teacher)
export const updateStudent = asyncHandler(async (req, res, next) => {
  let student = await Student.findById(req.params.id);

  if (!student) {
    return next(new AppError("Student not found", 404));
  }

  const updateData = { ...req.body };

  // Check if roll number is being changed and if it already exists
  if (updateData.rollNumber && updateData.rollNumber !== student.rollNumber) {
    const existingStudent = await Student.findOne({ 
      rollNumber: updateData.rollNumber.toUpperCase().trim(),
      _id: { $ne: req.params.id } // Exclude current student
    });
    
    if (existingStudent) {
      return next(new AppError(`Roll number ${updateData.rollNumber} is already assigned to ${existingStudent.firstName} ${existingStudent.lastName}`, 400));
    }
  }

  // Handle photo upload if present
  if (req.files && req.files.photo) {
    // Delete old photo from Cloudinary
    if (student.photo && student.photo.publicId) {
      await deleteImage(student.photo.publicId);
    }

    // Upload new photo
    const photoResult = await uploadImage(
      req.files.photo.tempFilePath,
      "students"
    );
    updateData.photo = photoResult;
  }

  // Set last updated by
  updateData.lastUpdatedBy = req.user._id;

  // Store previous risk level before update
  const previousRiskLevel = student.riskLevel;

  // Update student
  student = await Student.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).populate("class", "name standard section");

  // Recalculate risk score
  const riskData = await calculateRiskScore(student._id);
  student.riskScore = riskData.totalRiskScore;
  student.riskFactors = riskData.factors;
  await student.save();

  logger.info(
    `Student updated: ${student.fullName} (${student.rollNumber}) by ${req.user.email}`
  );

  // Send risk alert to parents if risk level is Medium, High, or Critical
  if (['Medium', 'High', 'Critical'].includes(student.riskLevel)) {
    try {
      await sendRiskAlertToParents(student, previousRiskLevel);
      logger.info(`✅ Risk alert sent for ${student.firstName} ${student.lastName}`);
    } catch (alertError) {
      logger.error('Failed to send risk alert:', alertError);
      // Don't fail the update if alert fails
    }
  }

  res.status(200).json({
    status: "success",
    message: "Student updated successfully",
    data: {
      student,
    },
  });
});

// @desc    Delete student
// @route   DELETE /api/v1/students/:id
// @access  Private (Admin only)
export const deleteStudent = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return next(new AppError("Student not found", 404));
  }

  // Delete photo from Cloudinary
  if (student.photo && student.photo.publicId) {
    await deleteImage(student.photo.publicId);
  }

  // Soft delete - just mark as inactive
  student.isActive = false;
  student.status = "Dropout";
  await student.save();

  logger.info(
    `Student deleted: ${student.fullName} (${student.rollNumber}) by ${req.user.email}`
  );

  res.status(200).json({
    status: "success",
    message: "Student deleted successfully",
  });
});

// @desc    Bulk import students from CSV
// @route   POST /api/v1/students/bulk-import
// @access  Private (Admin only)
export const bulkImportStudents = asyncHandler(async (req, res, next) => {
  // CSV parsing logic here
  // For now, return placeholder response

  res.status(200).json({
    status: "success",
    message: "Bulk import functionality to be implemented",
    data: {
      imported: 0,
      failed: 0,
    },
  });
});

// @desc    Get student risk analysis
// @route   GET /api/v1/students/:id/risk-analysis
// @access  Private
export const getStudentRiskAnalysis = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return next(new AppError("Student not found", 404));
  }

  // Recalculate risk score
  const riskData = await calculateRiskScore(student._id);

  // Determine risk level based on score
  let riskLevel = 'Low';
  if (riskData.totalRiskScore >= 70) {
    riskLevel = 'High';
  } else if (riskData.totalRiskScore >= 40) {
    riskLevel = 'Medium';
  }

  // Update student with new risk data
  student.riskScore = riskData.totalRiskScore;
  student.riskLevel = riskLevel;
  student.riskFactors = riskData.factors;
  await student.save();

  // Get historical risk data (implement based on your needs)
  const riskHistory = []; // Placeholder

  res.status(200).json({
    status: "success",
    data: {
      currentRisk: {
        score: riskData.totalRiskScore,
        level: riskLevel,
        factors: riskData.factors,
      },
      breakdown: riskData.breakdown,
      history: riskHistory,
      recommendations: riskData.recommendations || [],
      dropoutPrediction: riskData.dropoutPrediction || null,
    },
  });
});

// @desc    Get student timeline (attendance, grades, interventions)
// @route   GET /api/v1/students/:id/timeline
// @access  Private
export const getStudentTimeline = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return next(new AppError("Student not found", 404));
  }

  // Get recent activities
  const [recentAttendance, recentGrades] = await Promise.all([
    Attendance.find({ student: student._id })
      .sort({ date: -1 })
      .limit(30)
      .lean(),
    Grade.find({ student: student._id })
      .sort({ examDate: -1 })
      .limit(10)
      .lean(),
  ]);

  // Combine and sort timeline events
  const timeline = [
    ...recentAttendance.map((a) => ({
      type: "attendance",
      date: a.date,
      data: a,
    })),
    ...recentGrades.map((g) => ({
      type: "grade",
      date: g.examDate,
      data: g,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  res.status(200).json({
    status: "success",
    data: {
      timeline,
    },
  });
});

// @desc    Get next available roll number for a class/section
// @route   GET /api/v1/students/next-roll-number/:section
// @access  Private
export const getNextRollNumber = asyncHandler(async (req, res, next) => {
  const { section } = req.params;

  if (!section) {
    return next(new AppError("Section is required", 400));
  }

  // Find the highest roll number in this section
  const lastStudent = await Student.findOne({ section })
    .sort({ rollNumber: -1 })
    .select("rollNumber")
    .lean();

  let nextRollNumber;
  
  if (lastStudent && lastStudent.rollNumber) {
    // Extract the numeric part from the roll number
    // Assuming format like "9A-001", "10B-015", etc.
    const match = lastStudent.rollNumber.match(/(\d+)$/);
    if (match) {
      const lastNumber = parseInt(match[1]);
      const nextNumber = lastNumber + 1;
      // Pad with zeros to maintain 3 digits
      nextRollNumber = `${section}-${String(nextNumber).padStart(3, '0')}`;
    } else {
      // If no match, start from 001
      nextRollNumber = `${section}-001`;
    }
  } else {
    // No students in this section yet, start from 001
    nextRollNumber = `${section}-001`;
  }

  logger.info(`Next roll number for section ${section}: ${nextRollNumber}`);

  res.status(200).json({
    status: "success",
    data: {
      section,
      nextRollNumber,
    },
  });
});

// @desc    Get students at risk
// @route   GET /api/v1/students/at-risk
// @access  Private
export const getAtRiskStudents = asyncHandler(async (req, res, next) => {
  const { urgency = "all", limit = 50 } = req.query;

  const query = {
    riskLevel: { $in: ["Medium", "High", "Critical"] },
    isActive: true,
  };

  // Filter by urgency
  if (urgency === "critical") {
    query.riskLevel = "Critical";
  } else if (urgency === "high") {
    query.riskLevel = { $in: ["High", "Critical"] };
  }

  // If teacher, only show their students
  if (req.user.role === "teacher") {
    query.class = { $in: req.user.assignedClasses };
  }

  const students = await Student.find(query)
    .populate("class", "name standard section")
    .sort({ riskScore: -1 })
    .limit(parseInt(limit))
    .lean();

  res.status(200).json({
    status: "success",
    results: students.length,
    data: {
      students,
    },
  });
});

// Remove the default export at the end since we're using named exports
