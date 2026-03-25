import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, Award, 
  TrendingUp, AlertTriangle, BookOpen, Users, FileText,
  Edit, Download, MessageSquare, Clock, CheckCircle, XCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsAPI } from '../services/api';
import ContactParentModal from '../components/Modals/ContactParentModal';
import EditStudentModal from '../components/Modals/EditStudentModal';
import { formatClassSection, formatPercentage, formatStudentName } from '../utils/formatters';

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  console.log('📄 StudentProfile mounted with ID:', id);

  useEffect(() => {
    if (id) {
      fetchStudentDetails();
      fetchStudentNotes();
    }
  }, [id]);

  const fetchStudentNotes = async () => {
    try {
      setLoadingNotes(true);
      const response = await studentsAPI.getObservations(id);
      console.log('📝 Notes response:', response);
      
      // Handle different response structures
      const notesData = response.data?.data?.observations || 
                       response.data?.observations || 
                       response.data?.data || 
                       [];
      
      setNotes(notesData);
    } catch (error) {
      console.error('❌ Error fetching notes:', error);
      // Don't show error toast, just log it
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching student with ID:', id);
      const response = await studentsAPI.getById(id);
      console.log('✅ Full API response:', response);
      console.log('✅ response.data:', response.data);
      console.log('✅ response.data.data:', response.data.data);
      
      // The API returns data.student, not data.data
      let studentData;
      if (response.data.data && response.data.data.student) {
        studentData = response.data.data.student;
        console.log('📝 Found student at data.data.student');
      } else if (response.data.student) {
        studentData = response.data.student;
        console.log('📝 Found student at data.student');
      } else if (response.data.data) {
        studentData = response.data.data;
        console.log('📝 Found student at data.data');
      } else {
        studentData = response.data;
        console.log('📝 Using data directly');
      }
      
      console.log('📝 Final student data:', studentData);
      console.log('📝 Attendance:', studentData?.attendancePercentage || studentData?.attendance);
      console.log('📝 Academic:', studentData?.overallPercentage || studentData?.academicScore);
      console.log('📝 Risk Score:', studentData?.riskScore);
      
      // Normalize field names to ensure consistency
      // Map attendance/academicScore to attendancePercentage/overallPercentage if needed
      if (studentData) {
        studentData.attendancePercentage = studentData.attendancePercentage ?? studentData.attendance ?? 0;
        studentData.overallPercentage = studentData.overallPercentage ?? studentData.academicScore ?? 0;
        // Also keep the original field names for backward compatibility
        studentData.attendance = studentData.attendancePercentage;
        studentData.academicScore = studentData.overallPercentage;
      }
      
      setStudent(studentData);
    } catch (error) {
      console.error('❌ Error fetching student:', error);
      toast.error('Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Student Not Found</h2>
          <button onClick={() => navigate('/students')} className="btn-primary">
            Back to Students
          </button>
        </div>
      </div>
    );
  }

  const getRiskColor = (level) => {
    const colors = {
      Low: 'bg-green-100 text-green-800 border-green-200',
      Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      High: 'bg-orange-100 text-orange-800 border-orange-200',
      Critical: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[level] || colors.Low;
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'academic', label: 'Academic', icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'family', label: 'Family', icon: Users },
    { id: 'risk', label: 'Risk Analysis', icon: AlertTriangle },
    { id: 'notes', label: 'Notes & Documents', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/students')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-4">
                {student.photo?.url ? (
                  <img
                    src={student.photo.url}
                    alt={`${student.firstName} ${student.lastName}`}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {student.firstName[0]}{student.lastName[0]}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {student.firstName} {student.middleName} {student.lastName}
                  </h1>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-gray-600">Roll: {student.rollNumber}</span>
                    <span className="text-sm text-gray-600">{formatClassSection(student.section)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(student.riskLevel)}`}>
                      {student.riskLevel} Risk
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => {
                    const parentEmail = student.father?.email || student.mother?.email;
                    if (parentEmail) {
                      const subject = `Regarding ${student.firstName} ${student.lastName} - ${student.rollNumber}`;
                      const body = `Dear Parent,

I am writing to you regarding your child ${formatStudentName(student)} (Roll Number: ${student.rollNumber}, ${formatClassSection(student.section)}).

Current Status:
- Attendance: ${student.attendancePercentage || student.attendance || 0}%
- Academic Score: ${student.overallPercentage || student.academicScore || 0}%
- Risk Level: ${student.riskLevel}



Best regards,`;

                      // Try to open Gmail compose in new tab
                      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(parentEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      
                      // Open in new tab
                      window.open(gmailUrl, '_blank');
                      
                      toast.success('Opening Gmail compose window...');
                    } else {
                      toast.error('Parent email not available');
                    }
                  }}
                  className="btn-outline flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Email Parent
                </button>
              </div>
              <button 
                onClick={() => setShowContactModal(true)}
                className="btn-outline flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Send SMS/Report
              </button>
              <button className="btn-outline flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download Report
              </button>
              <button 
                onClick={() => setShowEditModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 font-medium'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab student={student} />}
        {activeTab === 'academic' && <AcademicTab student={student} />}
        {activeTab === 'attendance' && <AttendanceTab student={student} />}
        {activeTab === 'family' && <FamilyTab student={student} />}
        {activeTab === 'risk' && <RiskTab student={student} />}
        {activeTab === 'notes' && (
          <NotesTab 
            student={student} 
            notes={notes}
            loadingNotes={loadingNotes}
            onAddNote={() => setShowAddNoteModal(true)}
            onRefresh={fetchStudentNotes}
          />
        )}
      </div>

      {/* Contact Parent Modal */}
      <ContactParentModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        student={student}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        student={student ? { ...student, id: student._id } : null}
        onSubmit={async (studentId, updateData) => {
          await studentsAPI.update(studentId, updateData);
          // Refresh student data after update
          await fetchStudentDetails();
        }}
      />

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <AddNoteModal
          isOpen={showAddNoteModal}
          onClose={() => setShowAddNoteModal(false)}
          student={student}
          onSubmit={async (noteData) => {
            try {
              await studentsAPI.createObservation({
                studentId: student._id,
                ...noteData
              });
              toast.success('Note added successfully!');
              setShowAddNoteModal(false);
              await fetchStudentNotes();
            } catch (error) {
              console.error('Error adding note:', error);
              toast.error(error.response?.data?.message || 'Failed to add note');
              throw error;
            }
          }}
        />
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ student }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Quick Stats */}
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="Attendance"
          value={formatPercentage(student.attendancePercentage)}
          color="blue"
        />
        <StatCard
          icon={Award}
          label="Academic Score"
          value={formatPercentage(student.overallPercentage)}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Risk Score"
          value={formatPercentage(student.riskScore)}
          color="orange"
        />
        <StatCard
          icon={Clock}
          label="Days Present"
          value={student.totalDaysPresent || 0}
          color="purple"
        />
      </div>

      {/* Personal Information */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem icon={User} label="Full Name" value={`${student.firstName} ${student.middleName || ''} ${student.lastName}`} />
          <InfoItem icon={Calendar} label="Date of Birth" value={new Date(student.dateOfBirth).toLocaleDateString()} />
          <InfoItem icon={User} label="Gender" value={student.gender} />
          <InfoItem icon={User} label="Blood Group" value={student.bloodGroup || 'N/A'} />
          <InfoItem icon={Mail} label="Email" value={student.email || 'N/A'} />
          <InfoItem icon={Phone} label="Phone" value={student.phone || 'N/A'} />
          <InfoItem icon={MapPin} label="Address" value={`${student.address?.street}, ${student.address?.city}`} />
          <InfoItem icon={MapPin} label="State & PIN" value={`${student.address?.state} - ${student.address?.pincode}`} />
        </div>
      </div>

      {/* Academic Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Summary</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Overall Performance</span>
              <span className="font-medium text-gray-900">{formatPercentage(student.overallPercentage)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${student.overallPercentage || 0}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Attendance</span>
              <span className="font-medium text-gray-900">{formatPercentage(student.attendancePercentage)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${student.attendancePercentage || 0}%` }}
              ></div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Academic Trend</span>
              <span className="text-sm font-medium text-gray-900">{student.academicTrend || 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Failed Subjects</span>
              <span className="text-sm font-medium text-gray-900">{student.failedSubjectsCount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admission Details */}
      <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Admission Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoItem label="Admission Number" value={student.admissionNumber} />
          <InfoItem label="Roll Number" value={student.rollNumber} />
          <InfoItem label="Class/Section" value={formatClassSection(student.section)} />
          <InfoItem label="Date of Admission" value={new Date(student.dateOfAdmission).toLocaleDateString()} />
        </div>
      </div>
    </div>
  );
};

// Academic Tab Component
const AcademicTab = ({ student }) => {
  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{formatPercentage(student.overallPercentage)}</div>
            <div className="text-sm text-gray-600 mt-1">Overall Score</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{student.academicTrend || 'Unknown'}</div>
            <div className="text-sm text-gray-600 mt-1">Academic Trend</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-3xl font-bold text-orange-600">{student.failedSubjectsCount || 0}</div>
            <div className="text-sm text-gray-600 mt-1">Failed Subjects</div>
          </div>
        </div>
      </div>

      {/* Previous School */}
      {student.previousSchool?.name && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous School</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoItem label="School Name" value={student.previousSchool.name} />
            <InfoItem label="Last Class" value={student.previousSchool.lastClass || 'N/A'} />
            <InfoItem label="Address" value={student.previousSchool.address || 'N/A'} />
          </div>
        </div>
      )}

      {/* Subject-wise Performance (Placeholder) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject-wise Performance</h3>
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Subject-wise marks will be displayed here</p>
        </div>
      </div>
    </div>
  );
};

// Attendance Tab Component
const AttendanceTab = ({ student }) => {
  return (
    <div className="space-y-6">
      {/* Attendance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-bold text-blue-600">{formatPercentage(student.attendancePercentage)}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Days Present</p>
              <p className="text-2xl font-bold text-green-600">{student.totalDaysPresent || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Days Absent</p>
              <p className="text-2xl font-bold text-red-600">{student.totalDaysAbsent || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Consecutive Absences</p>
              <p className="text-2xl font-bold text-orange-600">{student.consecutiveAbsences || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Attendance Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Late Coming Count" value={student.lateComingCount || 0} />
          <InfoItem label="Transportation Mode" value={student.transportationMode} />
          <InfoItem label="Distance from School" value={`${student.distanceFromSchool} km`} />
        </div>
      </div>

      {/* Attendance Calendar (Placeholder) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Calendar</h3>
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Monthly attendance calendar will be displayed here</p>
        </div>
      </div>
    </div>
  );
};

// Family Tab Component
const FamilyTab = ({ student }) => {
  return (
    <div className="space-y-6">
      {/* Father Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Father's Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem icon={User} label="Name" value={student.father?.name || 'N/A'} />
          <InfoItem icon={Phone} label="Phone" value={student.father?.phone || 'N/A'} />
          <InfoItem icon={Mail} label="Email" value={student.father?.email || 'N/A'} />
          <InfoItem icon={User} label="Occupation" value={student.father?.occupation || 'N/A'} />
          <InfoItem label="Education" value={student.father?.education || 'N/A'} />
          <InfoItem label="Income" value={student.father?.income ? `₹${student.father.income}` : 'N/A'} />
        </div>
      </div>

      {/* Mother Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Mother's Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem icon={User} label="Name" value={student.mother?.name || 'N/A'} />
          <InfoItem icon={Phone} label="Phone" value={student.mother?.phone || 'N/A'} />
          <InfoItem icon={Mail} label="Email" value={student.mother?.email || 'N/A'} />
          <InfoItem icon={User} label="Occupation" value={student.mother?.occupation || 'N/A'} />
          <InfoItem label="Education" value={student.mother?.education || 'N/A'} />
          <InfoItem label="Income" value={student.mother?.income ? `₹${student.mother.income}` : 'N/A'} />
        </div>
      </div>

      {/* Guardian Information */}
      {student.guardian?.name && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Guardian's Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem icon={User} label="Name" value={student.guardian.name} />
            <InfoItem icon={Phone} label="Phone" value={student.guardian.phone || 'N/A'} />
            <InfoItem icon={Mail} label="Email" value={student.guardian.email || 'N/A'} />
            <InfoItem label="Relation" value={student.guardian.relation || 'N/A'} />
          </div>
        </div>
      )}

      {/* Family Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Family Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoItem label="Family Income Level" value={student.familyIncomeLevel} />
          <InfoItem label="Total Siblings" value={student.siblings?.count || 0} />
          <InfoItem label="Siblings in School" value={student.siblings?.inSchool || 0} />
        </div>
      </div>
    </div>
  );
};

// Risk Tab Component
const RiskTab = ({ student }) => {
  const getRiskColor = (level) => {
    const colors = {
      Low: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
      Medium: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
      High: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
      Critical: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' }
    };
    return colors[level] || colors.Low;
  };

  const riskColors = getRiskColor(student.riskLevel);

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className={`rounded-lg shadow-sm border p-6 ${riskColors.bg} ${riskColors.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-2xl font-bold ${riskColors.text}`}>{student.riskLevel} Risk</h3>
            <p className="text-gray-600 mt-1">Risk Score: {formatPercentage(student.riskScore)}</p>
          </div>
          <AlertTriangle className={`w-12 h-12 ${riskColors.text}`} />
        </div>
      </div>

      {/* Risk Factors */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Factors</h3>
        <div className="space-y-4">
          <RiskFactorItem
            label="Health Issues"
            value={student.hasHealthIssues}
            details={student.healthDetails}
          />
          <RiskFactorItem
            label="Behavioral Issues"
            value={student.hasBehavioralIssues}
            details={student.behavioralDetails}
          />
          <RiskFactorItem
            label="Family Problems"
            value={student.hasFamilyProblems}
            details={student.familyProblemDetails}
          />
          <RiskFactorItem
            label="Economic Distress"
            value={student.hasEconomicDistress}
            details={student.economicDistressDetails}
          />
        </div>
      </div>

      {/* Additional Risk Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem label="Previous Dropout Attempts" value={student.previousDropoutAttempts || 0} />
          <InfoItem label="Distance from School" value={`${student.distanceFromSchool} km`} />
          <InfoItem label="Transportation Mode" value={student.transportationMode} />
          <InfoItem label="Family Income Level" value={student.familyIncomeLevel} />
        </div>
      </div>
    </div>
  );
};

// Notes Tab Component
const NotesTab = ({ student, notes, loadingNotes, onAddNote, onRefresh }) => {
  return (
    <div className="space-y-6">
      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Teacher Notes & Observations</h3>
          <button onClick={onAddNote} className="btn-primary flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Add Note
          </button>
        </div>
        
        {loadingNotes ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading notes...</p>
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{note.title}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        note.observationType === 'Behavioral' ? 'bg-purple-100 text-purple-800' :
                        note.observationType === 'Academic' ? 'bg-blue-100 text-blue-800' :
                        note.observationType === 'Health' ? 'bg-red-100 text-red-800' :
                        note.observationType === 'Engagement' ? 'bg-green-100 text-green-800' :
                        note.observationType === 'Social' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {note.observationType}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        note.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                        note.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                        note.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {note.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{note.description}</p>
                    {note.actionTaken && (
                      <div className="mt-2 p-2 bg-blue-50 rounded">
                        <p className="text-xs text-gray-600 font-medium">Action Taken:</p>
                        <p className="text-sm text-gray-700">{note.actionTaken}</p>
                      </div>
                    )}
                    {note.followUpRequired && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-orange-600">
                        <Clock className="w-4 h-4" />
                        Follow-up required {note.followUpDate ? `by ${new Date(note.followUpDate).toLocaleDateString()}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <User className="w-4 h-4" />
                    <span>{note.teacher?.firstName} {note.teacher?.lastName}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(note.createdAt).toLocaleDateString()} at {new Date(note.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No notes available yet</p>
            <button onClick={onAddNote} className="btn-primary mt-4">Add First Note</button>
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No documents uploaded yet</p>
          <button className="btn-primary mt-4">Upload Document</button>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value }) => {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="w-5 h-5 text-gray-400 mt-0.5" />}
      <div className="flex-1">
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
};

const RiskFactorItem = ({ label, value, details }) => {
  return (
    <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900">{label}</p>
          {value ? (
            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Yes</span>
          ) : (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">No</span>
          )}
        </div>
        {value && details && (
          <p className="text-sm text-gray-600 mt-2">{details}</p>
        )}
      </div>
    </div>
  );
};

// Add Note Modal Component
const AddNoteModal = ({ isOpen, onClose, student, onSubmit }) => {
  const [formData, setFormData] = useState({
    observationType: 'General',
    severity: 'Medium',
    title: '',
    description: '',
    actionTaken: '',
    followUpRequired: false,
    followUpDate: '',
    followUpNotes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in title and description');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        observationType: 'General',
        severity: 'Medium',
        title: '',
        description: '',
        actionTaken: '',
        followUpRequired: false,
        followUpDate: '',
        followUpNotes: ''
      });
    } catch (error) {
      // Error is handled in parent
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">
            Add Note for {student?.firstName} {student?.lastName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observation Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.observationType}
                onChange={(e) => setFormData({ ...formData, observationType: e.target.value })}
                className="input"
                required
              >
                <option value="General">General</option>
                <option value="Behavioral">Behavioral</option>
                <option value="Academic">Academic</option>
                <option value="Health">Health</option>
                <option value="Engagement">Engagement</option>
                <option value="Social">Social</option>
                <option value="Attendance">Attendance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="input"
                required
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
              placeholder="Brief title for the observation"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input min-h-[100px]"
              placeholder="Detailed description of the observation"
              maxLength={1000}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length}/1000 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action Taken (Optional)
            </label>
            <textarea
              value={formData.actionTaken}
              onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
              className="input min-h-[80px]"
              placeholder="What action was taken regarding this observation?"
              maxLength={500}
            />
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="followUpRequired"
                checked={formData.followUpRequired}
                onChange={(e) => setFormData({ ...formData, followUpRequired: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="followUpRequired" className="text-sm font-medium text-gray-700">
                Follow-up Required
              </label>
            </div>

            {formData.followUpRequired && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="input"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Follow-up Notes
                  </label>
                  <input
                    type="text"
                    value={formData.followUpNotes}
                    onChange={(e) => setFormData({ ...formData, followUpNotes: e.target.value })}
                    className="input"
                    placeholder="Notes for follow-up"
                    maxLength={500}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentProfile;
