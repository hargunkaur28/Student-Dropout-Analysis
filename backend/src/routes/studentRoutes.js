import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import fs from 'fs';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Class from '../models/Class.js';
import logger from '../utils/logger.js';
import { getIO } from '../socket/socketHandler.js';
import { sendEmail } from '../services/emailService.js';
import { sendRiskAlertToParents } from '../services/riskAlertService.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    logger.info(`File filter check: ${file.originalname}, mimetype: ${file.mimetype}`);
    
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      logger.error(`Invalid file type: ${file.mimetype}`);
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer error:', error);
    return res.status(400).json({
      success: false,
      message: `Upload error: ${error.message}`
    });
  } else if (error) {
    logger.error('File upload error:', error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next();
};

// Bulk upload students
router.post('/bulk-upload', upload.single('file'), handleMulterError, async (req, res) => {
  try {
    logger.info('Bulk upload request received');
    
    if (!req.file) {
      logger.error('No file uploaded in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    logger.info(`File uploaded: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);

    const filePath = req.file.path;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    
    logger.info(`Processing bulk upload: ${req.file.originalname}`);

    let studentsData = [];

    // Parse file based on type
    if (fileExtension === 'csv') {
      // Parse CSV
      studentsData = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse Excel
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      studentsData = xlsx.utils.sheet_to_json(worksheet);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (!studentsData || studentsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in file'
      });
    }

    const results = {
      totalRecords: studentsData.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      parentsCreated: 0,
      parentsLinked: 0
    };

    // Process each student record
    for (let i = 0; i < studentsData.length; i++) {
      const rawRow = studentsData[i];
      let currentRollNumber = 'Unknown'; // Store roll number for error reporting

      try {
        // Normalize keys to be case-insensitive and whitespace-safe
        const row = {};
        Object.keys(rawRow || {}).forEach((key) => {
          if (!key) return;
          const trimmed = key.trim();
          const lower = trimmed.toLowerCase();
          const noSpace = lower.replace(/\s+/g, '');
          row[trimmed] = rawRow[key];
          row[lower] = rawRow[key];
          row[noSpace] = rawRow[key];
        });

        const getField = (...keys) => {
          for (const key of keys) {
            if (!key) continue;
            const variants = [
              key,
              key.toLowerCase(),
              key.toLowerCase().replace(/\s+/g, ''),
              key.replace(/[()%]/g, '').toLowerCase(), // Remove () and % for matching
              key.replace(/[()%]/g, '').toLowerCase().replace(/\s+/g, ''),
            ];
            for (const v of variants) {
              if (row[v] !== undefined && row[v] !== '') {
                return row[v];
              }
            }
          }
          return undefined;
        };

        // Handle misaligned columns: check common mismatched header names
        // If "Risk" column has numeric data, it's likely attendance %
        // If "Academic Score (%)" has text like "Low/Medium/High", it's likely risk level
        // If "Roll no." has numeric data but not sequential 1,2,3, it might be academic score

        // Support both "firstName"/"lastName" and combined "name" field
        let firstName = getField('firstName', 'firstname', 'first name');
        let lastName = getField('lastName', 'lastname', 'last name');

        // Try to find name in various column name variations (including truncated ones from Excel)
        const fullName = getField('name', 'studentName', 'student name', 'studentna', 'student na', 'studentname');
        if (!firstName && !lastName && fullName) {
          const nameParts = String(fullName).trim().split(/\s+/);
          firstName = nameParts[0] || 'Student';
          lastName = nameParts.slice(1).join(' ') || 'Student';
        }

        // Get class/section - handle both combined (e.g., "11A") and separate columns
        let sectionValue;
        const classField = getField('class', 'Class');
        const sectionField = getField('section', 'Section');
        
        if (classField && sectionField) {
          // Separate columns: combine them (e.g., class="11", section="A" -> "11A")
          sectionValue = `${classField}${sectionField}`.toString().toUpperCase().replace(/\s+/g, '');
        } else {
          // Combined column or fallback
          sectionValue = (getField('class', 'section', 'Class', 'Section') || '10A')
            .toString()
            .toUpperCase()
            .replace(/\s+/g, '');
        }

        // Generate a roll number if not provided
        let rollNumber = getField('rollNumber', 'rollno', 'roll', 'roll number', 'Roll no.', 'Roll No', 'RollNo', 'rollno.');
        
        // Check for roll number in unheaded column (xlsx creates keys like "__EMPTY", "__EMPTY_1", etc.)
        if (!rollNumber) {
          // Check all keys for unheaded columns (usually start with __EMPTY)
          const emptyKeys = Object.keys(row).filter(k => k.startsWith('__EMPTY') || k === '' || !k.trim());
          for (const key of emptyKeys) {
            const value = row[key];
            // If it's a simple sequential number (1, 2, 3...), likely roll number
            if (value !== undefined && value !== '' && !isNaN(Number(value)) && Number(value) <= 100) {
              rollNumber = value.toString();
              logger.info(`⚠️ Found roll number in unheaded column: ${rollNumber}`);
              break;
            }
          }
        }
        
        if (!rollNumber) {
          // Auto-generate sequential roll number for this section
          const lastStudent = await Student.findOne({ section: sectionValue })
            .sort({ rollNumber: -1 })
            .select('rollNumber')
            .lean();

          if (lastStudent && lastStudent.rollNumber) {
            const match = lastStudent.rollNumber.match(/(\d+)$/);
            if (match) {
              const lastNumber = parseInt(match[1]);
              const nextNumber = lastNumber + 1;
              rollNumber = `${sectionValue}-${String(nextNumber).padStart(3, '0')}`;
            } else {
              rollNumber = `${sectionValue}-001`;
            }
          } else {
            rollNumber = `${sectionValue}-001`;
          }
          
          logger.info(`✅ Auto-generated roll number: ${rollNumber} for section ${sectionValue}`);
        }

        // Store roll number for error reporting
        currentRollNumber = rollNumber;

        // Debug logging for first row to help troubleshoot
        if (i === 0) {
          logger.info(`📋 First row sample - Raw keys: ${Object.keys(rawRow).join(', ')}`);
          logger.info(`📋 Raw row values: ${JSON.stringify(rawRow)}`);
          logger.info(`📋 Normalized row keys: ${Object.keys(row).join(', ')}`);
        }

        if (!firstName || !lastName) {
          logger.error(`❌ Row ${i + 1}: Missing name fields. Found keys: ${Object.keys(rawRow).join(', ')}`);
          throw new Error(`Row ${i + 1}: Missing required fields: name / firstName + lastName. Found: ${firstName || 'missing'} ${lastName || 'missing'}`);
        }

        // Check for duplicate roll number
        const existingStudent = await Student.findOne({
          rollNumber: rollNumber.toString().toUpperCase()
        });

        if (existingStudent) {
          throw new Error(`Roll number ${rollNumber} already exists`);
        }

        // Get attendance - check both correct column and misaligned "Risk" column
        let attendanceRaw = getField('attendance', 'Attendance', 'attendance%', 'Attendance %');
        // If attendance column is empty but "Risk" column has numeric data, use that
        if ((!attendanceRaw || attendanceRaw === '') && row['Risk']) {
          const riskColValue = row['Risk'];
          // Check if it's a number (likely attendance % in wrong column)
          if (!isNaN(Number(riskColValue)) && riskColValue !== '') {
            attendanceRaw = riskColValue;
            logger.info(`⚠️ Found attendance data in "Risk" column: ${attendanceRaw}`);
          }
        }
        const attendancePercentage =
          attendanceRaw !== undefined && attendanceRaw !== ''
            ? Number(attendanceRaw)
            : 100;

        // Get academic score - check both correct column and misaligned "Roll no." column
        let academicRaw = getField('academicScore', 'academic score', 'Academic Score', 'overallPercentage', 'overall percentage', 'Academic Score (%)');
        // If academic column is empty but "Roll no." has numeric data (not sequential 1,2,3), use that
        if ((!academicRaw || academicRaw === '') && row['Roll no.']) {
          const rollColValue = row['Roll no.'];
          // Check if it's a number and not a simple sequential roll number
          if (!isNaN(Number(rollColValue)) && rollColValue !== '' && Number(rollColValue) > 10) {
            academicRaw = rollColValue;
            logger.info(`⚠️ Found academic score data in "Roll no." column: ${academicRaw}`);
          }
        }
        const overallPercentage =
          academicRaw !== undefined && academicRaw !== ''
            ? Number(academicRaw)
            : 0;

        // Calculate risk based on attendance/academic, but allow overrides from:
        // - textual level (risk/riskLevel)
        // - numeric percent (risk% / riskPercentage / risk score)
        let riskScore = 0;
        let riskLevel = 'Low';

        if (attendancePercentage < 70 || overallPercentage < 50) {
          riskScore = Math.max(100 - attendancePercentage, 100 - overallPercentage);
          if (riskScore >= 80) riskLevel = 'Critical';
          else if (riskScore >= 60) riskLevel = 'High';
          else if (riskScore >= 40) riskLevel = 'Medium';
          else riskLevel = 'Low';
        }

        // Check for numeric risk percentage from file
        const riskPercentRaw = getField('risk%', 'riskpercent', 'risk percentage', 'riskpercentage', 'riskscore', 'risk score');
        if (riskPercentRaw !== undefined && riskPercentRaw !== '') {
          const numericRisk = Number(riskPercentRaw);
          if (!Number.isNaN(numericRisk)) {
            riskScore = numericRisk;
            if (numericRisk >= 80) riskLevel = 'Critical';
            else if (numericRisk >= 60) riskLevel = 'High';
            else if (numericRisk >= 40) riskLevel = 'Medium';
            else riskLevel = 'Low';
          }
        }

        // Get risk level - check "Academic Score (%)" column for text risk levels (misaligned data)
        // The "Risk" column actually contains attendance %, so skip it for risk level
        let explicitRisk = null;
        
        // Check Academic Score (%) column for text risk levels (Medium, High, Low, etc.)
        const academicScoreColValue = row['Academic Score (%)'] || row['Academic Score'] || row['academic score (%)'];
        if (academicScoreColValue && isNaN(Number(academicScoreColValue))) {
          // It's text, likely a risk level
          explicitRisk = academicScoreColValue;
          logger.info(`⚠️ Found risk level data in "Academic Score (%)" column: ${explicitRisk}`);
        }
        
        // Also check standard risk column names (in case file is correctly formatted)
        if (!explicitRisk) {
          explicitRisk = getField('risk', 'riskLevel', 'risk level');
        }
        
        if (explicitRisk) {
          const normalized = String(explicitRisk).trim().toLowerCase();
          if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
            riskLevel = normalized.charAt(0).toUpperCase() + normalized.slice(1);
            // Set risk score based on level if we have level but not numeric score
            if (!riskPercentRaw || riskPercentRaw === '') {
              if (riskLevel === 'Critical') riskScore = 85;
              else if (riskLevel === 'High') riskScore = 65;
              else if (riskLevel === 'Medium') riskScore = 45;
              else riskScore = 20;
            }
          }
        }

        // Debug logging after extraction
        if (i === 0) {
          logger.info(`✅ Extracted values - Name: ${firstName} ${lastName}, Roll: ${rollNumber}, Section: ${sectionValue}, Attendance: ${attendancePercentage}%, Academic: ${overallPercentage}%, Risk: ${riskLevel} (${riskScore})`);
        }

        // Helper function to validate and clean phone numbers
        const cleanPhone = (phoneValue) => {
          if (!phoneValue) return '0000000000';
          
          // Handle scientific notation (e.g., 9.88E+09)
          let phoneStr = String(phoneValue);
          if (phoneStr.includes('E+') || phoneStr.includes('e+')) {
            // Convert from scientific notation
            const numValue = parseFloat(phoneStr);
            if (!isNaN(numValue)) {
              phoneStr = Math.round(numValue).toString();
            }
          }
          
          // Remove non-digits
          phoneStr = phoneStr.replace(/\D/g, '');
          
          // Handle 11-digit numbers (with country code starting with 91 for India)
          if (phoneStr.length === 11 && phoneStr.startsWith('91')) {
            phoneStr = phoneStr.substring(2);
          }
          
          // Handle 12-digit numbers (with country code starting with 91 for India)
          if (phoneStr.length === 12 && phoneStr.startsWith('91')) {
            phoneStr = phoneStr.substring(2);
          }
          
          if (phoneStr.length === 10 && /^\d{10}$/.test(phoneStr)) {
            return phoneStr;
          }
          
          // If still not 10 digits, try to extract last 10 digits
          if (phoneStr.length > 10) {
            phoneStr = phoneStr.slice(-10);
            if (/^\d{10}$/.test(phoneStr)) {
              return phoneStr;
            }
          }
          
          return '0000000000';
        };

        // Helper to get value or default
        const getValue = (value, defaultValue = 'N/A') => {
          return value && String(value).trim() !== '' ? String(value).trim() : defaultValue;
        };

        // Create comprehensive student data matching Add Student form
        const studentData = {
          // Personal Information
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          middleName: getValue(getField('middleName', 'middle name'), ''),
          rollNumber: rollNumber.toString().toUpperCase().trim(),
          admissionNumber: getValue(getField('admissionNumber', 'admission number', 'admission no'), `ADM${Date.now()}_${i}`),
          section: sectionValue,
          email: getField('email', 'studentEmail', 'student email')?.toLowerCase().trim() || undefined,
          phone: cleanPhone(getField('phone', 'studentPhone', 'student phone')),
          dateOfBirth: (() => {
            const dobField = getField('dateOfBirth', 'dob', 'date of birth', 'dateofbir', 'date of bir');
            if (!dobField) return new Date('2010-01-01');
            
            // Handle Excel date serial numbers (Excel stores dates as numbers)
            const dobValue = String(dobField).trim();
            
            // If it's a number (Excel serial date), convert it
            if (!isNaN(dobValue) && !dobValue.includes('-') && !dobValue.includes('/')) {
              try {
                // Excel serial date: days since January 1, 1900
                const excelSerialDate = parseFloat(dobValue);
                if (excelSerialDate > 1 && excelSerialDate < 100000) {
                  // Convert Excel serial date to JavaScript date
                  const excelEpoch = new Date(1899, 11, 30); // Excel epoch
                  const jsDate = new Date(excelEpoch.getTime() + excelSerialDate * 86400000);
                  if (!isNaN(jsDate.getTime())) {
                    return jsDate;
                  }
                }
              } catch (e) {
                logger.warn(`Failed to parse Excel date serial number: ${dobValue}`);
              }
            }
            
            // Try parsing as standard date string
            try {
              const parsedDate = new Date(dobField);
              if (!isNaN(parsedDate.getTime())) {
                return parsedDate;
              }
            } catch (e) {
              // Fall through to default
            }
            
            return new Date('2010-01-01');
          })(),
          dateOfAdmission: getField('dateOfAdmission', 'admission date') ? new Date(getField('dateOfAdmission', 'admission date')) : new Date(),
          gender: getValue(getField('gender'), 'Male'),
          bloodGroup: getField('bloodGroup', 'blood group') || undefined,

          // Address - handle single address field or separate fields
          address: (() => {
            const addressField = getField('address', 'Address');
            const streetField = getField('street', 'address street');
            const cityField = getField('city', 'address city', 'City');
            const stateField = getField('state', 'address state', 'State');
            const pincodeField = getField('pincode', 'pin code', 'address pincode', 'Pincode');
            
            // If address is a single field (like "Delhi"), use it as city
            if (!cityField && addressField && addressField !== 'N/A') {
              return {
                street: getValue(streetField, addressField),
                city: getValue(cityField, addressField),
                state: getValue(stateField, 'N/A'),
                pincode: getValue(pincodeField, '000000')
              };
            }
            
            return {
              street: getValue(streetField, addressField || 'N/A'),
              city: getValue(cityField, 'N/A'),
              state: getValue(stateField, 'N/A'),
              pincode: getValue(pincodeField, '000000')
            };
          })(),

          // Father Information
          father: {
            name: getValue(getField('fatherName', 'father name', 'parentName', 'parent name', 'parentnai', 'parent nai', 'parentname'), 'N/A'),
            phone: cleanPhone(getField('fatherPhone', 'father phone', 'parentPhone', 'parent phone', 'parentcor', 'parent cor', 'parentcontact')),
            email: getField('fatherEmail', 'father email', 'parentEmail', 'parent email')?.toLowerCase().trim() || undefined,
            occupation: getValue(getField('fatherOccupation', 'father occupation'), 'N/A'),
            education: getField('fatherEducation', 'father education') || undefined,
            income: getField('fatherIncome', 'father income') ? Number(getField('fatherIncome', 'father income')) : undefined
          },

          // Mother Information
          mother: {
            name: getValue(getField('motherName', 'mother name'), 'N/A'),
            phone: cleanPhone(getField('motherPhone', 'mother phone')),
            email: getField('motherEmail', 'mother email')?.toLowerCase().trim() || undefined,
            occupation: getValue(getField('motherOccupation', 'mother occupation'), 'N/A'),
            education: getField('motherEducation', 'mother education') || undefined,
            income: getField('motherIncome', 'mother income') ? Number(getField('motherIncome', 'mother income')) : undefined
          },

          // Guardian Information (optional)
          guardian: getField('guardianName', 'guardian name') ? {
            name: getValue(getField('guardianName', 'guardian name'), ''),
            phone: cleanPhone(getField('guardianPhone', 'guardian phone')),
            email: getField('guardianEmail', 'guardian email')?.toLowerCase().trim() || undefined,
            relation: getValue(getField('guardianRelation', 'guardian relation'), '')
          } : undefined,

          // Previous School (optional)
          previousSchool: getField('previousSchoolName', 'previous school') ? {
            name: getValue(getField('previousSchoolName', 'previous school'), ''),
            address: getValue(getField('previousSchoolAddress', 'previous school address'), ''),
            lastClass: getValue(getField('previousSchoolClass', 'previous class'), '')
          } : undefined,

          // Siblings
          siblings: {
            count: getField('siblingsCount', 'siblings count', 'siblings') ? Number(getField('siblingsCount', 'siblings count', 'siblings')) : 0,
            inSchool: getField('siblingsInSchool', 'siblings in school') ? Number(getField('siblingsInSchool', 'siblings in school')) : 0
          },

          // Family & Risk Factors
          familyIncomeLevel: getValue(getField('familyIncomeLevel', 'family income', 'income level'), 'Middle Income'),
          distanceFromSchool: getField('distanceFromSchool', 'distance') ? Number(getField('distanceFromSchool', 'distance')) : 5,
          transportationMode: getValue(getField('transportationMode', 'transportation', 'transport'), 'School Bus'),
          
          // Health & Behavioral
          hasHealthIssues: getField('hasHealthIssues', 'health issues') === 'Yes' || getField('hasHealthIssues', 'health issues') === true,
          healthDetails: getValue(getField('healthDetails', 'health details'), ''),
          hasBehavioralIssues: getField('hasBehavioralIssues', 'behavioral issues') === 'Yes' || getField('hasBehavioralIssues', 'behavioral issues') === true,
          behavioralDetails: getValue(getField('behavioralDetails', 'behavioral details'), ''),
          hasFamilyProblems: getField('hasFamilyProblems', 'family problems') === 'Yes' || getField('hasFamilyProblems', 'family problems') === true,
          familyProblemDetails: getValue(getField('familyProblemDetails', 'family problem details'), ''),
          hasEconomicDistress: getField('hasEconomicDistress', 'economic distress') === 'Yes' || getField('hasEconomicDistress', 'economic distress') === true,
          economicDistressDetails: getValue(getField('economicDistressDetails', 'economic distress details'), ''),
          previousDropoutAttempts: getField('previousDropoutAttempts', 'dropout attempts') ? Number(getField('previousDropoutAttempts', 'dropout attempts')) : 0,

          // Academic Performance
          attendancePercentage,
          overallPercentage,
          riskScore,
          riskLevel,
          
          // Status
          status: getValue(getField('status'), 'Active'),
          isActive: true
        };

        // Save student
        const newStudent = new Student(studentData);
        await newStudent.save();
        
        logger.info(`✅ Bulk upload - Student created: ${studentData.rollNumber}`);

        // *** AUTO-CREATE PARENT ACCOUNT ***
        if (studentData.father && studentData.father.email) {
          try {
            const parentEmail = studentData.father.email.toLowerCase().trim();
            
            // Check if parent account already exists
            const existingParent = await User.findOne({ email: parentEmail });
            
            if (existingParent) {
              // Link student to existing parent
              if (!existingParent.children.includes(newStudent._id)) {
                existingParent.children.push(newStudent._id);
                await existingParent.save();
                results.parentsLinked++;
                logger.info(`✅ Bulk upload - Student linked to existing parent: ${parentEmail}`);
              }
            } else {
              // Create new parent account
              const parentPassword = `${firstName}2025`;
              
              const newParentData = {
                firstName: studentData.father.name.split(' ')[0] || 'Parent',
                lastName: studentData.father.name.split(' ').slice(1).join(' ') || lastName,
                email: parentEmail,
                phone: studentData.father.phone,
                password: parentPassword,
                role: 'parent',
                children: [newStudent._id],
                isActive: true,
                notificationPreferences: {
                  email: true,
                  sms: true,
                  inApp: true
                }
              };

              const newParent = new User(newParentData);
              await newParent.save();
              
              results.parentsCreated++;
              logger.info(`✅ Bulk upload - Parent account created: ${parentEmail} with password: ${parentPassword}`);

              // Send welcome email to parent
              try {
                await sendEmail({
                  to: parentEmail,
                  subject: 'Welcome to Student Dropout Prevention System - Parent Portal',
                  html: `
                    <h2>Welcome to Student Dropout Prevention System</h2>
                    <p>Dear ${studentData.father.name},</p>
                    <p>A parent account has been created for you to monitor your child's academic progress.</p>
                    <h3>Your Login Credentials:</h3>
                    <p><strong>Email:</strong> ${parentEmail}</p>
                    <p><strong>Password:</strong> ${parentPassword}</p>
                    <p><strong>Student:</strong> ${firstName} ${lastName} (${rollNumber})</p>
                    <p>Please login to access your child's information and receive important updates.</p>
                    <p>You can change your password after logging in.</p>
                    <br>
                    <p>Best regards,<br>School Administration</p>
                  `
                });
                logger.info(`✅ Bulk upload - Welcome email sent to: ${parentEmail}`);
              } catch (emailError) {
                logger.warn(`⚠️ Bulk upload - Failed to send welcome email to ${parentEmail}: ${emailError.message}`);
              }
            }
          } catch (parentError) {
            logger.warn(`⚠️ Bulk upload - Failed to create parent account for ${studentData.rollNumber}: ${parentError.message}`);
            // Don't fail the whole upload if parent creation fails
          }
        }

        // Send risk alert if student is at Medium, High, or Critical risk
        if (['Medium', 'High', 'Critical'].includes(studentData.riskLevel)) {
          try {
            await sendRiskAlertToParents(newStudent);
            logger.info(`✅ Bulk upload - Risk alert sent for ${studentData.rollNumber}`);
          } catch (alertError) {
            logger.warn(`⚠️ Bulk upload - Failed to send risk alert for ${studentData.rollNumber}: ${alertError.message}`);
            // Don't fail the upload if alert fails
          }
        }
        
        results.successCount++;
        logger.info(`✅ Bulk upload - Completed processing: ${studentData.rollNumber}`);

      } catch (error) {
        results.errorCount++;
        const errorMsg = error.message || error.toString() || 'Unknown error';
        results.errors.push({
          row: i + 1,
          rollNumber: currentRollNumber,
          error: errorMsg
        });
        logger.error(`❌ Bulk upload error for row ${i + 1} (Roll: ${currentRollNumber}): ${errorMsg}`);
        if (error.stack) {
          logger.error(`Stack trace: ${error.stack}`);
        }
      }
    }

    // Emit socket event for bulk update
    try {
      const io = getIO();
      if (io) {
        io.emit('students:bulk-updated', {
          successCount: results.successCount,
          errorCount: results.errorCount
        });
        logger.info(`📡 Socket event emitted: students:bulk-updated`);
      }
    } catch (socketError) {
      logger.error('Socket emission error:', socketError);
    }

    // Build success message
    let message = `Bulk upload completed. ${results.successCount} students added successfully.`;
    if (results.parentsCreated > 0) {
      message += ` ${results.parentsCreated} parent accounts created.`;
    }
    if (results.parentsLinked > 0) {
      message += ` ${results.parentsLinked} students linked to existing parents.`;
    }

    res.json({
      success: true,
      message: message,
      data: results
    });

  } catch (error) {
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    logger.error('Bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk upload failed',
      error: error.message
    });
  }
});

// Get next available roll number for a section
router.get('/next-roll-number/:section', async (req, res) => {
  try {
    const { section } = req.params;

    if (!section) {
      return res.status(400).json({
        success: false,
        message: 'Section is required'
      });
    }

    // Find the highest roll number in this section
    const lastStudent = await Student.findOne({ section })
      .sort({ rollNumber: -1 })
      .select('rollNumber')
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
      success: true,
      data: {
        section,
        nextRollNumber,
      },
    });
  } catch (error) {
    logger.error('Error generating next roll number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate roll number',
      error: error.message
    });
  }
});

// Get all students with dynamic MongoDB queries
router.get('/', async (req, res) => {
  try {
    const { search, class: classFilter, riskLevel, page = 1, limit = 50 } = req.query;
    
    // Build dynamic query
    let query = { isActive: { $ne: false } }; // Include documents where isActive is true or undefined
    
    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Class filter
    if (classFilter && classFilter !== 'All') {
      query.section = classFilter; // Using section field for class filtering
    }
    
    // Risk level filter
    if (riskLevel && riskLevel !== 'All Risks') {
      query.riskLevel = riskLevel;
    }

    // Debug logging
    logger.info(`Query: ${JSON.stringify(query)}`);

    // Execute query with pagination
    const students = await Student.find(query)
      .select('firstName lastName rollNumber section attendancePercentage overallPercentage riskLevel riskScore email phone status photo')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count for pagination
    const total = await Student.countDocuments(query);
    
    logger.info(`Found ${students.length} students matching query, total: ${total}`);

    // Transform data to match frontend expectations
    const transformedStudents = students.map(student => ({
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      rollNumber: student.rollNumber,
      class: student.section,
      attendance: student.attendancePercentage || 100,
      academicScore: student.overallPercentage || 0,
      riskLevel: student.riskLevel,
      riskScore: student.riskScore || 0,
      email: student.email,
      phone: student.phone,
      status: student.status,
      photo: student.photo
    }));

    res.json({
      success: true,
      data: {
        students: transformedStudents,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// Get student by ID
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Transform data to match frontend expectations
    const attendanceValue = student.attendancePercentage || 100;
    const academicValue = student.overallPercentage || 0;
    
    const transformedStudent = {
      id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      middleName: student.middleName || '',
      rollNumber: student.rollNumber,
      class: student.section,
      section: student.section,
      // Include both field name formats for compatibility
      attendance: attendanceValue,
      attendancePercentage: attendanceValue,
      academicScore: academicValue,
      overallPercentage: academicValue,
      riskLevel: student.riskLevel,
      riskScore: student.riskScore || 0,
      email: student.email,
      phone: student.phone,
      status: student.status,
      photo: student.photo,
      // Include additional details for detailed view
      dateOfBirth: student.dateOfBirth,
      dateOfAdmission: student.dateOfAdmission,
      gender: student.gender,
      bloodGroup: student.bloodGroup,
      address: student.address,
      father: student.father,
      mother: student.mother,
      guardian: student.guardian,
      previousSchool: student.previousSchool,
      siblings: student.siblings,
      familyIncomeLevel: student.familyIncomeLevel,
      distanceFromSchool: student.distanceFromSchool,
      transportationMode: student.transportationMode,
      hasHealthIssues: student.hasHealthIssues,
      healthDetails: student.healthDetails,
      hasBehavioralIssues: student.hasBehavioralIssues,
      behavioralDetails: student.behavioralDetails,
      hasFamilyProblems: student.hasFamilyProblems,
      familyProblemDetails: student.familyProblemDetails,
      hasEconomicDistress: student.hasEconomicDistress,
      economicDistressDetails: student.economicDistressDetails,
      previousDropoutAttempts: student.previousDropoutAttempts,
      academicTrend: student.academicTrend,
      failedSubjectsCount: student.failedSubjectsCount,
      totalDaysPresent: student.totalDaysPresent || 0,
      totalDaysAbsent: student.totalDaysAbsent || 0,
      consecutiveAbsences: student.consecutiveAbsences || 0,
      lateComingCount: student.lateComingCount || 0,
      admissionNumber: student.admissionNumber
    };

    res.json({
      success: true,
      data: transformedStudent
    });
  } catch (error) {
    logger.error('Error fetching student:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student',
      error: error.message
    });
  }
});

// Create new student with MongoDB
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, rollNumber, class: studentClass, section, email, phone, dateOfBirth, gender, address, father, mother, attendance, academicScore, createParentAccount, photo } = req.body;
    
    logger.info(`Creating student: ${firstName} ${lastName} (${rollNumber})`);
    
    // Validate required fields
    if (!firstName || !lastName || !rollNumber) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and roll number are required'
      });
    }

    // Check if roll number already exists
    const rollNumberUpper = rollNumber.toString().toUpperCase().trim();
    const existingStudent = await Student.findOne({ rollNumber: rollNumberUpper });
    if (existingStudent) {
      logger.warn(`Duplicate roll number: ${rollNumber}`);
      return res.status(400).json({
        success: false,
        message: 'Roll number already exists'
      });
    }

    // Create new student with comprehensive data
    const sectionName = (section || studentClass || '10A').toString().toUpperCase(); // Default section
    const attendancePercentage = attendance !== undefined ? Number(attendance) : 100;
    const overallPercentage = academicScore !== undefined ? Number(academicScore) : 0;
    
    // Calculate risk level based on attendance and academic score
    let riskScore = 0;
    let riskLevel = 'Low';
    
    if (attendancePercentage < 70 || overallPercentage < 50) {
      riskScore = Math.max(100 - attendancePercentage, 100 - overallPercentage);
      if (riskScore >= 80) riskLevel = 'Critical';
      else if (riskScore >= 60) riskLevel = 'High';
      else if (riskScore >= 40) riskLevel = 'Medium';
      else riskLevel = 'Low';
    }
    
    // Handle address - ensure required fields are present
    const studentAddress = {
      city: address?.city || 'Unknown',
      state: address?.state || 'Unknown',
      pincode: address?.pincode || '000000',
      street: address?.street || ''
    };

    // Handle father data - ensure required fields
    const fatherData = {
      name: father?.name || 'Father Name',
      phone: father?.phone || phone || '0000000000',
      email: father?.email || email || '',
      occupation: father?.occupation || ''
    };

    // Handle mother data - ensure required fields
    const motherData = {
      name: mother?.name || 'Mother Name',
      phone: mother?.phone || phone || '0000000000',
      email: mother?.email || '',
      occupation: mother?.occupation || ''
    };
    
    const studentData = {
      firstName: firstName.toString().trim(),
      lastName: lastName.toString().trim(),
      rollNumber: rollNumberUpper,
      admissionNumber: `ADM${Date.now()}`, // Auto-generate admission number
      section: sectionName,
      email: email ? email.toLowerCase().trim() : undefined,
      phone: phone ? phone.toString().trim() : undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('2010-01-01'), // Default DOB
      gender: gender || 'Male',
      address: studentAddress,
      father: fatherData,
      mother: motherData,
      familyIncomeLevel: 'Middle Income',
      distanceFromSchool: 5,
      transportationMode: 'School Bus',
      // Photo handling - support both string (base64) and object formats
      photo: photo ? (typeof photo === 'string' ? { url: photo } : photo) : undefined,
      // Academic values with risk calculation
      attendancePercentage: attendancePercentage,
      overallPercentage: overallPercentage,
      riskScore: riskScore,
      riskLevel: riskLevel,
      status: 'Active',
      isActive: true
    };

    const newStudent = new Student(studentData);
    const savedStudent = await newStudent.save().catch((saveError) => {
      logger.error('❌ Validation error saving student:', saveError);
      // Extract validation error message
      if (saveError.name === 'ValidationError') {
        const errors = Object.values(saveError.errors).map(err => err.message);
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }
      throw saveError;
    });

    logger.info(`✅ Student saved to database: ${savedStudent.rollNumber}`);

    // *** AUTO-CREATE PARENT ACCOUNT ***
    let parentAccount = null;
    if (createParentAccount !== false && fatherData && fatherData.email) {
      try {
        // Check if parent account already exists
        const existingParent = await User.findOne({ email: fatherData.email.toLowerCase() });
        
        if (existingParent) {
          // Link student to existing parent
          if (!existingParent.children.includes(savedStudent._id)) {
            existingParent.children.push(savedStudent._id);
            await existingParent.save();
            logger.info(`✅ Student linked to existing parent: ${fatherData.email}`);
          }
          parentAccount = {
            email: existingParent.email,
            existed: true
          };
        } else {
          // Create new parent account
          // Password: FirstName2025 (e.g., John2025)
          const parentPassword = `${firstName}2025`;
          
          const newParentData = {
            firstName: fatherData.name.split(' ')[0] || 'Parent',
            lastName: fatherData.name.split(' ').slice(1).join(' ') || lastName,
            email: fatherData.email.toLowerCase(),
            phone: fatherData.phone || phone || '0000000000',
            password: parentPassword,
            role: 'parent',
            children: [savedStudent._id],
            isActive: true,
            notificationPreferences: {
              email: true,
              sms: true,
              inApp: true
            }
          };

          const newParent = new User(newParentData);
          await newParent.save();
          
          logger.info(`✅ Parent account created: ${fatherData.email} with password: ${parentPassword}`);
          
          parentAccount = {
            email: fatherData.email,
            password: parentPassword,
            existed: false
          };

          // Send welcome email to parent
          try {
            const { sendEmail } = await import('../services/emailService.js');
            await sendEmail({
              to: fatherData.email,
              subject: 'Parent Account Created - Student Dropout Prevention System',
              html: `
                <h2>Welcome to Student Dropout Prevention System</h2>
                <p>Dear ${fatherData.name},</p>
                <p>A parent account has been created for you to monitor your child's progress.</p>
                <p><strong>Login Credentials:</strong></p>
                <p>Email: ${fatherData.email}</p>
                <p>Password: ${parentPassword}</p>
                <p><strong>Student:</strong> ${firstName} ${lastName} (${rollNumber})</p>
                <p>Please login at: <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
                <p>We recommend changing your password after first login.</p>
              `,
              text: `Welcome! Your login: ${fatherData.email} / ${parentPassword}`
            });
            logger.info(`✅ Welcome email sent to parent: ${fatherData.email}`);
          } catch (emailError) {
            logger.error('❌ Failed to send welcome email:', emailError);
          }
        }
      } catch (parentError) {
        logger.error('❌ Error creating parent account:', parentError);
        // Don't fail student creation if parent creation fails
      }
    }

    // Transform response to match frontend expectations
    const transformedStudent = {
      id: savedStudent._id,
      firstName: savedStudent.firstName,
      lastName: savedStudent.lastName,
      rollNumber: savedStudent.rollNumber,
      class: savedStudent.section,
      attendance: savedStudent.attendancePercentage,
      academicScore: savedStudent.overallPercentage,
      riskLevel: savedStudent.riskLevel,
      riskScore: savedStudent.riskScore,
      email: savedStudent.email,
      phone: savedStudent.phone,
      status: savedStudent.status,
      photo: savedStudent.photo
    };

    // *** SEND RISK ALERT TO PARENTS ***
    if (['Medium', 'High', 'Critical'].includes(savedStudent.riskLevel)) {
      try {
        await sendRiskAlertToParents(savedStudent);
        logger.info(`✅ Risk alert sent for new student: ${savedStudent.rollNumber}`);
      } catch (alertError) {
        logger.error('❌ Failed to send risk alert:', alertError);
        // Don't fail student creation if alert fails
      }
    }

    // *** CRITICAL: Emit socket event for real-time updates ***
    try {
      const io = getIO();
      if (io) {
        logger.info(`📡 Emitting socket event: student:created for ${savedStudent.rollNumber}`);
        io.emit('student:created', transformedStudent);
        logger.info(`✅ Socket event emitted successfully`);
      } else {
        logger.warn('⚠️ Socket.io instance not available - real-time update skipped');
      }
    } catch (socketError) {
      logger.error('❌ Socket emission error:', socketError);
      // Don't fail the request if socket fails
    }

    // Send response
    res.status(201).json({
      success: true,
      message: parentAccount ? 
        `Student created successfully. Parent account ${parentAccount.existed ? 'linked' : 'created'} with email: ${parentAccount.email}` :
        'Student created successfully',
      data: transformedStudent,
      parentAccount: parentAccount
    });

    logger.info(`✅ Response sent for student: ${savedStudent.rollNumber}`);
    
  } catch (error) {
    logger.error('❌ Error creating student:', error);
    logger.error('Error details:', error.stack);
    
    // Return more specific error messages
    const statusCode = error.name === 'ValidationError' || error.message.includes('Validation') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create student',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update student
router.put('/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const updateData = { ...req.body };
    
    logger.info(`🔄 Update request received for student: ${studentId}`);
    logger.info(`📦 Update data keys:`, Object.keys(updateData));
    logger.info(`📦 Update data (without photo):`, { ...updateData, photo: updateData.photo ? '[BASE64 IMAGE]' : undefined });
    
    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData._id;
    
    // Handle class/section mapping - use class value for section field
    if (updateData.class !== undefined && updateData.class) {
      updateData.section = updateData.class.toString().toUpperCase();
      delete updateData.class; // Remove class field as it's an ObjectId reference in the model
    }
    
    // Handle photo update if present - only update if photo field is explicitly provided
    if (updateData.photo !== undefined) {
      // If photo is a string (base64), convert to object format
      if (typeof updateData.photo === 'string' && updateData.photo && updateData.photo.trim()) {
        updateData.photo = { url: updateData.photo.trim() };
        logger.info(`📸 Photo will be updated (base64 string)`);
      } else if (!updateData.photo) {
        // If photo is empty/null, don't update it (keep existing)
        delete updateData.photo;
        logger.info(`📸 Photo will not be updated (keeping existing)`);
      }
    } else {
      logger.info(`📸 Photo not included in update (keeping existing)`);
    }
    
    // Handle attendance and academic score updates with risk recalculation
    if (updateData.attendance !== undefined) {
      updateData.attendancePercentage = Number(updateData.attendance);
      delete updateData.attendance;
    }
    if (updateData.academicScore !== undefined) {
      updateData.overallPercentage = Number(updateData.academicScore);
      delete updateData.academicScore;
    }
    
    // Always recalculate risk when updating student data
    const currentStudent = await Student.findById(studentId);
    if (!currentStudent) {
      logger.error(`❌ Student not found: ${studentId}`);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Get current or updated values
    const attendance = updateData.attendancePercentage !== undefined ? updateData.attendancePercentage : (currentStudent.attendancePercentage || 100);
    const academic = updateData.overallPercentage !== undefined ? updateData.overallPercentage : (currentStudent.overallPercentage || 0);
    
    // Always recalculate risk score and level
    let riskScore = 0;
    let riskLevel = 'Low';
    
    if (attendance < 70 || academic < 50) {
      riskScore = Math.max(100 - attendance, 100 - academic);
      if (riskScore >= 80) riskLevel = 'Critical';
      else if (riskScore >= 60) riskLevel = 'High';
      else if (riskScore >= 40) riskLevel = 'Medium';
      else riskLevel = 'Low';
    }
    
    // Always update risk data
    updateData.riskScore = riskScore;
    updateData.riskLevel = riskLevel;
    
    logger.info(`📊 Risk calculated: score=${riskScore}, level=${riskLevel}`);
    logger.info(`💾 Final update data (without photo):`, { ...updateData, photo: updateData.photo ? '[BASE64 IMAGE]' : undefined });
    
    // Update student in MongoDB
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { ...updateData },
      { new: true, runValidators: true }
    ).lean();
    
    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Transform response
    const transformedStudent = {
      id: updatedStudent._id,
      firstName: updatedStudent.firstName,
      lastName: updatedStudent.lastName,
      rollNumber: updatedStudent.rollNumber,
      class: updatedStudent.section,
      attendance: updatedStudent.attendancePercentage,
      academicScore: updatedStudent.overallPercentage,
      riskLevel: updatedStudent.riskLevel,
      riskScore: updatedStudent.riskScore,
      email: updatedStudent.email,
      phone: updatedStudent.phone,
      status: updatedStudent.status,
      photo: updatedStudent.photo
    };

    logger.info(`Student updated: ${updatedStudent.rollNumber}`);

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      if (io) {
        io.emit('student:updated', transformedStudent);
        logger.info(`Socket event emitted: student:updated for ${updatedStudent.rollNumber}`);
      }
    } catch (socketError) {
      logger.error('Socket emission error:', socketError);
    }

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: transformedStudent
    });
  } catch (error) {
    logger.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message
    });
  }
});

// Delete student (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    
    logger.info(`Deleting student: ${studentId}`);
    
    // Soft delete by setting isActive to false
    const deletedStudent = await Student.findByIdAndUpdate(
      studentId,
      { 
        isActive: false, 
        status: 'Transferred',
        lastUpdatedBy: req.user?.id 
      },
      { new: true }
    ).lean();
    
    if (!deletedStudent) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    logger.info(`Student soft deleted: ${deletedStudent.rollNumber}`);

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      if (io) {
        const deletedData = {
          id: deletedStudent._id,
          rollNumber: deletedStudent.rollNumber,
          name: `${deletedStudent.firstName} ${deletedStudent.lastName}`
        };
        io.emit('student:deleted', deletedData);
        logger.info(`Socket event emitted: student:deleted for ${deletedStudent.rollNumber}`);
      }
    } catch (socketError) {
      logger.error('Socket emission error:', socketError);
    }

    res.json({
      success: true,
      message: 'Student deleted successfully',
      data: {
        id: deletedStudent._id,
        rollNumber: deletedStudent.rollNumber,
        name: `${deletedStudent.firstName} ${deletedStudent.lastName}`
      }
    });
  } catch (error) {
    logger.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message
    });
  }
});

export default router;